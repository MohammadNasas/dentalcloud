import { motion } from 'framer-motion'
import { Download as DownloadIcon, Monitor, Apple, ShieldQuestion, ExternalLink, Stethoscope } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { DOWNLOADS, downloadUrl, detectOS, RELEASES_PAGE } from '../lib/downloads'
import { cx } from '../lib/utils'

export default function Download() {
  const { t, lang, L } = useI18n()
  const os = detectOS()
  const recommended = DOWNLOADS.find((d) => d.os === os) || DOWNLOADS[0]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden shadow-soft">
          <img src="/logo.png" alt="logo" className="h-full w-full object-cover" />
        </div>
        <h1 className="text-2xl font-extrabold text-ink-800">{lang === 'ar' ? 'حمّل تطبيق سطح المكتب' : 'Download the desktop app'}</h1>
        <p className="mt-1 text-ink-400">{lang === 'ar' ? 'ثبّته على جهازك مثل أي برنامج — بياناتك نفسها على الموقع والتطبيق.' : 'Install it like any program — same data as the website.'}</p>
      </div>

      {/* Recommended */}
      <motion.a
        href={downloadUrl(recommended.file)}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="card flex items-center gap-4 border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-card"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
          {os === 'mac' ? <Apple size={28} /> : <Monitor size={28} />}
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">{lang === 'ar' ? 'موصى به لجهازك' : 'Recommended for you'}</p>
          <p className="text-lg font-extrabold text-ink-800">{L(recommended)}</p>
        </div>
        <span className="btn-primary"><DownloadIcon size={18} /> {lang === 'ar' ? 'تحميل' : 'Download'}</span>
      </motion.a>

      {/* All platforms */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">{lang === 'ar' ? 'كل الأنظمة' : 'All platforms'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {DOWNLOADS.map((d) => (
            <a key={d.id} href={downloadUrl(d.file)}
              className={cx('card flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft',
                d.id === recommended.id && 'ring-1 ring-brand-200')}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
                {d.os === 'mac' ? <Apple size={22} /> : <Monitor size={22} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink-800">{L(d)}</p>
                <p className="text-xs text-ink-400">{L(d.note)}</p>
              </div>
              <DownloadIcon size={18} className="text-brand-500" />
            </a>
          ))}
        </div>
      </div>

      {/* First-run help */}
      <div className="card p-5">
        <h3 className="mb-2 flex items-center gap-2 font-bold text-ink-800"><ShieldQuestion size={18} className="text-amber-500" /> {lang === 'ar' ? 'أول مرة تفتحه' : 'First time you open it'}</h3>
        <ul className="space-y-1.5 text-sm text-ink-600">
          <li>• <b>Windows:</b> {lang === 'ar' ? 'لو ظهر تحذير أزرق، اضغط «More info» ثم «Run anyway».' : 'If a blue warning appears, click “More info” → “Run anyway”.'}</li>
          <li>• <b>macOS:</b> {lang === 'ar' ? 'اضغط بزر الفأرة الأيمن على التطبيق ثم «Open».' : 'Right-click the app → “Open”.'}</li>
          <li>• {lang === 'ar' ? 'هذا طبيعي للبرامج الجديدة غير الموقّعة رسمياً.' : 'This is normal for new, unsigned apps.'}</li>
        </ul>
        <a href={RELEASES_PAGE} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:underline">
          <ExternalLink size={14} /> {lang === 'ar' ? 'لم يبدأ التحميل؟ افتح صفحة الإصدارات' : 'Download didn’t start? Open the releases page'}
        </a>
      </div>
    </div>
  )
}
