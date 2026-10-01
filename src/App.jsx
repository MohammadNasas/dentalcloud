import { lazy, useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { XCircle } from 'lucide-react'
import { useStore } from './context/StoreContext'
import { useI18n } from './i18n/I18nContext'
import { Modal, Spinner } from './components/ui'
import { Confetti, SuccessCheck, ToastHost } from './components/anim'
import UndoDeleteHost from './components/UndoDeleteHost'
import logo from './lib/logo'
import { startPaypalCheckout } from './lib/payments'
import { hasVerifiedPaidAccess, getPaidThrough } from './lib/entitlement.js'
import { paymentErrorMessage } from './lib/paymentErrors.js'
import SaveStatus from './components/SaveStatus'
import PageLoader from './components/PageLoader'
import Layout from './components/Layout'
import PublicEntry from './pages/PublicEntry'
import { postLoginPath } from './lib/routing'

const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Paywall = lazy(() => import('./pages/Paywall'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Patients = lazy(() => import('./pages/Patients'))
const PatientProfile = lazy(() => import('./pages/PatientProfile'))
const Appointments = lazy(() => import('./pages/Appointments'))
const Payments = lazy(() => import('./pages/Payments'))
const Reports = lazy(() => import('./pages/Reports'))
const Instructions = lazy(() => import('./pages/Instructions'))
const Download = lazy(() => import('./pages/Download'))
const Packages = lazy(() => import('./pages/Packages'))
const Settings = lazy(() => import('./pages/Settings'))
const Lab = lazy(() => import('./pages/Lab'))
const Inbox = lazy(() => import('./pages/Inbox'))

function Splash() {
  return (
    <div className="relative flex h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-[var(--app-bg)]">
      {/* soft brand glow behind the logo */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-brand-200/40 blur-3xl"
      />
      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 15 }}
        className="relative overflow-hidden rounded-3xl shadow-xl"
        style={{ width: 96, height: 96 }}
      >
        <img src={logo} alt="logo" className="h-full w-full object-cover" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="relative flex flex-col items-center gap-3"
      >
        <span className="text-2xl font-extrabold tracking-tight text-ink-800">DentalCloud</span>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-brand-500"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function PaymentResultOverlay({ result, onClose }) {
  const { t, lang } = useI18n()
  const { clinic, currentUser } = useStore()
  const [startingPaid, setStartingPaid] = useState(false)
  const [startError, setStartError] = useState('')
  const title = result.ok
    ? (result.paymentPending
        ? t('packages.paymentPendingTitle')
        : result.subscription && result.trial === false
          ? t('packages.paidSubscriptionSuccess')
          : result.subscription ? t('packages.trialSuccess') : t('packages.paySuccess'))
    : result.error === 'trial_already_used'
      ? t('packages.trialAlreadyUsed')
      : t('packages.payCancelled')
  const detail = result.paymentPending
    ? t('packages.paymentPending')
    : result.requiresPaidCheckout
      ? t('packages.paidWithoutTrialNotice')
      : !result.ok
    ? paymentErrorMessage(result, lang)
    : ''

  async function continuePaid() {
    setStartingPaid(true)
    setStartError('')
    const res = await startPaypalCheckout({
      tier: result.tier || 'pro',
      clinicId: result.clinicId || clinic?.id,
      email: currentUser?.email,
      checkoutMode: 'paid',
    })
    if (res.ok && res.url) { window.location.href = res.url; return }
    setStartingPaid(false)
    setStartError(paymentErrorMessage(res, lang))
  }
  return (
    <Modal open onClose={onClose} size="sm">
      {result.ok && <Confetti />}
      <div className="relative flex flex-col items-center gap-3 py-4 text-center">
        {result.ok
          ? <SuccessCheck size={56} />
          : <XCircle size={52} className="text-rose-500" />}
        <p className="text-lg font-bold text-ink-800">{title}</p>
        {detail && <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">{detail}</p>}
        {startError && <p className="text-sm font-semibold text-rose-600">{startError}</p>}
        {result.requiresPaidCheckout ? (
          <div className="mt-2 flex w-full flex-col gap-2">
            <button onClick={continuePaid} disabled={startingPaid} className="btn-primary w-full">
              {startingPaid ? <Spinner /> : t('packages.continuePaid')}
            </button>
            <button onClick={onClose} disabled={startingPaid} className="btn w-full bg-ink-100 text-ink-600">{t('common.close')}</button>
          </div>
        ) : (
          <button onClick={onClose} className="btn-primary mt-2">{t('common.close')}</button>
        )}
      </div>
    </Modal>
  )
}

export default function App() {
  const location = useLocation()
  const { booting, loadError, retryLoad, currentUser, recovery, paymentResult, dismissPaymentResult, mode, clinic } = useStore()
  const { lang } = useI18n()

  // Re-evaluate both trial and paid expiry while the app remains open.
  const [accessClock, setAccessClock] = useState(Date.now())
  const verifiedPaidAccess = hasVerifiedPaidAccess(clinic, Math.max(accessClock, Date.now()))
  useEffect(() => {
    const now = Date.now()
    const ends = [clinic?.trialEndsAt, getPaidThrough(clinic)].map(Date.parse).filter((end) => Number.isFinite(end) && end > now)
    if (!ends.length) return
    const remaining = Math.min(...ends) - now
    // Browsers cap setTimeout at a little under 25 days; reschedule if needed.
    const id = setTimeout(() => setAccessClock(Date.now()), Math.min(remaining + 100, 2_000_000_000))
    return () => clearTimeout(id)
  }, [clinic, accessClock])

  useEffect(() => {
    const tick = () => setAccessClock(Date.now())
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => { window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick) }
  }, [])

  const overlay = paymentResult ? <PaymentResultOverlay result={paymentResult} onClose={dismissPaymentResult} /> : null

  if (booting) return <Splash />
  if (loadError) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <p>{lang === 'ar' ? 'تعذّر تحميل بيانات العيادة. تحقق من الاتصال وأعد المحاولة.' : 'Could not load your clinic. Check your connection and retry.'}</p>
    <button onClick={retryLoad} className="btn-primary">{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button>
  </div>
  if (recovery) return <PageLoader><ResetPassword /></PageLoader>
  if (!currentUser) return <>{<PublicEntry />}{overlay}<ToastHost /></>
  const trialEnd = Date.parse(clinic?.trialEndsAt || '')
  const trialActive = Number.isFinite(trialEnd) && Math.max(accessClock, Date.now()) < trialEnd
  // Pro access is allowed during the free month or after a verified payment.
  // Merely having an ACTIVE PayPal agreement never counts as paid access.
  const expired = mode === 'cloud' && clinic && !verifiedPaidAccess && !trialActive && clinic.tier !== 'student'

  return (
    <>
      <Routes>
        <Route path="/login" element={<Navigate to={postLoginPath(location.state?.from)} replace />} />
        <Route path="/register" element={<Navigate to={postLoginPath(location.state?.from)} replace />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientProfile />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/instructions" element={<Instructions />} />
          <Route path="/download" element={<Download />} />
          <Route path="/packages" element={expired ? <Paywall /> : <Packages />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {overlay}
      <SaveStatus />
      <UndoDeleteHost />
      <ToastHost />
    </>
  )
}
