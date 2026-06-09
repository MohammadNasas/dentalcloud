import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, CalendarDays, Wallet, BarChart3, Package,
  Settings, LogOut, Menu, X, Lock, Globe, Stethoscope, FileText, Download, FlaskConical,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { TIERS } from '../lib/db'
import { isElectron } from '../lib/downloads'
import { cx } from '../lib/utils'
import { Avatar } from './ui'

const NAV = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', key: 'patients', icon: Users },
  { to: '/appointments', key: 'appointments', icon: CalendarDays, feature: 'appointments' },
  { to: '/payments', key: 'payments', icon: Wallet },
  { to: '/instructions', key: 'instructions', icon: FileText },
  { to: '/lab', key: 'lab', icon: FlaskConical, feature: 'lab' },
  { to: '/reports', key: 'reports', icon: BarChart3, feature: 'reports' },
  { to: '/download', key: 'download', icon: Download, webOnly: true },
  { to: '/packages', key: 'packages', icon: Package },
  { to: '/settings', key: 'settings', icon: Settings },
].filter((item) => !(item.webOnly && isElectron))

export default function Layout() {
  const { t, L, lang, toggleLang } = useI18n()
  const { currentUser, clinic, logout, can } = useStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const tierInfo = TIERS[clinic?.tier || 'student']

  const NavList = ({ onNavigate }) => (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const locked = item.feature && !can(item.feature)
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => cx('nav-link group', isActive && 'nav-link-active')}
          >
            <item.icon size={19} className="shrink-0" />
            <span className="flex-1">{t(`nav.${item.key}`)}</span>
            {locked && <Lock size={13} className="text-amber-400" />}
          </NavLink>
        )
      })}
    </nav>
  )

  const SidebarInner = ({ onNavigate }) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
          <Stethoscope size={22} />
        </div>
        <div className="leading-tight">
          <p className="text-lg font-extrabold text-ink-800">{t('app.name')}</p>
          <p className="text-[11px] font-semibold text-ink-400">{t('app.tagline')}</p>
        </div>
      </div>

      {/* Clinic chip */}
      <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100/40 p-3">
        <p className="truncate text-sm font-bold text-ink-700">
          {lang === 'ar' ? clinic?.nameAr || clinic?.name : clinic?.name}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="chip bg-white text-brand-700 shadow-soft">{L(tierInfo)}</span>
          <span className="text-[11px] text-ink-400">{t('settings.yourPlan')}</span>
        </div>
      </div>

      <NavList onNavigate={onNavigate} />

      {/* User */}
      <div className="mt-auto border-t border-ink-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={currentUser?.name} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink-700">
              {lang === 'ar' ? currentUser?.nameAr || currentUser?.name : currentUser?.name}
            </p>
            <p className="truncate text-[11px] text-ink-400">{currentUser?.specialty}</p>
          </div>
          <button onClick={logout} title={t('nav.logout')} className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-500">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  )

  const pageTitle = (() => {
    const item = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to) && n.to !== '/'))
    return item ? t(`nav.${item.key}`) : ''
  })()

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--app-bg)]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-e border-ink-100 bg-white/60 lg:block">
        <SidebarInner />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink-900/30 lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 z-50 w-64 bg-white shadow-2xl lg:hidden start-0"
              initial={{ x: lang === 'ar' ? 280 : -280 }}
              animate={{ x: 0 }}
              exit={{ x: lang === 'ar' ? 280 : -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <SidebarInner onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="glass sticky top-0 z-30 flex items-center gap-3 border-b border-ink-100 px-4 py-3 sm:px-6">
          <button className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-extrabold text-ink-800">{pageTitle}</h1>
          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="btn-outline !py-2"
              title={lang === 'ar' ? 'English' : 'العربية'}
            >
              <Globe size={16} />
              <span className="text-xs font-bold">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div key={location.pathname} className="page-enter mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
