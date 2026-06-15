import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download as DownloadIcon, Monitor, Apple, ShieldQuestion, ExternalLink, Stethoscope, Smartphone, Share, Plus, Check } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { DOWNLOADS, downloadUrl, detectOS, RELEASES_PAGE } from '../lib/downloads'
import { cx } from '../lib/utils'
import logo from '../lib/logo'

const isIOSDevice = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandaloneMode = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export default function Download() {
  const { t, lang, L } = useI18n()
  const os = detectOS()
  const recommended = DOWNLOADS.find((d) => d.os === os) || DOWNLOADS[0]

  const [installEvt, setInstallEvt] = useState(typeof window !== 'undefined' ? window.__pwaInstallPrompt : null)
  const [installed, setInstalled] = useState(isStandaloneMode())
  const isIOS = isIOSDevice()

  useEffect(() => {
    const onAvail = () => setInstallEvt(window.__pwaInstallPrompt || null)
    const onInstalled = () => { setInstalled(true); setInstallEvt(null); window.__pwaInstallPrompt = null }
    window.addEventListener('pwa-installable', onAvail)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('pwa-installable', onAvail); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  async function installApp() {
    const e = window.__pwaInstallPrompt
    if (!e) return
    e.prompt()
    try { await e.userChoice } catch { /* user dismissed */ }
    window.__pwaInstallPrompt = null
    setInstallEvt(null)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden shadow-soft">
          <img src={logo} alt="logo" className="h-full w-full object-cover" />
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

      {/* Install on phone (PWA) */}
      <div className="card p-5">
        <h3 className="mb-1 flex items-center gap-2 font-bold text-ink-800">
          <Smartphone size={18} className="text-brand-500" /> {lang === 'ar' ? 'ثبّت التطبيق على جوالك' : 'Install on your phone'}
        </h3>
        <p className="mb-4 text-sm text-ink-400">
          {lang === 'ar' ? 'بيفتح كتطبيق مستقل بأيقونته على الشاشة الرئيسية — أندرويد و iPhone.' : 'Opens as a standalone app with its own icon — Android & iPhone.'}
        </p>

        {installed ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            <Check size={18} /> {lang === 'ar' ? 'التطبيق مثبّت على هذا الجهاز ✅' : 'The app is installed on this device ✅'}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Android */}
            <div className="rounded-xl border border-ink-100 p-4">
              <p className="mb-2 flex items-center gap-2 font-bold text-ink-700"><Smartphone size={16} className="text-emerald-500" /> Android</p>
              {installEvt ? (
                <button onClick={installApp} className="btn-primary w-full"><DownloadIcon size={16} /> {lang === 'ar' ? 'ثبّت الآن' : 'Install now'}</button>
              ) : (
                <p className="text-sm text-ink-500">
                  {lang === 'ar'
                    ? 'افتح هذه الصفحة في Chrome على جوالك، ثم من قائمة (⋮) اختر «تثبيت التطبيق».'
                    : 'Open this page in Chrome on your phone, then choose “Install app” from the (⋮) menu.'}
                </p>
              )}
            </div>
            {/* iOS */}
            <div className={cx('rounded-xl border p-4', isIOS ? 'border-brand-200 bg-brand-50/40' : 'border-ink-100')}>
              <p className="mb-2 flex items-center gap-2 font-bold text-ink-700"><Apple size={16} /> iPhone / iPad</p>
              <ol className="space-y-1.5 text-sm text-ink-500">
                <li className="flex gap-1.5">{lang === 'ar' ? '١. افتح الموقع في متصفح Safari' : '1. Open the site in Safari'}</li>
                <li className="flex items-center gap-1.5">{lang === 'ar' ? '٢. اضغط زر المشاركة' : '2. Tap Share'} <Share size={14} className="inline text-brand-500" /></li>
                <li className="flex items-center gap-1.5">{lang === 'ar' ? '٣. اختر «إضافة إلى الشاشة الرئيسية»' : '3. Choose “Add to Home Screen”'} <Plus size={14} className="inline text-brand-500" /></li>
              </ol>
            </div>
          </div>
        )}
      </div>

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
