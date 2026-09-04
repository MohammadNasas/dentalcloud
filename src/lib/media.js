// ──────────────────────────────────────────────────────────────────────────
//  Patient media storage.
//
//  Cloud accounts store images only in the private Supabase `patient-images`
//  bucket. IndexedDB is retained solely for explicit local/demo mode and for a
//  one-time migration of legacy device-only images.
// ──────────────────────────────────────────────────────────────────────────

import { isCloud, supabase } from './supabaseClient'

const DB_NAME = 'dentacare.media'
const STORE = 'images'
const BUCKET = 'patient-images'
let _dbPromise = null

function open() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

export async function putImage(id, dataUrl) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(dataUrl, id)
    tx.oncomplete = () => resolve(id)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getImage(id) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteImage(id) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Remove device copies only when the patient metadata confirms that a cloud
// object exists. Legacy photos without storagePath are preserved for migration.
export async function purgeCloudBackedImageCache(patients = []) {
  if (!isCloud) return
  const ids = patients.flatMap((patient) =>
    (patient.photos || []).filter((photo) => photo.storagePath).map((photo) => photo.id)
  )
  await Promise.allSettled(ids.map((id) => deleteImage(id)))
}

function safeSegment(value, label) {
  const segment = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
  if (!segment) throw new Error(`Missing ${label} for patient image`)
  return segment
}

// The first folder is deliberately the clinic id: Supabase Storage policies
// use it to ensure an authenticated user can only access their own clinic.
export function patientImagePath({ clinicId, patientId, imageId }) {
  return `${safeSegment(clinicId, 'clinic id')}/${safeSegment(patientId, 'patient id')}/${safeSegment(imageId, 'image id')}.jpg`
}

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = String(dataUrl).split(',', 2)
  if (!header || !encoded) throw new Error('Invalid image data')
  const mime = header.match(/^data:([^;]+);base64$/i)?.[1] || 'image/jpeg'
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Could not read downloaded image'))
    reader.readAsDataURL(blob)
  })
}

async function withTimeout(promise, ms, message) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function cacheImage(id, dataUrl) {
  try {
    await withTimeout(putImage(id, dataUrl), 8000, 'Local image cache timed out')
  } catch (error) {
    // A full/disabled IndexedDB cache must not prevent cloud images from
    // uploading or displaying during the current session.
    if (!isCloud) throw error
    console.warn('Could not cache patient image locally:', error)
  }
}

async function readCachedImage(id) {
  try {
    return await withTimeout(getImage(id), 8000, 'Local image cache timed out')
  } catch (error) {
    if (!isCloud) throw error
    console.warn('Could not read patient image cache:', error)
    return null
  }
}

async function uploadCloudImage(storagePath, dataUrl) {
  const blob = dataUrlToBlob(dataUrl)
  const { error } = await withTimeout(
    supabase.storage.from(BUCKET).upload(storagePath, blob, {
      cacheControl: '3600',
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    }),
    30000,
    'Cloud image upload timed out'
  )
  if (error) {
    const wrapped = new Error(error.message || 'Cloud image upload failed')
    wrapped.code = error.statusCode || error.status || error.name
    wrapped.cause = error
    throw wrapped
  }
}

/**
 * Save a newly selected patient image in the account's cloud storage. Local
 * mode retains the old IndexedDB behaviour for development/demo use only.
 * Returns the private storage path to keep in the patient's photo metadata.
 */
export async function savePatientImage(id, dataUrl, { clinicId, patientId }) {
  if (!isCloud) {
    await cacheImage(id, dataUrl)
    return null
  }

  const storagePath = patientImagePath({ clinicId, patientId, imageId: id })
  await uploadCloudImage(storagePath, dataUrl)
  return storagePath
}

/**
 * Load a photo from the private cloud bucket without persisting another copy
 * on the device. Legacy device-only photos are uploaded once, then their old
 * IndexedDB copy is removed.
 */
export async function loadPatientImage(photo, { clinicId, patientId }) {
  if (!isCloud) return { dataUrl: await readCachedImage(photo.id), storagePath: null, error: null }

  const storagePath = photo.storagePath || patientImagePath({ clinicId, patientId, imageId: photo.id })
  if (!photo.storagePath) {
    const legacyCopy = await readCachedImage(photo.id)
    if (legacyCopy) {
      try {
        await uploadCloudImage(storagePath, legacyCopy)
        await deleteImage(photo.id)
        return { dataUrl: legacyCopy, storagePath, error: null }
      } catch (error) {
        // Do not delete the only copy until its cloud upload succeeds.
        return { dataUrl: legacyCopy, storagePath: null, error }
      }
    }
  }

  const { data, error } = await withTimeout(
    supabase.storage.from(BUCKET).download(storagePath),
    30000,
    'Cloud image download timed out'
  )
  if (error || !data) return { dataUrl: null, storagePath: photo.storagePath || null, error: error || new Error('Image not found') }

  const dataUrl = await blobToDataUrl(data)
  return { dataUrl, storagePath, error: null }
}

/** Remove both the local cache and the shared cloud object. */
export async function deletePatientImage(photo, { clinicId, patientId }) {
  try {
    await deleteImage(photo.id)
  } catch (error) {
    if (!isCloud) throw error
    console.warn('Could not remove patient image cache:', error)
  }

  if (!isCloud) return
  const storagePath = photo.storagePath || patientImagePath({ clinicId, patientId, imageId: photo.id })
  const { error } = await withTimeout(
    supabase.storage.from(BUCKET).remove([storagePath]),
    30000,
    'Cloud image deletion timed out'
  )
  if (error) throw error
}

// Resize an uploaded image to keep storage reasonable, returns a JPEG data URL.
export function fileToResizedDataURL(file, maxDim = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
