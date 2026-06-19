import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { XCircle } from 'lucide-react'
import { useStore } from './context/StoreContext'
import { useI18n } from './i18n/I18nContext'
import { Modal } from './components/ui'
import { Confetti, SuccessCheck, ToastHost } from './components/anim'
import logo from './lib/logo'
import Layout from './components/Layout'
import PublicEntry from './pages/PublicEntry'
import ResetPassword from './pages/ResetPassword'
import Paywall from './pages/Paywall'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import PatientProfile from './pages/PatientProfile'
import Appointments from './pages/Appointments'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import Instructions from './pages/Instructions'
import Download from './pages/Download'
import Packages from './pages/Packages'
import Settings from './pages/Settings'
import Lab from './pages/Lab'
import Inbox from './pages/Inbox'

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
  const { t } = useI18n()
  const detail = !result.ok
    ? (result.reason === 'gateway'
        ? 'declined at the payment page (card / 3-D Secure)'
        : [result.status && `status: ${result.status}`, result.error && `error: ${result.error}`, result.message].filter(Boolean).join(' · '))
    : ''
  return (
    <Modal open onClose={onClose} size="sm">
      {result.ok && <Confetti />}
      <div className="relative flex flex-col items-center gap-3 py-4 text-center">
        {result.ok
          ? <SuccessCheck size={56} />
          : <XCircle size={52} className="text-rose-500" />}
        <p className="text-lg font-bold text-ink-800">{result.ok ? t('packages.paySuccess') : t('packages.payCancelled')}</p>
        {detail && <p className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs text-ink-500" dir="ltr">{detail}</p>}
        <button onClick={onClose} className="btn-primary mt-2">{t('common.close')}</button>
      </div>
    </Modal>
  )
}

export default function App() {
  const { booting, currentUser, recovery, paymentResult, dismissPaymentResult, mode, clinic } = useStore()

  // Keep the splash on screen long enough for the logo reveal to actually be
  // seen, even when boot finishes instantly.
  const [minSplash, setMinSplash] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setMinSplash(false), 1600)
    return () => clearTimeout(id)
  }, [])

  const overlay = paymentResult ? <PaymentResultOverlay result={paymentResult} onClose={dismissPaymentResult} /> : null

  if (booting || minSplash) return <Splash />
  if (recovery) return <ResetPassword />
  if (!currentUser) return <>{<PublicEntry />}{overlay}<ToastHost /></>
  // Paid tiers must pay before entering; the Student plan is free, so it enters
  // straight away.
  if (mode === 'cloud' && clinic && !clinic.paid && clinic.tier !== 'student') return <>{<Paywall />}{overlay}<ToastHost /></>

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientProfile />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/instructions" element={<Instructions />} />
          <Route path="/download" element={<Download />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {overlay}
      <ToastHost />
    </>
  )
}
