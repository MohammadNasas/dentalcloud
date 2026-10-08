import { useState } from 'react'
import { Calculator, ChevronDown, Save, Check } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { useI18n } from '../i18n/I18nContext'
import { useSaveAction } from '../lib/useSaveAction'
import { DEFAULT_PRICES } from '../lib/treatments'
import { EXPENSE_CATEGORIES, financeMoney } from '../lib/clinicFinances'
import { pricingOverhead, treatmentEstimate, adoptTreatmentPrice } from '../lib/treatmentPricing'

export default function TreatmentPricingPlanner({ month, currency, expenses }) {
  const { clinic } = useStore()
  return <Planner key={`${clinic.id}:${currency}:${month}`} month={month} currency={currency} expenses={expenses} />
}

function Planner({ month, currency, expenses }) {
  const { clinic, updateClinic, readOnly, demoMode, can } = useStore()
  const { lang } = useI18n()
  const ar = lang === 'ar', text = (a, e) => ar ? a : e
  const money = value => financeMoney(value, currency, lang)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => clinic.settings?.pricingPlans?.[currency]?.[month] || {
    hours: '', doctorHourly: '', margin: '', excludedIds: [], treatments: {},
  })
  const catalog = clinic.prices?.length ? clinic.prices : DEFAULT_PRICES
  const [selected, setSelected] = useState(catalog[0]?.key || '')
  const [message, setMessage] = useState('')
  const { saving, runSave } = useSaveAction()
  const locked = readOnly || demoMode || !can('priceCatalog') || saving
  const treatment = draft.treatments?.[selected] || { minutes: '', visits: '', direct: '', max: '' }
  const row = catalog.find(p => p.key === selected)
  const excluded = draft.excludedIds || []
  const overhead = pricingOverhead(expenses, currency, excluded)
  const result = treatmentEstimate({ ...draft, overhead, treatment, currency })
  const patch = value => { setDraft(old => ({ ...old, ...value })); setMessage('') }
  const patchTreatment = value => patch({ treatments: { ...draft.treatments, [selected]: { ...treatment, ...value } } })
  const eligibleExpenses = expenses.filter(e => e.currency === currency && e.category !== 'supplies')
  async function save(adopt = false) {
    if (locked || (adopt && (!result || !row))) return
    await runSave(async () => {
      setMessage('')
      const settings = clinic.settings || {}
      const pricingPlans = settings.pricingPlans || {}
      const changes = { settings: { ...settings, pricingPlans: { ...pricingPlans,
        [currency]: { ...pricingPlans[currency], [month]: draft },
      } } }
      if (adopt) changes.prices = adoptTreatmentPrice(catalog, selected, result.suggested)
      try {
        const saved = await updateClinic(changes)
        const confirmed = saved && (!adopt || saved.prices?.find(p => p.key === selected)?.price === result.suggested)
        setMessage(confirmed
          ? (adopt ? text('تم حفظ الخطة واعتماد سعر العلاج.', 'Plan saved and treatment price adopted.') : text('تم حفظ خطة التسعير.', 'Pricing plan saved.'))
          : text('لم يتم تأكيد الحفظ؛ احتفظنا بمدخلاتك، أعد المحاولة.', 'Save was not confirmed; your inputs are retained. Please retry.'))
      } catch {
        setMessage(text('تعذّر الحفظ؛ تحقق من الاتصال وأعد المحاولة.', 'Could not save. Check your connection and retry.'))
      }
    })
  }
  function input(label, field, value, change, { min = 0, max = 9999999, step = 'any' } = {}) {
    return <label className="block min-w-0 text-xs text-ink-500"><span>{label}</span>
      <input className="input mt-1 !py-2" aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step}
        disabled={locked} value={value ?? ''} onChange={e => change({ [field]: e.target.value })} placeholder="—" />
    </label>
  }
  return <section className="card overflow-hidden">
    <button type="button" className="flex w-full items-center gap-3 p-4 text-start" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="pricing-planner">
      <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><Calculator size={20} /></span>
      <span className="flex-1"><span className="block text-sm font-bold text-ink-800">{text('خطة التسعير من DentalCloud', 'DentalCloud pricing planner')}</span>
        <span className="mt-1 block text-xs text-ink-500">{text('سعر كل علاج بناءً على مصاريفك ووقتك والربح المستهدف.', 'Treatment prices based on your expenses, time, and target profit.')}</span></span>
      <ChevronDown size={18} className={`shrink-0 text-brand-600 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div id="pricing-planner" className="space-y-4 border-t border-ink-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
        <span>{text('مصاريف التشغيل المحتسبة', 'Included overhead')} · {month}</span><strong>{money(overhead)}</strong>
      </div>
      <p className="text-xs leading-6 text-ink-500">{text('اختر شهرًا مكتمل المصاريف من أعلى الصفحة. تُوزّع المصاريف على ساعات علاج المرضى المتوقعة فعليًا، وليس ساعات فتح العيادة. التقدير يتغيّر مع المصاريف المسجّلة.', 'Choose a month with complete expenses above. Overhead is spread over expected patient treatment hours, not clinic opening hours. Estimates change with recorded expenses.')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {input(text('ساعات العلاج المتوقعة بالشهر', 'Expected treatment hours / month'), 'hours', draft.hours, patch, { min: 0.01, max: 10000 })}
        {input(text(`أجر الطبيب بالساعة (${currency})`, `Doctor pay / hour (${currency})`), 'doctorHourly', draft.doctorHourly, patch)}
        {input(text('هامش الربح المستهدف (%)', 'Target profit margin (%)'), 'margin', draft.margin, patch, { max: 95 })}
      </div>
      <details className="rounded-xl border border-ink-100 px-3 py-2 text-xs text-ink-500">
        <summary className="cursor-pointer font-semibold text-ink-700">{text('مراجعة المصاريف ومنع احتسابها مرتين', 'Review expenses and avoid counting costs twice')}</summary>
        <p className="my-2 leading-6">{text('المواد والمستلزمات مستثناة هنا؛ أدخل تكلفة استخدامها لكل علاج أدناه. ألغِ اختيار أي مصروف محسوب ضمن مواد العلاج أو أجر الطبيب، وأي مصروف استثنائي لا يمثل شهرًا عاديًا.', 'Supplies are excluded here; enter their per-treatment cost below. Uncheck costs already included in treatment materials or doctor pay, and exceptional costs that do not represent a normal month.')}</p>
        <div className="max-h-36 space-y-2 overflow-y-auto">{eligibleExpenses.map(e => <label key={e.id} className="flex items-center gap-2">
          <input type="checkbox" disabled={locked} checked={!excluded.includes(e.id)} onChange={event => patch({ excludedIds: event.target.checked ? excluded.filter(id => id !== e.id) : [...excluded, e.id] })} />
          <span className="flex-1">{EXPENSE_CATEGORIES[e.category]?.[lang] || e.category}{e.note ? ` · ${e.note}` : ''}</span><span>{money(e.amount)}</span>
        </label>)}</div>
      </details>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs text-ink-500">{text('العلاج', 'Treatment')}
            <select className="input mt-1 !py-2" aria-label={text('العلاج', 'Treatment')} disabled={saving} value={selected} onChange={e => { setSelected(e.target.value); setMessage('') }}>
              {catalog.map(p => <option key={p.key} value={p.key}>{p[lang] || p.en || p.ar}</option>)}
            </select></label>
          <div className="grid grid-cols-2 gap-3">
            {input(text('دقائق كل جلسة (متوسط)', 'Minutes per visit (average)'), 'minutes', treatment.minutes, patchTreatment, { min: 1, max: 1440 })}
            {input(text('عدد الجلسات', 'Number of visits'), 'visits', treatment.visits, patchTreatment, { min: 1, max: 100, step: 1 })}
            {input(text(`مواد ومختبر لكل العلاج (${currency})`, `Materials & lab for full treatment (${currency})`), 'direct', treatment.direct, patchTreatment)}
            {input(text('أعلى سعر مناسب لعيادتك (اختياري)', 'Your reasonable price ceiling (optional)'), 'max', treatment.max, patchTreatment, { min: 0.001, max: 999999999 })}
          </div>
          <p className="text-[11px] leading-5 text-ink-400">{text('أدخل 0 للتكلفة أو أجر الطبيب إن لم ينطبقا. تكلفة المواد تشمل جميع الجلسات؛ الزرعة والتاج يُحسبان كلٌ على حدة إذا كانا بندين في قائمتك.', 'Enter 0 for costs or doctor pay if not applicable. Materials cover all visits; calculate implant and crown separately when they are separate catalog items.')}</p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-ink-500"><span>{text('السعر المقترح للعلاج كاملًا', 'Suggested price for full treatment')}</span><span>{text('الحالي: ', 'Current: ')}{money(Number(row?.price || 0))}</span></div>
          <p className="my-3 text-3xl font-extrabold text-brand-700">{result ? money(result.suggested) : '—'}</p>
          {result ? <>
            <dl className="space-y-2 text-xs">{[
              [text('حصة مصاريف التشغيل', 'Overhead share'), result.operating],
              [text('أجر الطبيب', 'Doctor pay'), result.doctor],
              [text('مواد ومختبر', 'Materials & lab'), result.direct],
              [text('التكلفة / نقطة التعادل', 'Cost / break-even'), result.cost],
              [text('الربح المتوقع لكل علاج', 'Expected profit per treatment'), result.profit],
            ].map(([name, amount]) => <div key={name} className="flex justify-between gap-2"><dt className="text-ink-500">{name}</dt><dd className="font-semibold text-ink-800">{money(amount)}</dd></div>)}</dl>
            {result.aboveRange && <p role="status" className="mt-3 rounded-lg bg-amber-100 p-2 text-xs leading-5 text-amber-900">{result.belowCost
              ? text('الحد الذي أدخلته أقل من التكلفة. راجع المصاريف أو وقت العلاج؛ البيع بهذا الحد لا يغطي التكلفة.', 'Your ceiling is below cost. Review expenses or treatment time; charging this ceiling would not cover costs.')
              : text('السعر المقترح أعلى من الحد الذي أدخلته. راجع التكاليف أو هامش الربح قبل الاعتماد.', 'The suggestion exceeds your ceiling. Review costs or profit margin before adopting.')}</p>}
          </> : <p className="text-xs leading-6 text-ink-500">{text('أكمل ساعات الشهر، أجر الطبيب، هامش الربح (0–95%)، وبيانات العلاج لعرض تقدير قابل للمراجعة.', 'Complete monthly hours, doctor pay, margin (0–95%), and treatment inputs to see an estimate.')}</p>}
          <button className="btn-primary mt-4 w-full text-xs" disabled={locked || !result || !row} onClick={() => save(true)}><Check size={16} />{text('اعتماد السعر لهذا العلاج', 'Adopt price for this treatment')}</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
        <p className="max-w-xl text-[11px] leading-5 text-ink-500">{text('اقتراح مبني على مدخلاتك، وليس سعر سوق أو ضمان ربح. الاعتماد يحدّث قائمة أسعار العلاجات؛ لا يغيّر فواتير المرضى السابقة. هامش الربح = الربح ÷ سعر البيع.', 'An estimate from your inputs, not a market price or profit guarantee. Adoption updates the price catalog, not existing patient bills. Margin = profit ÷ selling price.')}</p>
        <button className="btn-ghost text-xs" disabled={locked} onClick={() => save()}><Save size={15} />{saving ? text('جارٍ الحفظ…', 'Saving…') : text('حفظ الخطة فقط', 'Save plan only')}</button>
      </div>
      {message && <p role="status" className="rounded-lg bg-ink-50 p-3 text-xs text-ink-700">{message}</p>}
    </div>}
  </section>
}
