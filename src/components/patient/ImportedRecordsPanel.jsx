import { useState } from 'react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { parseAmount, parseImportDate, importToday } from '../../lib/patientImport'
import { money } from '../../lib/utils'

export default function ImportedRecordsPanel({ patient }) {
  const { lang } = useI18n(), L = (a,b) => lang === 'ar' ? a : b
  const { clinic, can, readOnly, updatePatient } = useStore()
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState({}), [saving, setSaving] = useState(false), [error, setError] = useState('')
  if (!patient.importSource) return null
  const currency = clinic.settings?.currency || 'JOD', opening = patient.openingBalance
  function start() { setDraft({ notes: patient.importedHistory || '', known: Boolean(opening), amount: String(opening?.amount ?? ''), date: opening?.asOf || '', currency: opening?.currency || currency }); setEditing(true); setError('') }
  async function save() {
    const amount = parseAmount(draft.amount, 'dot', true), date = parseImportDate(draft.date)
    if (draft.notes.length > 15000 || (can('clinicBalances') && draft.known && (amount.error || amount.value === null || date.error || date.value > importToday() || draft.currency !== currency))) {
      setError(L('راجع المبلغ والتاريخ والعملة. استخدم YYYY-MM-DD ونقطة للأرقام العشرية.', 'Check amount, date and currency. Use YYYY-MM-DD and a decimal dot.')); return
    }
    setSaving(true)
    try {
      const saved = await updatePatient(patient.id, {
        importedHistory: draft.notes,
        ...(can('clinicBalances') ? { openingBalance: draft.known ? { amount: amount.value, asOf: date.value || null, currency, confirmed: true } : null } : {}),
      })
      if (saved) setEditing(false)
      else setError(L('لم يتأكد الحفظ؛ حاول مجددًا.', 'Save not confirmed; please retry.'))
    } finally { setSaving(false) }
  }
  return <section className="card p-4 space-y-3">
    <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-ink-800">{L('السجل المنقول من الملف السابق','Imported previous record')}</h3>{!readOnly && !editing && <button className="btn-outline !py-1.5" onClick={start}>{L('تعديل','Edit')}</button>}</div>
    <p className="text-xs text-ink-500">{patient.importSource.file} · {patient.importSource.sheet} · {L('صف','Row')} {patient.importSource.row}</p>
    {editing ? <>
      <label className="block text-sm">{L('العلاجات والملاحظات السابقة','Previous treatments and notes')}<textarea className="input mt-1" rows={4} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
      {can('clinicBalances') && <><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.known} onChange={e=>setDraft({...draft,known:e.target.checked})}/>{L('الرصيد السابق معروف ومعتمد','Opening balance is known and confirmed')}</label>{draft.known && <div className="grid gap-3 sm:grid-cols-3">{[['amount',L('الرصيد (+ مستحق / − لصالح المريض)','Balance (+ owed / − credit)')],['currency',L('العملة','Currency')],['date',L('تاريخ الرصيد (اختياري)','Balance date (optional)')]].map(([key,label])=><label key={key} className="text-xs">{label}<input className="input mt-1" value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}</div>}</>}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2"><button className="btn-primary" disabled={saving} onClick={save}>{L('حفظ','Save')}</button><button className="btn-outline" disabled={saving} onClick={()=>setEditing(false)}>{L('إلغاء','Cancel')}</button></div>
    </> : <>
      <p className="whitespace-pre-wrap text-sm leading-7">{patient.importedHistory || L('لا توجد ملاحظات مستخرجة؛ راجع النص الأصلي أدناه.','No extracted notes; see the original source below.')}</p>
      {can('clinicBalances') && <p className={`rounded-lg p-3 text-sm ${opening?'bg-brand-50 text-brand-800':'bg-amber-50 text-amber-800'}`}>{opening ? `${L('رصيد سابق معتمد','Confirmed opening balance')}: ${money(opening.amount,opening.currency)}${opening.asOf ? ` · ${opening.asOf}` : ''}` : L('الرصيد السابق غير محسوم — لا يعني أن المريض مسدد.','Previous balance is unresolved — this does not mean the patient is settled.')}</p>}
    </>}
    <details className="text-xs"><summary className="cursor-pointer text-brand-700">{L('النص الأصلي المحفوظ','Preserved original text')}</summary><pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-ink-50 p-3 leading-6">{patient.importSource.original}</pre></details>
    <p className="text-xs text-ink-400">{L('السجل السابق محفوظ للمراجعة؛ لا ينشئ إجراءات على مخطط الأسنان ولا إيرادات أو دفعات جديدة.','Previous history is retained for review; it does not create dental-chart procedures, revenue or new payments.')}</p>
  </section>
}
