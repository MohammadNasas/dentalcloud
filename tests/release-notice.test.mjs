import test from 'node:test'
import assert from 'node:assert/strict'
import { createReleaseNoticeGate, RELEASE_NOTICE_KEY } from '../src/lib/releaseNotice.js'

function fixture() {
  const user = { id:'doctor-a', user_metadata:{ display_name:'Doctor' } }
  let reads = 0, writes = 0, fail = false
  const auth = {
    async getUser() { reads++; return {data:{user:structuredClone(user)}} },
    async updateUser(patch) { writes++; if(fail) return {error:new Error('offline')}; Object.assign(user.user_metadata,patch.data); return {data:{user:structuredClone(user)}} },
  }
  return { user, auth, counts:()=>({reads,writes}), fail:value=>{fail=value} }
}
test('first account visit displays once; another device reads server marker',async()=>{
  const f=fixture(), first=createReleaseNoticeGate(f.auth)
  assert.equal(await first('doctor-a'),true)
  assert.equal(await first('doctor-a'),false)
  assert.equal(await createReleaseNoticeGate(f.auth)('doctor-a'),false)
  assert.equal(f.counts().writes,1)
  assert.equal(f.user.user_metadata.display_name,'Doctor')
})
test('concurrent checks in one runtime only open one notice',async()=>{
  const f=fixture(), gate=createReleaseNoticeGate(f.auth)
  assert.deepEqual(await Promise.all([gate('doctor-a'),gate('doctor-a')]),[true,false])
  assert.equal(f.counts().writes,1)
})
test('failed sync defers display and allows a later retry',async()=>{
  const f=fixture(), gate=createReleaseNoticeGate(f.auth)
  f.fail(true); assert.equal(await gate('doctor-a'),false)
  f.fail(false); assert.equal(await gate('doctor-a'),true)
})
test('wrong account and cancelled check never update metadata',async()=>{
  const f=fixture(), gate=createReleaseNoticeGate(f.auth)
  assert.equal(await gate('doctor-b'),false)
  assert.equal(await gate('doctor-a',()=>false),false)
  assert.equal(f.counts().writes,0)
})
test('cache is account-scoped and blocked storage does not break notice',async()=>{
  const f=fixture(), memory=new Map()
  const storage={getItem:key=>memory.get(key),setItem:(key,v)=>memory.set(key,v)}
  assert.equal(await createReleaseNoticeGate(f.auth,storage)('doctor-a'),true)
  assert.equal(memory.get(`${RELEASE_NOTICE_KEY}:doctor-a`),'1')
  const reads=f.counts().reads
  assert.equal(await createReleaseNoticeGate(f.auth,storage)('doctor-a'),false)
  assert.equal(f.counts().reads,reads)
  f.user.id='doctor-b'; delete f.user.user_metadata[RELEASE_NOTICE_KEY]
  assert.equal(await createReleaseNoticeGate(f.auth,{getItem(){throw Error()},setItem(){throw Error()}})('doctor-b'),true)
})
test('unconfirmed server response is not treated as seen',async()=>{
  const auth={ getUser:async()=>({data:{user:{id:'a'}}}),updateUser:async()=>({data:{user:{id:'a'}}}) }
  assert.equal(await createReleaseNoticeGate(auth)('a'),false)
})
