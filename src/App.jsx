import { Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { XCircle } from 'lucide-react'
import { useStore } from './context/StoreContext'
import { useI18n } from './i18n/I18nContext'
import { Modal } from './components/ui'
import { Confetti, SuccessCheck, ToastHost } from './components/anim'
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

function Splash() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-5 bg-[var(--app-bg)]">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="overflow-hidden rounded-2xl shadow-lg"
        style={{ width: 72, height: 72 }}
      >
        <img src="/logo.png" alt="logo" className="h-full w-full object-cover" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center gap-2"
      >
        <span className="text-lg font-extrabold text-ink-700">DentalCloud</span>
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
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

  const overlay = paymentResult ? <PaymentResultOverlay result={paymentResult} onClose={dismissPaymentResult} /> : null

  if (booting) return <Splash />
  if (recovery) return <ResetPassword />
  if (!currentUser) return <>{<PublicEntry />}{overlay}<ToastHost /></>
  // Cloud accounts must pay before entering the app.
  if (mode === 'cloud' && clinic && !clinic.paid) return <>{<Paywall />}{overlay}<ToastHost /></>

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {overlay}
      <ToastHost />
    </>
  )
}
