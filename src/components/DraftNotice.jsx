import { useI18n } from '../i18n/I18nContext'
export default function DraftNotice({ draft }) {
  const { lang } = useI18n()
  const ar = lang === 'ar'
  if (draft.pending) return <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm" role="status">
    <p>{ar ? 'في مسودة غير محفوظة لهذا النموذج على جهازك. بدك تسترجعها؟ راجعها قبل الحفظ.' : 'An unsaved draft is available on this device. Restore and review it before saving.'}</p>
    <div className="mt-2 flex gap-2">
      <button type="button" className="btn-primary" onClick={draft.restore}>{ar ? 'استرجاع المسودة' : 'Restore draft'}</button>
      <button type="button" className="btn-ghost" onClick={draft.discard}>{ar ? 'تجاهل المسودة' : 'Discard draft'}</button>
    </div>
  </div>
  if (draft.loading) return <p role="status" className="mb-2 text-xs text-ink-500">{ar ? 'جارٍ التحقق من المسودات…' : 'Checking drafts…'}</p>
  if (draft.status === 'error') return <p role="alert" className="mb-2 text-xs text-rose-600">{ar ? 'تعذّر حفظ المسودة على الجهاز. لا تغلق النموذج قبل حفظه.' : 'Could not save the device draft. Save the form before closing it.'}</p>
  if (!draft.dirty) return null
  return <p role="status" className="mb-2 text-xs text-ink-500">{draft.status === 'saving'
    ? (ar ? 'جارٍ حفظ المسودة…' : 'Saving draft…')
    : (ar ? 'مسودة محفوظة على هذا الجهاز — لم تُحفظ في ملف المريض بعد' : 'Draft saved on this device — not yet saved to the patient record')}</p>
}
