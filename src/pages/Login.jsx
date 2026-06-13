import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Stethoscope, Globe, CheckCircle2, ArrowRight, Sparkles, ShieldCheck, Smartphone,
  Cloud, WifiOff,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { TIERS, DEMO_LOGIN, tierPeriodLabel } from '../lib/db'
import { Field, Spinner } from '../components/ui'
import { FloatingField } from '../components/anim'
import { cx } from '../lib/utils'

export default function Login({ initialTab = 'signin', onBack }) {
  const { t, L, lang, toggleLang, isRTL } = useI18n()
  const { login, register, resetPassword, mode, otpEmail, verifyOtp, resendOtp, cancelOtp } = useStore()
  const [tab, setTab] = useState(initialTab)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('_rememberMe') !== 'false')
  const [forgot, setForgot] = useState({ open: false, email: '', sent: false })
  const [otpCode, setOtpCode] = useState('')
  const [resent, setResent] = useState(false)

  async function doVerify(e) {
    e.preventDefault()
    setError('')
    if (otpCode.length < 6) { setError(t('auth.otpTooShort')); return }
    setBusy(true)
    const res = await verifyOtp(otpCode)
    setBusy(false)
    if (!res.ok) setError(t(`auth.${res.error || 'wrongCode'}`))
  }
  async function doResend() {
    setError(''); setResent(false)
    await resendOtp(); setResent(true)
  }

  const [signin, setSignin] = useState({ email: '', password: '' })
  const [reg, setReg] = useState({
    clinicName: '', doctorName: '', email: '', password: '', specialty: '', tier: 'economy',
  })
  const isCloud = mode === 'cloud'

  async function doForgot(e) {
    e.preventDefault()
    setError('')
    if (!forgot.email) { setError(t('auth.fillAll')); return }
    setBusy(true)
    await resetPassword(forgot.email)
    setBusy(false)
    setForgot((f) => ({ ...f, sent: true })) // always show success (no email enumeration)
  }

  async function doSignin(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    localStorage.setItem('_rememberMe', String(rememberMe))
    const res = await login(signin.email, signin.password)
    setBusy(false)
    if (!res.ok) setError(t(`auth.${res.error || 'wrongCreds'}`))
  }

  async function doRegister(e) {
    e.preventDefault()
    setError('')
    if (!reg.clinicName || !reg.doctorName || !reg.email || !reg.password) {
      setError(t('auth.fillAll')); return
    }
    setBusy(true)
    const res = await register(reg)
    setBusy(false)
    if (!res.ok) setError(t(`auth.${res.error}`) + (res.message ? ` (${res.message})` : ''))
  }

  const highlights = [
    { icon: Smartphone, en: 'Log in from any device', ar: 'سجّل الدخول من أي جهاز' },
    { icon: ShieldCheck, en: 'Your patient data stays private', ar: 'بيانات مرضاك تبقى خاصة' },
    { icon: Sparkles, en: 'Charts, calendar, payments & reports', ar: 'مخططات، تقويم، مدفوعات وتقارير' },
  ]

  const ModeChip = () => (
    <span className={cx('chip', isCloud ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>
      {isCloud ? <Cloud size={12} /> : <WifiOff size={12} />}
      {isCloud ? t('auth.online') : t('auth.offline')}
    </span>
  )

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand / hero side */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-teal-800 lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -end-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -start-20 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl" />

        <div className="relative flex items-center gap-3 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl overflow-hidden bg-white/15 backdrop-blur">
            <img src="/logo.png" alt="logo" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-2xl font-extrabold">{t('app.name')}</p>
            <p className="text-sm text-white/70">{t('app.tagline')}</p>
          </div>
        </div>

        <div className="relative text-white">
          <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="max-w-md text-4xl font-extrabold leading-tight">
            {lang === 'ar' ? 'كل ما تحتاجه عيادتك في مكان واحد.' : 'Everything your clinic needs, in one place.'}
          </motion.h2>
          <div className="mt-8 space-y-4">
            {highlights.map((h, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: isRTL ? 16 : -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }} className="flex items-center gap-3 text-white/90">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><h.icon size={18} /></div>
                <span className="font-semibold">{L(h)}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative flex gap-3">
          {Object.values(TIERS).map((tier) => (
            <div key={tier.id} className="flex-1 rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-sm font-bold text-white">{L(tier)}</p>
              <p className="text-2xl font-extrabold text-white">${tier.price}<span className="text-sm font-normal text-white/60"> {tierPeriodLabel(tier, t)}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* Form side */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            {onBack ? (
              <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-ink-500 hover:text-brand-600">
                <ArrowRight size={16} className={cx(!isRTL && 'rotate-180')} /> {t('common.back')}
              </button>
            ) : (
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden"><img src="/logo.png" alt="logo" className="h-full w-full object-cover" /></div>
                <span className="text-xl font-extrabold text-ink-800">{t('app.name')}</span>
              </div>
            )}
            <div className="ms-auto flex items-center gap-2">
              <ModeChip />
              <button onClick={toggleLang} className="btn-outline !py-2">
                <Globe size={16} /> <span className="text-xs font-bold">{lang === 'ar' ? 'English' : 'العربية'}</span>
              </button>
            </div>
          </div>

          {isCloud && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              <Cloud size={16} /> {t('auth.cloudReady')}
            </div>
          )}

          {otpEmail ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-extrabold text-ink-800">{t('auth.verifyEmail')}</h2>
                <p className="text-sm text-ink-400">{t('auth.otpSentTo')} <b dir="ltr">{otpEmail}</b></p>
              </div>
              <form onSubmit={doVerify} className="space-y-4">
                <Field label={t('auth.verificationCode')}>
                  <input className="input text-center text-lg font-bold tracking-[0.3em]" dir="ltr" inputMode="numeric" autoFocus
                    value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="••••••••" />
                </Field>
                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
                {resent && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-600">{t('auth.codeResent')}</p>}
                <button disabled={busy} className="btn-primary w-full !py-3">{busy ? <Spinner /> : t('auth.verify')}</button>
              </form>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={doResend} className="font-bold text-brand-600 hover:underline">{t('auth.resendCode')}</button>
                <button type="button" onClick={cancelOtp} className="text-ink-400 hover:text-ink-600">{t('common.cancel')}</button>
              </div>
            </div>
          ) : forgot.open ? (
            <div className="space-y-4">
              <button type="button" onClick={() => { setForgot({ open: false, email: '', sent: false }); setError('') }}
                className="text-sm font-semibold text-ink-500 hover:text-brand-600">
                <ArrowRight size={14} className={cx('inline', !isRTL && 'rotate-180')} /> {t('auth.backToSignIn')}
              </button>
              <div>
                <h2 className="text-2xl font-extrabold text-ink-800">{t('auth.resetTitle')}</h2>
                <p className="text-sm text-ink-400">{t('auth.resetHint')}</p>
              </div>
              {forgot.sent ? (
                <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">{t('auth.resetLinkSent')}</div>
              ) : (
                <form onSubmit={doForgot} className="space-y-4">
                  <Field label={t('auth.email')}>
                    <input className="input" type="email" dir="ltr" autoFocus value={forgot.email}
                      onChange={(e) => setForgot((f) => ({ ...f, email: e.target.value }))} placeholder="name@clinic.com" />
                  </Field>
                  {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
                  <button disabled={busy} className="btn-primary w-full !py-3">{busy ? <Spinner /> : t('auth.sendResetLink')}</button>
                </form>
              )}
            </div>
          ) : (
          <>
          {/* Tabs */}
          <div className="mb-6 inline-flex w-full rounded-xl bg-ink-100 p-1">
            {['signin', 'register'].map((m) => (
              <button key={m} onClick={() => { setTab(m); setError('') }}
                className={cx('relative flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors', tab === m ? 'text-brand-700' : 'text-ink-500')}>
                {tab === m && <motion.span layoutId="authtab" className="absolute inset-0 rounded-lg bg-white shadow-soft" />}
                <span className="relative">{m === 'signin' ? t('auth.signIn') : t('auth.register')}</span>
              </button>
            ))}
          </div>

          {tab === 'signin' ? (
            <form onSubmit={doSignin} className="space-y-4">
              <div>
                <h2 className="text-2xl font-extrabold text-ink-800">{t('auth.welcome')}</h2>
                <p className="text-sm text-ink-400">{t('auth.subtitle')}</p>
              </div>
              <FloatingField label={t('auth.email')} type="text" dir="ltr" autoFocus value={signin.email}
                onChange={(e) => setSignin({ ...signin, email: e.target.value })} />
              <FloatingField label={t('auth.password')} type="password" dir="ltr" value={signin.password}
                onChange={(e) => setSignin({ ...signin, password: e.target.value })} />
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 accent-brand-600 cursor-pointer" />
                  <span className="text-sm text-ink-600">{t('auth.rememberMe')}</span>
                </label>
                {isCloud && (
                  <button type="button" onClick={() => { setForgot({ open: true, email: signin.email, sent: false }); setError('') }}
                    className="text-xs font-bold text-brand-600 hover:underline">{t('auth.forgotPassword')}</button>
                )}
              </div>
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
              <button disabled={busy} className="btn-primary w-full !py-3">
                {busy ? <Spinner /> : <>{t('auth.signIn')} <ArrowRight size={16} className={isRTL ? 'rotate-180' : ''} /></>}
              </button>

              {!isCloud && (
                <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/50 p-3 text-center text-sm">
                  <span className="font-bold text-brand-700">{t('auth.demoHint')}:</span>{' '}
                  <span className="text-ink-600">{DEMO_LOGIN.username} / {DEMO_LOGIN.password}</span>
                  <button type="button" onClick={() => setSignin({ email: DEMO_LOGIN.username, password: DEMO_LOGIN.password })}
                    className="ms-2 font-bold text-brand-600 underline">{t('common.apply')}</button>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={doRegister} className="space-y-3.5">
              <div>
                <h2 className="text-2xl font-extrabold text-ink-800">{t('auth.register')}</h2>
                <p className="text-sm text-ink-400">{t('auth.anyDevice')}</p>
              </div>
              <Field label={t('auth.clinicName')} required>
                <input className="input" value={reg.clinicName} onChange={(e) => setReg({ ...reg, clinicName: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('auth.doctorName')} required>
                  <input className="input" value={reg.doctorName} onChange={(e) => setReg({ ...reg, doctorName: e.target.value })} />
                </Field>
                <Field label={t('auth.specialty')}>
                  <input className="input" value={reg.specialty} onChange={(e) => setReg({ ...reg, specialty: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('auth.email')} required>
                  <input className="input" type="email" dir="ltr" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} placeholder="name@clinic.com" />
                </Field>
                <Field label={t('auth.password')} required>
                  <input className="input" type="password" dir="ltr" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} />
                </Field>
              </div>
              <Field label={t('auth.choosePlan')}>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(TIERS).map((tier) => (
                    <button type="button" key={tier.id} onClick={() => setReg({ ...reg, tier: tier.id })}
                      className={cx('rounded-xl border-2 p-2.5 text-center transition-all', reg.tier === tier.id ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-300')}>
                      {reg.tier === tier.id && <CheckCircle2 size={14} className="mx-auto mb-1 text-brand-500" />}
                      <p className="text-xs font-bold text-ink-700">{L(tier)}</p>
                      <p className="text-sm font-extrabold text-brand-600">${tier.price}</p>
                    </button>
                  ))}
                </div>
              </Field>
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
              <button disabled={busy} className="btn-primary w-full !py-3">
                {busy ? <Spinner /> : <>{t('auth.createAccount')} <ArrowRight size={16} className={isRTL ? 'rotate-180' : ''} /></>}
              </button>
            </form>
          )}
          </>
          )}

          <p className="mt-6 text-center text-xs text-ink-400">{isCloud ? t('auth.cloudReady') : t('auth.secureLocal')}</p>
        </div>
      </div>
    </div>
  )
}
