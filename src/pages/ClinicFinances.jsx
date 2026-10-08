import { useMemo, useState } from 'react'
import { Building2, UserRound, Users, Zap, Droplets, Wifi, Package, Wrench, Receipt, Wallet, ArrowDownLeft, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { useI18n } from '../i18n/I18nContext'
import { Modal, Field } from '../components/ui'
import FeatureLock from '../components/FeatureLock'
import TreatmentPricingPlanner from '../components/TreatmentPricingPlanner'
import { useSaveAction } from '../lib/useSaveAction'
import { calendarDate } from '../lib/calendarDate'
import { backend } from '../lib/backend'
import { EXPENSE_CATEGORIES, clinicFinanceSummary, financeMoney, validExpense } from '../lib/clinicFinances'

const ICONS = { rent: Building2, secretary: UserRound, salaries: Users, electricity: Zap, water: Droplets, internet: Wifi, supplies: Package, maintenance: Wrench, other: Receipt }
const PAGE_SIZE = 8

export default function ClinicFinances() {
  return <FeatureLock feature="clinicBalances"><Finances /></FeatureLock>
}

function Finances() {
  const { lang } = useI18n()
  const ar = lang === 'ar'
  const { clinic, payments, expenses, saveExpense, deleteExpense, readOnly, demoMode } = useStore()
  const currency = clinic?.settings?.currency || 'JOD'
  const [month, setMonth] = useState(() => calendarDate(new Date()).slice(0, 7))
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const summary = useMemo(() => clinicFinanceSummary(payments, expenses, month, currency), [payments, expenses, month, currency])
  const pages = Math.max(1, Math.ceil(summary.rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const rows = summary.rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const money = (amount, unit = currency) => financeMoney(amount, unit, lang)
  const disabled = readOnly || demoMode
  const { saving: deleting, runSave: runDelete } = useSaveAction()
  const label = (category) => (EXPENSE_CATEGORIES[category] || EXPENSE_CATEGORIES.other)[lang]

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-extrabold text-ink-800">{ar ? 'تحصيل العيادة' : 'Clinic finances'}</h1>
        <p className="mt-1 text-xs text-ink-500">{ar ? 'تحصيلك، تكاليف التشغيل، والصافي في مكان واحد.' : 'Collections, operating expenses, and your remaining balance.'}</p></div>
      <label className="flex items-center gap-2 text-xs text-ink-500">{ar ? 'الشهر' : 'Month'}
        <input type="month" aria-label={ar ? 'الشهر' : 'Month'} className="input !w-auto !py-2" value={month}
          onChange={(e) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) { setMonth(e.target.value); setPage(0) } }} /></label>
    </div>
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
      {[
        { title: ar ? 'تحصيل المرضى' : 'Patient collections', value: summary.income, hint: ar ? 'دفعات مستلمة خلال الشهر' : 'Payments received this month', icon: ArrowDownLeft },
        { title: ar ? 'مصاريف التشغيل' : 'Operating expenses', value: summary.operating, hint: ar ? 'المصاريف المدفوعة المسجّلة' : 'Recorded paid expenses', icon: Receipt },
        { title: ar ? 'الصافي المتبقي' : 'Remaining balance', value: summary.net, hint: ar ? 'التحصيل − مصاريف التشغيل' : 'Collections − operating expenses', icon: Wallet, net: true },
      ].map(({ title, value, hint, icon: Icon, net }) => <section key={title} className={`card min-w-0 p-4 ${net ? '!border-brand-100 !bg-brand-50/70' : ''}`}>
        <div className="flex items-center justify-between gap-2 text-xs text-ink-500"><span>{title}</span><Icon size={17} className="text-brand-600" /></div>
        <p className={`my-2 break-words text-xl font-extrabold tabular-nums lg:text-2xl ${net ? (value < 0 ? 'text-rose-600' : 'text-brand-700') : 'text-ink-800'}`}>{money(value)}</p>
        <p className="text-[11px] text-ink-500">{hint}</p>
      </section>)}
    </div>
    {summary.otherCurrencyCount > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
      {ar ? 'توجد مصاريف بعملة سابقة؛ تظهر في السجل، ولا تدخل في إجمالي العملة الحالية.' : 'Expenses in a previous currency are listed but excluded from the current currency totals.'}
    </p>}
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
        <div><h2 className="text-sm font-bold text-ink-800">{ar ? 'مصاريف العيادة' : 'Clinic expenses'}</h2>
          <p className="mt-1 text-[11px] text-ink-400">{summary.rows.length} {ar ? 'مصاريف هذا الشهر' : 'expenses this month'}</p></div>
        <button className="btn-primary !py-2 text-xs" disabled={disabled} onClick={() => setEditing({})}><Plus size={16} />{ar ? 'إضافة مصروف' : 'Add expense'}</button>
      </div>
      {rows.length ? <div className="overflow-x-auto"><table className="w-full text-start text-xs">
        <thead className="bg-ink-50/70 text-ink-500"><tr>
          <th className="px-4 py-2 text-start font-medium">{ar ? 'المصروف' : 'Expense'}</th>
          <th className="px-3 py-2 text-start font-medium">{ar ? 'تاريخ الدفع' : 'Date paid'}</th>
          <th className="px-3 py-2 text-start font-medium">{ar ? 'المبلغ' : 'Amount'}</th>
          <th className="px-3 py-2"><span className="sr-only">{ar ? 'إجراءات' : 'Actions'}</span></th>
        </tr></thead>
        <tbody className="divide-y divide-ink-100">{rows.map((expense) => {
          const Icon = ICONS[expense.category] || Receipt
          return <tr key={expense.id} className="hover:bg-ink-50/50">
            <td className="px-4 py-2.5"><div className="flex items-center gap-2.5">
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-400 sm:flex"><Icon size={16} /></span>
              <div className="min-w-0"><p className="font-bold text-ink-700">{label(expense.category)}</p>
                {expense.note && <p className="mt-0.5 max-w-64 break-words text-[11px] text-ink-400">{expense.note}</p>}</div>
            </div></td>
            <td className="whitespace-nowrap px-3 py-2.5 text-ink-500"><time dateTime={expense.date}>{expense.date.slice(8)}/{expense.date.slice(5, 7)}</time></td>
            <td className="whitespace-nowrap px-3 py-2.5 font-bold tabular-nums text-ink-800">{money(expense.amount, expense.currency)}</td>
            <td className="px-2 py-2"><div className="flex justify-end gap-1">
              <button className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40" disabled={disabled} onClick={() => setEditing(expense)} aria-label={(ar ? 'تعديل ' : 'Edit ') + label(expense.category)}><Pencil size={15} /></button>
              <button className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40" disabled={disabled} onClick={() => setRemoving(expense)} aria-label={(ar ? 'حذف ' : 'Delete ') + label(expense.category)}><Trash2 size={15} /></button>
            </div></td>
          </tr>
        })}</tbody>
      </table></div> : <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-ink-400">
        <Receipt size={26} /><p className="text-sm font-semibold">{ar ? 'لا توجد مصاريف مسجّلة لهذا الشهر' : 'No expenses recorded this month'}</p>
        <p className="text-xs">{ar ? 'ابدأ بإضافة الإيجار أو الرواتب أو فاتورة الكهرباء.' : 'Start with rent, salaries, or an electricity bill.'}</p>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 bg-ink-50/70 px-4 py-3 text-xs">
        <span className="text-ink-500">{ar ? 'إجمالي المصاريف المدفوعة' : 'Total paid expenses'}</span><strong className="tabular-nums text-ink-800">{money(summary.operating)}</strong>
      </div>
      {pages > 1 && <div className="flex items-center justify-center gap-3 border-t border-ink-100 p-2 text-xs text-ink-500">
        <button className="btn-ghost !p-2" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label={ar ? 'الصفحة السابقة' : 'Previous page'}><ChevronRight size={16} /></button>
        <span>{currentPage + 1} / {pages}</span>
        <button className="btn-ghost !p-2" disabled={currentPage + 1 === pages} onClick={() => setPage(currentPage + 1)} aria-label={ar ? 'الصفحة التالية' : 'Next page'}><ChevronLeft size={16} /></button>
      </div>}
    </section>
    <TreatmentPricingPlanner month={month} currency={currency} expenses={summary.rows} />
    {editing && <ExpenseEditor expense={editing} currency={currency} saveExpense={saveExpense}
      onSaved={(date) => { setMonth(date.slice(0, 7)); setPage(0); setEditing(null) }} onClose={() => setEditing(null)} />}
    <Modal open={Boolean(removing)} onClose={() => { if (!deleting) setRemoving(null) }} size="sm"
      title={ar ? 'حذف المصروف؟' : 'Delete expense?'} icon={<Trash2 size={18} className="text-rose-500" />}
      footer={<><button className="btn-ghost" disabled={deleting} onClick={() => setRemoving(null)}>{ar ? 'إلغاء' : 'Cancel'}</button>
        <button className="btn bg-rose-600 text-white hover:bg-rose-700" disabled={deleting}
          onClick={() => runDelete(async () => { if (await deleteExpense(removing.id)) setRemoving(null) })}>{ar ? 'حذف المصروف' : 'Delete expense'}</button></>}>
      <p className="text-sm text-ink-600">{removing && label(removing.category)} · {removing && money(removing.amount, removing.currency)}</p>
      <p className="mt-2 text-xs text-ink-400">{ar ? 'يمكنك التراجع عن الحذف خلال 10 ثوانٍ.' : 'You can undo the deletion within 10 seconds.'}</p>
    </Modal>
  </div>
}

function ExpenseEditor({ expense, currency, saveExpense, onSaved, onClose }) {
  const { lang } = useI18n()
  const ar = lang === 'ar'
  const [id] = useState(() => expense.id || backend.genId())
  const [category, setCategory] = useState(expense.category || 'rent')
  const [amount, setAmount] = useState(expense.amount ?? '')
  const [date, setDate] = useState(expense.date || calendarDate(new Date()))
  const [note, setNote] = useState(expense.note || '')
  const [error, setError] = useState('')
  const { saving, runSave } = useSaveAction()
  const unit = expense.currency || currency
  function save(event) {
    event.preventDefault()
    return runSave(async () => {
      const value = { id, category, amount: Number(amount), date, note: note.trim(), currency: unit }
      if (!validExpense(value)) { setError(ar ? 'أدخل مبلغًا موجبًا وتاريخًا صحيحًا (حتى 3 منازل عشرية).' : 'Enter a positive amount and a valid date (up to 3 decimal places).'); return }
      setError('')
      const saved = await saveExpense(value)
      if (saved) onSaved(saved.date)
      else setError(ar ? 'لم يتم تأكيد الحفظ. بياناتك ما زالت هنا؛ تحقق من الاتصال وأعد المحاولة.' : 'Save was not confirmed. Your draft is still here; check your connection and retry.')
    })
  }
  return <Modal open size="sm" onClose={() => { if (!saving) onClose() }} title={expense.id ? (ar ? 'تعديل المصروف' : 'Edit expense') : (ar ? 'إضافة مصروف' : 'Add expense')}
    icon={<Receipt size={18} className="text-brand-600" />}>
    <form onSubmit={save} className="space-y-4">
      <Field label={ar ? 'نوع المصروف' : 'Expense type'}>
        <select aria-label={ar ? 'نوع المصروف' : 'Expense type'} disabled={saving} className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(EXPENSE_CATEGORIES).map(([key, value]) => <option key={key} value={key}>{value[lang]}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label={(ar ? 'المبلغ' : 'Amount') + ' (' + unit + ')'}><input autoFocus required disabled={saving} aria-label={ar ? 'المبلغ' : 'Amount'} type="number" inputMode="decimal" min="0.001" max="9999999" step="0.001" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label={ar ? 'تاريخ الدفع' : 'Date paid'}><input required disabled={saving} aria-label={ar ? 'تاريخ الدفع' : 'Date paid'} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label={ar ? 'ملاحظة (اختياري)' : 'Note (optional)'}><input disabled={saving} aria-label={ar ? 'ملاحظة' : 'Note'} maxLength={500} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? 'مثل إيجار شهر أكتوبر' : 'e.g. October rent'} /></Field>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-ink-100 pt-3">
        <button type="button" disabled={saving} className="btn-ghost" onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</button>
        <button type="submit" disabled={saving} className="btn-primary"><Save size={16} />{saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ المصروف' : 'Save expense')}</button>
      </div>
    </form>
  </Modal>
}
