import { useEffect, useState } from 'react'
import { useStore } from '../context/StoreContext'
import { useI18n } from '../i18n/I18nContext'
import { supabase } from '../lib/supabaseClient'
import { createReleaseNoticeGate, RELEASE_NOTICE_KEY } from '../lib/releaseNotice'
import ReleaseNoticeDialog from './ReleaseNoticeDialog'

const storage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
}
const claim = createReleaseNoticeGate(supabase?.auth, storage)

export default function ReleaseNotice() {
  const { currentUser, demoMode, mode, paymentResult } = useStore()
  const { lang } = useI18n()
  const [visibleFor, setVisibleFor] = useState(null)
  const userId = currentUser?.id
  useEffect(() => {
    if (!userId || demoMode || mode !== 'cloud' || paymentResult) return
    let active = true
    const check = async () => {
      if (!active || document.visibilityState === 'hidden') return
      const run = () => claim(userId, () => active)
      // Serialize tabs on the same origin; the next device reads auth metadata.
      const show = navigator.locks
        ? await navigator.locks.request(`${RELEASE_NOTICE_KEY}:${userId}`, run).catch(() => false)
        : await run()
      if (show && active) setVisibleFor(userId)
    }
    // Defer one turn so StrictMode's initial cleanup cannot consume the notice.
    const timer = setTimeout(check, 0)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    return () => { active = false; clearTimeout(timer); window.removeEventListener('online', check); document.removeEventListener('visibilitychange', check) }
  }, [userId, demoMode, mode, paymentResult])
  return <ReleaseNoticeDialog open={Boolean(userId && visibleFor === userId && !demoMode && !paymentResult)} lang={lang} onClose={()=>setVisibleFor(null)}/>
}
