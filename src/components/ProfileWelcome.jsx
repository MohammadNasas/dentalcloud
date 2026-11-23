import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, LoaderCircle } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useReduceMotion } from '../lib/motionPref'

function Greeting({ profile, onClose }) {
  const { lang } = useI18n()
  const ar = lang === 'ar'
  const name = ar ? profile.nameAr || profile.name : profile.name || profile.nameAr
  const osReduced = useReducedMotion()
  const [appReduced] = useReduceMotion()
  const reduced = osReduced || appReduced
  const started = useRef(Date.now())
  const panel = useRef(null)
  useEffect(() => { panel.current?.focus() }, [])
  useEffect(() => {
    if (!profile.ready) return
    // Data loads during the greeting, not after an artificial loading screen.
    const timer = setTimeout(onClose, reduced ? 0 : Math.max(350, 1000 - (Date.now() - started.current)))
    return () => clearTimeout(timer)
  }, [profile.ready, onClose, reduced])
  return <motion.section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="profile-hello"
    dir={ar ? 'rtl' : 'ltr'}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: reduced ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
    className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-[#f4faf8] px-6 text-center outline-none"
    style={{ backgroundImage: 'radial-gradient(ellipse at 50% 48%, #d5eee8 0%, #edf7f3 40%, #f8faf9 75%)' }}>
    <div aria-hidden="true" className="pointer-events-none absolute h-[min(78vw,540px)] w-[min(78vw,540px)] rounded-full border border-teal-700/[0.07]" />
    <div aria-hidden="true" className="pointer-events-none absolute h-[min(110vw,760px)] w-[min(110vw,760px)] rounded-full border border-teal-700/[0.04]" />
    <motion.div initial={{ opacity: 0, y: reduced ? 0 : 18, scale: reduced ? 1 : 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reduced ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-xl">
      <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/80 bg-white/70 text-3xl font-bold text-teal-800 shadow-[0_12px_40px_-18px_#11675c55]">
        {Array.from(name || 'D')[0]}
      </div>
      <p className="mb-3 text-lg font-medium text-teal-700">{ar ? 'أهلًا بك' : 'Hello'}</p>
      <h1 id="profile-hello" className="break-words text-4xl font-extrabold leading-relaxed text-[#123e3b] sm:text-5xl">{name || (ar ? 'في بروفايلك' : 'Welcome back')}</h1>
      <p className="mt-4 text-sm text-[#63827c]">{ar ? 'مساحتك… ليومٍ أكثر ترتيبًا.' : 'Your space. A more organised day.'}</p>
      <div role="status" aria-live="polite" className="mt-10 flex h-6 items-center justify-center gap-2 text-xs font-medium text-teal-700">
        {profile.ready ? <Check size={16} /> : <LoaderCircle size={16} className={reduced ? '' : 'animate-spin'} />}
        {profile.ready ? (ar ? 'بروفايلك جاهز' : 'Your profile is ready') : (ar ? 'نجهّز بروفايلك' : 'Preparing your profile')}
      </div>
      {profile.ready && <button onClick={onClose} className="mt-5 rounded-lg px-4 py-2 text-xs text-teal-800 underline underline-offset-4 focus:outline focus:outline-2 focus:outline-teal-600">{ar ? 'متابعة' : 'Continue'}</button>}
    </motion.div>
    <span className="absolute bottom-8 text-xs font-semibold tracking-wider text-teal-800/40">DentalCloud</span>
  </motion.section>
}

export default function ProfileWelcome({ profile, onClose }) {
  return <AnimatePresence>{profile && <Greeting key={profile.id} profile={profile} onClose={onClose} />}</AnimatePresence>
}
