// Delay the actual delete: undo cancels a timer, never recreates a stale record.
export function createUndoDelete(onChange, { now = Date.now, schedule = setTimeout, cancel = clearTimeout } = {}) {
  const entries = new Map()
  const publish = () => onChange([...entries.values()].map(({ timer, commit, failed, ...item }) => item))
  return {
    add({ key, kind, commit, failed }) {
      if (entries.has(key)) return false
      const entry = { key, kind, commit, failed, deadline: now() + 10000, status: 'pending' }
      entries.set(key, entry)
      entry.timer = schedule(async () => {
        if (entries.get(key) !== entry) return
        entry.status = 'committing'; publish()
        try {
          if (!await commit()) throw new Error('Delete not confirmed')
        } catch {
          if (entries.get(key) === entry) failed?.()
        } finally {
          if (entries.get(key) === entry) { entries.delete(key); publish() }
        }
      }, 10000)
      publish()
      return true
    },
    undo(key) {
      const entry = entries.get(key)
      if (!entry || entry.status !== 'pending') return false
      cancel(entry.timer); entries.delete(key); publish()
      return true
    },
    hasPending: () => entries.size > 0,
    has: (key) => entries.has(key),
    reset() {
      for (const entry of entries.values()) cancel(entry.timer)
      entries.clear(); publish()
    },
  }
}
