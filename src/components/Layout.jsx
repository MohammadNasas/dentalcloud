import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, CalendarDays, Wallet, BarChart3, Package,
  Settings, LogOut, Menu, X, Lock, Globe, Stethoscope, FileText, Download, FlaskConical, Bell, Inbox,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { TIERS } from '../lib/db'
import { isElectron } from '../lib/downloads'
import { cx } from '../lib/utils'
import { isToday, parseISO, fmtTime } from '../lib/dates'
import { Avatar } from './ui'
import { PingDot, AnimatedBell } from './anim'
import logo from '../lib/logo'

const NAV_CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
}
const NAV_ITEM = {
  hidden: { opacity: 0, x: -12 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

function NotificationsBell({ items, lang, navigate }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" title={lang === 'ar' ? 'الإشعارات' : 'Notifications'}>
        <AnimatedBell count={items.length}><Bell size={18} /></AnimatedBell>
      </button>
      {/* Backdrop kept outside AnimatePresence so it unmounts instantly (no ghost overlay that could trap taps). */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="absolute z-50 mt-2 w-72 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card end-0">
              <div className="border-b border-ink-100 px-4 py-2.5 text-sm font-bold text-ink-700">
                {lang === 'ar' ? 'مواعيد اليوم' : "Today's appointments"}
              </div>
              {items.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-ink-400">{lang === 'ar' ? 'لا مواعيد اليوم' : 'No appointments today'}</div>
              ) : (
                <div className="max-h-72 divide-y divide-ink-50 overflow-y-auto">
                  {items.map((a) => (
                    <button key={a.id} onClick={() => { navigate(`/patients/${a.patientId}`); setOpen(false) }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-ink-50">
                      <span className="w-12 shrink-0 text-xs font-bold text-brand-600">{a.time}</span>
                      <span className="flex-1 truncate text-sm font-semibold text-ink-700">{a.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

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
  const { currentUser, clinic, logout, can, appointments, getPatient, isOwner } = useStore()
  const navItems = (() => {
    if (!isOwner) return NAV
    const items = [...NAV]
    const i = items.findIndex((n) => n.to === '/settings')
    const inbox = { to: '/inbox', key: 'inbox', icon: Inbox }
    if (i >= 0) items.splice(i, 0, inbox); else items.push(inbox)
    return items
  })()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const tierInfo = TIERS[clinic?.tier || 'student']

  const todayItems = (appointments || [])
    .filter((a) => isToday(parseISO(a.start)) && a.status !== 'cancelled')
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => {
      const p = getPatient(a.patientId)
      return { id: a.id, patientId: a.patientId, time: fmtTime(a.start, lang), name: (lang === 'ar' ? p?.nameAr || p?.name : p?.name) || '' }
    })

  const NavList = ({ onNavigate }) => (
    <motion.nav
      className="flex flex-1 flex-col gap-1 px-3"
      variants={NAV_CONTAINER}
      initial="hidden"
      animate="show"
    >
      {navItems.map((item) => {
        const locked = item.feature && !can(item.feature)
        return (
          <motion.div key={item.to} variants={NAV_ITEM}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) => cx('nav-link group relative', isActive && '!text-brand-700')}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-white shadow-soft"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex flex-1 items-center gap-3">
                    <item.icon size={19} className="shrink-0" />
                    <span className="flex-1">{t(`nav.${item.key}`)}</span>
                    {locked && <Lock size={13} className="text-amber-400" />}
                  </span>
                </>
              )}
            </NavLink>
          </motion.div>
        )
      })}
    </motion.nav>
  )

  const SidebarInner = ({ onNavigate }) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden shadow-soft">
          <img src={logo} alt="logo" className="h-full w-full object-cover" />
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
    const item = navItems.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to) && n.to !== '/'))
    return item ? t(`nav.${item.key}`) : ''
  })()

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--app-bg)]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-e border-ink-100 bg-white/60 lg:block">
        <SidebarInner />
      </aside>

      {/* Mobile sidebar — always mounted and animated via state (no AnimatePresence).
          When closed it gets pointer-events:none so a half-finished animation can
          never leave an invisible overlay that traps taps. */}
      <motion.div
        className={cx('fixed inset-0 z-40 bg-ink-900/30 lg:hidden', !mobileOpen && 'pointer-events-none')}
        initial={false}
        animate={{ opacity: mobileOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => setMobileOpen(false)}
      />
      <motion.aside
        className="fixed inset-y-0 z-50 w-64 bg-white shadow-2xl lg:hidden start-0"
        style={{ pointerEvents: mobileOpen ? 'auto' : 'none' }}
        initial={false}
        animate={{ x: mobileOpen ? 0 : (lang === 'ar' ? 280 : -280) }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <SidebarInner onNavigate={() => setMobileOpen(false)} />
      </motion.aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="glass sticky top-0 z-30 flex items-center gap-3 border-b border-ink-100 px-4 py-3 sm:px-6">
          <button className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-extrabold text-ink-800">{pageTitle}</h1>
          <div className="ms-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs font-semibold text-emerald-600 sm:flex">
              <PingDot /> {lang === 'ar' ? 'متصل' : 'Online'}
            </span>
            {can('appointments') && <NotificationsBell items={todayItems} lang={lang} navigate={navigate} />}
            <motion.button
              onClick={toggleLang}
              whileTap={{ scale: 0.9, rotate: -12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              className="btn-outline !py-2"
              title={lang === 'ar' ? 'English' : 'العربية'}
            >
              <Globe size={16} />
              <motion.span key={lang} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold">
                {lang === 'ar' ? 'EN' : 'ع'}
              </motion.span>
            </motion.button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
