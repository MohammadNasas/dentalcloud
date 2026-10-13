// Development-only review harness. No backend, credentials or real patient data.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PatientImportModal from './components/PatientImportModal'
import { prepareImport } from './lib/patientImport'
import { readPatientImport } from './lib/readPatientImport'
import JSZip from 'jszip'

async function formatsCheck() {
  const results = [], check = (condition, label) => { if (!condition) throw Error(label); results.push(label) }
  const zip = new JSZip()
  zip.file('xl/workbook.xml','<workbook xmlns:r="rel"><sheets><sheet name="Test" r:id="rId1"/></sheets></workbook>')
  zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
  zip.file('xl/styles.xml','<styleSheet><numFmts><numFmt numFmtId="164" formatCode="0000000000"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="14"/></cellXfs></styleSheet>')
  zip.file('xl/worksheets/sheet1.xml','<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c><c r="B1" t="inlineStr"><is><t>phone</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Fictional Patient</t></is></c><c r="B2" s="1"><v>599000001</v></c><c r="C2" s="2"><v>45000</v></c><c r="D2"><f>100+100</f><v>200</v></c></row></sheetData></worksheet>')
  const xlsx=await readPatientImport(new File([await zip.generateAsync({type:'arraybuffer'})],'test.xlsx'))
  check(xlsx.sheets[0].rows[1].cells[1]==='0599000001','XLSX: leading zeros preserved')
  check(xlsx.sheets[0].rows[1].cells[2]==='2023-03-15','XLSX: Excel date converted')
  check(xlsx.sheets[0].rows[1].formulas[0]===3,'XLSX: formulas flagged, never executed')
  const doc = new JSZip()
  doc.file('word/document.xml','<w:document xmlns:w="word"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>اسم المريض</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>الهاتف</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>مريض افتراضي</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>0599000001</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
  const docx=await readPatientImport(new File([await doc.generateAsync({type:'arraybuffer'})],'test.docx'))
  check(docx.sheets[0].rows[1].cells[0]==='مريض افتراضي','DOCX: Arabic table read')
  const content='BT /F1 12 Tf 50 700 Td (name phone) Tj 0 -20 Td (Fictional Patient 0599000001) Tj ET'
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]
  let pdf='%PDF-1.4\n';const offsets=[0]
  objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`})
  const xref=pdf.length;pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  const parsed=await readPatientImport(new File([pdf],'test.pdf'))
  check(parsed.sheets[0].rows.some(r=>r.cells.join(' ').includes('Fictional')),'PDF: local worker extracted text')
  return results
}
function Preview() {
  const [open,setOpen]=useState(false),[lang,setLang]=useState('ar'),[patients,setPatients]=useState([]),[checks,setChecks]=useState(''),[busy,setBusy]=useState(false)
  async function commit(rows,options) {
    const prepared=await prepareImport(rows,{...options,clinicId:'preview-clinic',userId:'preview-doctor',existing:patients})
    const inserted=prepared.filter(p=>!patients.some(old=>old.id===p.id));setPatients([...patients,...inserted]);return {inserted,skipped:prepared.length-inserted.length}
  }
  return <main className="min-h-screen bg-ink-50 p-8" dir={lang==='ar'?'rtl':'ltr'}><div className="mx-auto max-w-5xl space-y-5"><p className="font-bold text-brand-700">DentalCloud / معاينة محلية — بيانات وهمية فقط</p><h1 className="text-3xl font-extrabold text-ink-900">نقل ملفات المرضى</h1><p className="text-ink-500">اختر ملفك، راجع المرضى، واحفظهم. هذه تجربة محلية فقط.</p><div className="flex flex-wrap gap-3"><button className="btn-primary" onClick={()=>setOpen(true)}>فتح الاستيراد</button><button className="btn-outline" onClick={()=>setLang(lang==='ar'?'en':'ar')}>العربية / English</button><button disabled={busy} className="btn-outline" onClick={async()=>{setBusy(true);try{setChecks((await formatsCheck()).join('\n'))}catch(e){setChecks('FAILED: '+e.message)}finally{setBusy(false)}}}>فحص صيغ الملفات</button></div><pre dir="ltr" role="status" className="whitespace-pre-wrap text-sm">{busy?'Running format checks…':checks}</pre><p>المحفوظ في المعاينة: {patients.length}</p>{patients.map(p=><div className="card p-4" key={p.id}><strong>{p.name}</strong><p>{p.phone} · {p.openingBalance ? `${p.openingBalance.amount} ${p.openingBalance.currency}`:'رصيد غير محسوم'}</p><p>{p.importedHistory}</p></div>)}</div>{open&&<PatientImportModal open onClose={()=>setOpen(false)} lang={lang} patients={patients} currency="JOD" onCommit={commit}/>}</main>
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')).render(<Preview/> )
