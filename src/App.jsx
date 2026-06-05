import { Routes, Route, Navigate } from 'react-router-dom'
import { Stethoscope } from 'lucide-react'
import { useStore } from './context/StoreContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
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

function Splash() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--app-bg)]">
      <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-brand-600 text-white shadow-soft">
        <Stethoscope size={30} />
      </div>
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
    </div>
  )
}

export default function App() {
  const { booting, currentUser, recovery } = useStore()

  if (booting) return <Splash />
  if (recovery) return <ResetPassword />
  if (!currentUser) return <Login />

  return (
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
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
