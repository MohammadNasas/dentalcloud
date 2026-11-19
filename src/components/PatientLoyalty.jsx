import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Gift, QrCode, RefreshCw, Copy } from 'lucide-react'
import QRCode from 'qrcode'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { Modal, Field } from './ui'
import LoyaltyCard from './LoyaltyCard'
import WhatsAppIcon from './WhatsAppIcon'
import { waLink } from '../lib/utils'
import { instructionRecipientPhone } from '../lib/instructionRecipient'
import { loyaltyRpc, loyaltyError } from '../lib/loyaltyApi'
import { loyaltyLink, loyaltyProgress, loyaltyWhatsAppMessage, DEMO_LOYALTY_TOKEN } from '../lib/loyalty'

export default function PatientLoyalty({ patient }) {
  const { lang } = useI18n(); const ar = lang === 'ar'
  const { appointments, demoMode, readOnly, clinic } = useStore()
  const [card, setCard] = useState(null); const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const [share, setShare] = useState(false); const [qr, setQr] = useState('')
  const [redeem, setRedeem] = useState(false); const [appointmentId, setAppointmentId] = useState('')
  const [rotate, setRotate] = useState(false); const [copied, setCopied] = useState(false)
  const [phoneWarning, setPhoneWarning] = useState(false)
  const requestId = useRef(0)
  const load = useCallback(async () => {
    const request = ++requestId.current
    setError('')
    try {
      const value = demoMode ? { target: 5, visits: 3, reward: ar ? 'تنظيف أسنان مجاني' : 'Complimentary cleaning', enabled: true,
        clinicName: clinic?.name, clinicNameAr: clinic?.nameAr, demo: true, token: DEMO_LOYALTY_TOKEN }
        : await loyaltyRpc('get_loyalty_card', { p_patient: patient.id })
      if (request === requestId.current) setCard(value)
    } catch(e) { if (request === requestId.current) setError(loyaltyError(e, lang)) }
    finally { if (request === requestId.current) setLoaded(true) }
  }, [patient.id, appointments, demoMode, lang, clinic?.name, clinic?.nameAr])
  useEffect(() => { load(); return () => { requestId.current++ } }, [load])
  const demoOrigin = location.protocol === 'file:' ? 'https://dentalcloudapp.com' : location.origin
  const url = demoMode ? loyaltyLink(card?.token, demoOrigin).replace('/loyalty#','/loyalty?demo=1#') : loyaltyLink(card?.token)
  const recipient = instructionRecipientPhone(patient.phone)
  const whatsappUrl = recipient.status === 'ready' && url ? waLink(recipient.number, loyaltyWhatsAppMessage({
    lang, patientName: ar ? patient.nameAr || patient.name : patient.name || patient.nameAr,
    clinicName: ar ? clinic?.nameAr || clinic?.name : clinic?.name || clinic?.nameAr, url,
  })) : ''
  const whatsappClass = 'btn-outline !border-emerald-200 !bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100'
  useEffect(() => {
    let active = true; setQr('')
    if (share && url) QRCode.toDataURL(url, { width: 280, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#103c3b', light: '#ffffff' } })
      .then(data => { if (active) setQr(data) }).catch(() => { if (active) setError(ar ? 'تعذّر إنشاء الرمز.' : 'Could not create QR code.') })
    return () => { active = false }
  }, [share, url, ar])
  async function act(fn) {
    if (busy || readOnly) return
    setBusy(true); setError('')
    try { await fn(); await load() } catch(e) { setError(loyaltyError(e, lang)) } finally { setBusy(false) }
  }
  const rewardVisits = appointments.filter(a => a.patientId === patient.id && a.status === 'completed' && Date.parse(a.start) >= Date.parse(card?.enrolledAt || 0))
    .sort((a,b) => b.start.localeCompare(a.start))
  if (!loaded) return <div className="card p-5 text-sm text-ink-400">{ar ? 'جارٍ تحميل بطاقة الولاء…' : 'Loading loyalty card…'}</div>
  return <div className="space-y-3">
    {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}<button className="ms-3 underline" onClick={load}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></div>}
    {card ? <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
      <LoyaltyCard card={card} lang={lang} compact />
      <div className="card flex flex-col justify-center gap-3 p-5">
        <p className="text-sm font-bold text-ink-700">{ar ? 'خطوات صغيرة… واهتمام يستمر' : 'Small steps. Lasting care.'}</p>
        <button disabled={!url} onClick={() => { setCopied(false); setShare(true) }} className="btn-outline"><QrCode size={17} />{ar ? 'عرض رمز QR للبطاقة' : 'Show card QR code'}</button>
        {whatsappUrl ? <a className={whatsappClass} href={whatsappUrl} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={17} />{ar ? 'إرسال البطاقة عبر واتساب' : 'Share card via WhatsApp'}</a>
          : <button disabled={!url} className={whatsappClass} onClick={()=>setPhoneWarning(true)}><WhatsAppIcon size={17} />{ar ? 'إرسال البطاقة عبر واتساب' : 'Share card via WhatsApp'}</button>}
        {phoneWarning && recipient.status !== 'ready' && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs leading-6 text-amber-800">{recipient.status === 'missing'
          ? (ar ? 'لا يوجد رقم هاتف لهذا المريض. أضف رقم واتساب مع رمز الدولة من تعديل ملف المريض.' : 'No phone number is saved. Edit the patient profile and add their WhatsApp number with country code.')
          : (ar ? 'أكمل رقم المريض برمز الدولة أو صحّحه من تعديل ملف المريض، ثم أعد المحاولة.' : 'Edit the patient profile to correct the phone number and include its country code, then try again.')}</p>}
        <p className="text-xs leading-5 text-ink-400">{ar ? 'تفتح رسالة جاهزة؛ اضغط إرسال داخل واتساب.' : 'Opens a prepared message. Press Send in WhatsApp.'}</p>
        <button disabled={readOnly || !card.enabled || !loyaltyProgress(card).ready} onClick={() => { setAppointmentId(''); setRedeem(true) }} className="btn-primary"><Gift size={17} />{ar ? 'استخدام المكافأة' : 'Redeem reward'}</button>
        {!!card.adjustment && <p className="text-xs text-amber-700">{ar ? 'تم إلغاء زيارات استُخدمت لمكافأة سابقة؛ الزيارات الجديدة تعوّض الفرق أولاً.' : 'Reversed visits were used for a past reward. New visits first cover that adjustment.'}</p>}
        {demoMode && <p className="text-xs text-ink-400">{ar ? 'الرمز يفتح بطاقة تجريبية، بدون بيانات مرضى حقيقية.' : 'The QR opens a demo card, without real patient data.'}</p>}
      </div>
    </div> : !error && <div className="card flex items-center gap-3 p-5"><Gift className="text-brand-600" size={22} /><p className="flex-1 text-sm text-ink-500">{ar ? 'فعّل برنامج الولاء لتظهر بطاقة زيارات لهذا المريض.' : 'Enable loyalty to create a visit card for this patient.'}</p><Link to="/settings?section=loyalty" className="btn-outline">{ar ? 'إعداد الولاء' : 'Set up loyalty'}</Link></div>}
    {createPortal(<Modal open={share} onClose={() => setShare(false)} title={ar ? 'رمز QR لبطاقة المريض' : 'Patient card QR code'} size="sm">
      <div className="space-y-4 text-center">
        <p className="font-bold">{ar ? patient.nameAr || patient.name : patient.name}</p>
        {qr && <img className="mx-auto max-w-full" width="280" height="280" src={qr} alt={ar ? 'رمز بطاقة الولاء' : 'Loyalty card QR code'} />}
        <p className="text-sm text-ink-500">{ar ? 'يمسح المريض الرمز ليشاهد زياراته ومكافأته، بدون تسجيل دخول.' : 'Scan to view visits and rewards, without signing in.'}</p>
        <button className="btn-primary w-full" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { setError(ar ? 'تعذّر نسخ الرابط. افتح البطاقة وانسخ عنوانها.' : 'Copy failed. Open the card and copy its address.') } }}><Copy size={16} />{copied ? (ar ? 'تم النسخ' : 'Copied') : (ar ? 'نسخ رابط البطاقة' : 'Copy card link')}</button>
        <a className="btn-outline w-full" href={url} target="_blank" rel="noopener noreferrer">{ar ? 'فتح البطاقة' : 'Open card'}</a>
        {qr && <a className="btn-outline w-full" href={qr} download={`DentalCloud-loyalty-${patient.fileNo || 'card'}.png`}>{ar ? 'حفظ صورة الرمز' : 'Save QR image'}</a>}
        <p className="text-xs text-ink-400">{ar ? 'أي شخص يملك الرابط يمكنه رؤية البطاقة فقط. لا تُعرض بيانات الملف الطبي.' : 'Anyone with this link can view the card only. No medical record is shown.'}</p>
        <button disabled={readOnly} className="text-xs text-ink-500 underline" onClick={() => setRotate(true)}>{ar ? 'إلغاء الرابط القديم وإنشاء رابط جديد' : 'Replace the existing private link'}</button>
      </div>
    </Modal>,document.body)}
    {createPortal(<Modal open={rotate} onClose={() => !busy && setRotate(false)} title={ar ? 'تغيير رابط البطاقة؟' : 'Replace card link?'} size="sm">
      <p className="text-sm text-ink-500">{ar ? 'سيتوقف الرابط والرمز القديمان. أعطِ المريض الرمز الجديد.' : 'The old link and QR will stop working. Give the patient the new QR.'}</p>
      <button disabled={busy} className="btn-primary mt-4" onClick={() => act(async () => { await loyaltyRpc('rotate_loyalty_token', { p_patient: patient.id }); setRotate(false) })}><RefreshCw size={16} />{ar ? 'تغيير الرابط' : 'Replace link'}</button>
    </Modal>,document.body)}
    {createPortal(<Modal open={redeem} onClose={() => !busy && setRedeem(false)} title={ar ? 'استخدام المكافأة' : 'Redeem reward'} size="sm">
      <div className="space-y-4">
        <p className="font-bold text-brand-700">{card?.reward}</p>
        <p className="text-sm text-ink-500">{ar ? 'اختر الزيارة المكتملة التي قدّمت فيها المكافأة، بعد زيارات الاستحقاق. لا تحصل زيارة الهدية على ختم جديد. لا يغيّر هذا الإجراء الفاتورة؛ سجّل الخصم في الحساب عند الحاجة.' : 'Choose the completed reward visit after the qualifying visits. A reward visit earns no stamp. This does not alter billing; record any discount separately.'}</p>
        <Field label={ar ? 'زيارة المكافأة' : 'Reward visit'}><select className="input" value={appointmentId} onChange={e => setAppointmentId(e.target.value)}><option value="">{ar ? 'اختر الزيارة' : 'Select visit'}</option>{rewardVisits.map(a => <option key={a.id} value={a.id}>{new Date(a.start).toLocaleString(ar ? 'ar' : 'en-GB')}</option>)}</select></Field>
        <button disabled={busy || !appointmentId || readOnly} className="btn-primary w-full" onClick={() => act(async () => { await loyaltyRpc('redeem_loyalty_reward', { p_patient: patient.id, p_appointment: appointmentId }); setRedeem(false) })}>{busy ? '…' : (ar ? 'تأكيد استخدام المكافأة' : 'Confirm redemption')}</button>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      </div>
    </Modal>,document.body)}
  </div>
}
