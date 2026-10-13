import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, FileSearch, Check, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Modal } from './ui'
import { IMPORT_FIELDS, suggestMapping, analyzeRows, rowIssues, duplicateLookup } from '../lib/patientImport'
import { readPatientImport } from '../lib/readPatientImport'

const fieldNames = {
  record: ['نص ملف كامل (بعناوين داخل السطر)', 'Full record text (labelled fields)'],
  name: ['اسم المريض', 'Patient name'], phone: ['رقم الهاتف', 'Phone'], fileNo: ['رقم الملف', 'File number'],
  dob: ['تاريخ الميلاد', 'Birth date'], address: ['العنوان', 'Address'], history: ['العلاجات والملاحظات السابقة', 'Previous treatments / notes'],
  fees: ['التكلفة السابقة', 'Previous fees'], paid: ['المدفوع سابقًا', 'Previously paid'], balance: ['المتبقي سابقًا', 'Previous balance'],
  currency: ['العملة', 'Currency'], asOf: ['تاريخ الرصيد السابق', 'Balance as of'], opening: ['الرصيد السابق المعتمد', 'Approved opening balance'],
}
const messages = {
  name: ['أدخل اسم مريض واضحًا.', 'Enter a valid patient name.'], phone: ['راجع صيغة رقم الهاتف.', 'Check the phone format.'],
  length: ['إحدى الخانات أطول من الحد المسموح.', 'A field exceeds its length limit.'],
  date: ['تاريخ غير صالح. صححه أو امسحه مع إبقاء الأصل للمراجعة.', 'Invalid date. Correct it or clear it; the source will be retained.'],
  dateAmbiguous: ['ترتيب اليوم والشهر غير واضح. اختر ترتيب التواريخ أو اكتب YYYY-MM-DD.', 'Ambiguous day/month. Choose a date order or enter YYYY-MM-DD.'],
  futureDob: ['تاريخ الميلاد في المستقبل.', 'Birth date is in the future.'], futureBalance: ['تاريخ الرصيد في المستقبل.', 'Balance date is in the future.'],
  amount: ['مبلغ غير واضح في المصدر؛ راجعه قبل اعتماد الرصيد.', 'Unclear source amount; review before approving a balance.'],
  amountAmbiguous: ['فاصل الآلاف/العشري ملتبس في المصدر.', 'Ambiguous decimal/thousands separator in the source.'],
  conflict: ['التكلفة ناقص المدفوع لا تساوي المتبقي المكتوب.', 'Fees minus paid does not match the written balance.'],
  financeReview: ['حدّد الرصيد أو اختر «أراجعه لاحقًا».', 'Set the balance or choose “Review later”.'],
  opening: ['أدخل الرصيد المعتمد بالأرقام؛ استخدم النقطة للكسر العشري.', 'Enter an approved balance using a dot for decimals.'],
  currency: ['العملة تختلف عن عملة العيادة. لا يوجد تحويل تلقائي.', 'Currency differs from the clinic. No automatic conversion.'],
  financialPlan: ['الأرصدة تحتاج صلاحية الحسابات في باقتك.', 'Your plan does not include clinic balances.'],
  formula: ['في المصدر معادلة؛ عُرضت نتيجتها المحفوظة دون تشغيلها. راجعها.', 'A formula is present. Only its cached result is shown; verify it.'],
  noPhone: ['رقم الهاتف غير موجود.', 'No phone number.'], duplicate: ['سجل مشابه موجود؛ راجعه قبل إنشاء مريض جديد.', 'A similar record exists; review before creating a new patient.'],
  review: ['بانتظار اعتماد مراجعتك لهذا المريض.', 'Awaiting your review of this patient.'],
  duplicateMapping: ['لا تربط خانتين بنفس الحقل. اجمع الملاحظات أو اختر العمود المناسب.', 'Do not map two columns to the same field.'],
  nameMapping: ['حدّد العمود الذي يحتوي اسم المريض.', 'Select the patient-name column.'],
  fileSize: ['اختر ملفًا غير فارغ لا يتجاوز 10 MB.', 'Choose a non-empty file up to 10 MB.'],
  rowLimit: ['الحد 500 سجل في الورقة. قسّم الملف إلى دفعات أصغر.', 'Limit: 500 records per sheet. Split into smaller files.'],
  columnLimit: ['الحد 60 عمودًا. أزل الأعمدة الفارغة أو غير المطلوبة.', 'Limit: 60 columns. Remove unused columns.'],
  textLimit: ['إحدى الخانات النصية كبيرة جدًا.', 'A text cell is too large.'], expandedLimit: ['حجم المحتوى بعد فك الضغط كبير جدًا.', 'The expanded file is too large.'],
  invalidFile: ['الملف غير صالح أو بنيته غير مدعومة.', 'Invalid or unsupported file structure.'],
  encoding: ['احفظ الملف بترميز UTF-8 ثم أعد رفعه.', 'Save as UTF-8 and try again.'],
  quotes: ['علامات الاقتباس في CSV غير مكتملة.', 'The CSV contains an unclosed quoted field.'],
  sheetLimit: ['الحد 20 ورقة في الملف.', 'Limit: 20 sheets.'], pageLimit: ['الحد 50 صفحة في PDF.', 'Limit: 50 PDF pages.'],
  scanned: ['هذا PDF مصوّر بلا نص قابل للقراءة. استخدم ملف Excel أو نسخة PDF نصية. قراءة خط اليد غير مدعومة هنا.', 'This PDF is scanned, without readable text. Use Excel or a text PDF. Handwriting recognition is not supported.'],
  unsupported: ['الصيغ المدعومة: XLSX، CSV، TSV، TXT، DOCX وPDF نصّي.', 'Supported: XLSX, CSV, TSV, TXT, DOCX and text PDF.'],
  empty: ['لم نجد بيانات قابلة للقراءة.', 'No readable data found.'],
}
export const IMPORT_SAMPLE = 'اسم المريض,رقم الهاتف,ملاحظات,التكلفة,المدفوع,المتبقي\nمريض تجريبي أ,0599000001,حشوة؛ دفع 100,300,100,200\nمريض تجريبي ب,0599000002,خلع — 200,,,\nمريض تجريبي ج,+970599000003,تنظيف,500,100,250\nالمجموع,,,,,450'

export default function PatientImportModal({ open, onClose, lang = 'ar', patients = [], currency = 'JOD', allowBalances = true, readOnly = false, onCommit }) {
  const ar = lang === 'ar', L = (a, b) => ar ? a : b, label = key => fieldNames[key]?.[ar ? 0 : 1] || key
  const message = code => messages[code]?.[ar ? 0 : 1] || L('تعذّر إكمال العملية. الملف الأصلي لم يتغير؛ راجع الاتصال وحاول مجددًا.', 'Could not complete the operation. The source is unchanged; check your connection and retry.')
  const [document, setDocument] = useState(null), [sheetIndex, setSheetIndex] = useState(0)
  const [header, setHeader] = useState(-1), [mapping, setMapping] = useState([]), [rows, setRows] = useState([])
  const [step, setStep] = useState('file'), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [active, setActive] = useState(0), [onlyIssues, setOnlyIssues] = useState(false), [result, setResult] = useState(null)
  const [dateOrder, setDateOrder] = useState('auto'), [numberFormat, setNumberFormat] = useState('auto')
  const request = useRef(0), savingRef = useRef(false)
  const options = { currency, allowBalances, dateOrder, numberFormat }
  const sheet = document?.sheets[sheetIndex]
  useEffect(() => () => { request.current++ }, [])
  useEffect(() => {
    if (!open) return
    const warn = e => { if (rows.length && step === 'review') { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [open, rows.length, step])
  function selectSheet(doc, index) {
    const suggestion = suggestMapping(doc.sheets[index].rows)
    setSheetIndex(index); setHeader(suggestion.header); setMapping(suggestion.mapping)
    setRows([]); setError(''); setStep('mapping')
  }
  function reviewRows(doc, index, fields, heading) {
    const draft = analyzeRows(doc.sheets[index], fields, heading, options).map(row => {
      const alreadyImported = patients.some(p => p.importSource?.fingerprint === doc.fingerprint && p.importSource?.sheet === row.sheet && p.importSource?.row === row.sourceRow)
      return { ...row, alreadyImported, included: alreadyImported ? false : row.included }
    })
    setRows(draft); setActive(0); setStep('review'); setOnlyIssues(false); setError('')
  }
  async function load(file) {
    if (!file) return
    const version = ++request.current
    setBusy(true); setError('')
    try {
      const doc = await readPatientImport(file)
      if (version !== request.current) return
      setDocument(doc); selectSheet(doc, 0)
      const guess = suggestMapping(doc.sheets[0].rows)
      const fields = guess.mapping.filter(Boolean)
      if (doc.sheets.length === 1 && (fields.includes('name') || fields.includes('record')) && new Set(fields).size === fields.length)
        reviewRows(doc, 0, guess.mapping, guess.header)
    } catch (e) { if (version === request.current) setError(e.message) }
    finally { if (version === request.current) setBusy(false) }
  }
  function analyze() {
    try { reviewRows(document, sheetIndex, mapping, header) }
    catch (e) { setError(e.message) }
  }
  function edit(index, patch) { setRows(current => current.map((r,i) => i === index ? { ...r, ...patch, reviewed: patch.reviewed ?? false } : r)) }
  const existingDuplicates = useMemo(() => duplicateLookup(patients), [patients])
  const batchDuplicates = useMemo(() => duplicateLookup(rows.filter(r => r.included)), [rows])
  const issues = rows.map(row => rowIssues(row, options, [], [...new Set([...existingDuplicates(row), ...batchDuplicates(row)])]))
  const selected = rows.filter(r => r.included), blocked = rows.filter((r,i) => r.included && issues[i].errors.length)
  const visible = rows.map((row,index) => ({ row,index })).filter(({row,index}) => !onlyIssues || (row.included && issues[index].errors.length))
  const current = rows[active], issue = issues[active]
  function approveCurrent() {
    if (!current?.included || issue.errors.some(code => code !== 'review')) return
    edit(active, { reviewed: true })
    const next = rows.findIndex((row, index) => index > active && row.included && !row.reviewed)
    const first = rows.findIndex((row, index) => index !== active && row.included && !row.reviewed)
    if (next >= 0 || first >= 0) setActive(next >= 0 ? next : first)
  }
  async function commit() {
    if (savingRef.current || readOnly || blocked.length || !selected.length) return
    savingRef.current = true; setBusy(true); setError('')
    try {
      const saved = await onCommit(rows, { ...options, fingerprint: document.fingerprint, fileName: document.name })
      if (!saved) throw new Error('saveFailed')
      setResult(saved); setStep('done')
    } catch (e) { setError(e.message) }
    finally { setBusy(false); savingRef.current = false }
  }
  const close = () => { if (!busy) onClose() }
  return <Modal open={open} onClose={close} size="xl" title={L('نقل ملفات المرضى', 'Import patient records')} icon={<FileSearch size={20} />}>
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-4">
      {step !== 'done' && <p className="text-sm text-ink-500">{step === 'file' ? L('اختر الملف، راجع المرضى، واحفظهم.', 'Choose a file, review your patients, then save.') : L('تأكد من الاسم والرقم والرصيد، ثم اضغط «اعتماد والتالي».', 'Check the name, phone and balance, then approve and continue.')}</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message(error)}</p>}
      {step === 'done' && result?.needsRefresh && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{L('تأكد الحفظ. حدّث صفحة المرضى عند عودة الاتصال لعرض السجلات المستوردة سابقًا.', 'Save confirmed. Refresh patients when connected to display previously imported records.')}</p>}
      {step === 'file' && <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-8 text-center">
        <Upload className="mx-auto mb-3 text-brand-600" size={32} />
        <h4 className="text-lg font-bold">{L('ملفاتك القديمة، مرتّبة في مكان واحد', 'Bring your existing records together')}</h4>
        <p className="my-3 text-sm text-ink-500">XLSX · CSV · TSV · TXT · DOCX · PDF {L('نصّي', '(text)')} — 10 MB</p>
        <label className="btn-primary inline-flex cursor-pointer">{busy ? L('جارٍ قراءة الملف…', 'Reading file…') : L('اختيار ملف', 'Choose file')}<input aria-label={L('اختيار ملف المرضى', 'Choose patient file')} className="sr-only" type="file" disabled={busy} accept=".xlsx,.csv,.tsv,.txt,.docx,.pdf" onChange={e => load(e.target.files[0])} /></label>
        <button disabled={busy} className="mx-auto mt-4 block text-sm font-semibold text-brand-700 underline" onClick={() => load(new File([IMPORT_SAMPLE], 'sample-patients.csv', { type: 'text/csv' }))}>{L('جرّب بملف افتراضي', 'Try a fictional sample')}</button>
        <p className="mt-5 text-xs text-ink-500">{L('الصور وخط اليد غير مدعومين. ملفك الأصلي يبقى كما هو.', 'Images and handwriting are not supported. Your original file stays unchanged.')}</p>
      </div>}
      {step === 'mapping' && sheet && <>
        <p className="text-sm font-semibold">{L('إعدادات قراءة الملف — عدّلها فقط إذا ظهرت البيانات بمكان غير صحيح.', 'File settings — adjust only if data appears in the wrong place.')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">{L('الورقة أو الصفحة', 'Sheet or page')}<select className="input mt-1" value={sheetIndex} onChange={e => selectSheet(document, Number(e.target.value))}>{document.sheets.map((s,i) => <option key={i} value={i}>{s.name}</option>)}</select></label>
          <label className="text-sm font-semibold">{L('صف العناوين', 'Header row')}<select className="input mt-1" value={header} onChange={e => setHeader(Number(e.target.value))}><option value={-1}>{L('بدون عناوين', 'No header')}</option>{sheet.rows.slice(0,12).map((r,i) => <option key={i} value={i}>{r.row}: {r.cells.join(' | ').slice(0,80)}</option>)}</select></label>
        </div>
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{L('راجع اقتراحات الأعمدة. كل صف يُعامل كمريض مستقل؛ الصفوف المتكررة لا تُدمج تلقائيًا. PDF قد يحتاج ترتيب أعمدته يدويًا.', 'Review column suggestions. Each row becomes a separate patient; repeated rows are never merged automatically. PDF columns may need manual mapping.')}</p>
        <div className="max-h-[42vh] overflow-auto rounded-xl border border-ink-100"><table className="w-full text-start text-sm"><thead className="sticky top-0 bg-ink-50"><tr><th className="p-3 text-start">{L('العمود / أمثلة من الملف', 'Column / sample values')}</th><th className="p-3 text-start">{L('يُنقل إلى', 'Map to')}</th></tr></thead><tbody>{Array.from({ length: Math.max(...sheet.rows.map(r => r.cells.length)) }, (_,i) => <tr key={i} className="border-t border-ink-100"><td className="max-w-sm p-3"><strong>{header >= 0 ? sheet.rows[header].cells[i] || `#${i+1}` : `#${i+1}`}</strong><p className="mt-1 break-words text-xs text-ink-500">{sheet.rows.slice(header+1,header+4).map(r => r.cells[i] || '—').join(' / ')}</p></td><td className="p-3"><select aria-label={`${L('ربط العمود', 'Map column')} ${i+1}`} className="input min-w-40" value={mapping[i] || ''} onChange={e => setMapping(m => { const next = [...m]; next[i] = e.target.value; return next })}><option value="">{L('يبقى في النص الأصلي فقط', 'Keep only in original source')}</option>{['record',...IMPORT_FIELDS].map(k => <option key={k} value={k}>{label(k)}</option>)}</select></td></tr>)}</tbody></table></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{L('ترتيب التواريخ', 'Date order')}<select className="input" value={dateOrder} onChange={e => setDateOrder(e.target.value)}><option value="auto">{L('كشف الواضح فقط', 'Unambiguous only')}</option><option value="dmy">DD/MM/YYYY</option><option value="mdy">MM/DD/YYYY</option></select></label>
          <label className="text-sm">{L('صيغة المبالغ', 'Number format')}<select className="input" value={numberFormat} onChange={e => setNumberFormat(e.target.value)}><option value="auto">{L('كشف الواضح فقط', 'Unambiguous only')}</option><option value="dot">1,234.56</option><option value="comma">1.234,56</option></select></label>
        </div>
        <div className="flex gap-2"><button onClick={analyze} className="btn-primary">{L('قراءة الملف من جديد', 'Read file again')}</button>{rows.length > 0 && <button onClick={()=>setStep('review')} className="btn-outline">{L('رجوع بدون تغيير', 'Back without changes')}</button>}</div>
      </>}
      {step === 'review' && <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-3 text-sm"><strong>{L(`${selected.length} محدد · ${blocked.length} بحاجة لمراجعة`, `${selected.length} selected · ${blocked.length} need review`)}</strong><label className="flex items-center gap-2"><input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />{L('بحاجة لمراجعة فقط', 'Needs review only')}</label></div>
        <div className="grid gap-4 md:grid-cols-[210px_1fr]">
          <div className="max-h-40 md:max-h-[calc(100dvh-390px)] space-y-1 overflow-auto rounded-xl border border-ink-100 p-2">{visible.map(({row,index}) => <button key={row.key} onClick={() => setActive(index)} className={`flex w-full items-start gap-2 rounded-lg p-3 text-start text-sm ${active===index?'bg-brand-50 text-brand-800':'hover:bg-ink-50'} ${!row.included?'opacity-50':''}`}><span className="mt-0.5">{issues[index].errors.length ? <AlertTriangle size={15} /> : <Check size={15} />}</span><span className="min-w-0"><span className="block truncate font-semibold">{row.name || L('بدون اسم', 'No name')}</span><small>{L('صف', 'Row')} {row.sourceRow} {!row.included && L('· مستبعد', '· Excluded')}</small></span></button>)}</div>
          {current && <div className="max-h-[50vh] md:max-h-[calc(100dvh-390px)] space-y-3 overflow-auto pe-1">
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" disabled={current.alreadyImported || busy} checked={current.included} onChange={e => edit(active,{included:e.target.checked})} />{current.alreadyImported ? L('هذا الصف مستورد سابقًا — عدّله من ملف المريض', 'Already imported — edit in the patient profile') : L('تضمين هذا السجل', 'Include this record')}</label>
            <div className="grid gap-3 sm:grid-cols-2">{['name','phone'].map(k => <label className="text-xs font-semibold text-ink-500" key={k}>{label(k)}<input className="input mt-1" aria-label={label(k)} value={current[k]} onChange={e => edit(active,{[k]:e.target.value})} /></label>)}</div>
            <details key={`details-${current.key}`} open={issue.errors.some(code => ['date','dateAmbiguous','futureDob','length'].includes(code)) || undefined} className="rounded-xl border border-ink-100 p-3 text-sm"><summary className="cursor-pointer font-semibold">{L('باقي بيانات المريض والملاحظات', 'More patient details and notes')}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{['fileNo','dob','address'].map(k => <label className="text-xs text-ink-500" key={k}>{label(k)}<input className="input mt-1" aria-label={label(k)} value={current[k]} onChange={e => edit(active,{[k]:e.target.value})} /></label>)}</div><label className="mt-3 block text-xs text-ink-500">{label('history')}<textarea className="input mt-1" rows={3} value={current.history} onChange={e => edit(active,{history:e.target.value})} /></label></details>
            <div className="space-y-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
              <p className="text-xs text-ink-500">{L('المصدر: تكلفة', 'Source: fees')} {current.fees || '—'} · {L('مدفوع', 'paid')} {current.paid || '—'} · {L('متبقي', 'balance')} {current.balance || '—'}</p>
              <p className="text-sm font-semibold">{L('الرصيد القديم', 'Previous balance')}{current.financeMode !== 'opening' && current.opening !== '' && <span className="ms-2 font-normal text-ink-500">{L('بالملف:', 'In file:')} {current.opening} {current.currency}</span>}</p>
              <div className="flex flex-wrap gap-2">{[['opening',L('أحدد الرصيد', 'Set balance')],['unknown',L('أراجعه لاحقًا', 'Review later')]].map(([mode,text])=><button key={mode} type="button" aria-pressed={current.financeMode===mode} disabled={mode==='opening' && !allowBalances} className={current.financeMode===mode?'btn-primary':'btn-outline'} onClick={()=>edit(active,{financeMode:mode})}>{text}</button>)}</div>
              {current.financeMode==='unknown' && <p className="text-xs text-ink-500">{L('سنحفظ الملاحظات، ونترك الرصيد غير محسوم.', 'Notes are kept; the balance stays unresolved.')}</p>}
              {current.financeMode==='opening' && <><label className="block text-xs">{L('المبلغ المتبقي', 'Remaining amount')} ({current.currency})<input aria-label={label('opening')} className="input mt-1" inputMode="decimal" value={current.opening} onChange={e=>edit(active,{opening:e.target.value})}/></label><p className="text-xs text-ink-500">{L('إذا للمريض رصيد عندك، اكتب المبلغ بالسالب. لن يُحتسب كدفعة جديدة.', 'Use a negative amount for patient credit. This is not a new payment.')}</p><details key={`balance-${current.key}`} open={issue.errors.some(code=>['currency','date','dateAmbiguous','futureBalance'].includes(code)) || undefined}><summary className="cursor-pointer text-xs text-ink-500">{L('العملة وتاريخ الرصيد', 'Currency and balance date')}</summary><div className="mt-2 grid gap-3 sm:grid-cols-2">{['currency','asOf'].map(k=><label key={k} className="text-xs">{label(k)}<input aria-label={label(k)} className="input mt-1" value={current[k]} onChange={e=>edit(active,{[k]:e.target.value})}/></label>)}</div></details></>}
            </div>
            {issue.duplicates.length > 0 && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><p>{L('سجلات مشابهة:', 'Similar records:')} {issue.duplicates.slice(0,5).map(p => `${p.nameAr || p.name} ${p.fileNo ? `#${p.fileNo}` : ''}`).join(' · ')}</p><label className="mt-2 flex gap-2"><input type="checkbox" checked={current.duplicateAccepted} onChange={e => edit(active,{duplicateAccepted:e.target.checked})} />{L('راجعتها: هذا مريض مستقل، أنشئ ملفًا جديدًا', 'Reviewed: this is a separate patient; create a new file')}</label></div>}
            {[...issue.errors.filter(e => !['review','duplicate'].includes(e)),...issue.warnings].length > 0 && <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{[...new Set([...issue.errors.filter(e => !['review','duplicate'].includes(e)),...issue.warnings])].map(code => <li key={code}>• {message(code)}</li>)}</ul>}
            <details className="rounded-xl border border-ink-100 p-3 text-sm"><summary className="cursor-pointer font-semibold">{L('قارن مع النص الأصلي', 'Compare with original source')} · {current.sheet} / {current.sourceRow}</summary><pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-ink-600">{current.original}</pre></details>
            <div className="flex flex-wrap items-center justify-between gap-2"><button className="btn-outline" disabled={active===0} onClick={()=>setActive(active-1)}><ChevronRight size={15}/>{L('السابق','Previous')}</button><button type="button" className="btn-primary" disabled={!current.included || issue.errors.some(code=>code!=='review') || current.reviewed} onClick={approveCurrent}>{current.reviewed ? L('تمت المراجعة ✓','Reviewed ✓') : L('اعتماد والتالي','Approve and continue')}</button><button className="btn-outline" disabled={active===rows.length-1} onClick={()=>setActive(active+1)}>{L('التالي','Next')}<ChevronLeft size={15}/></button></div>
          </div>}
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-ink-100 pt-4"><button className="text-xs text-ink-500 underline" disabled={busy} onClick={()=>setStep('mapping')}>{L('إعدادات قراءة الملف', 'File reading settings')}</button><button disabled={busy || readOnly || !selected.length || blocked.length>0} onClick={commit} className="btn-primary">{busy ? L('جارٍ الحفظ…','Saving…') : L(`حفظ ${selected.length} مريض`, `Save ${selected.length} patients`)}</button></div>
        {readOnly && <p className="text-xs text-amber-700">{L('وضع العرض: يمكنك تجربة التحليل والمراجعة، والحفظ غير متاح.', 'Read-only mode: analysis and review are available, saving is disabled.')}</p>}
      </fieldset>}
      {step === 'done' && <div className="py-8 text-center"><Check className="mx-auto text-brand-600" size={40}/><h4 className="my-3 text-xl font-bold">{L('اكتمل الاستيراد', 'Import complete')}</h4><p>{L(`أُضيف ${result.inserted.length} مريض. تم تجاوز ${result.skipped} سجل سبق استيراده.`, `${result.inserted.length} patients added. ${result.skipped} already imported records skipped.`)}</p><p className="my-3 text-sm text-ink-500">{L('تجد الأصل والملاحظات السابقة داخل ملف كل مريض. يمكنك متابعة تعديل البيانات هناك.', 'Original source and previous notes are available in each patient file for further review and editing.')}</p><button className="btn-primary" onClick={close}>{L('عرض المرضى','View patients')}</button></div>}
      {step === 'mapping' && <button disabled={busy} className="text-xs text-ink-500 underline" onClick={()=>{setStep('file');setDocument(null)}}>{L('اختيار ملف آخر','Choose another file')}</button>}
    </div>
  </Modal>
}
