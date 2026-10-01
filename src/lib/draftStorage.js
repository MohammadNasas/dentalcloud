// Device-only encrypted drafts. Keys are non-extractable CryptoKeys in IndexedDB.
// This protects stored text, not a compromised browser or an unlocked session.
const DB = 'dentalcloud.drafts.v1'
const TTL = 7 * 24 * 60 * 60 * 1000
const queues = new Map()
const epochs = new Map()
let opened
function database() {
  if (!opened) opened = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('keys')
      request.result.createObjectStore('drafts')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { opened = null; reject(request.error) }
  })
  return opened
}
async function transaction(store, mode, action) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const request = action(tx.objectStore(store))
    tx.oncomplete = () => resolve(request?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Draft storage unavailable'))
  })
}
function enqueue(scope, task) {
  const next = (queues.get(scope) || Promise.resolve()).catch(() => {}).then(task)
  queues.set(scope, next)
  return next
}
async function deviceKey(scope) {
  let key = await transaction('keys', 'readonly', (store) => store.get(scope))
  if (!key) {
    const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    // add (not put) prevents another tab's key being overwritten.
    try { await transaction('keys', 'readwrite', (store) => store.add(candidate, scope)) } catch { /* another tab may have won */ }
    key = await transaction('keys', 'readonly', (store) => store.get(scope))
    if (!key) throw new Error('Draft encryption unavailable')
  }
  return key
}
export function draftScope(userId, clinicId) {
  return userId && clinicId ? JSON.stringify([userId, clinicId]) : null
}
export function encryptedDraftStore(scope, formKey) {
  const epoch = epochs.get(scope) || 0
  const id = scope + ':' + formKey
  const active = () => (epochs.get(scope) || 0) === epoch
  return {
    read: () => enqueue(scope, async () => {
      if (!active()) return null
      const record = await transaction('drafts', 'readonly', (store) => store.get(id))
      if (!record) return null
      if (record.expires <= Date.now()) { await transaction('drafts', 'readwrite', (store) => store.delete(id)); return null }
      const key = await deviceKey(scope)
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv, additionalData: new TextEncoder().encode(id) }, key, record.ciphertext)
      return JSON.parse(new TextDecoder().decode(plain))
    }),
    write: (value) => enqueue(scope, async () => {
      if (!active()) return
      const key = await deviceKey(scope)
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) }, key, new TextEncoder().encode(JSON.stringify(value)))
      if (active()) await transaction('drafts', 'readwrite', (store) => store.put({ scope, iv, ciphertext, expires: Date.now() + TTL }, id))
    }),
    remove: () => enqueue(scope, () => transaction('drafts', 'readwrite', (store) => store.delete(id))),
  }
}
export function clearDraftScope(scope) {
  if (!scope) return Promise.resolve()
  epochs.set(scope, (epochs.get(scope) || 0) + 1)
  return enqueue(scope, async () => {
    const db = await database()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['drafts', 'keys'], 'readwrite')
      tx.objectStore('keys').delete(scope)
      const cursor = tx.objectStore('drafts').openCursor()
      cursor.onsuccess = () => {
        const entry = cursor.result
        if (entry) { if (entry.value.scope === scope) entry.delete(); entry.continue() }
      }
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  })
}
