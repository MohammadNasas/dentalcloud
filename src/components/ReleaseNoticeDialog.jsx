import { useEffect, useRef } from 'react'
import { X, ArrowLeft, ArrowRight, FileUp, Wallet, ChartNoAxesCombined, MessageCircle, Sparkles, Check, FileText } from 'lucide-react'
import './ReleaseNotice.css'
export default function ReleaseNoticeDialog({ open, onClose, lang = 'ar' }) {
  const dialog = useRef(null), ar = lang === 'ar', L = (a,b) => ar ? a : b
  useEffect(() => {
    const node = dialog.current
    if (!open) { if (node.open) node.close(); return }
    const previousFocus = document.activeElement
    node.showModal()
    return () => { node.close(); previousFocus?.focus?.() }
  }, [open])
  const features = [
    [Wallet, L('مصاريف عيادتك بصورة أوضح','A clearer view of your expenses'), L('تابع الإيجار والرواتب والمصاريف، وشوف صافي التحصيل الشهري.','Track rent, salaries and expenses alongside your monthly collections.')],
    [ChartNoAxesCombined, L('أسعار مبنية على تكاليفك','Pricing informed by your costs'), L('جهّز خطة تسعير تراعي مصاريف العيادة والربح المستهدف.','Plan treatment prices around your clinic costs and target profit.')],
    [MessageCircle, L('تعليمات المريض عبر واتساب','Patient instructions on WhatsApp'), L('اختر التعليمة والمريض، وجهّز إرسالها لرقمه مباشرة.','Choose the instructions and patient, then prepare their WhatsApp message.')],
  ]
  return (
    <dialog ref={dialog} className="release-dialog" dir={ar?'rtl':'ltr'} aria-labelledby="release-title" onCancel={()=>onClose()} onClick={e=>{if(e.target===dialog.current)onClose()}}>
      <div className="release-content">
        <header className="release-head">
          <div className="release-eyebrow"><span className="release-brand">DentalCloud</span><span className="release-pill"><Sparkles size={12}/>{L('جديد لعيادتك','NEW FOR YOUR CLINIC')}</span></div>
          <button className="release-close" aria-label={L('إغلاق','Close')} onClick={()=>onClose()}><X size={19}/></button>
          <h1 id="release-title">{L('خطوة أسهل، كل يوم.','A little easier. Every day.')}</h1>
          <p>{L('تعرّف على أحدث الإضافات لعيادتك.','Discover the latest additions to your clinic.')}</p>
        </header>
        <section className="release-featured">
          <div className="release-featured-copy"><span className="release-feature-label"><FileUp size={15}/>{L('استيراد ملفات المرضى','PATIENT IMPORT')}</span><h2>{L('ملفاتك القديمة، بداية مرتّبة.','Your old records. A fresh start.')}</h2><p>{L('انقل ملفات مرضاك، راجع البيانات وعدّلها قبل إضافتها لعيادتك.','Bring in your patient records, review the details and make changes before saving.')}</p><span className="release-location">{L('تلاقيها في: المرضى ← نقل ملفات المرضى','Find it in: Patients → Import patients')}</span></div>
          <div className="release-art" aria-hidden="true"><div className="release-paper back"/><div className="release-paper"><FileText size={25}/><i/><i/><i/><span className="release-check"><Check size={18}/></span></div><span className="release-art-dot"/></div>
        </section>
        <div className="release-features">{features.map(([Icon,title,description],i)=><section className="release-item" key={i}><span className={`release-icon icon-${i}`}><Icon size={20} strokeWidth={1.7}/></span><div><h2>{title}</h2><p>{description}</p></div></section>)}</div>
        <footer className="release-footer"><span>{L('كل شيء بمكانه المعتاد.','Everything is right where you left it.')}</span><button autoFocus className="release-start" onClick={()=>onClose()}>{L('يلا نبدأ','Let’s get started')}{ar?<ArrowLeft size={17}/>:<ArrowRight size={17}/>}</button></footer>
      </div>
    </dialog>
  )
}
