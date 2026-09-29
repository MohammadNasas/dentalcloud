import { useEffect, useId, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { CalendarDays, Check, Users, Wallet, LayoutDashboard } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useReduceMotion } from '../lib/motionPref'
import { DashboardPreview } from './PackagePreviews'

export function FloatScene({ children, className = '' }) {
  const ref = useRef(null)
  const visible = useInView(ref)
  const reduced = useReducedMotion()
  const [performance] = useReduceMotion()
  const [active, setActive] = useState(!document.hidden)
  useEffect(() => {
    const changed = () => setActive(!document.hidden)
    document.addEventListener('visibilitychange', changed)
    return () => document.removeEventListener('visibilitychange', changed)
  }, [])
  return <div ref={ref} className={`landing-scene ${className}`} data-moving={visible && active && !reduced && !performance}>{children}</div>
}

export function FloatingTooth({ className = '', outline = false }) {
  const id = useId().replaceAll(':', '')
  return <svg aria-hidden="true" className={`landing-tooth ${className}`} viewBox="0 0 80 100" fill="none">
    <defs><linearGradient id={id} x1="14" y1="10" x2="68" y2="88" gradientUnits="userSpaceOnUse">
      <stop stopColor="white"/><stop offset=".4" stopColor="#f4fffd"/><stop offset=".75" stopColor="#b5dcd6"/><stop offset="1" stopColor="#f5fffd"/>
    </linearGradient></defs>
    <path d="M40 14C27 4 8 10 8 28c0 19 10 27 12 39 2 11 3 22 9 23 6 1 7-23 11-23s5 24 11 23c6-1 7-12 9-23 2-12 12-20 12-39C72 10 53 4 40 14Z" fill={outline ? 'none' : `url(#${id})`} stroke={outline ? 'currentColor' : '#e1f5f0'} strokeWidth="1.5"/>
    {!outline && <path d="M20 28c0-8 7-12 15-9M25 40c2 9 3 15 4 21" stroke="white" strokeWidth="4" strokeLinecap="round" opacity=".8"/>}
  </svg>
}

export function PatientPreview({ payment = false }) {
  const { lang } = useI18n()
  const ar = lang === 'ar'
  return <div className="landing-mini-record">
    <div className="flex items-center justify-between border-b border-ink-100 pb-3 text-xs font-bold text-ink-700">
      <span>{payment ? (ar ? 'المدفوعات' : 'Payments') : (ar ? 'ملف المريض' : 'Patient record')}</span>
      {payment ? <Wallet size={15}/> : <Users size={15}/>}
    </div>
    {payment ? [true, false, true].map((paid, i) => <div key={i} className="mt-3 flex items-center gap-3 text-[10px]">
      <span className="h-7 w-7 rounded-full bg-brand-50"/><span className="h-1.5 flex-1 rounded bg-ink-100"/>
      <span className={`rounded-full px-2 py-1 ${paid ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>{paid ? (ar ? 'مدفوع' : 'Paid') : (ar ? 'متبقي' : 'Balance')}</span>
    </div>) : <>
      <div className="my-4 flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Users size={19}/></span><div className="flex-1 space-y-2 pt-2"><div className="h-2 w-2/3 rounded bg-ink-200/70"/><div className="h-1.5 w-1/3 rounded bg-ink-100"/></div></div>
      <div className="flex gap-1 rounded-lg bg-brand-50 p-2 text-[9px] font-bold text-brand-700">{ar ? 'معلومات عامة · التاريخ الطبي · العلاجات' : 'Overview · History · Treatments'}</div>
      <div className="mt-3 space-y-2">{[75, 90, 55].map(w=><div key={w} className="h-1.5 rounded bg-ink-100" style={{width:`${w}%`}}/>)}</div>
    </>}
  </div>
}

export function HeroPreview() {
  const { lang } = useI18n()
  const ar = lang === 'ar'
  return <FloatScene className="landing-product" >
    <div className="landing-desktop">
      <div className="landing-windowbar"><span className="flex gap-1" aria-hidden="true"><i/><i/><i/></span><span>DentalCloud</span><span className="text-brand-600">✧</span></div>
      <div className="flex min-w-0">
        <div className="w-16 shrink-0 space-y-5 border-e border-ink-100 bg-white px-3 py-5 text-brand-500"><LayoutDashboard size={17}/><Users size={17}/><CalendarDays size={17}/><Wallet size={17}/></div>
        <div className="min-w-0 flex-1 bg-slate-50 p-3 sm:p-4"><p className="mb-1 text-sm font-extrabold text-ink-700">{ar ? 'مرحباً بك' : 'Welcome back'}</p><p className="mb-4 text-[10px] text-ink-400">{ar ? 'كل شيء جاهز ليومك' : 'Everything ready for your day'}</p><DashboardPreview/></div>
      </div>
    </div>
    <div className="landing-phone landing-float" aria-hidden="true">
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink-800"/>
      <p className="text-xs font-extrabold text-ink-800">{ar ? 'مواعيد اليوم' : 'Today’s appointments'}</p>
      <p className="mb-3 mt-1 text-[8px] text-ink-400">{ar ? 'يومك، بنظرة واحدة' : 'Your day, at a glance'}</p>
      {['09:00','10:30','12:00','14:30'].map((time,i)=><div key={time} className="mb-2 rounded-lg bg-brand-50/70 p-2"><div className="flex items-center justify-between gap-2"><span className="h-5 w-5 rounded-full bg-brand-100"/><span className="text-[9px] font-bold text-ink-600" dir="ltr">{time}</span></div><div className="mt-2 h-1 w-3/4 rounded bg-brand-200/60"/></div>)}
      <div className="mt-3 flex justify-around text-brand-500"><LayoutDashboard size={12}/><CalendarDays size={12}/><Users size={12}/></div>
    </div>
    <div className="landing-float landing-floating-note"><span className="rounded-full bg-brand-600 p-1.5 text-white"><Check size={14}/></span>{ar ? 'كل شيء بمكانه' : 'Everything in its place'}</div>
    <div className="landing-float landing-floating-appt"><CalendarDays size={22} className="text-brand-600"/><div><b>{ar ? 'موعد جديد' : 'New appointment'}</b><p className="text-ink-400" dir="ltr">10:30</p></div></div>
    <FloatingTooth className="landing-hero-tooth-a landing-float"/>
    <FloatingTooth className="landing-hero-tooth-b landing-float"/>
    <span className="landing-demo-label">{ar ? 'عرض توضيحي ببيانات تجريبية' : 'Preview with sample data'}</span>
  </FloatScene>
}
