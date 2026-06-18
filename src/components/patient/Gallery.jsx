import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Trash2, Images, X, Scan } from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import { useStore } from '../../context/StoreContext'
import { putImage, getImage, deleteImage, fileToResizedDataURL } from '../../lib/media'
import { genId } from '../../lib/db'
import { EmptyState, Segmented } from '../ui'
import { toast } from '../anim'
import { fmtDate } from '../../lib/dates'
import { cx } from '../../lib/utils'

const CATEGORIES = {
  before: { en: 'Before', ar: 'قبل' },
  during: { en: 'During', ar: 'خلال' },
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
  const [progress, setProgress] = useState({ done: 0, total: 0 })
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

  const [uploadError, setUploadError] = useState('')

  async function onFiles(files) {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    setBusy(true)
    setUploadError('')
    setProgress({ done: 0, total: images.length })
    try {
      const currentPhotos = patient.photos || []
      const next = [...currentPhotos]
      let added = 0
      for (const file of images) {
        try {
          const dataUrl = await fileToResizedDataURL(file)
          const id = genId('img')
          await putImage(id, dataUrl)
          setUrls((u) => ({ ...u, [id]: dataUrl }))
          next.push({ id, category, caption: '', date: new Date().toISOString() })
          added++
        } catch (err) {
          console.error('Failed to process image:', err)
          setUploadError(lang === 'ar' ? 'فشل تحميل إحدى الصور، حاول مرة أخرى' : 'Failed to upload an image, try again')
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }))
      }
      if (added > 0) {
        updatePatient(patient.id, { photos: next })
        toast(lang === 'ar' ? `تم رفع ${added} صورة` : `Uploaded ${added} image${added > 1 ? 's' : ''}`)
      }
    } catch (err) {
      console.error('Gallery upload error:', err)
      setUploadError(lang === 'ar' ? 'حدث خطأ أثناء الرفع' : 'Upload error, please try again')
    } finally { setBusy(false); setProgress({ done: 0, total: 0 }) }
  }

  function onDrop(e) {
    e.preventDefault()
    const files = [...(e.dataTransfer?.files || [])]
    if (files.length) onFiles(files)
  }

  async function remove(id) {
    await deleteImage(id)
    updatePatient(patient.id, { photos: photos.filter((p) => p.id !== id) })
  }

  const groups = ['before', 'during', 'after', 'xray', 'other'].map((c) => ({ c, items: photos.filter((p) => p.category === c) })).filter((g) => g.items.length)

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={category} onChange={setCategory} size="sm"
            options={Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: L(v) }))} />
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => { if (e.target.files?.length) { onFiles([...e.target.files]); e.target.value = '' } }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary ms-auto">
            <Upload size={16} /> {busy ? (lang === 'ar' ? 'جاري الرفع…' : 'Uploading…') : t('common.upload')}
          </button>
        </div>
        {/* Drag-and-drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-ink-200 px-4 py-5 text-center text-sm text-ink-400 transition-colors hover:border-brand-400 hover:bg-brand-50/30"
        >
          <Upload size={20} className="mx-auto mb-1 text-ink-300" />
          {lang === 'ar' ? 'اسحب الصور هنا أو اضغط للاختيار' : 'Drag images here or click to choose'}
        </div>
        <AnimatePresence>
          {busy && progress.total > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="flex items-center justify-between pb-1 text-xs font-semibold text-ink-500">
                <span>{lang === 'ar' ? 'جاري رفع الصور…' : 'Uploading images…'}</span>
                <span>{Math.round((progress.done / progress.total) * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                <motion.div className="h-full rounded-full bg-brand-500"
                  animate={{ width: `${(progress.done / progress.total) * 100}%` }}
                  transition={{ ease: 'easeOut', duration: 0.4 }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {uploadError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{uploadError}</p>}
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
                  ) : <span className="shimmer block h-full w-full" />}
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
