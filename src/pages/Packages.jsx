import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Sparkles, Crown, GraduationCap, Building2, X, ArrowRight, Star } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { TIERS, tierPeriodLabel } from '../lib/db'
import { PACKAGE_FEATURES, fullFeatures } from '../lib/packages'
import { Modal } from '../components/ui'
import { cx } from '../lib/utils'
import { ChartPreview, CalendarPreview, DashboardPreview } from '../components/PackagePreviews'

const ICONS = { student: GraduationCap, economy: Building2, pro: Crown }

export default function Packages() {
  const { t, lang, L, isRTL } = useI18n()
  const { clinic, setTier } = useStore()
  const [buying, setBuying] = useState(null)
  const [activated, setActivated] = useState(false)
  const [expanded, setExpanded] = useState({})
  const current = clinic?.tier

  function confirmBuy() {
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

      {/* Pricing cards */}
      <div className="grid gap-5 lg:grid-cols-3">
        {Object.values(TIERS).map((tier, idx) => {
          const Icon = ICONS[tier.id]
          const accent = PACKAGE_FEATURES[tier.id].accent
          const isCurrent = current === tier.id
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
                <span className="text-4xl font-extrabold text-ink-800">${tier.price}</span>
                <span className="mb-1 text-sm text-ink-400"> {tierPeriodLabel(tier, t)}</span>
              </div>
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
        <Modal open onClose={() => setActivated(false) || setBuying(null)} size="lg"
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
              <div className="mt-5 flex items-center justify-between rounded-xl bg-ink-50 p-4">
                <div>
                  <p className="text-sm text-ink-400">{L(TIERS[buying])}</p>
                  <p className="text-2xl font-extrabold text-ink-800">${TIERS[buying].price}<span className="text-sm font-normal text-ink-400"> {tierPeriodLabel(TIERS[buying], t)}</span></p>
                </div>
                <button onClick={confirmBuy} className="btn-primary !py-3 !px-6" style={{ background: PACKAGE_FEATURES[buying].accent }}>
                  {t('packages.buyNow')} <ArrowRight size={16} className={isRTL ? 'rotate-180' : ''} />
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
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
