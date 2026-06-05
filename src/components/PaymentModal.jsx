import { useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Modal, Field } from './ui'
import { money, PAYMENT_METHODS, cx } from '../lib/utils'

// Shared "record payment" modal used from a patient's payments tab and the
// clinic-wide Payments page. Supports single method (Economy) and split (Pro).
export default function PaymentModal({ patient, onClose }) {
  const { t, lang, L } = useI18n()
  const { addPayment, clinic, can, balanceForPatient } = useStore()
  const currency = clinic?.settings?.currency || 'JOD'
  const debt = balanceForPatient(patient.id).debt

  const [amount, setAmount] = useState(debt > 0 ? String(debt) : '')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [split, setSplit] = useState(false)
  const [single, setSingle] = useState('cash')
  const [rows, setRows] = useState([{ method: 'cash', amount: '' }, { method: 'card', amount: '' }])

  const supportsMethods = can('paymentMethods')
  const supportsSplit = can('splitPayments')

  function save() {
    let methods = []
    let total = Number(amount) || 0
    if (supportsMethods && split && supportsSplit) {
      methods = rows.filter((r) => Number(r.amount) > 0).map((r) => ({ method: r.method, amount: Number(r.amount) }))
      total = methods.reduce((s, m) => s + m.amount, 0)
    } else if (supportsMethods) {
      methods = [{ method: single, amount: total }]
    }
    if (total <= 0) return
    addPayment({ patientId: patient.id, amount: total, methods, note, date: new Date(date).toISOString() })
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="md"
      title={`${t('pay.record')} — ${lang === 'ar' ? patient.nameAr || patient.name : patient.name}`}
      icon={<Wallet size={18} className="text-brand-500" />}
      footer={<><button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button><button onClick={save} className="btn-primary">{t('common.save')}</button></>}>
      <div className="space-y-3">
        {debt > 0 && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{t('pay.debt')}: {money(debt, currency)}</p>}

        {!(supportsMethods && split) && (
          <Field label={`${t('pay.amount')} (${currency})`}>
            <input type="number" className="input text-lg font-bold" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} />
          </Field>
        )}

        {supportsMethods && (
          <Field label={t('pay.method')}>
            {!split ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(PAYMENT_METHODS).map(([k, m]) => (
                  <button key={k} onClick={() => setSingle(k)}
                    className={cx('flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-all',
                      single === k ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-300')}>
                    <span>{m.icon}</span> {L(m)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select className="input flex-1" value={r.method} onChange={(e) => setRows((rs) => rs.map((x, idx) => idx === i ? { ...x, method: e.target.value } : x))}>
                      {Object.entries(PAYMENT_METHODS).map(([k, m]) => <option key={k} value={k}>{m.icon} {L(m)}</option>)}
                    </select>
                    <input type="number" placeholder={currency} className="input w-28" value={r.amount}
                      onChange={(e) => setRows((rs) => rs.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} />
                  </div>
                ))}
                <button onClick={() => setRows((rs) => [...rs, { method: 'insurance', amount: '' }])} className="btn-ghost text-xs text-brand-600"><Plus size={13} /> {t('pay.addMethod')}</button>
              </div>
            )}
            {supportsSplit && (
              <button onClick={() => setSplit(!split)} className="mt-2 text-xs font-bold text-brand-600 hover:underline">
                {split ? t('pay.method') : `+ ${t('pay.mixed')}`}
              </button>
            )}
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('common.date')}><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t('common.notes')}><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  )
}
