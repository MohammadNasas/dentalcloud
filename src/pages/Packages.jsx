import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Sparkles, Crown, GraduationCap, Building2, X, ArrowRight, Star, Landmark, Wallet, Tag } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { TIERS, tierPeriodLabel } from '../lib/db'
import { PACKAGE_FEATURES, fullFeatures } from '../lib/packages'
import { Modal, Spinner } from '../components/ui'
import { cx } from '../lib/utils'
import { paymentsEnabled, startPaypalCheckout, notifyCouponUse } from '../lib/payments'
import { lookupCoupon, applyDiscount } from '../lib/coupons'
import { ChartPreview, CalendarPreview, DashboardPreview } from '../components/PackagePreviews'
import BankTransferPanel from '../components/BankTransferPanel'
import PaymentHelp from '../components/PaymentHelp'

const ICONS = { student: GraduationCap, economy: Building2, pro: Crown }

// Tier ranking (student < economy < pro) so we can block downgrades.
const TIER_ORDER = Object.keys(TIERS)
const tierRank = (id) => TIER_ORDER.indexOf(id)

// Pre-fill the promo code when the marketing site deep-links with ?coupon=CODE.
function initialCoupon() {
  try { return new URLSearchParams(window.location.search).get('coupon') || '' }
  catch { return '' }
}

export default function Packages() {
  const { t, lang, L, isRTL } = useI18n()
  const { clinic, currentUser, setTier } = useStore()
  const [buying, setBuying] = useState(null)
  const [activated, setActivated] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [processing, setProcessing] = useState(false)
  const [payError, setPayError] = useState('')
  const [payMethod, setPayMethod] = useState('paypal')
  const [couponInput, setCouponInput] = useState(initialCoupon)
  const current = clinic?.tier
  const coupon = lookupCoupon(couponInput) // { code, percent } | null

  // Price for a tier after applying the active coupon (paid tiers only).
  const priceFor = (tier) => (coupon && tier.price > 0 ? applyDiscount(tier.price, coupon.percent) : tier.price)

  // Privately notify the app owner the moment a valid gift code is applied.
  useEffect(() => {
    if (paymentsEnabled && coupon) notifyCouponUse({ email: currentUser?.email, tier: buying || current, coupon: coupon.code })
  }, [coupon?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmBuy() {
    setPayError('')
    // Never let a paid clinic downgrade to a lower (e.g. free Student) plan.
    if (current && tierRank(buying) < tierRank(current)) { setBuying(null); return }
    // The Student plan is free — activate it instantly, no payment.
    if (TIERS[buying].price === 0) {
      setTier(buying)
      setActivated(true)
      setTimeout(() => { setBuying(null); setActivated(false) }, 1600)
      return
    }
    if (paymentsEnabled) {
      setProcessing(true)
      const res = await startPaypalCheckout({ tier: buying, clinicId: clinic.id, coupon: coupon?.code, customerName: clinic.name, email: currentUser?.email })
      if (res.ok && res.url) { window.location.href = res.url; return }
      setProcessing(false)
      setPayError(res.error === 'not_configured' ? t('packages.paymentsSoon') : (res.message || t('packages.payFailed')))
      return
    }
    // Local/demo mode → activate instantly (no real billing).
    setTier(buying)
    setActivated(true)
    setTimeout(() => { setBuying(null); setActivated(false) }, 1600)
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-extrabold text-ink-800">
          {t('packages.title')}
        </motion.h1>
        <p className="mt-2 text-ink-400">{t('packages.subtitle')}</p>
      </div>

      {/* Preview gallery */}
      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-500"><Sparkles size={16} className="text-brand-500" /> {t('packages.screenshotsTitle')}</p>
        <div className="grid gap-4 md:grid-cols-3">
          <PreviewCard title={lang === 'ar' ? 'مخطط الأسنان' : 'Dental chart'}><ChartPreview /></PreviewCard>
          <PreviewCard title={lang === 'ar' ? 'تقويم المواعيد' : 'Calendar'}><CalendarPreview /></PreviewCard>
          <PreviewCard title={lang === 'ar' ? 'لوحة المعلومات' : 'Dashboard'}><DashboardPreview /></PreviewCard>
        </div>
      </div>

      {/* Promo / discount code */}
      <div className="mx-auto max-w-md">
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-ink-600">
          <Tag size={15} className="text-brand-500" /> {t('packages.couponLabel')}
        </label>
        <div className="flex items-center gap-2">
          <input
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder={t('packages.couponPlaceholder')}
            dir="ltr"
            className={cx('flex-1 rounded-xl border bg-white px-4 py-2.5 font-bold tracking-wide text-ink-800 uppercase outline-none transition-colors placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-300',
              coupon ? 'border-emerald-400 ring-1 ring-emerald-300' : couponInput.trim() ? 'border-rose-300' : 'border-ink-200 focus:border-brand-400')}
          />
          {couponInput.trim() && (
            <button type="button" onClick={() => setCouponInput('')} className="rounded-xl border border-ink-200 px-3 py-2.5 text-ink-400 hover:text-ink-600" aria-label={t('common.clear')}>
              <X size={16} />
            </button>
          )}
        </div>
        {coupon ? (
          <p className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-emerald-600">
            <Check size={15} /> {t('packages.couponApplied').replace('{percent}', coupon.percent)}
          </p>
        ) : couponInput.trim() ? (
          <p className="mt-1.5 text-sm font-semibold text-rose-500">{t('packages.couponInvalid')}</p>
        ) : null}
      </div>

      {/* Pricing cards */}
      <div className="grid gap-5 lg:grid-cols-3">
        {Object.values(TIERS).map((tier, idx) => {
          const Icon = ICONS[tier.id]
          const accent = PACKAGE_FEATURES[tier.id].accent
          const isCurrent = current === tier.id
          const isDowngrade = current && tierRank(tier.id) < tierRank(current)
          const popular = tier.id === 'economy'
          const features = fullFeatures(tier.id)
          const own = PACKAGE_FEATURES[tier.id].features
          const inheritsId = PACKAGE_FEATURES[tier.id].inherits
          const isExpanded = expanded[tier.id]
          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}
              className={cx('card relative flex flex-col overflow-hidden p-6', popular && 'ring-2 ring-brand-400')}
            >
              {popular && (
                <div className="absolute top-0 flex items-center gap-1 rounded-b-lg bg-brand-500 px-3 py-1 text-xs font-bold text-white end-5">
                  <Star size={12} /> {t('packages.mostPopular')}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ background: accent }}>
                  <Icon size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-ink-800">{L(tier)}</h3>
                  <p className="text-xs font-semibold text-ink-400">{t(`tier.${tier.id}Tag`)}</p>
                </div>
              </div>

              <div className="mt-4 flex items-end gap-1">
                {tier.price === 0 ? (
                  <span className="text-4xl font-extrabold text-ink-800">{t('packages.free')}</span>
                ) : coupon ? (
                  <>
                    <span className="text-lg font-bold text-ink-300 line-through" dir="ltr">${tier.price}</span>
                    <span className="text-4xl font-extrabold text-ink-800" dir="ltr">${priceFor(tier)}</span>
                    <span className="mb-1 text-sm text-ink-400"> {tierPeriodLabel(tier, t)}</span>
                  </>
                ) : (
                  <>
                    <span className="text-4xl font-extrabold text-ink-800">${tier.price}</span>
                    <span className="mb-1 text-sm text-ink-400"> {tierPeriodLabel(tier, t)}</span>
                  </>
                )}
              </div>
              {coupon && tier.price > 0 && (
                <p className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  <Tag size={11} /> {coupon.code} · {t('packages.couponOff').replace('{percent}', coupon.percent)}
                </p>
              )}
              <p className="mt-2 text-sm text-ink-500">{t(`packages.${tier.id}Desc`)}</p>

              <div className="my-5 h-px bg-ink-100" />

              <ul className="mb-4 flex-1 space-y-2.5">
                {isExpanded ? (
                  features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: accent }} /><span>{L(f)}</span>
                    </li>
                  ))
                ) : (
                  <>
                    {inheritsId && (
                      <li className="flex items-start gap-2 text-sm font-bold" style={{ color: accent }}>
                        <Check size={16} className="mt-0.5 shrink-0" /> {t('packages.everythingIn')} «{L(TIERS[inheritsId])}»
                      </li>
                    )}
                    {own.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                        <Check size={16} className="mt-0.5 shrink-0" style={{ color: accent }} /><span>{L(f)}</span>
                      </li>
                    ))}
                  </>
                )}
              </ul>
              {inheritsId && (
                <button onClick={() => setExpanded((e) => ({ ...e, [tier.id]: !e[tier.id] }))}
                  className="mb-4 text-start text-xs font-bold hover:underline" style={{ color: accent }}>
                  {isExpanded ? t('common.less') : (lang === 'ar' ? 'عرض كل المزايا' : 'See all features')}
                </button>
              )}

              {isCurrent ? (
                <button disabled className="btn w-full bg-ink-100 text-ink-500">
                  <Check size={16} /> {t('packages.current')}
                </button>
              ) : isDowngrade ? (
                <button disabled className="btn w-full cursor-not-allowed bg-ink-100 text-ink-400">
                  <Check size={16} /> {t('packages.includedInPlan')}
                </button>
              ) : (
                <button onClick={() => setBuying(tier.id)} className="btn w-full text-white" style={{ background: accent }}>
                  {t('packages.buyNow')} <ArrowRight size={16} className={isRTL ? 'rotate-180' : ''} />
                </button>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Purchase modal */}
      {buying && (
        <Modal open onClose={() => { setActivated(false); setBuying(null); setPayError(''); setProcessing(false) }} size="lg"
          title={`${t('packages.whatYouGet')} — ${L(TIERS[buying])}`}
          icon={<Sparkles size={18} style={{ color: PACKAGE_FEATURES[buying].accent }} />}
        >
          {activated ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check size={32} />
              </motion.div>
              <p className="text-lg font-bold text-ink-800">{t('packages.activated')} 🎉</p>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="overflow-hidden rounded-xl border border-ink-100"><ChartPreview small /></div>
                <div className="overflow-hidden rounded-xl border border-ink-100"><CalendarPreview small /></div>
                <div className="overflow-hidden rounded-xl border border-ink-100"><DashboardPreview small /></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {fullFeatures(buying).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-ink-50/60 px-3 py-2 text-sm text-ink-600">
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: PACKAGE_FEATURES[buying].accent }} />
                    {L(f)}
                  </div>
                ))}
              </div>
              {payError && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{payError}</p>}

              {paymentsEnabled && TIERS[buying].price > 0 && (
                <>
                  <p className="mt-5 mb-2 text-sm font-bold text-ink-600">{t('packages.payHow')}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <MethodBtn active={payMethod === 'paypal'} onClick={() => setPayMethod('paypal')} accent={PACKAGE_FEATURES[buying].accent}
                      icon={<Wallet size={18} />} title="PayPal" sub={t('packages.payPaypalSub')} />
                    <MethodBtn active={payMethod === 'bank'} onClick={() => setPayMethod('bank')} accent={PACKAGE_FEATURES[buying].accent}
                      icon={<Landmark size={18} />} title={t('packages.payBank')} sub={t('packages.payBankSub')} />
                  </div>
                </>
              )}

              {paymentsEnabled && TIERS[buying].price > 0 && payMethod === 'bank' ? (
                <BankTransferPanel amount={priceFor(TIERS[buying])} originalAmount={TIERS[buying].price} coupon={coupon?.code} planLabel={L(TIERS[buying])} />
              ) : (
                <>
                  <div className="mt-5 flex items-center justify-between rounded-xl bg-ink-50 p-4">
                    <div>
                      <p className="text-sm text-ink-400">{L(TIERS[buying])}</p>
                      <p className="text-2xl font-extrabold text-ink-800">
                        {TIERS[buying].price === 0 ? t('packages.free') : (
                          <>
                            {coupon && <span className="me-2 text-base font-bold text-ink-300 line-through" dir="ltr">${TIERS[buying].price}</span>}
                            <span dir="ltr">${priceFor(TIERS[buying])}</span>
                            <span className="text-sm font-normal text-ink-400"> {tierPeriodLabel(TIERS[buying], t)}</span>
                          </>
                        )}
                      </p>
                      {coupon && TIERS[buying].price > 0 && (
                        <p className="mt-0.5 text-xs font-bold text-emerald-600">{coupon.code} · {t('packages.couponOff').replace('{percent}', coupon.percent)}</p>
                      )}
                    </div>
                    <button onClick={confirmBuy} disabled={processing} className="btn-primary !py-3 !px-6" style={{ background: PACKAGE_FEATURES[buying].accent }}>
                      {processing ? <Spinner /> : <>{TIERS[buying].price === 0 ? t('packages.buyNow') : !paymentsEnabled ? t('packages.buyNow') : payMethod === 'paypal' ? 'PayPal' : t('packages.pay')} <ArrowRight size={16} className={isRTL ? 'rotate-180' : ''} /></>}
                    </button>
                  </div>
                  {paymentsEnabled && TIERS[buying].price > 0 && <p className="mt-2 text-center text-xs text-ink-400">🔒 {t('packages.securePay')}</p>}
                </>
              )}

              {paymentsEnabled && TIERS[buying].price > 0 && <PaymentHelp />}
            </>
          )}
        </Modal>
      )}
    </div>
  )
}

function MethodBtn({ active, onClick, icon, title, sub, accent }) {
  return (
    <button type="button" onClick={onClick}
      className={cx('flex items-start gap-2.5 rounded-xl border p-3 text-start transition-all', active ? 'bg-ink-50/60' : 'border-ink-100 hover:border-ink-200')}
      style={active ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` } : undefined}>
      <span className="mt-0.5 shrink-0" style={{ color: active ? accent : '#94a3b8' }}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold text-ink-800">{title}</span>
        <span className="block text-xs text-ink-400">{sub}</span>
      </span>
    </button>
  )
}

function PreviewCard({ title, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-ink-50 to-white p-3">{children}</div>
      <div className="border-t border-ink-100 px-4 py-2.5">
        <p className="text-sm font-bold text-ink-600">{title}</p>
      </div>
    </div>
  )
}
