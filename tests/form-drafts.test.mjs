import test from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { encryptedDraftStore, clearDraftScope, draftScope } from '../src/lib/draftStorage.js'
import { createDraftSession } from '../src/lib/draftSession.js'

test('draft survives reopen, requires explicit restore, and keeps operation ID', async () => {
  const scope = draftScope('doctor-a','clinic-a')
  const storage = encryptedDraftStore(scope,'payment:patient-a')
  const first = createDraftSession({ id:'operation-1',note:'',amount:'' },storage)
  await first.ready
  first.set({id:'operation-1',note:'Synthetic clinical note',amount:'35'})
  await first.flush()
  const reopened = createDraftSession({id:'operation-2',note:'',amount:''},storage)
  await reopened.ready
  assert.equal(reopened.value.note,'')
  assert.equal(reopened.pending.note,'Synthetic clinical note')
  reopened.set({id:'wrong'})
  assert.equal(reopened.value.id,'operation-2')
  reopened.restore()
  assert.equal(reopened.value.id,'operation-1')
  assert.equal(reopened.value.amount,'35')
  await reopened.clear()
  const saved = createDraftSession({id:'operation-3',note:'',amount:''},storage)
  await saved.ready
  assert.equal(saved.pending,null)
})

test('drafts isolated by doctor, clinic, patient and form; sign-out removes scope', async () => {
  const scope = draftScope('doctor-b','clinic-a')
  const own = encryptedDraftStore(scope,'treatment:patient-a')
  await own.write({version:1,value:{notes:'Synthetic private note'}})
  for (const [user,clinic,form] of [
    ['doctor-c','clinic-a','treatment:patient-a'],['doctor-b','clinic-b','treatment:patient-a'],
    ['doctor-b','clinic-a','treatment:patient-b'],['doctor-b','clinic-a','payment:patient-a'],
  ]) assert.equal(await encryptedDraftStore(draftScope(user,clinic),form).read(),null)
  await clearDraftScope(scope)
  await own.write({version:1,value:{notes:'late save after logout'}})
  assert.equal(await encryptedDraftStore(scope,'treatment:patient-a').read(),null)
})

test('rapid saves followed by discard cannot resurrect an old draft', async () => {
  const storage=encryptedDraftStore(draftScope('doctor-d','clinic-a'),'patient:new')
  const session=createDraftSession({name:''},storage)
  await session.ready
  session.set({name:'First'}); session.set({name:'Latest'}); session.discard()
  await session.flush()
  assert.equal(await storage.read(),null)
  session.set({name:'Next'})
  await session.flush()
  assert.equal((await storage.read()).value.name,'Next')
})

test('save failure retains draft and reports storage failure without claiming success', async () => {
  const storage={read:async()=>null,write:async()=>{throw Error('quota')},remove:async()=>{}}
  const session=createDraftSession({notes:''},storage)
  await session.ready
  session.set({notes:'Keep me'})
  await session.flush()
  assert.equal(session.value.notes,'Keep me')
  assert.equal(session.dirty,true)
  assert.equal(session.status,'error')
})

test('IndexedDB stores encrypted bytes and nonextractable keys, not clinical text', async () => {
  const scope=draftScope('doctor-e','clinic-a')
  await encryptedDraftStore(scope,'consent:patient-a').write({version:1,value:{plan:'UNIQUE_SYNTHETIC_PLAN'}})
  const db=await new Promise((resolve,reject)=>{ const r=indexedDB.open('dentalcloud.drafts.v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error) })
  const read=(store,key)=>new Promise((resolve,reject)=>{ const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error) })
  const record=await read('drafts',scope+':consent:patient-a')
  const key=await read('keys',scope)
  assert.equal(key.extractable,false)
  assert.ok(record.ciphertext instanceof ArrayBuffer)
  assert.equal(new TextDecoder().decode(record.ciphertext).includes('UNIQUE_SYNTHETIC_PLAN'),false)
  db.close()
})
