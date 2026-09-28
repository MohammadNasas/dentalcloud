import { useState } from 'react'
import { motion } from 'framer-motion'
import { Stethoscope, Check, ArrowRight, LogOut, GraduationCap, Crown, Lock, Landmark, Wallet } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { TIERS, tierPeriodLabel } from '../lib/db'
import { PACKAGE_FEATURES, fullFeatures } from '../lib/packages'
import { startPaypalCheckout, paymentsEnabled } from '../lib/payments'
import { paymentErrorMessage } from '../lib/paymentErrors.js'
import { isInAppBrowser, openInBrowserNotice } from '../lib/inAppBrowser'
import { Spinner } from '../components/ui'
import { cx } from '../lib/utils'
import BankTransferPanel from '../components/BankTransferPanel'
import PaymentHelp from '../components/PaymentHelp'
import logo from '../lib/logo'
import { useSaveAction } from '../lib/useSaveAction'

const ICONS = { student: GraduationCap, pro: Crown }

// Shown to a cloud account that hasn't paid yet — they must pay to enter the app.
export default function Paywall() {
  const { t, lang, L, isRTL, toggleLang } = useI18n()
  const { clinic, currentUser, logout, setTier } = useStore()
  const [selected, setSelected] = useState(clinic?.tier === 'student' ? 'student' : 'pro')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [paidOnly, setPaidOnly] = useState(false)
  const [payMethod, setPayMethod] = useState('paypal')
  const { saving, runSave } = useSaveAction()
  async function pay() {
    setError('')
    // PayPal won't open inside Instagram/Facebook in-app browsers — guide the
    // user to a real browser instead of redirecting into a dead end.
    if (isInAppBrowser()) { openInBrowserNotice(true); return }
    setBusy(true)
    const res = await startPaypalCheckout({ tier: selected, clinicId: clinic.id, customerName: clinic.name, email: currentUser?.email, checkoutMode: paidOnly ? 'paid' : 'trial' })
    if (res.ok && res.url) { window.location.href = res.url; return }
    setBusy(false)
    if (res.error === 'trial_already_used' || res.requiresPaidCheckout) {
      setPaidOnly(true)
      setError(t('packages.trialAlreadyUsed'))
    } else {
      setError(paymentErrorMessage(res, lang))
    }
  }

  function activateFreePlan() { return runSave(async () => {
    setError('')
    await setTier('student')
  }) }

  const tier = TIERS[selected]
  const feats = fullFeatures(selected)

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 via-brand-600 to-teal-800 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-white/15 backdrop-blur"><img src={logo} alt="logo" className="h-full w-full object-cover" /></div>
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

        <div className="mx-auto mt-7 grid max-w-2xl gap-4 sm:grid-cols-2">
          {Object.values(TIERS).map((ti) => {
            const Icon = ICONS[ti.id]; const accent = PACKAGE_FEATURES[ti.id].accent
            const active = selected === ti.id
            return (
              <button key={ti.id} onClick={() => { setSelected(ti.id); setPaidOnly(false); setError('') }}
                className={cx('card relative p-5 text-start transition-all', active ? 'ring-2 ring-white scale-[1.02]' : 'opacity-90 hover:opacity-100')}>
                {active && <span className="absolute top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white end-3"><Check size={14} /></span>}
                <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: accent }}><Icon size={22} /></div>
                <h3 className="mt-3 font-extrabold text-ink-800">{L(ti)}</h3>
                <p className="mt-1 text-2xl font-extrabold text-ink-800" dir="ltr">
                  {ti.price === 0 ? t('packages.free') : (
                    <>
                      ${ti.price}<span className="text-xs font-normal text-ink-400"> {tierPeriodLabel(ti, t)}</span>
                    </>
                  )}
                </p>
                {ti.price > 0 && <p className={cx('mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-extrabold', paidOnly && active ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>{paidOnly && active ? t('packages.noTrialBadge') : t('packages.freeTrialBadge')}</p>}
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
        {paidOnly && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm font-bold text-amber-900">{t('packages.paidWithoutTrialNotice')}</p>}

        <div className="mx-auto mt-6 max-w-md">
          {tier.price === 0 ? (
            <button onClick={activateFreePlan} disabled={saving || busy} className="btn w-full bg-white !py-3.5 text-base font-extrabold text-brand-700 hover:bg-white/90">
              {t('packages.buyNow')} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
            </button>
          ) : (
            <>
              <p className="mb-2 text-center text-sm font-bold text-white/90">{t('packages.payHow')}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <PwMethodBtn active={payMethod === 'paypal'} onClick={() => setPayMethod('paypal')} icon={<Wallet size={18} />} title="PayPal" sub={t('packages.payPaypalSub')} />
                <PwMethodBtn active={payMethod === 'bank'} onClick={() => setPayMethod('bank')} icon={<Landmark size={18} />} title={t('packages.payBank')} sub={t('packages.payBankSub')} />
              </div>

              {payMethod === 'bank' ? (
                <BankTransferPanel amount={tier.price} planLabel={L(tier)} />
              ) : (
                <div className="mt-6 flex flex-col items-center gap-3">
                  <p className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-extrabold leading-relaxed text-amber-900 shadow-sm">
                    {t('packages.paypalNoAccountNote')}
                  </p>
                  <button onClick={pay} disabled={busy} className="btn bg-white !px-8 !py-3.5 text-base font-extrabold text-brand-700 hover:bg-white/90">
                    {busy ? <Spinner /> : <>{paidOnly ? t('packages.continuePaid') : `${t('packages.startTrial')} — ${t('packages.trialToday')}`} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} /></>}
                  </button>
                  <p className="text-xs text-white/70">🔒 {t('packages.securePay')}</p>
                </div>
              )}

              <PaymentHelp />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PwMethodBtn({ active, onClick, icon, title, sub }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('flex items-start gap-2.5 rounded-xl border p-3 text-start backdrop-blur transition-all',
        active ? 'border-white bg-white text-ink-800' : 'border-white/30 bg-white/10 text-white hover:bg-white/20')}>
      <span className={cx('mt-0.5 shrink-0', active ? 'text-brand-600' : 'text-white')}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold">{title}</span>
        <span className={cx('block text-xs', active ? 'text-ink-400' : 'text-white/70')}>{sub}</span>
      </span>
    </button>
  )
}
