import { useEffect, useState, useRef } from 'react'
import { Upload, Trash2, Images, X, Scan } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { putImage, getImage, deleteImage, fileToResizedDataURL } from '../../lib/media'
import { genId } from '../../lib/db'
import { EmptyState, Segmented } from '../ui'
import { fmtDate } from '../../lib/dates'
import { cx } from '../../lib/utils'

const CATEGORIES = {
  before: { en: 'Before', ar: 'قبل' },
  after: { en: 'After', ar: 'بعد' },
  xray: { en: 'X-ray', ar: 'أشعة' },
  other: { en: 'Other', ar: 'أخرى' },
}

export default function Gallery({ patient }) {
  const { t, lang, L } = useI18n()
  const { updatePatient } = useStore()
  const photos = patient.photos || []
  const [urls, setUrls] = useState({})
  const [category, setCategory] = useState('before')
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    let active = true
    ;(async () => {
      const map = {}
      for (const p of photos) {
        if (!urls[p.id]) { const d = await getImage(p.id); if (d) map[p.id] = d }
      }
      if (active && Object.keys(map).length) setUrls((u) => ({ ...u, ...map }))
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length])

  async function onFiles(files) {
    setBusy(true)
    try {
      const next = [...photos]
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        const dataUrl = await fileToResizedDataURL(file)
        const id = genId('img')
        await putImage(id, dataUrl)
        setUrls((u) => ({ ...u, [id]: dataUrl }))
        next.push({ id, category, caption: '', date: new Date().toISOString() })
      }
      updatePatient(patient.id, { photos: next })
    } finally { setBusy(false) }
  }

  async function remove(id) {
    await deleteImage(id)
    updatePatient(patient.id, { photos: photos.filter((p) => p.id !== id) })
  }

  const groups = ['before', 'after', 'xray', 'other'].map((c) => ({ c, items: photos.filter((p) => p.category === c) })).filter((g) => g.items.length)

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <Segmented value={category} onChange={setCategory} size="sm"
          options={Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: L(v) }))} />
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles([...e.target.files])} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary ms-auto">
          <Upload size={16} /> {busy ? t('export.exporting') : t('common.upload')}
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="card"><EmptyState icon={<Images size={28} />} title={lang === 'ar' ? 'لا صور بعد' : 'No images yet'} hint={lang === 'ar' ? 'ارفع صور قبل/بعد أو أشعة' : 'Upload before/after photos or X-rays'} /></div>
      ) : (
        groups.map((g) => (
          <div key={g.c} className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              {g.c === 'xray' ? <Scan size={16} className="text-brand-500" /> : <Images size={16} className="text-brand-500" />}
              <h3 className="font-bold text-ink-800">{L(CATEGORIES[g.c])}</h3>
              <span className="chip bg-ink-100 text-ink-500">{g.items.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map((p) => (
                <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl border border-ink-100 bg-ink-50">
                  {urls[p.id] ? (
                    <img src={urls[p.id]} alt="" onClick={() => setLightbox(urls[p.id])} className={cx('h-full w-full cursor-zoom-in object-cover', g.c === 'xray' && 'bg-black')} />
                  ) : <div className="flex h-full items-center justify-center text-ink-300"><Images size={24} /></div>}
                  <button onClick={() => remove(p.id)} className="absolute top-2 rounded-lg bg-white/90 p-1.5 text-rose-500 opacity-0 shadow transition-opacity group-hover:opacity-100 end-2"><Trash2 size={14} /></button>
                  <span className="absolute bottom-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white start-1">{fmtDate(p.date, lang)}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 rounded-lg bg-white/10 p-2 text-white end-4"><X size={22} /></button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}
