import { useRef, useState } from 'react'

// Keep a second click from starting another write before React has rendered
// the disabled button. Callers keep their draft until the write is confirmed.
export function useSaveAction() {
  const active = useRef(false)
  const [saving, setSaving] = useState(false)
  async function runSave(action) {
    if (active.current) return null
    active.current = true
    setSaving(true)
    try {
      return await action()
    } finally {
      active.current = false
      setSaving(false)
    }
  }
  return { saving, runSave }
}
