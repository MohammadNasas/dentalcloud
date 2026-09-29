import { motion, useReducedMotion } from 'framer-motion'
import { Globe, ArrowRight, Check, CalendarDays, Wallet, Sparkles, Crown, GraduationCap, Users, Monitor, Smartphone, Activity, FileText, Images, Languages } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { TIERS, tierPeriodLabel } from '../lib/db'
import { PACKAGE_FEATURES } from '../lib/packages'
import { useReduceMotion } from '../lib/motionPref'
import { CalendarPreview, AppShowcase } from '../components/PackagePreviews'
import { FloatScene, FloatingTooth, HeroPreview, PatientPreview } from '../components/LandingVisuals'
import LandingFAQ from '../components/LandingFAQ'
import { cx } from '../lib/utils'
import logo from '../lib/logo'
import './Landing.css'

const TIER_ICON = { student: GraduationCap, pro: Crown }
export default function Landing({ onEnter }) {
  const { t, lang, L, toggleLang, isRTL } = useI18n()
  const ar = lang === 'ar'
  const reduced = useReducedMotion()
  const [performance] = useReduceMotion()
  const still = reduced || performance
  const reveal = { initial: still ? false : { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: .1 }, transition: { duration: .45 } }
  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: still ? 'instant' : 'smooth', block: 'start' })
  const features = [
    { icon: Users, title: ar ? 'ملفات المرضى' : 'Patient records', detail: ar ? 'كل معلومات المريض وتاريخه، في ملف واحد.' : 'Every patient’s details and history, together.', preview: <PatientPreview/> },
    { icon: CalendarDays, title: ar ? 'مواعيد منظّمة' : 'Organised appointments', detail: ar ? 'يومك أوضح، ومواعيد فريقك بمكان واحد.' : 'A clearer day, with your team’s schedule in one place.', preview: <CalendarPreview/> },
    { icon: Wallet, title: ar ? 'مدفوعات واضحة' : 'Clear payments', detail: ar ? 'تابع تكلفة العلاج، المدفوع والمتبقي بسهولة.' : 'Keep treatment fees, payments and balances in view.', preview: <PatientPreview payment/> },
  ]
  return <div className="landing min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2"><img src={logo} alt="" width="36" height="36" className="rounded-xl"/><span className="text-lg font-extrabold tracking-tight text-ink-800 sm:text-xl">Dental<span className="text-brand-600">Cloud</span></span></div>
        <nav aria-label={ar ? 'روابط الصفحة' : 'Page navigation'} className="ms-5 hidden items-center gap-6 text-xs font-bold text-ink-500 md:flex">
          {[["landing-features",ar?'المزايا':'Features'],["landing-showcase",ar?'استكشف النظام':'Explore'],["landing-pricing",ar?'الباقات':'Plans']].map(([id,label])=><button key={id} onClick={()=>scrollTo(id)} className="hover:text-brand-600">{label}</button>)}
        </nav>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <button onClick={toggleLang} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'} className="btn-ghost !px-2 !py-2"><Globe size={15}/><span className="text-xs">{ar ? 'EN' : 'ع'}</span></button>
          <button onClick={()=>onEnter('signin')} className="btn-ghost !px-2 !py-2 text-xs">{t('auth.signIn')}</button>
          <button onClick={()=>onEnter('register')} className="btn-primary hidden !py-2 text-xs sm:inline-flex">{ar?'ابدأ الآن':'Get started'}</button>
        </div>
      </div>
    </header>
    <section className="landing-hero overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-5 py-12 sm:px-6 lg:grid-cols-[.95fr_1.05fr] lg:gap-10 lg:py-20">
        <motion.div {...reveal} className="relative z-10">
          <span className="chip bg-brand-100/60 text-brand-700"><Sparkles size={13}/>{ar?'لعيادة أكثر تنظيماً':'A more organised clinic'}</span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.4] tracking-tight text-ink-900 sm:text-5xl xl:text-[56px]">{ar?'عيادتك مرتّبة.':'Your clinic, in order.'}<br/><span className="text-brand-600">{ar?'وقتك لمرضاك.':'Your time, for patients.'}</span></h1>
          <p className="mt-5 max-w-md text-base leading-8 text-ink-500 sm:text-lg">{ar?'المرضى، المواعيد والمدفوعات — كل تفاصيل عيادتك في مكان واحد، بالعربي والإنجليزي.':'Patients, appointments and payments — your entire clinic in one place, in Arabic and English.'}</p>
          <div className="mt-7 flex flex-wrap gap-3"><button onClick={()=>onEnter('register')} className="btn-primary !rounded-xl !px-6 !py-3.5">{ar?'ابدأ شهرك المجاني':'Start your free month'}<ArrowRight size={17} className={isRTL?'rotate-180':''}/></button><button onClick={()=>scrollTo('landing-showcase')} className="btn-outline !rounded-xl !px-6 !py-3.5">{ar?'اكتشف المزايا':'Explore the features'}</button></div>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-ink-400"><Monitor size={16}/><Smartphone size={14}/><span>{ar?'على الكمبيوتر والموبايل':'On desktop and mobile'}</span><span className="mx-1 h-1 w-1 rounded-full bg-brand-300"/><span>{ar?'باقة الطالب مجانية':'Free Student plan'}</span></div>
        </motion.div>
        <HeroPreview/>
      </div>
    </section>
    <section id="landing-features" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
      <motion.div {...reveal} className="mb-8 text-center"><span className="text-xs font-bold text-brand-600">{ar?'أقل تشتت. أكثر وضوح.':'Less clutter. More clarity.'}</span><h2 className="mt-2 text-2xl font-extrabold text-ink-800 sm:text-3xl">{ar?'كل أدوات عيادتك، بتجربة أبسط':'Your clinic’s tools. A simpler experience.'}</h2></motion.div>
      <div className="grid gap-5 md:grid-cols-3">{features.map(f=><motion.article {...reveal} key={f.title} className="landing-feature"><div className="flex items-center gap-3"><f.icon className="text-brand-600" size={25}/><h3 className="text-lg font-extrabold text-ink-800">{f.title}</h3></div><p className="mt-3 text-sm leading-6 text-ink-400">{f.detail}</p><div className="landing-feature-preview" aria-hidden="true">{f.preview}</div></motion.article>)}</div>
      <div className="mt-7 flex flex-wrap justify-center gap-x-7 gap-y-3 text-xs font-semibold text-ink-500">{[[Activity,ar?'مخطط اللثة':'Perio chart'],[Images,ar?'صور وأشعة':'Photos & X-rays'],[FileText,ar?'تعليمات للطباعة':'Printable instructions'],[Languages,ar?'عربي وإنجليزي':'Arabic & English']].map(([Icon,label])=><span key={label} className="flex items-center gap-2"><Icon size={15} className="text-brand-500"/>{label}</span>)}</div>
    </section>
    <section id="landing-showcase" className="landing-showcase">
      <FloatScene className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="landing-orbit" aria-hidden="true"/><FloatingTooth className="landing-showcase-tooth-a landing-float"/><FloatingTooth className="landing-showcase-tooth-b landing-float"/><FloatingTooth outline className="landing-showcase-outline landing-float"/>
        <motion.div {...reveal} className="relative mb-10 text-center"><span className="chip mb-3 bg-white/10 text-white/70"><Sparkles size={13}/>{ar?'نظرة من الداخل':'Inside the app'}</span><h2 className="text-2xl font-extrabold text-white sm:text-3xl">{ar?'كل أداة صُمِّمت بعناية':'Every tool, crafted with care'}</h2><p className="mt-3 text-sm text-white/60">{ar?'اضغط على التبويبات لتستكشف':'Click the tabs to explore'}</p></motion.div>
        <div className="relative"><AppShowcase/></div><p className="mt-4 text-center text-[10px] text-white/50">{ar?'عرض توضيحي ببيانات تجريبية':'Interactive preview with sample data'}</p>
        <div className="relative mt-6 flex flex-wrap justify-center gap-3">{features.map(f=><span key={f.title} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-white/90"><f.icon size={18} className="text-teal-300"/>{f.title}</span>)}</div>
      </FloatScene>
    </section>
    <section id="landing-pricing" className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="mb-9 text-center"><h2 className="text-2xl font-extrabold text-ink-800 sm:text-3xl">{ar?'اختر ما يناسب عيادتك':'Choose what fits your clinic'}</h2><p className="mt-2 text-sm text-ink-400">{t('packages.subtitle')}</p></div>
      <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">{Object.values(TIERS).map(tier=>{
        const Icon=TIER_ICON[tier.id], popular=tier.id==='pro', own=PACKAGE_FEATURES[tier.id].features, inherits=PACKAGE_FEATURES[tier.id].inherits
        return <motion.article {...reveal} key={tier.id} className={cx('relative flex flex-col rounded-3xl border bg-white p-7 shadow-[0_12px_40px_-25px_#0d948830]',popular?'border-brand-500':'border-ink-100')}>
          <div className="flex items-center gap-3"><Icon size={26} className="text-brand-600"/><h3 className="text-xl font-extrabold text-ink-800">{L(tier)}</h3></div>
          {popular&&<span className="mt-3 w-fit rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-700">{ar?'للعيادة المتكاملة':'For the complete clinic'}</span>}
          <div className="mt-6 flex items-baseline gap-2"><span className="text-4xl font-extrabold text-ink-800">{tier.price===0?(ar?'مجاني':'Free'):`$${tier.price}`}</span>{tier.price>0&&<span className="text-sm text-ink-500">{tierPeriodLabel(tier,t)}</span>}</div>
          {tier.price>0&&<p className="mt-2 text-xs font-bold text-brand-600">{t('packages.freeTrialBadge')}</p>}
          <ul className="mb-4 mt-6 space-y-3">{inherits&&<li className="flex gap-2 text-sm font-semibold text-brand-700"><Check size={16}/>{t('packages.everythingIn')} «{L(TIERS[inherits])}»</li>}{own.slice(0,4).map((f,i)=><li key={i} className="flex items-start gap-2 text-sm text-ink-500"><Check size={16} className="mt-0.5 shrink-0 text-brand-500"/>{L(f)}</li>)}</ul>
          {own.length>4&&<details className="mb-6 text-sm text-ink-500"><summary className="cursor-pointer font-bold text-brand-700">{ar?'عرض كل المزايا':'See all features'}</summary><ul className="mt-3 space-y-2">{own.slice(4).map((f,i)=><li key={i} className="flex gap-2"><Check size={15} className="mt-1 shrink-0 text-brand-500"/>{L(f)}</li>)}</ul></details>}
          <button onClick={()=>onEnter('register')} className={cx('mt-auto w-full !rounded-xl !py-3',popular?'btn-primary':'btn-outline')}>{popular?(ar?'جرّب الآن':'Try it now'):(ar?'ابدأ مجاناً':'Start free')}</button>
        </motion.article>
      })}</div>
    </section>
    <LandingFAQ ar={ar}/>
    <section className="px-4 pb-8 sm:px-6"><div className="landing-closing relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 overflow-hidden rounded-3xl px-7 py-10 text-center text-white sm:flex-row sm:text-start sm:px-12"><div className="relative z-10"><h2 className="text-2xl font-extrabold sm:text-3xl">{ar?'جاهز ترتّب يومك؟':'Ready for a clearer day?'}</h2><p className="mt-2 text-sm text-white/65">{ar?'ابدأ مع DentalCloud، وخلي تركيزك لمرضاك.':'Start with DentalCloud. Keep your focus on patients.'}</p></div><button onClick={()=>onEnter('register')} className="btn relative z-10 bg-white !px-6 !py-3.5 font-bold text-brand-700 hover:bg-brand-50">{ar?'ابدأ مع DentalCloud':'Start with DentalCloud'}<ArrowRight size={17} className={isRTL?'rotate-180':''}/></button><FloatingTooth outline className="absolute -bottom-8 start-[40%] !w-36 text-teal-300/10"/></div></section>
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 pb-7 text-xs text-ink-400"><span className="font-bold text-ink-700">© {new Date().getFullYear()} DentalCloud</span><div className="flex flex-wrap gap-5">{[['pricing',ar?'الأسعار':'Pricing'],['terms',ar?'الشروط':'Terms'],['privacy',ar?'الخصوصية':'Privacy'],['refund',ar?'الاسترجاع':'Refund']].map(([path,label])=><a key={path} href={`/${path}.html`} className="hover:text-brand-600">{label}</a>)}</div></footer>
  </div>
}
