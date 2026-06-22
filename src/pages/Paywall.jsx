import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Stethoscope, Check, ArrowRight, LogOut, GraduationCap, Building2, Crown, Lock, Landmark, Wallet, Tag, X } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { TIERS, tierPeriodLabel } from '../lib/db'
import { PACKAGE_FEATURES, fullFeatures } from '../lib/packages'
import { startPaypalCheckout, paymentsEnabled, notifyCouponUse } from '../lib/payments'
import { lookupCoupon, applyDiscount } from '../lib/coupons'
import { Spinner } from '../components/ui'
import { cx } from '../lib/utils'
import BankTransferPanel from '../components/BankTransferPanel'
import PaymentHelp from '../components/PaymentHelp'
import logo from '../lib/logo'

const ICONS = { student: GraduationCap, economy: Building2, pro: Crown }

// Pre-fill the code when the owner shares a private link with ?coupon=CODE.
function initialCoupon() {
  try { return new URLSearchParams(window.location.search).get('coupon') || '' }
  catch { return '' }
}

// Shown to a cloud account that hasn't paid yet — they must pay to enter the app.
export default function Paywall() {
  const { t, lang, L, isRTL, toggleLang } = useI18n()
  const { clinic, currentUser, logout } = useStore()
  const [selected, setSelected] = useState(clinic?.tier || 'economy')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [payMethod, setPayMethod] = useState('paypal')
  const [couponInput, setCouponInput] = useState(initialCoupon)
  const coupon = lookupCoupon(couponInput) // { code, percent } | null

  // Price for a tier after applying the active coupon.
  const priceFor = (ti) => (coupon && ti.price > 0 ? applyDiscount(ti.price, coupon.percent) : ti.price)

  // The moment a valid gift code is entered, privately notify the app owner
  // (by email) that this customer applied it — before they pay.
  useEffect(() => {
    if (paymentsEnabled && coupon) notifyCouponUse({ email: currentUser?.email, tier: selected, coupon: coupon.code })
  }, [coupon?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  async function pay() {
    setError(''); setBusy(true)
    const res = await startPaypalCheckout({ tier: selected, clinicId: clinic.id, coupon: coupon?.code, customerName: clinic.name, email: currentUser?.email })
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
                <p className="mt-1 text-2xl font-extrabold text-ink-800" dir="ltr">
                  {coupon && ti.price > 0 && <span className="me-1.5 text-base font-bold text-ink-300 line-through">${ti.price}</span>}
                  ${priceFor(ti)}<span className="text-xs font-normal text-ink-400"> {tierPeriodLabel(ti, t)}</span>
                </p>
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

        <div className="mx-auto mt-6 max-w-md">
          {/* Discount / gift code */}
          <div className="mb-5">
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-white/90">
              <Tag size={15} /> {t('packages.couponLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder={t('packages.couponPlaceholder')}
                dir="ltr"
                className={cx('flex-1 rounded-xl border bg-white/95 px-4 py-2.5 font-bold uppercase tracking-wide text-ink-800 outline-none transition-colors placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-300',
                  coupon ? 'border-emerald-300 ring-2 ring-emerald-300' : couponInput.trim() ? 'border-rose-300 ring-1 ring-rose-200' : 'border-transparent')}
              />
              {couponInput.trim() && (
                <button type="button" onClick={() => setCouponInput('')} className="rounded-xl bg-white/15 px-3 py-2.5 text-white hover:bg-white/25" aria-label={t('common.clear')}>
                  <X size={16} />
                </button>
              )}
            </div>
            {coupon ? (
              <p className="mt-1.5 flex items-center gap-1 text-sm font-bold text-emerald-200">
                <Check size={15} /> {t('packages.couponApplied').replace('{percent}', coupon.percent)}
              </p>
            ) : couponInput.trim() ? (
              <p className="mt-1.5 text-sm font-bold text-rose-200">{t('packages.couponInvalid')}</p>
            ) : null}
          </div>

          <p className="mb-2 text-center text-sm font-bold text-white/90">{t('packages.payHow')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <PwMethodBtn active={payMethod === 'paypal'} onClick={() => setPayMethod('paypal')} icon={<Wallet size={18} />} title="PayPal" sub={t('packages.payPaypalSub')} />
            <PwMethodBtn active={payMethod === 'bank'} onClick={() => setPayMethod('bank')} icon={<Landmark size={18} />} title={t('packages.payBank')} sub={t('packages.payBankSub')} />
          </div>

          {payMethod === 'bank' ? (
            <BankTransferPanel amount={priceFor(tier)} originalAmount={tier.price} coupon={coupon?.code} planLabel={L(tier)} />
          ) : (
            <div className="mt-6 flex flex-col items-center gap-3">
              <button onClick={pay} disabled={busy} className="btn bg-white !px-8 !py-3.5 text-base font-extrabold text-brand-700 hover:bg-white/90">
                {busy ? <Spinner /> : <>{payMethod === 'paypal' ? 'PayPal' : t('packages.pay')} — ${priceFor(tier)} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} /></>}
              </button>
              <p className="text-xs text-white/70">🔒 {t('packages.securePay')}</p>
            </div>
          )}

          <PaymentHelp />
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
