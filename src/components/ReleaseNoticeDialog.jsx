import { useEffect, useRef } from 'react'
import { X, ArrowLeft, ArrowRight, Gift, QrCode, CalendarCheck, Settings, Sparkles, Check } from 'lucide-react'
import './ReleaseNotice.css'
export default function ReleaseNoticeDialog({ open, onClose, onExplore, lang = 'ar' }) {
  const dialog = useRef(null), ar = lang === 'ar', L = (a,b) => ar ? a : b
  useEffect(() => {
    const node = dialog.current
    if (!open) { if (node.open) node.close(); return }
    const previousFocus = document.activeElement
    node.showModal()
    return () => { node.close(); previousFocus?.focus?.() }
  }, [open])
  const features = [
    [Settings, L('عرض تحدده أنت','Your clinic, your reward'), L('حدد عدد الزيارات والمكافأة من الإعدادات ← بطاقات الولاء.','Choose the visit target and reward in Settings → Loyalty cards.')],
    [CalendarCheck, L('أختام مع الزيارات المكتملة','Stamps for completed visits'), L('تُحتسب الزيارات المؤهلة بعد تفعيل البرنامج، دون إضافة الزيارات القديمة.','Eligible completed visits count after enrollment. Earlier visits are not added.')],
    [QrCode, L('بطاقة المريض برمز QR','A patient card with its own QR'), L('من ملف المريض ← بطاقة الولاء ← عرض رمز QR للبطاقة. يمسحه المريض ليرى زياراته ومكافأته بدون تسجيل دخول.','Open a patient → Loyalty card → Show card QR code. Patients scan it to view visits and rewards without signing in.')],
  ]
  return (
    <dialog ref={dialog} className="release-dialog" dir={ar?'rtl':'ltr'} aria-labelledby="release-title" onCancel={()=>onClose()} onClick={e=>{if(e.target===dialog.current)onClose()}}>
      <div className="release-content">
        <header className="release-head">
          <div className="release-eyebrow"><span className="release-brand">DentalCloud</span><span className="release-pill"><Sparkles size={12}/>{L('جديد لعيادتك','NEW FOR YOUR CLINIC')}</span></div>
          <button className="release-close" aria-label={L('إغلاق','Close')} onClick={()=>onClose()}><X size={19}/></button>
          <h1 id="release-title">{L('كل زيارة تستحق التقدير.','Every visit deserves appreciation.')}</h1>
          <p>{L('بطاقات الولاء أصبحت متاحة في DentalCloud.','Loyalty cards are now available in DentalCloud.')}</p>
        </header>
        <section className="release-featured">
          <div className="release-featured-copy"><span className="release-feature-label"><Gift size={15}/>{L('بطاقات الولاء','LOYALTY CARDS')}</span><h2>{L('زيارات تتراكم، ومكافأة يختارها الطبيب.','Visits add up. You choose the reward.')}</h2><p>{L('مثلاً: خمس زيارات مكتملة، وتنظيف مجاني في الزيارة التالية. أنت تحدد العرض المناسب لعيادتك.','For example: five completed visits, then complimentary cleaning at the next visit. Set the offer that suits your clinic.')}</p><span className="release-location">{L('متاحة ضمن باقة Pro','Available with Pro')}</span></div>
          <div className="release-art" aria-hidden="true"><div className="release-paper back"/><div className="release-paper"><Gift size={25}/><i/><i/><i/><span className="release-check"><Check size={18}/></span></div><span className="release-art-dot"/></div>
        </section>
        <div className="release-features">{features.map(([Icon,title,description],i)=><section className="release-item" key={i}><span className={`release-icon icon-${i}`}><Icon size={20} strokeWidth={1.7}/></span><div><h2>{title}</h2><p>{description}</p></div></section>)}</div>
        <footer className="release-footer"><span>{L('كل شيء بمكانه المعتاد.','Everything is right where you left it.')}</span><button autoFocus className="release-start" onClick={()=>onExplore ? onExplore() : onClose()}>{L('اكتشف بطاقات الولاء','Explore loyalty cards')}{ar?<ArrowLeft size={17}/>:<ArrowRight size={17}/>}</button></footer>
      </div>
    </dialog>
  )
}
