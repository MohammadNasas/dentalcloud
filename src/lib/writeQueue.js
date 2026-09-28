// Serialize writes to each record. Failed drafts stay in memory for an explicit
// retry; never persist patient information in an unencrypted browser outbox.
export function createWriteQueue(onChange = () => {}) {
  const latest = new Map()
  const tails = new Map()
  let generation = 0
  let sequence = 0
  const notify = () => onChange({
    pending: [...latest.values()].filter((x) => x.status === 'pending').length,
    failed: [...latest.values()].filter((x) => x.status === 'failed').length,
  })

  function enqueue(key, write, onSaved = () => {}) {
    const epoch = generation
    const entry = { key, write, onSaved, sequence: ++sequence, status: 'pending' }
    latest.set(key, entry)
    notify()
    const promise = (tails.get(key) || Promise.resolve()).then(async () => {
      if (epoch !== generation) return null
      try {
        const result = await write()
        if (epoch !== generation) return null
        if (latest.get(key) === entry) {
          onSaved(result)
          latest.delete(key)
        }
        return result
      } catch {
        if (epoch === generation && latest.get(key) === entry) entry.status = 'failed'
        return null
      } finally {
        if (epoch === generation) notify()
      }
    })
    tails.set(key, promise)
    promise.then(() => { if (tails.get(key) === promise) tails.delete(key) })
    return promise
  }

  return {
    enqueue,
    retry: () => Promise.all([...latest.values()].filter((x) => x.status === 'failed')
      .map((x) => enqueue(x.key, x.write, x.onSaved))),
    hasUnsaved: () => latest.size > 0,
    reset() { generation += 1; latest.clear(); tails.clear(); notify() },
  }
}
