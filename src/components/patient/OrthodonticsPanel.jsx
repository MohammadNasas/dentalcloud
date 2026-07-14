import { useState } from 'react'
import { Activity, Check, ClipboardList, Grid3x3, NotebookPen, ScanFace } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { ORTHO_FIELDS, ORTHO_SECTIONS } from '../../lib/orthodontics'
import { cx } from '../../lib/utils'

const SECTION_ICONS = {
  consultation: ClipboardList,
  extraoral: ScanFace,
  intraoral: Grid3x3,
  occlusion: Activity,
  assessment: NotebookPen,
}

const hasValue = (value) => value !== '' && value != null && (!Array.isArray(value) || value.length > 0)

export default function OrthodonticsPanel({ patient }) {
  const { lang, L } = useI18n()
  const { updatePatient } = useStore()
  const [activeSection, setActiveSection] = useState('consultation')
  const data = patient.orthodontics || {}
  const section = ORTHO_SECTIONS.find((item) => item.id === activeSection) || ORTHO_SECTIONS[0]
  const completed = ORTHO_FIELDS.filter((field) => hasValue(data[field.id])).length
  const completion = Math.round((completed / ORTHO_FIELDS.length) * 100)

  function setField(fieldId, value) {
    updatePatient(patient.id, {
      orthodontics: {
        ...data,
        [fieldId]: value,
        updatedAt: new Date().toISOString(),
      },
    })
  }

  return (
    <div className="space-y-5">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <ScanFace size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-ink-800">{lang === 'ar' ? 'فحص التقويم الشامل' : 'Comprehensive orthodontic examination'}</h3>
              <p className="text-xs font-semibold text-ink-400">
                {lang === 'ar' ? `${completed} من ${ORTHO_FIELDS.length} حقلاً مكتمل` : `${completed} of ${ORTHO_FIELDS.length} fields completed`}
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-48">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${completion}%` }} />
            </div>
            <span className="w-10 text-end text-xs font-extrabold text-violet-600">{completion}%</span>
          </div>
        </div>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {ORTHO_SECTIONS.map((item) => {
          const Icon = SECTION_ICONS[item.id]
          const active = item.id === section.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={cx(
                'flex min-h-10 min-w-[148px] shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors',
                active ? 'bg-violet-600 text-white shadow-soft' : 'bg-white text-ink-500 hover:text-violet-600'
              )}
            >
              <Icon size={16} /> {L(item)}
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {section.groups.map((group) => (
          <section key={group.id} className="card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-ink-100 pb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Check size={15} />
              </span>
              <h4 className="font-extrabold text-ink-800">{L(group)}</h4>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((field) => (
                <OrthoField
                  key={field.id}
                  field={field}
                  value={data[field.id]}
                  lang={lang}
                  L={L}
                  onChange={(value) => setField(field.id, value)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function OrthoField({ field, value, lang, L, onChange }) {
  const full = field.span === 'full'
  const placeholder = field.placeholder ? L(field.placeholder) : ''

  return (
    <div className={cx('min-w-0', full && 'sm:col-span-2')}>
      <label className="label mb-1.5 block">{L(field)}</label>
      {field.type === 'textarea' ? (
        <textarea
          className="input min-h-24 resize-y"
          rows={4}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : field.type === 'number' ? (
        <div className="flex items-center gap-2">
          <input
            className="input min-w-0"
            type="number"
            step="0.1"
            inputMode="decimal"
            dir="ltr"
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
          />
          {field.unit && <span className="w-8 shrink-0 text-xs font-bold text-ink-400" dir="ltr">{field.unit}</span>}
        </div>
      ) : field.type === 'single' ? (
        <ChoiceGroup
          options={field.options}
          selected={value || ''}
          lang={lang}
          L={L}
          onToggle={(key) => onChange(value === key ? '' : key)}
        />
      ) : field.type === 'multi' ? (
        <ChoiceGroup
          options={field.options}
          selected={Array.isArray(value) ? value : []}
          lang={lang}
          L={L}
          multiple
          onToggle={(key) => {
            const current = Array.isArray(value) ? value : []
            onChange(current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
          }}
        />
      ) : (
        <input
          className="input"
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          dir={field.id.toLowerCase().includes('teeth') ? 'ltr' : undefined}
        />
      )}
    </div>
  )
}

function ChoiceGroup({ options, selected, multiple, L, onToggle }) {
  const selectedValues = multiple ? selected : [selected]
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((item) => {
        const active = selectedValues.includes(item.key)
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(item.key)}
            className={cx(
              'min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-bold leading-tight transition-colors',
              active
                ? 'border-violet-300 bg-violet-50 text-violet-700'
                : 'border-ink-200 bg-white text-ink-500 hover:border-violet-200 hover:text-violet-600'
            )}
          >
            {L(item)}
          </button>
        )
      })}
    </div>
  )
}
