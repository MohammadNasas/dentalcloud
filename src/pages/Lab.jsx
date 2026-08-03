import { useState, useMemo } from 'react'
import {
  FlaskConical, Plus, Trash2, Search, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Truck, PackageCheck, Edit2, X, Save, Phone, BookUser, Copy, Check,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Modal, Field, Segmented, Badge, EmptyState } from '../components/ui'
import FeatureLock from '../components/FeatureLock'
import PageHero from '../components/PageHero'
import { fmtDate } from '../lib/dates'
import { money, cx, waLink, waNumber, buildLabOrderWhatsAppMessage } from '../lib/utils'
import { genId } from '../lib/db'
import { chartRows } from '../lib/teeth'
import WhatsAppIcon from '../components/WhatsAppIcon'

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
  labId: '', labName: '', labPhone: '', workType: 'crown', customWorkType: '',
  shade: 'A2', pieces: '1', toothIds: [], specs: '',
  price: '', paid: '', dueDate: '',
  status: 'sent',
}

export default function Lab() {
  const { can } = useStore()
  if (!can('lab')) return <FeatureLock feature="lab" />
  return <LabContent />
}

function LabContent() {
  const { lang } = useI18n()
  const { labOrders = [], addLabOrder, updateLabOrder, deleteLabOrder,
          clinic, updateClinic } = useStore()
  const currency = clinic?.settings?.currency || 'JOD'
  const labs = clinic?.labs || []

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [labsOpen, setLabsOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = [...labOrders].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    if (filterStatus !== 'all') list = list.filter((o) => o.status === filterStatus)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((o) =>
        (o.labName || '').toLowerCase().includes(q) ||
        (o.customWorkType || '').toLowerCase().includes(q) ||
        (o.specs || '').toLowerCase().includes(q)
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
      <PageHero
        icon={<FlaskConical size={22} />}
        title={lang === 'ar' ? 'إدارة المختبر' : 'Lab Management'}
        subtitle={lang === 'ar' ? 'تتبّع طلبات المختبر والمدفوعات' : 'Track lab orders and payments'}
        actions={<div className="flex flex-wrap gap-2">
          <button onClick={() => setLabsOpen(true)} className="btn bg-white/15 font-bold text-white ring-1 ring-white/20 hover:bg-white/25">
            <BookUser size={16} /> {lang === 'ar' ? 'المختبرات' : 'Labs'}
          </button>
          <button onClick={() => setAddOpen(true)} className="btn bg-white font-bold text-brand-700 hover:bg-white/90">
            <Plus size={16} /> {lang === 'ar' ? 'طلب جديد' : 'New Order'}
          </button>
        </div>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: lang === 'ar' ? 'إجمالي الطلبات' : 'Total Orders', value: labOrders.length },
            { label: lang === 'ar' ? 'قيد الانتظار' : 'Pending', value: pending },
            { label: lang === 'ar' ? 'إجمالي المدفوع' : 'Total Paid', value: money(totalPaid, currency) },
            { label: lang === 'ar' ? 'المتبقي للمختبر' : 'Owed to Lab', value: money(totalOwed, currency) },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl bg-white/10 p-3.5 backdrop-blur ring-1 ring-white/10">
              <p className="text-[11px] font-semibold text-white/70">{s.label}</p>
              <p className="mt-1 text-xl font-extrabold">{s.value}</p>
            </div>
          ))}
        </div>
      </PageHero>

      {/* Saved labs directory */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-ink-800"><BookUser size={18} className="text-violet-500" /> {lang === 'ar' ? 'المختبرات المحفوظة' : 'Saved Labs'}</h2>
            <p className="mt-0.5 text-xs text-ink-400">{lang === 'ar' ? 'احفظ اسم المختبر ورقم واتسابه مرة واحدة ثم اختره داخل أي طلب.' : 'Save each lab and its WhatsApp number once, then select it in any order.'}</p>
          </div>
          <button onClick={() => setLabsOpen(true)} className="btn-outline !py-2"><Plus size={15} /> {lang === 'ar' ? 'إضافة / تعديل' : 'Add / edit'}</button>
        </div>
        {labs.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {labs.map((lab) => (
              <div key={lab.id} className="flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><FlaskConical size={17} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-700">{lab.name}</p>
                  <p dir="ltr" className="truncate text-start text-xs text-ink-400">{lab.phone}</p>
                </div>
                {waNumber(lab.phone).length >= 8 && (
                  <a href={waLink(lab.phone)} target="_blank" rel="noopener noreferrer" title={lang === 'ar' ? 'فتح واتساب المختبر' : 'Open lab WhatsApp'}
                    className="rounded-lg bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100"><WhatsAppIcon size={16} /></a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <button onClick={() => setLabsOpen(true)} className="mt-3 w-full rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-4 text-sm font-semibold text-violet-600 hover:bg-violet-50">
            {lang === 'ar' ? '+ أضف أول مختبر ورقم واتسابه' : '+ Add the first lab and WhatsApp number'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 text-ink-400 start-3" />
          <input className="input ps-9" placeholder={lang === 'ar' ? 'بحث بالمختبر أو تفاصيل الطلب…' : 'Search lab or order details…'}
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
              currency={currency} lang={lang} clinic={clinic} labs={labs}
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
          currency={currency} lang={lang} clinic={clinic} labs={labs}
          onManageLabs={() => { setAddOpen(false); setEditingId(null); setLabsOpen(true) }}
          onSave={(data) => {
            if (editingId) updateLabOrder(editingId, data)
            else addLabOrder(data)
            setAddOpen(false); setEditingId(null)
          }}
          onClose={() => { setAddOpen(false); setEditingId(null) }}
        />
      )}

      {labsOpen && (
        <LabsDirectoryModal
          labs={labs} lang={lang}
          onSave={(nextLabs) => { updateClinic({ labs: nextLabs }); setLabsOpen(false) }}
          onClose={() => setLabsOpen(false)}
        />
      )}
    </div>
  )
}

function LabOrderCard({ order, currency, lang, clinic, labs, expanded, onToggle, onEdit, onDelete, onStatusChange }) {
  const [copied, setCopied] = useState(false)
  const wt = WORK_TYPES.find((w) => w.key === order.workType)
  const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft
  const remaining = Math.max(0, (Number(order.price) || 0) - (Number(order.paid) || 0))
  const StatusIcon = st.icon
  const savedLab = labs.find((lab) => lab.id === order.labId)
  const labPhone = savedLab?.phone || order.labPhone || ''
  const workType = order.workType === 'custom'
    ? order.customWorkType
    : (lang === 'ar' ? wt?.ar : wt?.en)
  const message = buildLabOrderWhatsAppMessage({
    lang,
    clinicName: lang === 'ar' ? clinic?.nameAr || clinic?.name : clinic?.name,
    labName: savedLab?.name || order.labName,
    workType,
    teeth: order.toothIds || [],
    shade: order.shade,
    pieces: order.pieces,
    dueDate: order.dueDate ? fmtDate(order.dueDate, lang) : '',
    specs: order.specs,
    price: Number(order.price) > 0 ? money(order.price, currency) : '',
    paid: Number(order.paid) > 0 ? money(order.paid, currency) : '',
    remaining: remaining > 0 ? money(remaining, currency) : '',
  })

  async function copyOrder() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = message
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch (error) {
      console.error('copy lab order failed', error)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <FlaskConical size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-ink-800">{workType || (lang === 'ar' ? 'طلب مختبر' : 'Lab order')}</span>
            <Badge color={st.color}><StatusIcon size={11} /> {lang === 'ar' ? st.ar : st.en}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-ink-500">
            {(savedLab?.name || order.labName) && <span className="font-semibold">{savedLab?.name || order.labName}</span>}
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
          <button type="button" onClick={copyOrder}
            aria-label={lang === 'ar' ? 'نسخ الطلب كاملًا' : 'Copy full order'}
            title={copied ? (lang === 'ar' ? 'تم نسخ الطلب' : 'Order copied') : (lang === 'ar' ? 'نسخ الطلب كاملًا' : 'Copy full order')}
            className={cx('rounded-lg p-1.5 transition-colors', copied ? 'bg-violet-100 text-violet-600' : 'bg-violet-50 text-violet-600 hover:bg-violet-100')}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
          {waNumber(labPhone).length >= 8 && (
            <a href={waLink(labPhone, message)} target="_blank" rel="noopener noreferrer"
              title={lang === 'ar' ? 'إرسال الطلب للمختبر عبر واتساب' : 'Send order to lab on WhatsApp'}
              className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100"><WhatsAppIcon size={15} /></a>
          )}
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
          {waNumber(labPhone).length >= 8 ? (
            <a href={waLink(labPhone, message)} target="_blank" rel="noopener noreferrer"
              className="btn !py-2 bg-emerald-500 text-white hover:bg-emerald-600">
              <WhatsAppIcon size={16} /> {lang === 'ar' ? 'إرسال الطلب كاملًا على واتساب المختبر' : 'Send full order to lab WhatsApp'}
            </a>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              {lang === 'ar' ? 'أضف رقم واتساب لهذا المختبر لتتمكن من إرسال الطلب بضغطة.' : 'Add this lab’s WhatsApp number to send the order in one click.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function LabOrderModal({ order, currency, lang, clinic, labs, onManageLabs, onSave, onClose }) {
  const matchedLab = order && (labs.find((lab) => lab.id === order.labId) || labs.find((lab) => lab.name === order.labName))
  const [form, setForm] = useState(order ? {
    labId: matchedLab?.id || '',
    labName: matchedLab?.name || order.labName || '',
    labPhone: matchedLab?.phone || order.labPhone || '',
    workType: order.workType || 'crown',
    customWorkType: order.customWorkType || '',
    shade: order.shade || 'A2',
    pieces: String(order.pieces || 1),
    toothIds: order.toothIds || [],
    specs: order.specs || '',
    price: String(order.price || ''),
    paid: String(order.paid || ''),
    dueDate: order.dueDate || '',
    status: order.status || 'sent',
  } : { ...DEFAULT_FORM })

  const f = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  function selectLab(labId) {
    const lab = labs.find((item) => item.id === labId)
    setForm((prev) => ({ ...prev, labId, labName: lab?.name || '', labPhone: lab?.phone || '' }))
  }

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

  function buildData(statusOverride) {
    return {
      ...form,
      status: statusOverride || form.status,
      patientId: undefined,
      patientName: undefined,
      pieces: Math.max(1, Number(form.pieces) || 1),
      price: Number(form.price) || 0,
      paid: Number(form.paid) || 0,
    }
  }

  function submit(sendWhatsApp = false) {
    const data = buildData(sendWhatsApp ? 'sent' : undefined)
    if (sendWhatsApp && waNumber(data.labPhone).length >= 8) {
      const wt = WORK_TYPES.find((item) => item.key === data.workType)
      const remaining = Math.max(0, data.price - data.paid)
      const message = buildLabOrderWhatsAppMessage({
        lang,
        clinicName: lang === 'ar' ? clinic?.nameAr || clinic?.name : clinic?.name,
        labName: data.labName,
        workType: data.workType === 'custom' ? data.customWorkType : (lang === 'ar' ? wt?.ar : wt?.en),
        teeth: data.toothIds,
        shade: data.shade,
        pieces: data.pieces,
        dueDate: data.dueDate ? fmtDate(data.dueDate, lang) : '',
        specs: data.specs,
        price: data.price > 0 ? money(data.price, currency) : '',
        paid: data.paid > 0 ? money(data.paid, currency) : '',
        remaining: remaining > 0 ? money(remaining, currency) : '',
      })
      window.open(waLink(data.labPhone, message), '_blank', 'noopener,noreferrer')
    }
    onSave(data)
  }

  return (
    <Modal open onClose={onClose} size="xl"
      title={order ? (lang === 'ar' ? 'تعديل طلب مختبر' : 'Edit Lab Order') : (lang === 'ar' ? 'طلب مختبر جديد' : 'New Lab Order')}
      icon={<FlaskConical size={18} className="text-violet-500" />}
      footer={<>
        <button onClick={onClose} className="btn-ghost">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
        <button onClick={() => submit(false)} disabled={!form.labId} className="btn-outline"><Save size={16} /> {lang === 'ar' ? 'حفظ' : 'Save'}</button>
        <button onClick={() => submit(true)} disabled={!form.labId || waNumber(form.labPhone).length < 8}
          className="btn bg-emerald-500 text-white hover:bg-emerald-600"><WhatsAppIcon size={16} /> {lang === 'ar' ? 'حفظ وإرسال واتساب' : 'Save & send WhatsApp'}</button>
      </>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* Saved lab */}
        <Field label={lang === 'ar' ? 'المختبر' : 'Lab'} required hint={form.labPhone ? `${lang === 'ar' ? 'واتساب' : 'WhatsApp'}: ${form.labPhone}` : undefined}>
          <div className="flex gap-2">
            <select className="input" value={form.labId} onChange={(e) => selectLab(e.target.value)}>
              <option value="">{lang === 'ar' ? '— اختر مختبراً —' : '— Select lab —'}</option>
              {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name} · {lab.phone}</option>)}
            </select>
            <button type="button" onClick={onManageLabs} className="btn-outline shrink-0 !px-3" title={lang === 'ar' ? 'إدارة المختبرات' : 'Manage labs'}><Plus size={16} /></button>
          </div>
          {labs.length === 0 && <button type="button" onClick={onManageLabs} className="mt-2 text-xs font-bold text-violet-600 hover:underline">{lang === 'ar' ? 'أضف مختبراً ورقم واتسابه أولًا' : 'Add a lab and its WhatsApp number first'}</button>}
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
          <input type="number" min={1} step={1} className="input" value={form.pieces}
            onChange={(e) => f('pieces', e.target.value)}
            onBlur={() => f('pieces', String(Math.max(1, Number(form.pieces) || 1)))} />
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

function LabsDirectoryModal({ labs, lang, onSave, onClose }) {
  const [rows, setRows] = useState(() => labs.length
    ? labs.map((lab) => ({ ...lab }))
    : [{ id: genId('lab'), name: '', phone: '' }])
  const [error, setError] = useState('')

  function updateRow(id, patch) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    setError('')
  }

  function removeRow(row) {
    if (row.name && !confirm(lang === 'ar' ? `حذف المختبر «${row.name}»؟` : `Delete “${row.name}”?`)) return
    setRows((current) => current.filter((item) => item.id !== row.id))
  }

  function save() {
    const entered = rows.filter((row) => row.name.trim() || row.phone.trim())
    const incomplete = entered.some((row) => !row.name.trim() || waNumber(row.phone).length < 8)
    if (incomplete) {
      setError(lang === 'ar'
        ? 'أدخل اسمًا ورقم واتساب صحيحًا مع رمز الدولة لكل مختبر.'
        : 'Enter a name and valid WhatsApp number with country code for every lab.')
      return
    }
    onSave(entered.map((row) => ({ id: row.id || genId('lab'), name: row.name.trim(), phone: row.phone.trim() })))
  }

  return (
    <Modal open onClose={onClose} size="lg"
      title={lang === 'ar' ? 'دليل المختبرات' : 'Labs Directory'}
      icon={<BookUser size={18} className="text-violet-500" />}
      footer={<>
        <button onClick={onClose} className="btn-ghost">{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
        <button onClick={save} className="btn-primary"><Save size={16} /> {lang === 'ar' ? 'حفظ المختبرات' : 'Save labs'}</button>
      </>}
    >
      <p className="mb-4 text-sm text-ink-500">
        {lang === 'ar' ? 'أضف اسم كل مختبر ورقم واتسابه. اكتب الرقم مع رمز الدولة، مثل: +962… أو +970…' : 'Add each lab and its WhatsApp number. Include the country code, for example +962… or +970…'}
      </p>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-2 rounded-xl border border-ink-100 bg-ink-50/40 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label={lang === 'ar' ? 'اسم المختبر' : 'Lab name'} required>
              <input className="input" value={row.name} onChange={(e) => updateRow(row.id, { name: e.target.value })}
                placeholder={lang === 'ar' ? 'مثال: مختبر الإتقان' : 'e.g. Master Dental Lab'} />
            </Field>
            <Field label={lang === 'ar' ? 'رقم واتساب المختبر' : 'Lab WhatsApp'} required>
              <div className="relative">
                <Phone size={15} className="absolute top-1/2 -translate-y-1/2 text-ink-400 start-3" />
                <input dir="ltr" type="tel" className="input ps-9 text-start" value={row.phone}
                  onChange={(e) => updateRow(row.id, { phone: e.target.value })} placeholder="+962 7…" />
              </div>
            </Field>
            <button type="button" onClick={() => removeRow(row)} className="btn-ghost !px-3 text-rose-500 hover:bg-rose-50" title={lang === 'ar' ? 'حذف' : 'Delete'}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows((current) => [...current, { id: genId('lab'), name: '', phone: '' }])}
        className="btn-soft mt-3"><Plus size={15} /> {lang === 'ar' ? 'إضافة مختبر آخر' : 'Add another lab'}</button>
      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
    </Modal>
  )
}
