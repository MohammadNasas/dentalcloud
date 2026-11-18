import { useEffect, useState } from 'react'
import { Gift, Save, Check } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { useI18n } from '../i18n/I18nContext'
import { Field } from './ui'
import { supabase } from '../lib/supabaseClient'
import { loyaltyRpc, loyaltyError } from '../lib/loyaltyApi'
import { LOYALTY_CATEGORIES } from '../lib/loyalty'
import LoyaltyCard from './LoyaltyCard'

export default function LoyaltySettings() {
  const { lang } = useI18n(); const ar = lang === 'ar'
  const { clinic, currentUser, readOnly, demoMode } = useStore()
  const owner = Boolean(currentUser?.isOwner)
  const [enabled, setEnabled] = useState(false); const [target, setTarget] = useState(5)
  const [reward, setReward] = useState(''); const [categories, setCategories] = useState(LOYALTY_CATEGORIES.map(c => c.value))
  const [error, setError] = useState(''); const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false)
  useEffect(() => {
    let active = true
    async function load() {
      if (demoMode) { setReward(ar ? 'تنظيف أسنان مجاني' : 'Complimentary cleaning'); setEnabled(true); setLoaded(true); return }
      try {
        if (!supabase) throw new Error('setup_required')
        const { data, error } = await supabase.from('loyalty_programs').select('enabled,target,reward,categories').eq('clinic_id', clinic.id).maybeSingle()
        if (error) throw error
        if (!active) return
        if (data) { setEnabled(data.enabled); setTarget(data.target); setReward(data.reward); setCategories(data.categories) }
        setLoaded(true)
      } catch(e) { if (active) setError(loyaltyError(e, lang)) }
    }
    load(); return () => { active = false }
  }, [clinic.id, demoMode, lang])
  async function save() {
    if (busy || readOnly || !owner) return
    setBusy(true); setError(''); setSaved(false)
    try { await loyaltyRpc('save_loyalty_program', { p_enabled: enabled, p_target: Number(target), p_reward: reward.trim(), p_categories: categories }); setSaved(true) }
    catch(e) { setError(loyaltyError(e, lang)) } finally { setBusy(false) }
  }
  return <div className="space-y-6">
    <div className="card p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-lg font-bold text-ink-800"><Gift size={21} className="text-brand-600" />{ar ? 'زيارات تستحق التقدير' : 'Visits worth rewarding'}</h3>
      <p className="mt-2 text-sm leading-7 text-ink-500">{ar ? 'حدد عرض عيادتك. يحصل كل مريض على بطاقة خاصة، وتتحدث الأختام مع الزيارات المكتملة.' : 'Set your clinic reward. Each patient gets a private card that updates as visits are completed.'}</p>
      {!owner && <p className="mt-3 text-sm text-amber-700">{ar ? 'تعديل العرض متاح لصاحب العيادة.' : 'Only the clinic owner can change the program.'}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <fieldset disabled={!loaded || busy || readOnly || !owner} className="space-y-4">
          <label className="flex items-center gap-2 font-semibold text-ink-700"><input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); setSaved(false) }} />{ar ? 'تفعيل بطاقة الولاء' : 'Enable loyalty cards'}</label>
          <Field label={ar ? 'عدد الزيارات قبل المكافأة' : 'Visits before the reward'}><input className="input" type="number" min="1" max="20" step="1" value={target} onChange={e => { setTarget(e.target.value); setSaved(false) }} /></Field>
          <Field label={ar ? 'المكافأة' : 'Reward'}><input className="input" maxLength={160} value={reward} placeholder={ar ? 'مثلاً: تنظيف مجاني في الزيارة التالية' : 'e.g. Free cleaning at the next visit'} onChange={e => { setReward(e.target.value); setSaved(false) }} /></Field>
          <Field label={ar ? 'الزيارات المحتسبة' : 'Qualifying visits'}><div className="flex flex-wrap gap-3">{LOYALTY_CATEGORIES.map(c => <label key={c.value} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={categories.includes(c.value)} onChange={e => { setCategories(values => e.target.checked ? [...values,c.value] : values.filter(v => v !== c.value)); setSaved(false) }} />{c[lang] || c.en}</label>)}</div></Field>
          <p className="text-xs leading-6 text-ink-400">{ar ? 'تبدأ الأختام من التفعيل، ولا تُضاف الزيارات القديمة. تغيير العرض يطبّق على البطاقات الجديدة وبعد صرف مكافأة البطاقة الحالية، حفاظاً على وعدك للمريض.' : 'Only visits after enrollment count. Program changes apply to new cards and existing cards after their current reward is redeemed.'}</p>
          <button className="btn-primary" disabled={!reward.trim() || !categories.length || !Number.isInteger(Number(target)) || Number(target)<1 || Number(target)>20} onClick={save}>{saved ? <Check size={16} /> : <Save size={16} />}{saved ? (ar ? 'تم الحفظ' : 'Saved') : (ar ? 'حفظ العرض' : 'Save program')}</button>
        </fieldset>
        <div><p className="mb-3 text-xs font-semibold text-ink-400">{ar ? 'معاينة بطاقة المريض' : 'Patient card preview'}</p><LoyaltyCard compact lang={lang} card={{ target, visits: Math.min(3,Number(target)), reward: reward || (ar ? 'مكافأتك المميزة' : 'Your special reward'), clinicName: clinic.name, clinicNameAr: clinic.nameAr, enabled }} /></div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    </div>
  </div>
}