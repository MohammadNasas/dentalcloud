import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../functions/api/clinic-profiles.js'
const env={SUPABASE_URL:'https://project.example',SUPABASE_SERVICE_ROLE_KEY:'test-service'}
const cid='20000000-0000-0000-0000-000000000001', owner='10000000-0000-0000-0000-000000000001', staff='10000000-0000-0000-0000-000000000002'
const request = body => new Request('https://dentalcloudapp.com/api/clinic-profiles',{method:'POST',headers:{Authorization:'Bearer test.jwt','Content-Type':'application/json'},body:JSON.stringify(body)})
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
