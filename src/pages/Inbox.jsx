import { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Inbox as InboxIcon, Mail, Building2, RefreshCw, User, Lightbulb } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useStore } from '../context/StoreContext'
import { supabase, isCloud } from '../lib/supabaseClient'
import { Spinner, EmptyState, Badge } from '../components/ui'
import { fmtDateTime } from '../lib/dates'
import { cx } from '../lib/utils'

// Owner-only: lists suggestions submitted by every clinic. In cloud mode it
// reads the whole suggestions table (an RLS policy grants the owner read-all);
// in local mode it just shows this device's suggestions.
export default function Inbox() {
  const { t, lang } = useI18n()
  const { isOwner, suggestions } = useStore()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setError(''); setLoading(true)
    if (!isCloud) {
      setRows((suggestions || []).slice())
      setLoading(false)
      return
    }
    const r = await supabase.from('suggestions').select('*').order('created_at', { ascending: false })
    if (r.error) { setError(r.error.message); setRows([]) }
    else setRows((r.data || []).map((row) => ({ ...row.data, id: row.id, clinicId: row.clinic_id, createdAt: row.created_at })))
    setLoading(false)
  }, [suggestions])

  useEffect(() => { if (isOwner) load() }, [isOwner, load])

  if (!isOwner) return <Navigate to="/" replace />

  const list = (rows || []).slice().sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink-800">
            <InboxIcon size={24} className="text-brand-500" /> {t('inbox.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-400">{t('inbox.subtitle')}</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-outline shrink-0">
          {loading ? <Spinner /> : <RefreshCw size={16} />} {t('inbox.refresh')}
        </button>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600" dir="ltr">{error}</p>}

      {rows === null ? (
        <div className="flex justify-center py-16"><Spinner size={26} /></div>
      ) : list.length === 0 ? (
        <EmptyState icon={<InboxIcon size={28} />} title={t('inbox.empty')} hint={t('inbox.emptyHint')} />
      ) : (
        <>
          <p className="text-sm font-semibold text-ink-500">{t('inbox.count').replace('{n}', list.length)}</p>
          <div className="space-y-3">
            {list.map((s, i) => {
              const meta = [
                s.clinicName && { icon: Building2, text: s.clinicName, strong: true },
                s.userName && { icon: User, text: s.userName },
              ].filter(Boolean)
              return (
                <motion.div key={s.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="card flex gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500"><Lightbulb size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-700">{s.text}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink-100 pt-2.5 text-xs text-ink-400">
                      {meta.map((m, j) => (
                        <span key={j} className={cx('flex items-center gap-1.5', m.strong && 'font-semibold text-ink-500')}><m.icon size={13} /> {m.text}</span>
                      ))}
                      {s.tier && <Badge color="brand">{t(`tier.${s.tier}`)}</Badge>}
                      {s.userEmail && <a href={`mailto:${s.userEmail}`} className="flex items-center gap-1.5 text-brand-600 hover:underline" dir="ltr"><Mail size={13} /> {s.userEmail}</a>}
                      <span className="ms-auto whitespace-nowrap" dir="ltr">{fmtDateTime(s.date || s.createdAt, lang)}</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
