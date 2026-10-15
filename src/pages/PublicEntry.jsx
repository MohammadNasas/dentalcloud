import { useEffect, useLayoutEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import Landing from './Landing'
import Login from './Login'
import { isElectron } from '../lib/downloads'
import { useI18n } from '../i18n/I18nContext'
import { useReduceMotion } from '../lib/motionPref'
import { landingLanguage } from '../lib/seo'

// Public (logged-out) experience.
// • Website  → marketing landing page first, then the sign-in / registration form.
// • Desktop app (Electron) → straight to the sign-in form (no marketing page).
export default function PublicEntry() {
  const location = useLocation()
  const navigate = useNavigate()
  const { lang, setLang } = useI18n()
  const reduced = useReducedMotion()
  const [performance] = useReduceMotion()
  const path = location.pathname.replace(/\/+$/, '') || '/'
  const desktop = isElectron || window.location.protocol === 'file:'
  const register = path === '/register'
  const homeLanguage = landingLanguage(location.pathname)

  // Public language URLs take precedence over saved preferences. Account pages
  // keep their existing language preference, including on a dashboard refresh.
  useLayoutEffect(() => {
    if (!desktop && homeLanguage) setLang(homeLanguage)
  }, [desktop, homeLanguage, setLang])

  useEffect(() => {
    if (desktop) return
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [path, lang, desktop, register])

  // Desktop keeps its direct sign-in form and file-compatible router.
  if (desktop) return <Login />
  if (!homeLanguage && !['/login', '/register'].includes(path)) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <motion.div key={homeLanguage ? 'landing' : path} initial={reduced || performance ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}>
    {homeLanguage ? <Landing /> : <Login initialTab={register ? 'register' : 'signin'}
      onBack={() => navigate(lang === 'en' ? '/en/' : '/')}
      onTabChange={tab => navigate(tab === 'register' ? '/register' : '/login', { state: location.state })} />}
  </motion.div>
}
