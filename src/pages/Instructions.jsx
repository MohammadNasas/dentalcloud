import { useState } from 'react'
import { FileText, Plus, Printer, Pencil, Trash2, Save } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { INSTRUCTIONS } from '../lib/treatments'
import { genId } from '../lib/db'
import { Modal, Field, Badge } from '../components/ui'
import PageHero from '../components/PageHero'
import { printSheet, escapeHtml } from '../lib/print'

export default function Instructions() {
  const { t, lang } = useI18n()
  const { clinic, updateClinic } = useStore()
  const [editing, setEditing] = useState(null)
  const customSheets = clinic?.customSheets || []
  const defaultKeys = Object.keys(INSTRUCTIONS)
  const clinicName = lang === 'ar' ? clinic?.nameAr || clinic?.name : clinic?.name

  function doPrint(title, points) {
    printSheet({
      title, lang, clinicName, subtitle: t('instructions.title'),
      bodyHtml: `<h1>${escapeHtml(title)}</h1><ul>${points.filter((p) => p.trim()).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`,
    })
  }
  const defaultSheet = (key) => clinic?.customInstructions?.[key]?.[lang] || INSTRUCTIONS[key][lang]
  function deleteCustom(id) {
    if (confirm(t('common.delete') + '?')) updateClinic({ customSheets: customSheets.filter((s) => s.id !== id) })
  }

  return (
    <div className="space-y-5">
      <PageHero
        icon={<FileText size={22} />}
        title={t('nav.instructions')}
        subtitle={lang === 'ar' ? 'أوراق جاهزة قابلة للتعديل والطباعة، مع إضافة أوراقك الخاصة.' : 'Ready, editable & printable sheets — plus add your own.'}
        actions={<button onClick={() => setEditing({ type: 'custom', id: null })} className="btn bg-white font-bold text-brand-700 hover:bg-white/90"><Plus size={16} /> {lang === 'ar' ? 'إضافة ورقة' : 'Add sheet'}</button>}
      />

      {/* Custom sheets */}
      {customSheets.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">{lang === 'ar' ? 'أوراقك الخاصة' : 'Your sheets'}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customSheets.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-start gap-2">
                  <FileText size={18} className="mt-0.5 shrink-0 text-brand-500" />
                  <p className="flex-1 font-bold text-ink-800">{s.title}</p>
                </div>
                <p className="mt-1 text-xs text-ink-400">{s.points.length} {lang === 'ar' ? 'بنود' : 'points'}</p>
                <div className="mt-3 flex gap-1.5">
                  <button onClick={() => doPrint(s.title, s.points)} className="btn-soft !py-1.5 flex-1 text-xs"><Printer size={13} /> {t('common.print')}</button>
                  <button onClick={() => setEditing({ type: 'custom', id: s.id })} className="btn-outline !py-1.5 !px-2.5"><Pencil size={13} /></button>
                  <button onClick={() => deleteCustom(s.id)} className="btn-ghost !py-1.5 !px-2.5 text-rose-500 hover:bg-rose-50"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Default sheets */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">{lang === 'ar' ? 'أوراق جاهزة' : 'Ready-made sheets'}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {defaultKeys.map((key) => {
            const sheet = defaultSheet(key)
            const edited = clinic?.customInstructions?.[key]?.[lang]
            return (
              <div key={key} className="card p-4">
                <div className="flex items-start gap-2">
                  <FileText size={18} className="mt-0.5 shrink-0 text-brand-500" />
                  <p className="flex-1 font-bold text-ink-800">{sheet.title}</p>
                  {edited && <Badge color="brand">{lang === 'ar' ? 'مُعدّل' : 'edited'}</Badge>}
                </div>
                <p className="mt-1 text-xs text-ink-400">{sheet.points.length} {lang === 'ar' ? 'بنود' : 'points'}</p>
                <div className="mt-3 flex gap-1.5">
                  <button onClick={() => doPrint(sheet.title, sheet.points)} className="btn-soft !py-1.5 flex-1 text-xs"><Printer size={13} /> {t('common.print')}</button>
                  <button onClick={() => setEditing({ type: 'default', key })} className="btn-outline !py-1.5 !px-2.5"><Pencil size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editing && <SheetEditor editing={editing} onClose={() => setEditing(null)} />}
    </div>
  )

  function SheetEditor({ editing, onClose }) {
    const isCustom = editing.type === 'custom'
    const existingCustom = isCustom && editing.id ? customSheets.find((s) => s.id === editing.id) : null
    const base = isCustom
      ? (existingCustom || { title: '', points: [''] })
      : defaultSheet(editing.key)
    const [title, setTitle] = useState(base.title)
    const [points, setPoints] = useState(base.points.length ? [...base.points] : [''])

    function save() {
      const cleaned = points.filter((p) => p.trim())
      if (isCustom) {
        const id = editing.id || genId('sheet')
        const sheet = { id, title: title || (lang === 'ar' ? 'ورقة تعليمات' : 'Instruction sheet'), points: cleaned }
        const next = editing.id ? customSheets.map((s) => (s.id === id ? sheet : s)) : [...customSheets, sheet]
        updateClinic({ customSheets: next })
      } else {
        const ci = { ...(clinic.customInstructions || {}) }
        ci[editing.key] = { ...(ci[editing.key] || {}), [lang]: { title, points: cleaned } }
        updateClinic({ customInstructions: ci })
      }
      onClose()
    }

    return (
      <Modal open onClose={onClose} size="lg" title={t('settings.editInstructions')} icon={<FileText size={18} className="text-brand-500" />}
        footer={<><button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button><button onClick={save} className="btn-primary"><Save size={16} /> {t('common.save')}</button></>}>
        <Field label={lang === 'ar' ? 'اسم الورقة / العنوان' : 'Sheet name / title'}>
          <input className="input font-bold" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder={lang === 'ar' ? 'مثال: تعليمات بعد التبييض' : 'e.g. After whitening'} />
        </Field>
        <p className="label mt-3">{lang === 'ar' ? 'البنود' : 'Points'}</p>
        <div className="space-y-2">
          {points.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
              <textarea rows={1} className="input min-h-[40px] resize-none py-2 text-sm" value={p}
                onChange={(e) => setPoints((ps) => ps.map((x, idx) => (idx === i ? e.target.value : x)))} />
              <button onClick={() => setPoints((ps) => ps.filter((_, idx) => idx !== i))} className="mt-1.5 p-1.5 text-ink-300 hover:text-rose-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => setPoints((p) => [...p, ''])} className="btn-ghost mt-2 text-brand-600"><Plus size={15} /> {t('instructions.addPoint')}</button>
      </Modal>
    )
  }
}
