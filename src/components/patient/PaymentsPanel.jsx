import { useState } from 'react'
import { Plus, Trash2, Wallet, Receipt } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { EmptyState, Badge } from '../ui'
import { money, PAYMENT_METHODS, cx } from '../../lib/utils'
import { fmtDate } from '../../lib/dates'
import PaymentModal from '../PaymentModal'

export default function PaymentsPanel({ patient }) {
  const { t, lang, L } = useI18n()
  const { paymentsForPatient, balanceForPatient, deletePayment, clinic } = useStore()
  const [open, setOpen] = useState(false)
  const currency = clinic?.settings?.currency || 'JOD'

  const pays = paymentsForPatient(patient.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const bal = balanceForPatient(patient.id)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xs font-semibold text-ink-400">{t('pay.fees')}</p>
          <p className="mt-1 text-xl font-extrabold text-ink-800">{money(bal.fees, currency)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs font-semibold text-ink-400">{t('pay.paid')}</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-600">{money(bal.paid, currency)}</p>
        </div>
        <div className={cx('card p-4 text-center', bal.debt > 0 && 'ring-1 ring-rose-200')}>
          <p className="text-xs font-semibold text-ink-400">{t('pay.debt')}</p>
          <p className={cx('mt-1 text-xl font-extrabold', bal.debt > 0 ? 'text-rose-500' : 'text-emerald-600')}>{money(bal.debt, currency)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-ink-800">{t('pay.history')}</h3>
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} /> {t('pay.record')}</button>
      </div>

      <div className="card overflow-hidden">
        {pays.length === 0 ? (
          <EmptyState icon={<Receipt size={26} />} title={t('pay.noPayments')} />
        ) : (
          <div className="divide-y divide-ink-50">
            {pays.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Wallet size={18} /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink-800">{money(p.amount, currency)}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
                    <span>{fmtDate(p.date, lang)}</span>
                    {(p.methods || []).map((m, i) => (
                      <Badge key={i} color="brand">{PAYMENT_METHODS[m.method]?.icon} {L(PAYMENT_METHODS[m.method] || { en: m.method })} {p.methods.length > 1 ? money(m.amount, currency) : ''}</Badge>
                    ))}
                    {p.note && <span>· {p.note}</span>}
                  </div>
                </div>
                <button onClick={() => deletePayment(p.id)} className="rounded-lg p-1.5 text-ink-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && <PaymentModal patient={patient} onClose={() => setOpen(false)} />}
    </div>
  )
}
