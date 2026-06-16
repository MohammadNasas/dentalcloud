import { motion } from 'framer-motion'

// Bold gradient page header used across the app for a distinctive, consistent
// identity. `actions` sit top-end; `children` render below (search, KPIs, …).
export default function PageHero({ icon, title, subtitle, actions, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-ink-900 p-6 text-white sm:p-7"
    >
      <div className="pointer-events-none absolute -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl end-[-30px]" />
      <div className="pointer-events-none absolute h-48 w-48 rounded-full bg-brand-400/20 blur-3xl bottom-[-60px] start-12" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">{icon}</span>}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold">{title}</h1>
            {subtitle && <p className="mt-0.5 truncate text-sm text-white/70">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      {children && <div className="relative mt-5">{children}</div>}
    </motion.div>
  )
}
