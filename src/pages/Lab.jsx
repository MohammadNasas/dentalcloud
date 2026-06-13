import { useState, useMemo } from 'react'
import {
  FlaskConical, Plus, Trash2, Search, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Truck, PackageCheck, Edit2, X, Save,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Modal, Field, Segmented, Badge, EmptyState } from '../components/ui'
import FeatureLock from '../components/FeatureLock'
import { fmtDate } from '../lib/dates'
import { money, cx } from '../lib/utils'
import { chartRows, toothLabel } from '../lib/teeth'

const WORK_TYPES = [
  { key: 'crown',       en: 'Crown',               ar: 'تاج' },
  { key: 'bridge',      en: 'Bridge',               ar: 'جسر' },
  { key: 'veneer',      en: 'Veneer',               ar: 'فينير' },
  { key: 'denture_full',en: 'Full Denture',          ar: 'طقم كامل' },
  { key: 'denture_part',en: 'Partial Denture',       ar: 'طقم جزئي' },
  { key: 'implant_crown',en: 'Implant Crown',        ar: 'تاج زرعة' },
  { key: 'inlay',       en: 'Inlay / Onlay',         ar: 'انليه / اونليه' },
  { key: 'nightguard',  en: 'Night Guard',            ar: 'جبيرة ليلية' },
  { key: 'ortho_retainer', en: 'Orthodontic Retainer', ar: 'ريتينر تقويم' },
  { key: 'custom',      en: 'Other',                 ar: 'أخرى' },
]

const SHADES = ['A1','A2','A3','A3.5','A4','B1','B2','B3','B4','C1','C2','C3','C4','D2','D3','D4','BL','WT']

const STATUS_CONFIG = {
  draft:      { color: 'ink',   en: 'Draft',      ar: 'مسودة',       icon: Clock },
  sent:       { color: 'amber', en: 'Sent',        ar: 'مُرسَل',       icon: Truck },
  received:   { color: 'brand', en: 'Received',    ar: 'وصل',          icon: PackageCheck },
  completed:  { color: 'green', en: 'Completed',   ar: 'مكتمل',        icon: CheckCircle2 },
}

const DEFAULT_FORM = {
  patientId: '', labName: '', workType: 'crown', customWorkType: '',
  shade: 'A2', pieces: 1, toothIds: [], specs: '',
  price: '', paid: '', dueDate: '', linkedAppointmentId: '',
  status: 'sent',
}

export default function Lab() {
  const { can } = useStore()
  if (!can('lab')) return <FeatureLock feature="lab" />
  return <LabContent />
}

function LabContent() {
  const { t, lang, L } = useI18n()
  const { labOrders = [], addLabOrder, updateLabOrder, deleteLabOrder,
          patients, clinic, appointments } = useStore()
  const currency = clinic?.settings?.currency || 'JOD'

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const filtered = useMemo(() => {
    let list = [...labOrders].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    if (filterStatus !== 'all') list = list.filter((o) => o.status === filterStatus)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((o) =>
        (o.patientName || '').toLowerCase().includes(q) ||
        (o.labName || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [labOrders, filterStatus, search])

  // Summary stats
  const totalPrice = labOrders.reduce((s, o) => s + (Number(o.price) || 0), 0)
  const totalPaid  = labOrders.reduce((s, o) => s + (Number(o.paid)  || 0), 0)
  const totalOwed  = Math.max(0, totalPrice - totalPaid)
  const pending    = labOrders.filter((o) => o.status === 'sent' || o.status === 'draft').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink-800">
            <FlaskConical size={22} className="text-violet-500" />
            {lang === 'ar' ? 'إدارة المختبر' : 'Lab Management'}
          </h1>
          <p className="mt-0.5 text-sm text-ink-400">
            {lang === 'ar' ? 'تتبّع طلبات المختبر والمدفوعات' : 'Track lab orders and payments'}
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary">
          <Plus size={16} /> {lang === 'ar' ? 'طلب جديد' : 'New Order'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: lang === 'ar' ? 'إجمالي الطلبات' : 'Total Orders', value: labOrders.length, color: 'text-ink-700' },
          { label: lang === 'ar' ? 'قيد الانتظار' : 'Pending', value: pending, color: 'text-amber-600' },
          { label: lang === 'ar' ? 'إجمالي المدفوع' : 'Total Paid', value: money(totalPaid, currency), color: 'text-emerald-600' },
          { label: lang === 'ar' ? 'المتبقي للمختبر' : 'Owed to Lab', value: money(totalOwed, currency), color: 'text-rose-600' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <p className="text-xs font-bold text-ink-400">{s.label}</p>
            <p className={cx('mt-1 text-xl font-extrabold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 text-ink-400 start-3" />
          <input className="input ps-9" placeholder={lang === 'ar' ? 'بحث بالمريض أو المختبر…' : 'Search patient or lab…'}
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Segmented size="sm" value={filterStatus} onChange={setFilterStatus}
          options={[
            { value: 'all', label: lang === 'ar' ? 'الكل' : 'All' },
            { value: 'sent', label: lang === 'ar' ? 'مُرسَل' : 'Sent' },
            { value: 'received', label: lang === 'ar' ? 'وصل' : 'Received' },
            { value: 'completed', label: lang === 'ar' ? 'مكتمل' : 'Done' },
          ]}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FlaskConical size={28} />}
            title={lang === 'ar' ? 'لا طلبات مختبر' : 'No lab orders'}
            hint={lang === 'ar' ? 'اضغط «طلب جديد» لإضافة أول طلب' : 'Click "New Order" to add the first order'} />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <LabOrderCard key={order.id} order={order}
              currency={currency} lang={lang}
              expanded={expandedId === order.id}
              onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
              onEdit={() => setEditingId(order.id)}
              onDelete={() => deleteLabOrder(order.id)}
              onStatusChange={(s) => updateLabOrder(order.id, { status: s })}
            />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {(addOpen || editingId) && (
        <LabOrderModal
          order={editingId ? labOrders.find((o) => o.id === editingId) : null}
          patients={patients} currency={currency} lang={lang}
          appointments={appointments}
          onSave={(data) => {
            if (editingId) updateLabOrder(editingId, data)
            else addLabOrder(data)
            setAddOpen(false); setEditingId(null)
          }}
          onClose={() => { setAddOpen(false); setEditingId(null) }}
        />
      )}
    </div>
  )
}

function LabOrderCard({ order, currency, lang, expanded, onToggle, onEdit, onDelete, onStatusChange }) {
  const wt = WORK_TYPES.find((w) => w.key === order.workType)
  const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft
  const remaining = Math.max(0, (Number(order.price) || 0) - (Number(order.paid) || 0))
  const StatusIcon = st.icon

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <FlaskConical size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-ink-800">{order.patientName || '—'}</span>
            <Badge color={st.color}><StatusIcon size={11} /> {lang === 'ar' ? st.ar : st.en}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-ink-500">
            {lang === 'ar' ? wt?.ar || order.customWorkType : wt?.en || order.customWorkType}
            {order.labName && <> · <span className="font-semibold">{order.labName}</span></>}
            {order.shade && <> · {lang === 'ar' ? 'اللون:' : 'Shade:'} {order.shade}</>}
            {order.pieces > 1 && <> · {order.pieces} {lang === 'ar' ? 'قطع' : 'pcs'}</>}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
            {order.dueDate && <span>{lang === 'ar' ? 'موعد التسليم:' : 'Due:'} {fmtDate(order.dueDate, lang)}</span>}
            {order.price > 0 && (
              <>
                <span className="font-semibold text-ink-600">{money(order.price, currency)}</span>
                {order.paid > 0 && <span className="text-emerald-600">{lang === 'ar' ? 'مدفوع:' : 'Paid:'} {money(order.paid, currency)}</span>}
                {remaining > 0 && <span className="text-rose-500">{lang === 'ar' ? 'متبقي:' : 'Owed:'} {money(remaining, currency)}</span>}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-brand-600"><Edit2 size={15} /></button>
          <button onClick={onDelete} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15} /></button>
          <button onClick={onToggle} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-ink-100 bg-ink-50/40 px-4 py-3 space-y-3">
          {/* Status change buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-bold text-ink-500 self-center">{lang === 'ar' ? 'الحالة:' : 'Status:'}</span>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <button key={k} onClick={() => onStatusChange(k)}
                className={cx('rounded-lg px-2.5 py-1 text-xs font-bold transition-colors',
                  order.status === k ? 'bg-brand-600 text-white' : 'bg-white text-ink-500 hover:bg-brand-50 hover:text-brand-600')}>
                {lang === 'ar' ? v.ar : v.en}
              </button>
            ))}
          </div>
          {/* Teeth */}
          {order.toothIds?.length > 0 && (
            <p className="text-xs text-ink-500">
              🦷 {lang === 'ar' ? 'الأسنان:' : 'Teeth:'} <span className="font-semibold">{order.toothIds.join(', ')}</span>
            </p>
          )}
          {/* Specs */}
          {order.specs && <p className="text-xs text-ink-600 whitespace-pre-wrap">{order.specs}</p>}
        </div>
      )}
    </div>
  )
}

function LabOrderModal({ order, patients, currency, lang, appointments, onSave, onClose }) {
  const [form, setForm] = useState(order ? {
    patientId: order.patientId || '',
    labName: order.labName || '',
    workType: order.workType || 'crown',
    customWorkType: order.customWorkType || '',
    shade: order.shade || 'A2',
    pieces: order.pieces || 1,
    toothIds: order.toothIds || [],
    specs: order.specs || '',
    price: String(order.price || ''),
    paid: String(order.paid || ''),
    dueDate: order.dueDate || '',
    status: order.status || 'sent',
  } : { ...DEFAULT_FORM })

  const f = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  const selectedPatient = patients.find((p) => p.id === form.patientId)

  // Tooth picker — permanent arch
  const rows = chartRows('permanent')
  const allTeeth = [...rows.upper.right, ...rows.upper.left, ...rows.lower.right, ...rows.lower.left]
  function toggleTooth(id) {
    setForm((prev) => ({
      ...prev,
      toothIds: prev.toothIds.includes(id)
        ? prev.toothIds.filter((t) => t !== id)
        : [...prev.toothIds, id],
    }))
  }

  function submit() {
    const patient = patients.find((p) => p.id === form.patientId)
    onSave({
      ...form,
      patientName: lang === 'ar' ? (patient?.nameAr || patient?.name || '') : (patient?.name || ''),
      price: Number(form.price) || 0,
      paid: Number(form.paid) || 0,
    })
  }

  return (
    <Modal open onClose={onClose} size="xl"
      title={order ? (lang === 'ar' ? 'تعديل طلب مختبر' : 'Edit Lab Order') : (lang === 'ar' ? 'طلب مختبر جديد' : 'New Lab Order')}
      icon={<FlaskConical size={18} className="text-violet-500" />}
      footer={<>
        <button onClick={onClose} className="btn-ghost">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
        <button onClick={submit} className="btn-primary"><Save size={16} /> {lang === 'ar' ? 'حفظ' : 'Save'}</button>
      </>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* Patient */}
        <Field label={lang === 'ar' ? 'المريض' : 'Patient'} required>
          <select className="input" value={form.patientId} onChange={(e) => f('patientId', e.target.value)}>
            <option value="">{lang === 'ar' ? '— اختر مريضاً —' : '— Select patient —'}</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{lang === 'ar' ? (p.nameAr || p.name) : p.name}</option>
            ))}
          </select>
        </Field>

        {/* Lab name */}
        <Field label={lang === 'ar' ? 'اسم المختبر' : 'Lab Name'} required>
          <input className="input" value={form.labName} onChange={(e) => f('labName', e.target.value)}
            placeholder={lang === 'ar' ? 'اسم المختبر…' : 'Lab name…'} />
        </Field>

        {/* Work type */}
        <Field label={lang === 'ar' ? 'نوع الشغل' : 'Work Type'}>
          <select className="input" value={form.workType} onChange={(e) => f('workType', e.target.value)}>
            {WORK_TYPES.map((w) => (
              <option key={w.key} value={w.key}>{lang === 'ar' ? w.ar : w.en}</option>
            ))}
          </select>
        </Field>

        {/* Custom work type */}
        {form.workType === 'custom' && (
          <Field label={lang === 'ar' ? 'وصف الشغل' : 'Describe Work'}>
            <input className="input" value={form.customWorkType} onChange={(e) => f('customWorkType', e.target.value)} />
          </Field>
        )}

        {/* Shade — pick from the list or type any custom shade */}
        <Field label={lang === 'ar' ? 'اللون / الشيد' : 'Shade'} hint={lang === 'ar' ? 'اختر من القائمة أو اكتب لوناً مخصصاً' : 'Pick from the list or type a custom shade'}>
          <input className="input" list="lab-shades" value={form.shade} onChange={(e) => f('shade', e.target.value)}
            placeholder={lang === 'ar' ? 'مثل A2 أو لون مخصص…' : 'e.g. A2 or custom…'} />
          <datalist id="lab-shades">
            {SHADES.map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>

        {/* Pieces */}
        <Field label={lang === 'ar' ? 'عدد القطع' : 'Pieces'}>
          <input type="number" min={1} className="input" value={form.pieces}
            onChange={(e) => f('pieces', Number(e.target.value) || 1)} />
        </Field>

        {/* Price */}
        <Field label={`${lang === 'ar' ? 'سعر المختبر' : 'Lab Price'} (${currency})`}>
          <input type="number" className="input" value={form.price}
            onChange={(e) => f('price', e.target.value)} placeholder="0" />
        </Field>

        {/* Paid */}
        <Field label={`${lang === 'ar' ? 'المدفوع' : 'Paid'} (${currency})`}>
          <input type="number" className="input" value={form.paid}
            onChange={(e) => f('paid', e.target.value)} placeholder="0" />
        </Field>

        {/* Due date */}
        <Field label={lang === 'ar' ? 'موعد الاستلام' : 'Due Date'}>
          <input type="date" className="input" value={form.dueDate}
            onChange={(e) => f('dueDate', e.target.value)} />
        </Field>

        {/* Status */}
        <Field label={lang === 'ar' ? 'الحالة' : 'Status'}>
          <select className="input" value={form.status} onChange={(e) => f('status', e.target.value)}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Specs */}
      <Field label={lang === 'ar' ? 'مواصفات خاصة / ملاحظات' : 'Special Specifications / Notes'} className="mt-3">
        <textarea className="input min-h-[70px] resize-none" rows={3} value={form.specs}
          onChange={(e) => f('specs', e.target.value)}
          placeholder={lang === 'ar' ? 'ملاحظات للمختبر…' : 'Notes for the lab…'} />
      </Field>

      {/* Tooth picker */}
      <div className="mt-4">
        <p className="label mb-2">{lang === 'ar' ? 'الأسنان المطلوب شغلها' : 'Teeth Required'}</p>
        <div dir="ltr" className="overflow-x-auto rounded-xl border border-ink-100 bg-ink-50/40 p-3">
          {[...rows.upper.right, ...rows.upper.left].map && (
            <div className="min-w-max space-y-2">
              {/* Upper */}
              <div className="flex justify-center gap-1">
                {[...rows.upper.right, ...rows.upper.left].map((tt) => (
                  <button key={tt.id} onClick={() => toggleTooth(tt.id)}
                    className={cx('flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold transition-all',
                      form.toothIds.includes(tt.id) ? 'bg-violet-500 text-white' : 'bg-white text-ink-500 hover:bg-violet-50')}>
                    {tt.fdi}
                  </button>
                ))}
              </div>
              <div className="h-px bg-ink-200" />
              {/* Lower */}
              <div className="flex justify-center gap-1">
                {[...rows.lower.right, ...rows.lower.left].map((tt) => (
                  <button key={tt.id} onClick={() => toggleTooth(tt.id)}
                    className={cx('flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold transition-all',
                      form.toothIds.includes(tt.id) ? 'bg-violet-500 text-white' : 'bg-white text-ink-500 hover:bg-violet-50')}>
                    {tt.fdi}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {form.toothIds.length > 0 && (
          <p className="mt-1 text-xs text-ink-400">
            🦷 {form.toothIds.join(', ')}
            <button onClick={() => f('toothIds', [])} className="ms-2 text-rose-400 hover:text-rose-600"><X size={11} /></button>
          </p>
        )}
      </div>
    </Modal>
  )
}
