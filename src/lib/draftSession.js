// UI-independent controller, also exercised by regression tests.
export function createDraftSession(initial, storage, notify = () => {}) {
  let baseline = structuredClone(initial)
  let sequence = 0
  let tail = Promise.resolve()
  const session = { value: structuredClone(initial), pending: null, loading: Boolean(storage), status: '', dirty: false }
  function persist(task) {
    const revision = ++sequence
    session.status = 'saving'; notify()
    tail = tail.catch(() => {}).then(task).then(() => {
      if (sequence === revision) { session.status = 'saved'; notify() }
    }, () => { if (sequence === revision) { session.status = 'error'; notify() } })
    return tail
  }
  session.ready = storage ? storage.read().then((saved) => {
    if (saved && saved.version === 1 && saved.value && typeof saved.value === 'object' && !Array.isArray(saved.value)) {
      session.pending = saved.value
    }
  }).catch(() => { session.status = 'error' }).finally(() => { session.loading = false; notify() }) : Promise.resolve()
  session.set = (update) => {
    if (session.loading || session.pending) return
    session.value = typeof update === 'function' ? update(session.value) : update
    session.dirty = JSON.stringify(session.value) !== JSON.stringify(baseline)
    if (storage) {
      const snapshot = structuredClone(session.value)
      const dirty = session.dirty
      persist(() => dirty ? storage.write({ version: 1, value: snapshot }) : storage.remove())
    }
    notify()
  }
  session.restore = () => {
    if (!session.pending) return
    // Ignore unknown properties in old drafts, retain stable operation IDs.
    session.value = Object.fromEntries(Object.keys(baseline).map((key) => [key,
      Object.hasOwn(session.pending, key) ? session.pending[key] : baseline[key]]))
    session.pending = null; session.dirty = true; session.status = 'saved'; notify()
  }
  session.discard = () => {
    session.pending = null; session.value = structuredClone(baseline); session.dirty = false
    if (storage) persist(() => storage.remove())
    notify()
  }
  session.clear = () => {
    session.pending = null; session.dirty = false; baseline = structuredClone(session.value)
    if (storage) return persist(() => storage.remove())
    return Promise.resolve()
  }
  session.flush = () => tail
  return session
}
