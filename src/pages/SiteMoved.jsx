import { useEffect } from 'react'
import { ArrowUpLeft, Check, Globe2, Sparkles, Stethoscope, HeartPulse } from 'lucide-react'
import { FloatingTooth } from '../components/LandingVisuals'
import { NEW_SITE_URL } from '../lib/siteMigration'
import logo from '../lib/logo'
import './SiteMoved.css'

export default function SiteMoved() {
  useEffect(() => {
    document.title = 'انتقلنا إلى عنوان جديد — DentalCloud'
    // This page only links to the new site; it does not sign in or take payments.
    document.getElementById('__iaNotice')?.remove()
  }, [])
  return <div className="site-moved" dir="rtl">
    <div className="site-moved-scenery" aria-hidden="true">
      <div className="site-moved-orbit orbit-one" /><div className="site-moved-orbit orbit-two" />
      <FloatingTooth className="moved-tooth tooth-one" />
      <FloatingTooth className="moved-tooth tooth-two" />
      <FloatingTooth className="moved-tooth tooth-three" outline />
      <FloatingTooth className="moved-tooth tooth-four" outline />
      <Stethoscope className="moved-tool tool-one" strokeWidth={1} />
      <HeartPulse className="moved-tool tool-two" strokeWidth={1} />
      <span className="moved-star star-one">✦</span><span className="moved-star star-two">✦</span>
    </div>
    <header className="site-moved-brand"><img src={logo} alt="" /><span dir="ltr">DentalCloud<span>مساحة عيادتك الرقمية</span></span></header>
    <main className="site-moved-main">
      <div className="site-moved-badge"><span /> عنوان جديد، وبداية أجمل</div>
      <h1>نفس عيادتك.<br /><span>عنوان جديد يجمعنا.</span></h1>
      <p className="site-moved-intro">انتقلنا إلى بيتنا الجديد على الإنترنت.<br />يسعدنا نكمّل معك، بنفس حسابك وبيانات عيادتك.</p>
      <section className="site-moved-card" aria-label="عنوان DentalCloud الجديد">
        <div className="moved-domain-icon"><Globe2 size={25} strokeWidth={1.5} /></div>
        <span className="moved-domain-label">عنواننا الجديد</span>
        <a className="moved-domain" href={NEW_SITE_URL} dir="ltr">dentalcloudapp<span>.com</span></a>
        <a className="moved-cta" href={NEW_SITE_URL}>انتقل إلى الموقع الجديد<ArrowUpLeft size={21} /></a>
        <p className="moved-login-note">سجّل دخولك ببيانات حسابك المعتادة</p>
        <div className="moved-reassurance"><span><Check size={15} /> نفس الحساب</span><i /><span><Check size={15} /> نفس بيانات العيادة</span></div>
      </section>
      <p className="moved-bookmark"><Sparkles size={14} /> احفظ الرابط الجديد في المفضّلة، وخليك قريب.</p>
    </main>
    <footer className="site-moved-footer"><span dir="ltr">DentalCloud</span><span>صُمّم لعيادتك، بكل عناية.</span></footer>
  </div>
}
