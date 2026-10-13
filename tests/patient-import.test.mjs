import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAmount, parseImportDate, suggestMapping, analyzeRows, rowIssues, prepareImport, importPatientId, duplicateCandidates, duplicateLookup, patientBalance, groupLabeledLines, parseLabeledRecord } from '../src/lib/patientImport.js'
import { parseDelimited, readPatientImport } from '../src/lib/readPatientImport.js'
import { createCloudWrites } from '../src/lib/cloudWrites.js'

const options = { currency: 'JOD', numberFormat: 'auto', dateOrder: 'auto', allowBalances: true }
const context = { ...options, clinicId: 'clinic-1', userId: 'doctor-1', fingerprint: 'abc', fileName: 'test.csv', existing: [] }
function fixture(text) { const sheet = { name: 'Sheet1', rows: parseDelimited(text) }; const m = suggestMapping(sheet.rows); return analyzeRows(sheet,m.mapping,m.header,options) }
const approved = () => ({...fixture('name,phone,fees,paid\nTest Patient,0599000001,300,100')[0], financeMode:'opening', reviewed:true})

test('Arabic/Persian digits and labelled decimal amounts', () => {
  assert.equal(parseAmount('١٢٣٫٥٠ دينار').value,123.5)
  assert.equal(parseAmount('۱۲۳.۵۰').value,123.5)
  assert.equal(parseAmount('1,250.50','dot').value,1250.5)
  assert.equal(parseAmount('1.250,50','comma').value,1250.5)
})
test('missing payments are unknown, never zero', () => {
  assert.equal(parseAmount('').value,null)
  const row = fixture('name,cost,paid\nPatient,300,')[0]
  assert.equal(row.opening,''); assert.equal(row.financeMode,'review')
  assert.ok(rowIssues({...row, reviewed:true},options).errors.includes('financeReview'))
})
test('ambiguous amounts, formula text, negative fees and malformed separators are rejected', () => {
  for (const v of ['1,200','1.200']) assert.equal(parseAmount(v).error,'amountAmbiguous')
  for (const v of ['=1+1','12/3','-50','1,2,3','100 abc']) assert.ok(parseAmount(v).error)
  assert.equal(parseAmount('-50','dot',true).value,-50)
})
test('dates never silently swap day/month or roll invalid days', () => {
  assert.equal(parseImportDate('03/04/2025').error,'dateAmbiguous')
  assert.equal(parseImportDate('03/04/2025','dmy').value,'2025-04-03')
  assert.equal(parseImportDate('03/04/2025','mdy').value,'2025-03-04')
  assert.equal(parseImportDate('31/02/2025','dmy').error,'date')
  assert.equal(parseImportDate('2024-02-29').value,'2024-02-29')
  assert.equal(parseImportDate('٢٠٢٥-٠٤-١٦').value,'2025-04-16')
  assert.ok(parseImportDate('01/02/25').error)
})
test('CSV quoting, embedded newlines, BOM, semicolon and leading phone zero survive', () => {
  const rows = parseDelimited('\ufeffname;phone;notes\r\n"Test, Patient";0599000001;"line1\nline2, with, commas"')
  assert.deepEqual(rows[1].cells,['Test, Patient','0599000001','line1\nline2, with, commas'])
  assert.throws(()=>parseDelimited('name,notes\nA,"unfinished'),/quotes/)
})
test('header detection skips a title and supports bilingual columns', () => {
  const sheet={name:'Patients',rows:parseDelimited('عيادة تجريبية\nاسم المريض,phone,المتبقي\nمريض افتراضي,0599000001,200')}
  const m=suggestMapping(sheet.rows)
  assert.equal(m.header,1); assert.deepEqual(m.mapping,['name','phone','balance'])
  assert.equal(analyzeRows(sheet,m.mapping,m.header,options)[0].opening,'200')
})
test('headerless data requires explicit mapping; duplicate field assignments rejected', () => {
  const sheet={name:'S',rows:parseDelimited('Someone,0599000001\nAnother,0599000002')}
  assert.equal(suggestMapping(sheet.rows).header,-1)
  assert.equal(analyzeRows(sheet,['name','phone'],-1,options).length,2)
  assert.throws(()=>analyzeRows(sheet,['name','name'],-1),/duplicateMapping/)
  assert.throws(()=>analyzeRows(sheet,['','phone'],-1),/nameMapping/)
})
test('only explicit financial labels in notes are recognized, with decimals intact', () => {
  let row=fixture('name,notes\nPatient,حشوة 300 دفع 100.50')[0]
  assert.equal(row.paid,'100.50'); assert.equal(row.fees,''); assert.equal(row.opening,'')
  row=fixture('name,notes\nPatient,تكلفة العلاج 300 دفع 100')[0]
  assert.equal(row.opening,'200')
  assert.equal(fixture('name,notes\nPatient,خلع — 200')[0].financeMode,'unknown')
  assert.equal(fixture('name,notes\nPatient,دفع 100 ثم دفع 50')[0].paid,'')
  assert.equal(fixture('name,notes\nPatient,غير مدفوع 100')[0].paid,'')
})
test('conflicts are visible and original rows stay intact', () => {
  const row=fixture('name,cost,paid,balance,extra\nPatient,500,100,250,do not lose me')[0]
  assert.ok(rowIssues(row,options).warnings.includes('conflict'))
  assert.match(row.original,/do not lose me/)
  assert.ok(rowIssues(row,options).errors.includes('financeReview'))
})
test('summary rows excluded; inclusion still requires review', () => {
  const rows=fixture('name,paid\nPatient,100\nالمجموع,100')
  assert.equal(rows[1].included,false)
  assert.equal(rows[1].summary,true)
})
test('duplicate suggestions include normalized names, file IDs and international/local phone', () => {
  const row={name:'أحمد علي',phone:'+970599000001',fileNo:'F-7'}
  assert.equal(duplicateCandidates(row,[{name:'احمد علي'},{phone:'0599000001'},{fileNo:'F-7'}]).length,3)
  assert.equal(duplicateCandidates({name:'Unique',phone:'+15551234567'},[{name:'Other',phone:'+445551234567'}]).length,0)
})
test('no save until individual review and duplicate decision', async () => {
  const row=approved(); row.reviewed=false
  await assert.rejects(prepareImport([row],context),/reviewRequired/)
  row.reviewed=true
  await assert.rejects(prepareImport([row],{...context,existing:[{name:'Test Patient'}]}),/reviewRequired/)
  row.duplicateAccepted=true
  assert.equal((await prepareImport([row],{...context,existing:[{name:'Test Patient'}]})).length,1)
})
test('currency mismatch and unavailable financial plan block opening balances', () => {
  assert.ok(rowIssues({...approved(),currency:'USD'},options).errors.includes('currency'))
  assert.ok(rowIssues(approved(),{...options,allowBalances:false}).errors.includes('financialPlan'))
})
test('unknown finance imports source without manufacturing payments or fees', async () => {
  const row={...approved(),financeMode:'unknown'}
  const [patient]=await prepareImport([row],context)
  assert.equal(patient.openingBalance,null)
  assert.equal(patient.importSource.financialStatus,'unknown')
  assert.equal(patient.payments,undefined)
  assert.equal(patient.toothRecords,undefined)
})
test('confirmed balance is separate from revenue and respects credits and currency', async () => {
  const [patient]=await prepareImport([approved()],context)
  assert.equal(patient.openingBalance.amount,200)
  let b=patientBalance(patient,[{price:50}],[{amount:20}],'JOD')
  assert.deepEqual([b.fees,b.paid,b.opening,b.debt],[50,20,200,230])
  b=patientBalance({...patient,openingBalance:{amount:-100,currency:'JOD',confirmed:true}},[],[],'JOD')
  assert.equal(b.raw,-100); assert.equal(b.debt,0)
  b=patientBalance(patient,[],[],'USD'); assert.equal(b.opening,0); assert.equal(b.currencyMismatch,true)
  assert.equal(patientBalance({...patient,openingBalance:null},[],[],'JOD').unknown,true)
})
test('stable import identity survives filename changes and isolates clinics/sheets/rows', async () => {
  const id=await importPatientId('clinic-1','abc','Sheet1',2)
  assert.equal(id,await importPatientId('clinic-1','abc','Sheet1',2))
  assert.notEqual(id,await importPatientId('clinic-2','abc','Sheet1',2))
  assert.notEqual(id,await importPatientId('clinic-1','abc','Sheet2',2))
  assert.notEqual(id,await importPatientId('clinic-1','abc','Sheet1',3))
})
test('read CSV is local, produces a hash and rejects invalid encoding/files/limits', async () => {
  const a=await readPatientImport(new File(['name,phone\nExample,0599000001'],'a.csv'))
  const b=await readPatientImport(new File(['name,phone\nExample,0599000001'],'renamed.csv'))
  assert.equal(a.fingerprint,b.fingerprint)
  assert.equal(a.sheets[0].name,b.sheets[0].name)
  assert.equal(a.sheets[0].rows[1].cells[1],'0599000001')
  await assert.rejects(readPatientImport(new File(['fake'],'a.exe')),/unsupported/)
  await assert.rejects(readPatientImport(new File([new Uint8Array([0xff,0x70])],'a.csv')),/encoding/)
  await assert.rejects(readPatientImport(new File([''],'empty.csv')),/fileSize/)
})
test('cloud import uses one atomic insert, ignores conflicts and never upserts existing edits', async () => {
  const [patient]=await prepareImport([approved()],context), database=new Map()
  let fail=true,calls=0,settings
  const client={from(table){assert.equal(table,'patients');return {upsert(rows,opts){calls++;settings=opts;return {async select(){
    if(fail) return {error:new Error('offline')}
    const inserted=rows.filter(r=>!database.has(r.id)); inserted.forEach(r=>database.set(r.id,r));return {data:inserted}
  }}}}}}
  const api=createCloudWrites(client)
  await assert.rejects(api.importPatients([patient]),/offline/);assert.equal(database.size,0)
  fail=false
  assert.equal((await api.importPatients([patient])).inserted.length,1)
  database.get(patient.id).data.name='Doctor corrected name'
  assert.equal((await api.importPatients([patient])).skipped,1)
  assert.equal(database.get(patient.id).data.name,'Doctor corrected name')
  assert.deepEqual(settings,{onConflict:'id',ignoreDuplicates:true});assert.equal(calls,3)
})
test('mixed-clinic and duplicate-ID batches rejected before any network request', async () => {
  const [patient]=await prepareImport([approved()],context),api=createCloudWrites({from(){throw Error('unexpected network')}})
  await assert.rejects(api.importPatients([patient,{...patient,id:'other',clinicId:'evil'}]),/invalidBatch/)
  await assert.rejects(api.importPatients([patient,patient]),/invalidBatch/)
})
test('labelled text groups patient paragraphs and keeps unrecognized clinical notes', async () => {
  const text='اسم المريض: مثال أول\nالهاتف: 0599000001\nملاحظات: حشوة قديمة\nالتكلفة: 300\nالمدفوع: 100\n\nاسم المريض: مثال ثان؛ الهاتف: 0599000002\nملاحظة غير مفهومة 123'
  const source=await readPatientImport(new File([text],'notes.txt'))
  assert.equal(source.sheets[0].rows.length,2)
  const mapping=suggestMapping(source.sheets[0].rows)
  assert.deepEqual(mapping.mapping,['record'])
  const rows=analyzeRows(source.sheets[0],mapping.mapping,-1,options)
  assert.equal(rows[0].name,'مثال أول');assert.equal(rows[0].opening,'200')
  assert.match(rows[1].history,/غير مفهومة 123/);assert.equal(rows[1].opening,'')
})
test('repeated money labels stay ambiguous and do not sum potentially duplicate payments', () => {
  const r=parseLabeledRecord('name: Test; paid: 100; paid: 50')
  assert.equal(r.paid,'100 / 50');assert.ok(parseAmount(r.paid).error)
  const rows=groupLabeledLines(['Clinic title','name: A','details: abc','name: B'])
  assert.equal(rows.length,3);assert.equal(rows[0].cells[0],'Clinic title')
})
test('explicit and mixed source currencies cannot silently inherit clinic currency', () => {
  const foreign=fixture('name,cost,paid\nTest,300 USD,100 USD')[0]
  assert.equal(foreign.currency,'USD')
  assert.ok(rowIssues({...foreign,financeMode:'opening',reviewed:true},options).errors.includes('currency'))
  assert.equal(fixture('name,cost,paid\nTest,300 JOD,100 USD')[0].currency,'MIXED')
  assert.equal(fixture('name,balance\nTest,$200')[0].currency,'?')
})
test('indexed duplicate detection agrees with international/local suggestions', () => {
  const records=[{name:'أحمد',phone:'+970599000001'},{name:'Other',phone:'0599000002'},{name:'Third',phone:'+44599123456'}]
  const lookup=duplicateLookup(records)
  for(const row of [{name:'احمد'},{phone:'0599000001'},{phone:'+970599000002'},{phone:'+155599123456'}])
    assert.deepEqual(lookup(row),duplicateCandidates(row,records))
  assert.equal(lookup(records[0]).length,0)
})
