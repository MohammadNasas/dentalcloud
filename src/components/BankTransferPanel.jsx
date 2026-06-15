import { useState } from 'react'
import { Copy, Check, Mail, Landmark } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { DENTALCLOUD_BANK, SUPPORT_EMAIL } from '../lib/billing'

// Copyable detail row (IBAN, bank name, …).
function Row({ label, value, mono }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch { /* clipboard blocked — user can still select manually */ }
  }
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-100 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-400">{label}</p>
        <p className={`truncate font-bold text-ink-800 ${mono ? 'font-mono tracking-wide' : ''}`} dir={mono ? 'ltr' : undefined}>{value}</p>
      </div>
      <button onClick={copy} type="button"
        className="flex shrink-0 items-center gap-1 rounded-lg border border-ink-100 px-2.5 py-1.5 text-xs font-bold text-ink-500 hover:border-brand-300 hover:text-brand-600">
        {copied ? <><Check size={13} /> {t('packages.copied')}</> : <><Copy size={13} /> {t('packages.copy')}</>}
      </button>
    </div>
  )
}

// Shown when a clinic chooses to pay its subscription by manual bank transfer.
// `amount` is the plan price in USD; `planLabel` is the localized plan name.
export default function BankTransferPanel({ amount, planLabel }) {
  const { t } = useI18n()
  const bank = DENTALCLOUD_BANK

  if (!bank.iban) {
    return <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{t('packages.bankNotSet')}</p>
  }

  const subject = `DentalCloud — ${planLabel} ($${amount})`
  const body = `Plan: ${planLabel}\nAmount: $${amount}\nClinic name: \nTransfer date: \n\n(Please attach the transfer receipt.)`
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  return (
    <div className="mt-5 rounded-2xl border border-ink-100 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Landmark size={18} /></span>
        <h4 className="font-bold text-ink-800">{t('packages.bankTitle')}</h4>
      </div>

      <div className="mb-3 flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
        <span className="text-sm text-ink-400">{t('packages.bankAmount')}</span>
        <span className="text-xl font-extrabold text-ink-800" dir="ltr">${amount}</span>
      </div>

      <div className="rounded-xl border border-ink-100 px-4">
        <Row label={t('packages.bankIban')} value={bank.iban} mono />
        {bank.bankName && <Row label={t('packages.bankBank')} value={bank.bankName} />}
        {bank.accountHolder && <Row label={t('packages.bankHolder')} value={bank.accountHolder} />}
        {bank.swift && <Row label={t('packages.bankSwift')} value={bank.swift} mono />}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-500">{t('packages.bankSteps')}</p>

      <a href={mailto}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-extrabold text-white hover:bg-brand-700">
        <Mail size={17} /> {t('packages.sendProof')}
      </a>
    </div>
  )
}
