import { useState } from 'react'
import { motion } from 'framer-motion'
import { Stethoscope, Globe, KeyRound, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Field, Spinner } from '../components/ui'

export default function ResetPassword() {
  const { t, lang, toggleLang, isRTL } = useI18n()
  const { updatePassword } = useStore()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (pw.length < 6) { setError(t('auth.passwordTooShort')); return }
    if (pw !== confirm) { setError(t('auth.passwordsNoMatch')); return }
    setBusy(true)
    const res = await updatePassword(pw)
    setBusy(false)
    if (!res.ok) { setError(res.error || t('auth.signupFailed')); return }
    setDone(true)
    // updatePassword clears recovery + reloads session → app shows shortly after.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-teal-800 p-6">
      <button onClick={toggleLang} className="absolute top-5 rounded-xl bg-white/15 px-3 py-2 text-sm font-bold text-white backdrop-blur end-5">
        <Globe size={16} className="inline" /> {lang === 'ar' ? 'EN' : 'ع'}
      </button>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white"><KeyRound size={24} /></div>
          <div>
            <p className="text-xl font-extrabold text-ink-800">{t('auth.setNewPassword')}</p>
            <p className="text-sm text-ink-400">{t('auth.recoveryHint')}</p>
          </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={32} />
            </motion.div>
            <p className="font-bold text-ink-800">{t('auth.passwordUpdated')}</p>
            <Spinner />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label={t('auth.newPassword')}>
              <input className="input" type="password" dir="ltr" value={pw} autoFocus onChange={(e) => setPw(e.target.value)} placeholder="••••••" />
            </Field>
            <Field label={t('auth.confirmPassword')}>
              <input className="input" type="password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••" />
            </Field>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
            <button disabled={busy} className="btn-primary w-full !py-3">
              {busy ? <Spinner /> : <>{t('auth.updatePassword')} <ArrowRight size={16} className={isRTL ? 'rotate-180' : ''} /></>}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
