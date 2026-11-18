import { Check, Gift, Sparkles } from 'lucide-react'
import { loyaltyProgress } from '../lib/loyalty'

export default function LoyaltyCard({ card, lang = 'ar', compact = false }) {
  const ar = lang === 'ar'
  const progress = loyaltyProgress(card)
  const remainingLabel = progress.remaining === 1 ? 'باقي زيارة واحدة على مكافأتك'
    : progress.remaining === 2 ? 'باقي زيارتان على مكافأتك'
      : `باقي ${progress.remaining} ${progress.remaining <= 10 ? 'زيارات' : 'زيارة'} على مكافأتك`
  return <section dir={ar ? 'rtl' : 'ltr'} className={`relative overflow-hidden rounded-3xl bg-[#103c3b] text-white shadow-lg ${compact ? 'p-5' : 'p-7 sm:p-9'}`}>
    <div className="pointer-events-none absolute -end-12 -top-16 h-52 w-52 rounded-full border-[28px] border-white/[0.04]" />
    <div className="relative flex items-start justify-between gap-4">
      <div><p className="text-xs font-semibold tracking-wide text-teal-200">{ar ? 'بطاقة زياراتك' : 'YOUR VISIT CARD'}</p>
        <h3 className="mt-2 text-xl font-bold">{(ar ? card.clinicNameAr || card.clinicName : card.clinicName) || (ar ? 'عيادتك' : 'Your clinic')}</h3></div>
      <div className="rounded-2xl border border-white/15 bg-white/10 p-3"><Gift size={22} className="text-[#e8cb8f]" /></div>
    </div>
    <div className={`relative flex flex-wrap gap-2 ${compact ? 'my-5' : 'my-8'}`}>
      {Array.from({ length: progress.target }, (_, i) => <span key={i} aria-label={ar ? `الزيارة ${i + 1}${i < progress.filled ? ' مكتملة' : ''}` : `Visit ${i + 1}${i < progress.filled ? ' complete' : ''}`}
        className={`flex h-9 w-9 items-center justify-center rounded-full border sm:h-11 sm:w-11 ${i < progress.filled ? 'border-[#e8cb8f] bg-[#e8cb8f] text-[#103c3b]' : 'border-dashed border-white/30 text-white/45'}`}>
        {i < progress.filled ? <Check size={21} strokeWidth={3} /> : <span className="text-sm font-semibold">{i + 1}</span>}
      </span>)}
      <span className={`flex h-9 w-9 items-center justify-center rounded-full border sm:h-11 sm:w-11 ${progress.ready ? 'border-[#e8cb8f] bg-[#e8cb8f] text-[#103c3b]' : 'border-white/15 bg-white/5 text-[#e8cb8f]'}`}><Gift size={21} /></span>
    </div>
    <div className="relative border-t border-white/15 pt-4">
      <p className="flex items-center gap-2 text-sm text-teal-100">{progress.ready && <Sparkles size={16} />}{!card.enabled
        ? (ar ? 'برنامج الولاء متوقف مؤقتاً' : 'The loyalty program is paused')
        : progress.ready ? (ar ? 'مكافأتك جاهزة للزيارة القادمة' : 'Your reward is ready for your next visit')
          : (ar ? remainingLabel : `${progress.remaining} ${progress.remaining === 1 ? 'visit' : 'visits'} until your reward`)}</p>
      <p className="mt-2 text-lg font-bold text-[#f5e2bb]">{card.reward}</p>
      <p className="mt-3 text-xs text-white/50">{ar ? 'تُحتسب الزيارة بعد إتمامها في العيادة.' : 'Visits count after completion at the clinic.'}</p>
    </div>
  </section>
}
