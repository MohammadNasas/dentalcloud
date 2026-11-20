import { useEffect,useState } from 'react'
import { Bell,BellOff } from 'lucide-react'

export default function PatientPushOptIn({token,lang,demo=false}) {
 const ar=lang==='ar'
 const [config,setConfig]=useState(null),[state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const supported=typeof Notification!=='undefined' && 'serviceWorker' in navigator && 'PushManager' in window
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1)
 const android=/Android/i.test(navigator.userAgent)
 const braveDesktop=typeof navigator.brave?.isBrave==='function' && !ios && !android
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
      : braveDesktop
        ? (ar?'تعذّر الاتصال بخدمة الإشعارات في Brave. تأكد من تفعيل خيار Use Google services for push messaging في الإعدادات، ثم أعد تشغيل المتصفح وجرّب مجددًا.':'Brave could not connect to its push service. Check that Use Google services for push messaging is enabled in Settings, then relaunch the browser and try again.')
        : (ar?'تعذّر تفعيل خدمة الإشعارات في المتصفح. تأكد من السماح بإشعارات الموقع ومن اتصالك بالإنترنت، ثم أعد المحاولة.':'The browser could not enable push notifications. Check site notification permissions and your connection, then try again.'))}
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
   : state && !state.available ? <p className="mt-3 text-sm text-ink-500">{ar?'التذكيرات متوقفة حاليًا لدى العيادة.':'Your clinic’s reminders are currently paused.'}</p>
   : ios && !installed ? <div className="mt-4 rounded-xl bg-[#f3f6f2] p-4 text-sm leading-7">
      <p className="font-semibold">{ar?'على الآيفون، أضف بطاقتك للشاشة الرئيسية':'On iPhone, add your card to the Home Screen'}</p>
      <p className="mt-1 text-ink-500">{ar?'بدون تنزيل تطبيق من المتجر. تحتاج iOS 16.4 أو أحدث.':'No App Store download needed. Requires iOS 16.4 or later.'}</p>
      <ol className="mt-2 list-inside list-decimal space-y-1">
       <li>{ar?'افتح رابط البطاقة في Safari.':'Open the card link in Safari.'}</li>
       <li>{ar?'اضغط «مشاركة»، ثم «إضافة إلى الشاشة الرئيسية» وأكّد الإضافة.':'Tap Share, then Add to Home Screen, and confirm.'}</li>
       <li>{ar?'افتح البطاقة من الأيقونة الجديدة، واضغط «تفعيل الإشعارات» ثم «السماح».':'Open the new card icon, tap Enable notifications, then Allow.'}</li>
      </ol>
     </div>
   : !supported && !demo ? <p className="mt-3 text-sm leading-7 text-ink-500">{ar?(android?'افتح رابط البطاقة في Chrome خارج واتساب أو إنستغرام، ثم فعّل الإشعارات. لا تحتاج تنزيل تطبيق.':'هذا المتصفح لا يدعم الإشعارات. افتح البطاقة في متصفح يدعمها.'):(android?'Open the card link in Chrome outside WhatsApp or Instagram, then enable notifications. No app download needed.':'This browser does not support notifications. Open your card in a supported browser.')}</p>
   : <div className="mt-4">
      {android && <p className="mb-3 text-sm text-ink-500">{ar?'توصلك الإشعارات من الموقع مباشرة، بدون تنزيل تطبيق.':'Receive notifications directly from this site. No app download needed.'}</p>}
      <button disabled={busy || !state?.available} onClick={enable} className="btn-primary w-full"><Bell size={16}/>{busy?'…':ar?'تفعيل الإشعارات':'Enable notifications'}</button>
      <p className="mt-2 text-center text-xs text-ink-500">{ar?'اختر «السماح» عندما يطلب جهازك الإذن. يمكنك إيقافها لاحقًا.':'Choose Allow when your device asks. You can turn notifications off later.'}</p>
     </div>}
  {state?.subscribed && !state.available && <p className="mt-3 text-sm text-ink-500">{ar?'التذكيرات متوقفة حاليًا لدى العيادة.':'Your clinic’s reminders are currently paused.'}</p>}
  {error && <div role="alert" className="mt-3 text-sm leading-6 text-rose-700"><p>{error}</p>
   {braveDesktop && error.includes('Use Google services') && <p className="mt-2 text-ink-500">{ar?'انسخ هذا العنوان وافتحه في شريط المتصفح:':'Copy this address into your browser’s address bar:'} <code dir="ltr" className="block select-all break-all rounded-lg bg-[#f3f6f2] px-3 py-2 mt-1 text-[#103c3b]">brave://settings/privacy</code></p>}
  </div>}
 </section>
}
