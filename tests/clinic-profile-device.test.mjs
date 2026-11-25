import test from 'node:test'
import assert from 'node:assert/strict'
import { listedProfiles, deviceTokenHash } from '../functions/_lib/clinicProfileAuth.js'
import { onRequestPost as enter } from '../functions/api/clinic-profile-entry.js'
import { onRequestPost as manage } from '../functions/api/clinic-profiles.js'
const cid='20000000-0000-0000-0000-000000000001', owner='10000000-0000-0000-0000-000000000001', staff='10000000-0000-0000-0000-000000000002'
const env={SUPABASE_URL:'https://project.example',SUPABASE_SERVICE_ROLE_KEY:'test-service'}
const token='a'.repeat(64), email=`${staff}@profiles.dentalcloudapp.com`
const request = (body, auth=false) => new Request('https://dentalcloudapp.com/api/clinic-profile-entry',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test.jwt'}:{})},body:JSON.stringify(body)})
const date='2026-09-01T00:00:00Z'

test('list restores only legacy profiles and creation dates, never exposes passwords or resurrects deleted profiles',()=>{
  const rows=listedProfiles([
    {id:owner,data:{name:'Owner'},created_at:date},
    {id:staff,data:{name:'Legacy',passwordHash:'private-hash',email:'old@example.invalid'},created_at:date},
    {id:'deleted',data:{name:'Deleted',profileLoginMode:'device',profileDeletedAt:date}},
    {id:'old-deleted',data:{name:'Former normal profile'}},
    {id:'disabled',data:{name:'Disabled',profileLoginMode:'device'},created_at:date},
  ],[{user_id:'disabled',active:false}],owner)
  assert.deepEqual(rows.map(p=>p.id),[owner,staff,'disabled'])
  assert.equal(rows[1].createdAt,date); assert.equal(rows[1].passwordless,true); assert.equal(rows[1].active,true)
  assert.equal(rows[1].email,null); assert.equal(rows[2].active,false)
  assert.ok(!JSON.stringify(rows).includes('private-hash'))
})

test('only an owner can issue a device grant; it includes active legacy IDs and stores only a hash',async t=>{
  let stored
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const path=String(url)
    if(path.includes('clinic_profile_context'))return Response.json({user:{id:owner,isClinicOwner:true},clinic:{id:cid}})
    if(path.includes('clinic_profiles?'))return Response.json([{user_id:'disabled',active:false},{user_id:'normal',active:true}])
    if(path.includes('doctors?'))return Response.json([
      {id:owner,data:{}}, {id:staff,data:{passwordHash:'old'},created_at:date},
      {id:'disabled',data:{profileLoginMode:'device'}}, {id:'normal',data:{email:'normal@example.invalid'}},
    ])
    if(path.endsWith('/clinic_profile_devices')){stored=JSON.parse(options.body);return Response.json([stored])}
    throw Error(path)
  })
  const response=await manage({request:request({action:'device'},true),env})
  assert.equal(response.status,200)
  const body=await response.json()
  assert.deepEqual(stored.profile_ids,[staff]);assert.equal(stored.clinic_id,cid)
  assert.equal(stored.token_hash,await deviceTokenHash(body.device.token));assert.notEqual(stored.token_hash,body.device.token)
  assert.ok(Date.parse(stored.expires_at)-Date.now()<=12*60*60*1000)
})

test('passwordless entry provisions the original ID once, preserves history and returns a single-use login token without sending email',async t=>{
  let auth=null, finished=false, created=0
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const path=String(url), body=options.body?JSON.parse(options.body):null
    if(path.includes('clinic_profile_devices?')) return Response.json([{clinic_id:cid,profile_ids:[staff],expires_at:'2099-01-01'}])
    if(path.includes('/doctors?')) return Response.json([{id:staff,data:finished?{profileLoginMode:'device'}:{passwordHash:'old'}}])
    if(path.includes('/clinics?')) return Response.json([{owner_id:owner}])
    if(path.includes('/clinic_profiles?'))return Response.json(finished?[{active:true}]:[])
    if(path.endsWith(`/auth/v1/admin/users/${staff}`))return auth?Response.json(auth):Response.json({}, {status:404})
    if(path.endsWith('/auth/v1/admin/users')){
      created++;assert.equal(body.id,staff);assert.equal(body.email,email)
      assert.ok(body.password.length>30);assert.deepEqual(body.app_metadata,{legacyClinicId:cid})
      auth={id:staff,email,app_metadata:body.app_metadata};return Response.json(auth)
    }
    if(path.includes('rpc/clinic_profile_finish_legacy')){
      assert.deepEqual(body,{p_clinic:cid,p_doctor:staff,p_email:email});finished=true;return Response.json(null)
    }
    if(path.endsWith('/auth/v1/admin/generate_link')){assert.equal(finished,true);assert.equal(body.type,'magiclink');return Response.json({hashed_token:'one-use-test-token'})}
    throw Error('Unexpected write '+path)
  })
  for(let i=0;i<2;i++){
    const response=await enter({request:request({id:staff,deviceToken:token}),env})
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,tokenHash:'one-use-test-token'})
  }
  assert.equal(created,1)
})

test('forged, expired, owner, disabled, deleted and ordinary profiles cannot use passwordless entry',async t=>{
  for(const scenario of ['missing-token','expired','not-listed','owner','disabled','deleted','ordinary','foreign-auth']){
    const mock=t.mock.method(globalThis,'fetch',async(url)=>{
      const path=String(url)
      if(path.includes('clinic_profile_devices?'))return Response.json([{clinic_id:cid,profile_ids:scenario==='not-listed'?[]:[staff],expires_at:scenario==='expired'?'2000-01-01':'2099-01-01'}])
      if(path.includes('/doctors?'))return Response.json([{id:staff,data:scenario==='ordinary'?{}:{passwordHash:'old',...(scenario==='deleted'?{profileDeletedAt:date}:{})}}])
      if(path.includes('/clinics?'))return Response.json([{owner_id:scenario==='owner'?staff:owner}])
      if(path.includes('/clinic_profiles?'))return Response.json(scenario==='disabled'?[{active:false}]:[])
      if(scenario==='foreign-auth' && path.includes('/auth/v1/admin/users/'))return Response.json({id:staff,email:'real@example.invalid',app_metadata:{}})
      throw Error('Unexpected privilege grant')
    })
    const response=await enter({request:request({id:staff,deviceToken:scenario==='missing-token'?'bad':token}),env})
    assert.ok([401,403].includes(response.status),`${scenario}: ${response.status}`)
    assert.ok(mock.mock.calls.every(({arguments:[,options]})=>options.method==='GET'))
    mock.mock.restore()
  }
})

test('legacy deletion archives without deleting the doctor or requiring a login identity',async t=>{
  let archived=false
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const path=String(url)
    if(path.includes('clinic_profile_context'))return Response.json({user:{id:owner,isClinicOwner:true},clinic:{id:cid}})
    if(path.includes('/clinic_profiles?') && options.method==='GET')return Response.json([])
    if(path.includes('/doctors?'))return Response.json([{data:{passwordHash:'old'}}])
    if(path.includes('rpc/clinic_profile_archive')){archived=true;return Response.json(null)}
    if(path.includes('/auth/v1/admin/users/')){assert.equal(archived,true);return Response.json({}, {status:404})}
    if(path.includes('/clinic_profiles?') && options.method==='DELETE')return Response.json([])
    throw Error('Unexpected historical deletion')
  })
  assert.equal((await manage({request:request({action:'delete',id:staff},true),env})).status,200)
  assert.equal(archived,true)
})
