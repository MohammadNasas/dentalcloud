export const RELEASE_NOTICE_KEY = 'dc_seen_clinic_tools_20261013'

// Auth metadata is account-scoped and shared by web and desktop. No clinic or
// billing records are changed. Offline checks defer the notice until reconnect.
export function createReleaseNoticeGate(auth, storage) {
  const claimed = new Set(), pending = new Map()
  return async function claim(userId, active = () => true) {
    if (!auth || !userId || !active()) return false
    const key = `${RELEASE_NOTICE_KEY}:${userId}`
    if (claimed.has(key)) return false
    try { if (storage?.getItem(key) === '1') return false } catch {}
    if (pending.has(key)) { await pending.get(key); return false }
    const task = (async () => {
      const remember = () => {
        claimed.add(key)
        try { storage?.setItem(key, '1') } catch {}
      }
      const { data, error } = await auth.getUser()
      if (error || data?.user?.id !== userId || !active()) return false
      if (data.user.user_metadata?.[RELEASE_NOTICE_KEY]) { remember(); return false }
      // Supabase merges this one metadata field; do not rewrite profile fields.
      const saved = await auth.updateUser({ data: { [RELEASE_NOTICE_KEY]: true } })
      if (saved.error || saved.data?.user?.id !== userId || !saved.data.user.user_metadata?.[RELEASE_NOTICE_KEY]) return false
      remember()
      return active()
    })().catch(() => false)
    pending.set(key, task)
    try { return await task } finally { pending.delete(key) }
  }
}
