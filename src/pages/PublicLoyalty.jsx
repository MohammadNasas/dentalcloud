import { useEffect, useState } from 'react'
import { Gift, RefreshCw } from 'lucide-react'
import LoyaltyCard from '../components/LoyaltyCard'
import { paymentApiUrl } from '../lib/apiUrl'
import { DEMO_LOYALTY_TOKEN } from '../lib/loyalty'
export default function PublicLoyalty() {
  const [lang, setLang] = useState('ar'); const ar = lang === 'ar'
  const [card, setCard] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    document.title = ar ? 'بطاقة زياراتك — DentalCloud' : 'Your visit card — DentalCloud'
    let robots = document.querySelector('meta[name="robots"]')
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
    robots.content = 'noindex, nofollow, noarchive'
    document.querySelectorAll('link[rel="canonical"],link[rel="alternate"][hreflang],script[type="application/ld+json"]').forEach(el=>el.remove())
  }, [ar])
  useEffect(() => {
    const controller = new AbortController(); let active = true
    setLoading(true); setError('')
    const token = window.location.hash.slice(1)
    const load = async () => {
      try {
        if (token === DEMO_LOYALTY_TOKEN && new URLSearchParams(location.search).get('demo') === '1') {
          if (active) setCard({ target: 5, visits: 3, enabled: true, reward: 'تنظيف أسنان مجاني · Demo reward', clinicName: 'Demo clinic', clinicNameAr: 'عيادة تجريبية' })
          return
        }
        if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('missing')
        const r = await fetch(paymentApiUrl('/api/loyalty-card', location.protocol), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
          credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
        })
        const result = await r.json()
        if (!r.ok || !result.card) throw new Error(r.status === 404 ? 'missing' : 'unavailable')
        if (active) setCard(result.card)
      } catch(e) { if (active && e.name !== 'AbortError') { setCard(null); setError(e.message === 'missing' ? 'missing' : 'unavailable') } }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false; controller.abort() }
  }, [refresh])
  return <main dir={ar ? 'rtl' : 'ltr'} className="flex min-h-[100dvh] flex-col items-center bg-[#f3f6f2] px-5 py-9">
    <div className="flex w-full max-w-md items-center justify-between text-[#103c3b]"><span className="text-sm font-bold">DentalCloud</span><button onClick={() => setLang(ar ? 'en' : 'ar')} className="rounded-full border border-[#103c3b]/15 px-3 py-1 text-xs">{ar ? 'English' : 'العربية'}</button></div>
    <div className="my-auto w-full max-w-md py-10">
      {new URLSearchParams(location.search).get('demo') === '1' && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{ar ? 'بطاقة للمعاينة فقط — ليست بطاقة مريض حقيقي.' : 'Demo only — this is not a real patient card.'}</p>}
      <div className="mb-7"><p className="text-sm text-ink-400">{ar ? 'أهلاً بك مجدداً' : 'Welcome back'}</p><h1 className="mt-2 text-3xl font-extrabold text-[#103c3b]">{ar ? 'كل زيارة تقرّبك.' : 'Every visit brings you closer.'}</h1></div>
      {loading ? <div className="rounded-3xl bg-white p-10 text-center text-ink-400">{ar ? 'جارٍ تحميل بطاقتك…' : 'Loading your card…'}</div>
        : card ? <LoyaltyCard card={card} lang={lang} />
          : <div role="alert" className="rounded-3xl bg-white p-7 text-center"><Gift className="mx-auto mb-4 text-brand-600" /><p>{error === 'missing' ? (ar ? 'الرابط غير صالح أو تم تغييره. اطلب رمز البطاقة من عيادتك.' : 'This link is invalid or replaced. Ask your clinic for your card QR.') : (ar ? 'تعذّر تحميل البطاقة. تحقق من الاتصال وأعد المحاولة.' : 'Could not load the card. Check your connection and retry.')}</p></div>}
      <button disabled={loading} onClick={() => setRefresh(v => v + 1)} className="mx-auto mt-6 flex items-center gap-2 text-sm text-brand-700"><RefreshCw size={15} />{ar ? 'تحديث البطاقة' : 'Refresh card'}</button>
    </div>
    <p className="text-center text-xs text-ink-400">{ar ? 'الرعاية تستمر، والاهتمام يكبر.' : 'Care continues. Appreciation grows.'}</p>
  </main>
}
