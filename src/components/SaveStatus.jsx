import { useStore } from '../context/StoreContext'
import { useI18n } from '../i18n/I18nContext'

export default function SaveStatus() {
  const { saveStatus, retrySaves } = useStore()
  const { lang } = useI18n()
  const ar = lang === 'ar'
  if (!saveStatus.pending && !saveStatus.failed) return null
  const failed = saveStatus.failed > 0
  return (
    <div role={failed ? 'alert' : 'status'} aria-live="polite" dir={ar ? 'rtl' : 'ltr'}
      className={`fixed bottom-3 left-3 right-3 z-[100] mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${failed ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-brand-200 bg-white text-ink-700'}`}>
      <span>{failed
        ? (ar ? 'في تعديلات ما انحفظت. خلي الصفحة مفتوحة وأعد المحاولة.' : 'Some changes were not saved. Keep this page open and retry.')
        : (ar ? 'جاري تأكيد الحفظ…' : 'Confirming save…')}</span>
      {failed && <button className="btn-primary shrink-0" disabled={saveStatus.pending > 0} onClick={retrySaves}>
        {ar ? 'إعادة المحاولة' : 'Retry'}
      </button>}
    </div>
  )
}
