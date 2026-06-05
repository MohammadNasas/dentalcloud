import { useState } from 'react'
import { motion } from 'framer-motion'
import { Stethoscope, Check, ArrowRight, LogOut, GraduationCap, Building2, Crown, Lock } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { TIERS, tierPeriodLabel } from '../lib/db'
import { PACKAGE_FEATURES, fullFeatures } from '../lib/packages'
import { startCheckout } from '../lib/payments'
import { Spinner } from '../components/ui'
import { cx } from '../lib/utils'

const ICONS = { student: GraduationCap, economy: Building2, pro: Crown }

// Shown to a cloud account that hasn't paid yet — they must pay to enter the app.
export default function Paywall() {
  const { t, lang, L, isRTL, toggleLang } = useI18n()
  const { clinic, currentUser, logout } = useStore()
  const [selected, setSelected] = useState(clinic?.tier || 'economy')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pay() {
    setError(''); setBusy(true)
    const res = await startCheckout({ tier: selected, clinicId: clinic.id, customerName: clinic.name, email: currentUser?.email })
    if (res.ok && res.url) { window.location.href = res.url; return }
    setBusy(false)
    setError(res.error === 'not_configured' ? t('packages.paymentsSoon') : (res.message || t('packages.payFailed')))
  }

  const tier = TIERS[selected]
  const feats = fullFeatures(selected)

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 via-brand-600 to-teal-800 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur"><Stethoscope size={22} /></div>
            <span className="text-xl font-extrabold">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleLang} className="rounded-xl bg-white/15 px-3 py-2 text-sm font-bold backdrop-blur">{lang === 'ar' ? 'EN' : 'ع'}</button>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-bold backdrop-blur"><LogOut size={15} /> {t('nav.logout')}</button>
          </div>
        </div>

        <div className="text-center text-white">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Lock size={26} />
          </motion.div>
          <h1 className="text-3xl font-extrabold">{t('packages.activateTitle')}</h1>
          <p className="mt-1 text-white/80">{t('packages.activateSub')}</p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {Object.values(TIERS).map((ti) => {
            const Icon = ICONS[ti.id]; const accent = PACKAGE_FEATURES[ti.id].accent
            const active = selected === ti.id
            return (
              <button key={ti.id} onClick={() => setSelected(ti.id)}
                className={cx('card relative p-5 text-start transition-all', active ? 'ring-2 ring-white scale-[1.02]' : 'opacity-90 hover:opacity-100')}>
                {active && <span className="absolute top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white end-3"><Check size={14} /></span>}
                <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: accent }}><Icon size={22} /></div>
                <h3 className="mt-3 font-extrabold text-ink-800">{L(ti)}</h3>
                <p className="mt-1 text-2xl font-extrabold text-ink-800">${ti.price}<span className="text-xs font-normal text-ink-400"> {tierPeriodLabel(ti, t)}</span></p>
              </button>
            )
          })}
        </div>

        {/* Selected plan features */}
        <div className="mt-5 rounded-2xl bg-white/10 p-5 backdrop-blur">
          <div className="grid gap-2 sm:grid-cols-2">
            {feats.slice(0, 8).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-white/90"><Check size={15} className="mt-0.5 shrink-0 text-white" />{L(f)}</div>
            ))}
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-rose-100 px-3 py-2 text-center text-sm font-semibold text-rose-700">{error}</p>}

        <div className="mt-6 flex flex-col items-center gap-3">
          <button onClick={pay} disabled={busy} className="btn bg-white !px-8 !py-3.5 text-base font-extrabold text-brand-700 hover:bg-white/90">
            {busy ? <Spinner /> : <>{t('packages.pay')} — ${tier.price} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} /></>}
          </button>
          <p className="text-xs text-white/70">🔒 {t('packages.securePay')}</p>
        </div>
      </div>
    </div>
  )
}
