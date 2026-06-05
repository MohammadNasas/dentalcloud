import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, TrendingUp, CircleDollarSign, CheckCircle2, HandCoins, Receipt } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Avatar, EmptyState, Stat, Badge, SearchInput } from '../components/ui'
import PaymentModal from '../components/PaymentModal'
import { money, PAYMENT_METHODS } from '../lib/utils'
import { fmtDate } from '../lib/dates'

export default function Payments() {
  const { t, lang, L } = useI18n()
  const navigate = useNavigate()
  const { patients, payments, clinic, can, balanceForPatient, getPatient } = useStore()
  const currency = clinic?.settings?.currency || 'JOD'
  const [collectFor, setCollectFor] = useState(null)
  const [q, setQ] = useState('')

  const balances = useMemo(
    () => patients.map((p) => ({ patient: p, ...balanceForPatient(p.id) })),
    [patients, balanceForPatient]
  )
  const totalBilled = balances.reduce((s, b) => s + b.fees, 0)
  const totalPaid = balances.reduce((s, b) => s + b.paid, 0)
  const totalDue = balances.reduce((s, b) => s + b.debt, 0)

  const debtors = balances
    .filter((b) => b.debt > 0)
    .filter((b) => !q || (b.patient.name + b.patient.nameAr).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.debt - a.debt)

  const recentPayments = [...payments].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 12)

  // Payment method breakdown
  const methodTotals = useMemo(() => {
    const m = {}
    payments.forEach((p) => (p.methods || []).forEach((x) => { m[x.method] = (m[x.method] || 0) + x.amount }))
    return m
  }, [payments])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={<Receipt size={22} />} label={t('pay.totalBilled')} value={money(totalBilled, currency)} color="blue" />
        <Stat icon={<TrendingUp size={22} />} label={t('pay.totalPaid')} value={money(totalPaid, currency)} color="green" />
        <Stat icon={<CircleDollarSign size={22} />} label={t('pay.totalDue')} value={money(totalDue, currency)} color="rose" />
      </div>

      {can('paymentMethods') && Object.keys(methodTotals).length > 0 && (
        <div className="card p-4">
          <p className="mb-3 text-xs font-bold text-ink-500">{t('reports.paymentMethods')}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(methodTotals).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2">
                <span className="text-lg">{PAYMENT_METHODS[k]?.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-ink-400">{L(PAYMENT_METHODS[k] || { en: k })}</p>
                  <p className="text-sm font-bold text-ink-800">{money(v, currency)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Who owes */}
        <div className="card overflow-hidden lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3.5">
            <h3 className="flex items-center gap-2 font-bold text-ink-800"><HandCoins size={18} className="text-rose-500" /> {t('pay.whoOwes')}</h3>
            <div className="w-44"><SearchInput value={q} onChange={setQ} placeholder={t('common.search')} /></div>
          </div>
          {debtors.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={28} />} title={t('dashboard.nothingDue')} />
          ) : (
            <div className="divide-y divide-ink-50">
              {debtors.map((b) => (
                <div key={b.patient.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={b.patient.name} size={40} />
                  <button onClick={() => navigate(`/patients/${b.patient.id}`)} className="min-w-0 flex-1 text-start">
                    <p className="truncate font-bold text-ink-800">{lang === 'ar' ? b.patient.nameAr || b.patient.name : b.patient.name}</p>
                    <p className="text-xs text-ink-400">{money(b.paid, currency)} / {money(b.fees, currency)} {t('pay.paid')}</p>
                  </button>
                  <div className="text-end">
                    <p className="font-extrabold text-rose-500">{money(b.debt, currency)}</p>
                  </div>
                  <button onClick={() => setCollectFor(b.patient)} className="btn-soft !py-1.5 !px-3 text-xs">{t('pay.collect')}</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent payments */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-ink-100 px-5 py-3.5">
            <h3 className="flex items-center gap-2 font-bold text-ink-800"><Wallet size={18} className="text-emerald-500" /> {t('pay.history')}</h3>
          </div>
          {recentPayments.length === 0 ? (
            <EmptyState icon={<Receipt size={26} />} title={t('pay.noPayments')} />
          ) : (
            <div className="max-h-[420px] divide-y divide-ink-50 overflow-y-auto">
              {recentPayments.map((p) => {
                const pt = getPatient(p.patientId)
                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Avatar name={pt?.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-700">{lang === 'ar' ? pt?.nameAr || pt?.name : pt?.name}</p>
                      <p className="text-xs text-ink-400">{fmtDate(p.date, lang)} {(p.methods || []).map((m) => PAYMENT_METHODS[m.method]?.icon).join(' ')}</p>
                    </div>
                    <span className="font-bold text-emerald-600">{money(p.amount, currency)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {collectFor && <PaymentModal patient={collectFor} onClose={() => setCollectFor(null)} />}
    </div>
  )
}
