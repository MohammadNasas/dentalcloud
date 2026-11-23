import { useEffect, useRef } from 'react'
import { X, ArrowLeft, ArrowRight, Users, LockKeyhole, CalendarCheck, Settings, Sparkles, Check } from 'lucide-react'
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
    [Settings, L('بروفايل لكل فرد','A profile for each team member'), L('أضف الأطباء والمساعدين بكلمات مرور مستقلة من الإعدادات ← بروفايلات العيادة.','Add doctors and assistants with separate passwords in Settings → Clinic profiles.')],
    [LockKeyhole, L('خصوصية حسابات المرضى','Patient financial privacy'), L('الفريق يرى الحالة الطبية، ويطّلع على حساب المرضى المعيّنين له فقط. إيرادات العيادة ومصاريفها تبقى لصاحبها.','The team can view clinical details and finances only for their assigned patients. Clinic revenue and expenses remain private to the owner.')],
    [CalendarCheck, L('موعد من ملف المريض','Book from the patient file'), L('زر إضافة موعد يختار المريض تلقائيًا. التقويم مشترك بين بروفايلات العيادة.','Add appointment selects the patient automatically. All clinic profiles share one calendar.')],
  ]
  return (
    <dialog ref={dialog} className="release-dialog" dir={ar?'rtl':'ltr'} aria-labelledby="release-title" onCancel={()=>onClose()} onClick={e=>{if(e.target===dialog.current)onClose()}}>
      <div className="release-content">
        <header className="release-head">
          <div className="release-eyebrow"><span className="release-brand">DentalCloud</span><span className="release-pill"><Sparkles size={12}/>{L('جديد لعيادتك','NEW FOR YOUR CLINIC')}</span></div>
          <button className="release-close" aria-label={L('إغلاق','Close')} onClick={()=>onClose()}><X size={19}/></button>
          <h1 id="release-title">{L('فريق واحد. مساحة لكل شخص.','One team. A workspace for everyone.')}</h1>
          <p>{L('بروفايلات العيادة والحجز السريع أصبحت متاحة.','Clinic profiles and quick appointment booking are here.')}</p>
        </header>
        <section className="release-featured">
          <div className="release-featured-copy"><span className="release-feature-label"><Users size={15}/>{L('بروفايلات العيادة','CLINIC PROFILES')}</span><h2>{L('شغل مشترك، وخصوصية لصاحب العيادة.','Shared work. Private clinic finances.')}</h2><p>{L('صاحب العيادة يدير البروفايلات ويحدد الطبيب المسؤول عن كل مريض. التبديل متاح من أسفل القائمة الجانبية.','The owner manages profiles and assigns each patient to a clinician. Switch profiles from the bottom of the sidebar.')}</p><span className="release-location">{L('متاحة ضمن باقة Pro','Available with Pro')}</span></div>
          <div className="release-art" aria-hidden="true"><div className="release-paper back"/><div className="release-paper"><Users size={25}/><i/><i/><i/><span className="release-check"><Check size={18}/></span></div><span className="release-art-dot"/></div>
        </section>
        <div className="release-features">{features.map(([Icon,title,description],i)=><section className="release-item" key={i}><span className={`release-icon icon-${i}`}><Icon size={20} strokeWidth={1.7}/></span><div><h2>{title}</h2><p>{description}</p></div></section>)}</div>
        <footer className="release-footer"><span>{L('كل شيء بمكانه المعتاد.','Everything is right where you left it.')}</span><button autoFocus className="release-start" onClick={()=>onExplore ? onExplore() : onClose()}>{L('اكتشف التحديث','Explore the update')}{ar?<ArrowLeft size={17}/>:<ArrowRight size={17}/>}</button></footer>
      </div>
    </dialog>
  )
}
