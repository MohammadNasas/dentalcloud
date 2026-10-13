// Development preview only. No account marker is read or saved.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import ReleaseNoticeDialog from './components/ReleaseNoticeDialog'
import './index.css'
import './updates-preview.css'
function Preview() {
  const [open,setOpen] = useState(true), [lang,setLang] = useState('ar')
  const ar=lang==='ar'
  return <div className="release-preview" dir={ar?'rtl':'ltr'}>
    <iframe title="DentalCloud — demo patients" src="/patients?demo=1" className="release-app" tabIndex={open?-1:0}/>
    <div className="release-preview-tools"><span>{ar?'معاينة فقط':'Preview only'}</span><button onClick={()=>setOpen(true)}>{ar?'عرض الرسالة':'Show update'}</button><button onClick={()=>setLang(ar?'en':'ar')}>{ar?'English':'العربية'}</button></div>
    <ReleaseNoticeDialog open={open} onClose={()=>setOpen(false)} lang={lang}/>
  </div>
}
if(import.meta.env.DEV) createRoot(document.getElementById('root')).render(<Preview/> )
