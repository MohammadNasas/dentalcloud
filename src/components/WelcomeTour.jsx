import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/I18nContext'
import './WelcomeTour.css'

const SEEN_KEY = 'dentalcloud.welcome-tour.v1'
const media = `${import.meta.env.BASE_URL}tour/`

export default function WelcomeTour() {
  const { lang, toggleLang } = useI18n()
  const ar = lang === 'ar'
  const dialog = useRef(null)
  const launcher = useRef(null)
  const video = useRef(null)
  const timer = useRef(null)
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) !== 'seen' } catch { return false }
  })
  const [closing, setClosing] = useState(false)
  const [failed, setFailed] = useState(false)

  function close() {
    if (closing) return
    video.current?.pause()
    setClosing(true)
    timer.current = setTimeout(() => {
      dialog.current?.close()
      setOpen(false)
      setClosing(false)
      launcher.current?.focus({ preventScroll: true })
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180)
  }

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { setFailed(false) }, [lang, open])
  useEffect(() => {
    if (!open) return
    const element = dialog.current
    element.showModal()
    try { localStorage.setItem(SEEN_KEY, 'seen') } catch { /* Tour still works without storage. */ }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = previous }
  }, [open])

  return <>
    <button ref={launcher} type="button" className="tour-launcher" onClick={() => setOpen(true)}>
      <span className="tour-play" aria-hidden="true">▶</span>
      <span><strong>{ar ? 'شاهد جولة DentalCloud' : 'Take a DentalCloud tour'}</strong><small>{ar ? 'جولة سريعة داخل عيادتك الرقمية' : 'A quick look inside your digital clinic'}</small></span>
      <span className="tour-duration">0:30</span>
    </button>
    {createPortal(<dialog ref={dialog} className={`tour-dialog ${closing ? 'is-closing' : ''}`} dir={ar ? 'rtl' : 'ltr'} aria-labelledby="welcome-tour-title" onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}>
      {open && <section className="tour-card">
        <div className="tour-header"><div className="tour-heading"><span className="tour-spark" aria-hidden="true">✧</span><div><h2 id="welcome-tour-title">{ar ? 'أهلاً بك في DentalCloud' : 'Welcome to DentalCloud'}</h2><p>{ar ? 'اكتشف أدوات عيادتك الرقمية' : 'Explore your digital clinic'}</p></div></div><div className="tour-actions"><button type="button" onClick={toggleLang} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}>{ar ? 'EN' : 'ع'}</button><button type="button" autoFocus className="tour-close" aria-label={ar ? 'إغلاق الفيديو' : 'Close video'} onClick={close}>×</button></div></div>
        {failed ? <div className="tour-error" role="status"><p>{ar ? 'تعذّر تحميل الفيديو. تأكد من اتصالك وحاول مرة أخرى.' : 'The video could not load. Check your connection and try again.'}</p><button type="button" onClick={() => setFailed(false)}>{ar ? 'إعادة المحاولة' : 'Try again'}</button></div> : <video key={lang} ref={video} className="tour-video" dir="ltr" controls playsInline preload="metadata" poster={`${media}poster-${ar ? 'ar' : 'en'}-v2.jpg`} src={`${media}welcome-${ar ? 'ar' : 'en'}-v2.mp4`} aria-label={ar ? 'جولة تعريفية بميزات DentalCloud' : 'An introduction to DentalCloud features'} onError={() => setFailed(true)} />}
        <div className="tour-footer"><span>{ar ? 'من أول مريض، ليوم عمل منظّم.' : 'From your first patient to a well-organised day.'}</span><button type="button" onClick={close}>{ar ? 'استكشف الموقع ←' : 'Explore the website →'}</button></div>
      </section>}
    </dialog>, document.body)}
  </>
}
