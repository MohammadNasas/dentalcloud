import { useEffect,useState } from 'react'
import { Bell,BellOff } from 'lucide-react'

export default function PatientPushOptIn({token,lang,demo=false}) {
 const ar=lang==='ar'
 const [config,setConfig]=useState(null),[state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const supported=typeof Notification!=='undefined' && 'serviceWorker' in navigator && 'PushManager' in window
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1)
 const installed=window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true
 async function api(action,subscription) {
  const r=await fetch('/api/loyalty-push',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({token,action,subscription,lang}),cache:'no-store',referrerPolicy:'no-referrer'})
  const value=await r.json(); if(!r.ok) throw Error('unavailable'); return value
 }
 useEffect(()=>{
  let active=true
  if(demo) {setConfig({enabled:true});setState({available:true,review:true,appointment:true,subscribed:false});return}
  async function load() {
   try {
    const r=await fetch('/api/loyalty-push',{cache:'no-store'});const data=await r.json()
    if(!r.ok || !data.config?.enabled) return
    let sub=null
    if(supported) {const reg=await navigator.serviceWorker.getRegistration('/');sub=await reg?.pushManager.getSubscription()}
    const status=await api('status',sub?.toJSON() || {})
    if(active){setConfig(data.config);setState(status)}
   } catch {if(active)setError(ar?'تعذّر تحميل إعدادات التذكير. حدّث البطاقة وأعد المحاولة.':'Could not load reminders. Refresh the card and try again.')}
  }
  load();return()=>{active=false}
 },[token,demo])
 async function enable() {
  if(busy || !config || !state?.available) return
  if(demo) {setState(s=>({...s,subscribed:true}));return}
  setBusy(true);setError('')
  // Request directly from the patient's click, before any network awaits (iOS).
  let stage='permission'
  try {
   if(await Notification.requestPermission()!=='granted') throw Error('denied')
   stage='browser'
   await navigator.serviceWorker.register('/sw.js')
   const reg=await navigator.serviceWorker.ready
   const key=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))
   let sub=await reg.pushManager.getSubscription()
   if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key})
   stage='save'
   const result=await api('subscribe',sub.toJSON())
   if(!result.subscribed) throw Error('not_saved')
   setState(result)
  } catch(e) {setError(e.message==='denied' || e.name==='NotAllowedError'
    ? (ar?'الإشعارات غير مسموحة. يمكنك السماح بها من إعدادات الموقع في المتصفح.':'Notifications are blocked. You can allow them in your browser’s site settings.')
    : stage==='save'
      ? (ar?'تعذّر حفظ تفعيل الإشعارات. أعد المحاولة، وإذا استمرت المشكلة تواصل مع العيادة.':'Could not save your notification preferences. Try again or contact your clinic if this continues.')
      : (ar?'تعذّر تفعيل الإشعارات في هذا المتصفح. افتح رابط البطاقة في Chrome أو Safari خارج التطبيقات، وتأكد من السماح بالإشعارات.':'This browser could not enable notifications. Open the card in Chrome or Safari outside other apps and check notification permissions.'))}
  finally {setBusy(false)}
 }
 async function disable() {
  if(demo){setState(s=>({...s,subscribed:false}));return}
  setBusy(true);setError('')
  try {const reg=await navigator.serviceWorker.getRegistration('/');const sub=await reg?.pushManager.getSubscription()
   setState(await api('remove',sub?.toJSON() || {}))
  } catch {setError(ar?'تعذّر إيقاف التذكيرات. أعد المحاولة أو امنع الإشعارات من إعدادات المتصفح.':'Could not stop reminders. Retry or block notifications in browser settings.')}
  finally {setBusy(false)}
 }
 if(!config && !error) return null
 return <section className="mt-5 rounded-2xl border border-[#103c3b]/10 bg-white p-5 text-[#103c3b]" aria-label={ar?'تذكيراتك':'Your reminders'}>
  <h2 className="flex items-center gap-2 font-bold"><Bell size={19}/>{ar?'خلّينا نذكّرك بابتسامتك':'A little reminder for your smile'}</h2>
  <p className="mt-2 text-sm leading-7 text-ink-500">{ar?'فعّل الإشعارات ليصلك تذكير بحجز مراجعتك، وبموعدك قبل يوم.':'Enable notifications for a reminder to book your check-up and a reminder one day before your appointment.'}</p>
  {demo && <p className="mt-2 text-xs text-amber-700">{ar?'معاينة فقط — لا يُطلب إذن ولا تُرسل إشعارات.':'Preview only — no permission request or notifications.'}</p>}
  {state?.subscribed ? <div className="mt-4"><p role="status" className="mb-3 text-sm text-emerald-700">{ar?'التذكيرات مفعّلة لهذه البطاقة على هذا الجهاز.':'Reminders are enabled for this card on this device.'}</p><button disabled={busy} className="btn-outline w-full" onClick={disable}><BellOff size={16}/>{ar?'إيقاف التذكيرات':'Turn reminders off'}</button></div>
   : ios && !installed ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-7 text-amber-900">{ar?'على الآيفون: افتح البطاقة في Safari، اضغط مشاركة ← إضافة إلى الشاشة الرئيسية، ثم افتحها من الأيقونة وفعّل التذكيرات.':'On iPhone: open this card in Safari, tap Share → Add to Home Screen, then open its icon to enable reminders.'}</p>
   : !supported && !demo ? <p className="mt-3 text-sm text-ink-500">{ar?'هذا المتصفح لا يدعم الإشعارات. افتح البطاقة في متصفح يدعمها.':'This browser does not support notifications. Open your card in a supported browser.'}</p>
   : <button disabled={busy || !state?.available} onClick={enable} className="btn-primary mt-4 w-full"><Bell size={16}/>{busy?'…':ar?'تفعيل الإشعارات':'Enable notifications'}</button>}
  {state && !state.available && <p className="mt-3 text-xs text-ink-500">{ar?'التذكيرات متوقفة حاليًا لدى العيادة.':'Your clinic’s reminders are currently paused.'}</p>}
  {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
 </section>
}
