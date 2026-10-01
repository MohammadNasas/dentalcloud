import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useStore } from '../context/StoreContext'
import { createDraftSession } from './draftSession.js'
import { draftScope, encryptedDraftStore } from './draftStorage.js'

export function useFormDraft(formKey, initial, active = true) {
  const { currentUser, clinic, readOnly, demoMode } = useStore()
  const [, render] = useReducer((n) => n + 1, 0)
  const latest = useRef(initial)
  latest.current = initial
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const scope = draftScope(currentUser?.id, clinic?.id)
  const session = useMemo(() => createDraftSession(
    typeof latest.current === 'function' ? latest.current() : latest.current,
    active && scope && !demoMode ? encryptedDraftStore(scope, formKey) : null,
    () => { if (mounted.current) render() },
  ), [scope, formKey, active, demoMode])
  useEffect(() => {
    // Persisting is async; warn if a tab is closed before the device confirms it.
    const warn = (event) => {
      if (session.dirty && ['saving', 'error'].includes(session.status)) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [session])
  const setField = (field, value) => session.set((previous) => ({
    ...previous, [field]: typeof value === 'function' ? value(previous[field]) : value,
  }))
  return { ...session, setField, blocked: readOnly || session.loading || Boolean(session.pending) }
}
