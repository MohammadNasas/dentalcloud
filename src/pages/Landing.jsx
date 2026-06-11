import { motion } from 'framer-motion'
import {
  Stethoscope, Globe, ArrowRight, Check, Grid3x3, CalendarDays, Wallet,
  Activity, FileText, Images, BarChart3, ShieldCheck, Sparkles, Star, Crown,
  GraduationCap, Building2, Languages, Cloud,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { TIERS, tierPeriodLabel } from '../lib/db'
import { PACKAGE_FEATURES } from '../lib/packages'
import { ChartPreview, CalendarPreview, DashboardPreview, AppShowcase } from '../components/PackagePreviews'
import { cx } from '../lib/utils'

const TIER_ICON = { student: GraduationCap, economy: Building2, pro: Crown }

export default function Landing({ onEnter }) {
  const { t, lang, L, toggleLang, isRTL } = useI18n()

  const features = [
    { icon: Grid3x3, en: 'Interactive dental chart', ar: 'مخطط أسنان تفاعلي', d: { en: 'Permanent & primary, surfaces, colours, FDI/Universal/Palmer.', ar: 'دائمة ولبنية، أسطح، ألوان، وأنظمة ترقيم FDI/Universal/Palmer.' } },
    { icon: CalendarDays, en: 'Unified calendar', ar: 'تقويم موحّد', d: { en: 'All appointments, a colour per doctor.', ar: 'كل المواعيد، لون لكل طبيب.' } },
    { icon: Activity, en: 'Perio & plaque charts', ar: 'مخطط اللثة واللويحة', d: { en: 'Pocket depths, bleeding, O’Leary index.', ar: 'أعماق الجيوب، النزف، مؤشر O’Leary.' } },
    { icon: Wallet, en: 'Payments & balances', ar: 'مدفوعات وأرصدة', d: { en: 'Who owes & how much, multiple methods.', ar: 'مَن عليه رصيد وكم، وطرق دفع متعددة.' } },
    { icon: FileText, en: 'Printable instructions', ar: 'تعليمات للطباعة', d: { en: 'Editable post-op sheets per treatment.', ar: 'أوراق تعليمات قابلة للتعديل لكل علاج.' } },
    { icon: Images, en: 'Photos & X-rays', ar: 'صور وأشعة', d: { en: 'Before/after gallery for each patient.', ar: 'معرض قبل/بعد لكل مريض.' } },
    { icon: BarChart3, en: 'Monthly reports', ar: 'تقارير شهرية', d: { en: 'Revenue, collection rate, performance.', ar: 'الإيراد، نسبة التحصيل، الأداء.' } },
    { icon: Languages, en: 'Arabic & English', ar: 'عربي وإنجليزي', d: { en: 'Full RTL/LTR, switch in one click.', ar: 'دعم كامل للاتجاهين بضغطة زر.' } },
  ]

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      {/* Nav */}
      <header className="glass sticky top-0 z-30 border-b border-ink-100">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden"><img src="/logo.png" alt="logo" className="h-full w-full object-cover" /></div>
            <span className="text-xl font-extrabold text-ink-800">{t('app.name')}</span>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <button onClick={toggleLang} className="btn-outline !py-2"><Globe size={16} /> <span className="text-xs font-bold">{lang === 'ar' ? 'EN' : 'ع'}</span></button>
            <button onClick={() => onEnter('signin')} className="btn-ghost">{t('auth.signIn')}</button>
            <button onClick={() => onEnter('register')} className="btn-primary">{t('packages.buyNow')}</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -end-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <span className="chip bg-brand-50 text-brand-700"><Cloud size={13} /> {lang === 'ar' ? 'سحابي · ويب + سطح المكتب' : 'Cloud · Web + Desktop'}</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-ink-900 sm:text-5xl">
              {lang === 'ar' ? 'إدارة عيادة أسنانك' : 'Run your dental clinic,'}<br />
              <span className="text-brand-600">{lang === 'ar' ? 'بذكاء وسلاسة.' : 'beautifully.'}</span>
            </h1>
            <p className="mt-4 max-w-md text-lg text-ink-500">
              {lang === 'ar'
                ? 'مرضى، مواعيد، مخططات أسنان ولثة، مدفوعات، تقارير وتعليمات — بمكان واحد، عربي وإنجليزي.'
                : 'Patients, appointments, dental & perio charts, payments, reports and instructions — all in one place, Arabic & English.'}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => onEnter('register')} className="btn-primary !px-6 !py-3 text-base">
                {lang === 'ar' ? 'أنشئ عيادتك الآن' : 'Set up your clinic'} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
              </button>
              <button onClick={() => onEnter('signin')} className="btn-outline !px-6 !py-3 text-base">{t('auth.signIn')}</button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-400">
              <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-brand-500" /> {lang === 'ar' ? 'بياناتك محمية' : 'Your data is protected'}</span>
              <span className="flex items-center gap-1.5"><Sparkles size={15} className="text-amber-500" /> {lang === 'ar' ? 'باقة الطالب $5 لمرة واحدة — للأبد' : 'Student plan: $5 once — forever'}</span>
            </div>
          </motion.div>

          {/* Screenshot collage */}
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className="relative">
            <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-card">
              <ChartPreview />
            </div>
            <div className="absolute -bottom-6 w-40 rounded-2xl border border-ink-100 bg-white p-2 shadow-card end-[-10px] sm:w-48">
              <CalendarPreview small />
            </div>
            <div className="absolute -top-6 w-40 rounded-2xl border border-ink-100 bg-white p-2 shadow-card start-[-10px] sm:w-48">
              <DashboardPreview small />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-600">{t('packages.features')}</p>
          <h2 className="mt-1 text-3xl font-extrabold text-ink-800">{lang === 'ar' ? 'كل ما تحتاجه عيادتك' : 'Everything your clinic needs'}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="card card-hover p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><f.icon size={22} /></div>
              <h3 className="mt-3 font-bold text-ink-800">{L(f)}</h3>
              <p className="mt-1 text-sm text-ink-400">{L(f.d)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* App Showcase */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-[#0f1f3d] to-brand-900 py-20">
        {/* Ambient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -start-32 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
          <div className="absolute -bottom-32 -end-32 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
        </div>

        {/* Floating decorative teeth */}
        <motion.div
          animate={{ y: [0, -14, 0], rotate: [0, 6, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute start-[6%] top-16 opacity-[0.07]">
          <svg viewBox="0 0 60 80" width="70" fill="white">
            <ellipse cx="30" cy="28" rx="22" ry="26" />
            <rect x="16" y="48" width="12" height="28" rx="6" />
            <rect x="32" y="48" width="12" height="28" rx="6" />
          </svg>
        </motion.div>
        <motion.div
          animate={{ y: [0, 14, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          className="pointer-events-none absolute end-[5%] bottom-16 opacity-[0.07]">
          <svg viewBox="0 0 60 80" width="90" fill="white">
            <ellipse cx="30" cy="28" rx="22" ry="26" />
            <rect x="16" y="48" width="12" height="28" rx="6" />
            <rect x="32" y="48" width="12" height="28" rx="6" />
          </svg>
        </motion.div>

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          {/* Heading */}
          <div className="mb-10 text-center">
            <motion.span
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="chip mb-3 bg-white/10 text-white/70 backdrop-blur">
              <Sparkles size={13} />
              {lang === 'ar' ? 'نظرة من الداخل' : 'Inside the app'}
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="text-3xl font-extrabold text-white">
              {lang === 'ar' ? 'كل أداة صُمِّمت بعناية' : 'Every tool, crafted with care'}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
              className="mt-2 text-white/50">
              {lang === 'ar' ? 'اضغط على التبويبات لتستكشف' : 'Click the tabs to explore'}
            </motion.p>
          </div>

          {/* Tabbed window mockup */}
          <AppShowcase />

          {/* Stat badges */}
          <motion.div
            initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
            className="mt-10 flex flex-wrap justify-center gap-4">
            {[
              { emoji: '🦷', val: '1,200+', label: lang === 'ar' ? 'مريض في النظام' : 'Patients managed' },
              { emoji: '📅', val: '450+',   label: lang === 'ar' ? 'موعد شهرياً'    : 'Monthly appointments' },
              { emoji: '⚡', val: '< 1s',   label: lang === 'ar' ? 'زمن التحميل'    : 'Load time' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-2xl bg-white/8 px-5 py-3.5 ring-1 ring-white/10 backdrop-blur">
                <span className="text-2xl">{s.emoji}</span>
                <div>
                  <p className="text-base font-extrabold text-white">{s.val}</p>
                  <p className="text-xs text-white/50">{s.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold text-ink-800">{t('packages.title')}</h2>
          <p className="mt-1 text-ink-400">{t('packages.subtitle')}</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {Object.values(TIERS).map((tier) => {
            const Icon = TIER_ICON[tier.id]; const accent = PACKAGE_FEATURES[tier.id].accent
            const popular = tier.id === 'economy'
            const own = PACKAGE_FEATURES[tier.id].features
            const inheritsId = PACKAGE_FEATURES[tier.id].inherits
            return (
              <div key={tier.id} className={cx('card relative flex flex-col p-6', popular && 'ring-2 ring-brand-400')}>
                {popular && <div className="absolute top-0 flex items-center gap-1 rounded-b-lg bg-brand-500 px-3 py-1 text-xs font-bold text-white end-5"><Star size={12} /> {t('packages.mostPopular')}</div>}
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: accent }}><Icon size={22} /></div>
                  <div><h3 className="font-extrabold text-ink-800">{L(tier)}</h3><p className="text-xs font-semibold text-ink-400">{t(`tier.${tier.id}Tag`)}</p></div>
                </div>
                <div className="mt-4 flex items-end gap-1"><span className="text-4xl font-extrabold text-ink-800">${tier.price}</span><span className="mb-1 text-sm text-ink-400"> {tierPeriodLabel(tier, t)}</span></div>
                <ul className="my-5 flex-1 space-y-2">
                  {inheritsId && (
                    <li className="flex items-start gap-2 text-sm font-bold" style={{ color: accent }}>
                      <Check size={15} className="mt-0.5 shrink-0" /> {t('packages.everythingIn')} «{L(TIERS[inheritsId])}»
                    </li>
                  )}
                  {own.map((f, i) => <li key={i} className="flex items-start gap-2 text-sm text-ink-600"><Check size={15} className="mt-0.5 shrink-0" style={{ color: accent }} />{L(f)}</li>)}
                </ul>
                <button onClick={() => onEnter('register')} className="btn w-full text-white" style={{ background: accent }}>{t('packages.buyNow')}</button>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-brand-700 to-teal-800 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-3xl font-extrabold">{lang === 'ar' ? 'جاهز تبدأ؟' : 'Ready to start?'}</h2>
          <p className="mt-2 text-white/80">{lang === 'ar' ? 'أنشئ حساب عيادتك خلال دقيقة.' : 'Create your clinic account in a minute.'}</p>
          <button onClick={() => onEnter('register')} className="btn mt-6 bg-white !px-7 !py-3 text-base font-bold text-brand-700 hover:bg-white/90">
            {lang === 'ar' ? 'ابدأ الآن' : 'Get started'} <ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} />
          </button>
        </div>
      </section>

      <footer className="border-t border-ink-100 py-6 text-center text-sm text-ink-400">
        © {new Date().getFullYear()} {t('app.name')} — {t('app.tagline')}
      </footer>
    </div>
  )
}
