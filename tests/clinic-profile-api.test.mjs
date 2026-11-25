import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../functions/api/clinic-profiles.js'
const env={SUPABASE_URL:'https://project.example',SUPABASE_SERVICE_ROLE_KEY:'test-service'}
const cid='20000000-0000-0000-0000-000000000001', owner='10000000-0000-0000-0000-000000000001', staff='10000000-0000-0000-0000-000000000002'
const request = body => new Request('https://dentalcloudapp.com/api/clinic-profiles',{method:'POST',headers:{Authorization:'Bearer test.jwt','Content-Type':'application/json'},body:JSON.stringify(body)})

test('profile deletion revokes existing sessions before banning login and preserves all clinical records', async t => {
  const calls = []
  let members = [{ user_id: staff, active: true }]
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = String(url), method = options.method
    const body = options.body ? JSON.parse(options.body) : null
    calls.push({ path, method, body })
    if (path.includes('clinic_profile_context')) return Response.json({ user: { id: owner, isClinicOwner: true }, clinic: { id: cid } })
    if (path.includes('clinic_profiles?') && method === 'GET') return Response.json(members)
    if (path.includes('rpc/clinic_profile_archive') && method === 'POST') {
      assert.deepEqual(body, { p_doctor: staff }); members[0].active = false
      return Response.json(members)
    }
    if (path.endsWith(`/auth/v1/admin/users/${staff}`) && method === 'GET') return Response.json({id:staff})
    if (path.endsWith(`/auth/v1/admin/users/${staff}`) && method === 'PUT') {
      assert.equal(members[0].active, false)
      assert.deepEqual(body, { ban_duration: '876000h' })
      return Response.json({ id: staff })
    }
    if (path.includes('clinic_profiles?') && method === 'DELETE') {
      assert.ok(calls.some(c => c.path.endsWith(`/auth/v1/admin/users/${staff}`)))
      members = []; return Response.json([])
    }
    if (path.includes('doctors?') && method === 'GET') return Response.json([
      { id: owner, data: { name: 'Owner' } }, { id: staff, data: { name: 'Former clinician' } },
    ])
    throw Error('Unexpected mutation of historical records')
  })
  assert.equal((await onRequestPost({ request: request({ action: 'delete', id: staff }), env })).status, 200)
  const listed = await onRequestPost({ request: request({ action: 'list' }), env })
  assert.deepEqual((await listed.json()).profiles.map(p => p.id), [owner])
  assert.equal(calls.filter(c => c.method === 'DELETE').length, 1)
  assert.ok(calls.filter(c => c.method === 'DELETE').every(c => c.path.includes('/rest/v1/clinic_profiles?')))
})

test('deletion rejects staff, foreign profiles and the owner without any mutations', async t => {
  for (const scenario of [
    { isOwner: false, id: staff, status: 403 },
    { isOwner: true, id: '10000000-0000-0000-0000-000000000099', status: 404 },
    { isOwner: true, id: owner, status: 404 },
  ]) {
    const mock = t.mock.method(globalThis, 'fetch', async url => {
      if (String(url).includes('clinic_profile_context')) return Response.json({ user: { id: owner, isClinicOwner: scenario.isOwner }, clinic: { id: cid } })
      if (String(url).includes('clinic_profiles?')) return Response.json([{ user_id: staff }, { user_id: owner }])
      if (String(url).includes('doctors?')) return Response.json([])
      throw Error('Unexpected elevated call')
    })
    const result = await onRequestPost({ request: request({ action: 'delete', id: scenario.id }), env })
    assert.equal(result.status, scenario.status)
    assert.ok(mock.mock.calls.every(({ arguments: [url, options] }) => String(url).includes('clinic_profile_context') || options.method === 'GET'))
    mock.mock.restore()
  }
})

test('failed login ban leaves the profile disabled and returns failure so deletion can be retried', async t => {
  let disabled = false, removed = false
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('clinic_profile_context')) return Response.json({ user: { id: owner, isClinicOwner: true }, clinic: { id: cid } })
    if (String(url).includes('clinic_profiles?') && options.method === 'GET') return Response.json([{ user_id: staff, active: !disabled }])
    if (String(url).includes('clinic_profile_archive')) { disabled = true; return Response.json(null) }
    if (String(url).includes('/auth/v1/admin/')) return Response.json({}, { status: 503 })
    if (options.method === 'DELETE') removed = true
    throw Error('Unexpected request')
  })
  const result = await onRequestPost({ request: request({ action: 'delete', id: staff }), env })
  assert.equal(result.status, 502)
  assert.equal(disabled, true)
  assert.equal(removed, false)
})
test('profile API rejects staff administration and foreign identities before Auth Admin calls', async t => {
  const calls=[]
  const mock=t.mock.method(globalThis,'fetch',async(url,options)=>{
    calls.push(String(url))
    if(String(url).includes('clinic_profile_context')) return Response.json({user:{id:owner,isClinicOwner:false},clinic:{id:cid}})
    throw Error('unexpected elevated call')
  })
  assert.equal((await onRequestPost({request:request({action:'create',name:'Test',password:'test-only-123'}),env})).status,403)
  assert.equal(calls.length,1)
  mock.mock.mockImplementation(async(url)=>{
    calls.push(String(url))
    if(String(url).includes('clinic_profile_context')) return Response.json({user:{id:owner,isClinicOwner:true},clinic:{id:cid}})
    if(String(url).includes('clinic_profiles?')) return Response.json([])
    throw Error('unexpected elevated call')
  })
  assert.equal((await onRequestPost({request:request({action:'password',id:staff,password:'test-only-123'}),env})).status,404)
  assert.ok(calls.every(url=>!url.includes('/auth/v1/admin/')))
})
test('provisioning creates separate credentials, stores no password and validates subscription first', async t=>{
  const calls=[]
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const body=options.body?JSON.parse(options.body):null
    calls.push({url:String(url),body})
    if(String(url).includes('clinic_profile_context')) return Response.json({user:{id:owner,isClinicOwner:true},clinic:{id:cid}})
    if(String(url).includes('clinic_profiles?')) return Response.json([])
    if(String(url).includes('clinic_profile_can_manage')) return Response.json(true)
    if(String(url).endsWith('/auth/v1/admin/users')) return Response.json({id:staff})
    if(String(url).endsWith('/rest/v1/doctors') || String(url).endsWith('/rest/v1/clinic_profiles')) return Response.json([body])
    throw Error('unexpected call')
  })
  const r=await onRequestPost({request:request({action:'create',name:'Assistant',password:'test-only-123',isOwner:true,clinicId:'forged'}),env})
  assert.equal(r.status,200)
  const auth=calls.findIndex(c=>c.url.endsWith('/auth/v1/admin/users'))
  assert.ok(calls.findIndex(c=>c.url.includes('clinic_profile_can_manage'))<auth)
  const row=calls.find(c=>c.url.endsWith('/rest/v1/doctors')).body
  assert.equal(row.clinic_id,cid); assert.equal(row.data.isOwner,false)
  assert.equal(row.data.password,undefined); assert.equal(row.data.passwordHash,undefined)
  assert.ok(!JSON.stringify(await r.json()).includes('test-only-123'))
})
