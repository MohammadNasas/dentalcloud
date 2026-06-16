import { useEffect, useState } from 'react'

// Per-device "reduce motion / performance mode" preference. Stored in
// localStorage (NOT synced) because it's about a specific machine's speed —
// one clinic may have a fast reception PC and a slow doctor's laptop.
const KEY = 'dc_reduce_motion'

export function getReduceMotion() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function setReduceMotion(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* private mode */ }
  document.documentElement.classList.toggle('reduce-motion', on)
  window.dispatchEvent(new Event('dc-reduce-motion'))
}

// Apply the saved choice to <html> before React renders, so there's no flash.
export function applyReduceMotionOnBoot() {
  if (getReduceMotion()) document.documentElement.classList.add('reduce-motion')
}

export function useReduceMotion() {
  const [on, setOn] = useState(getReduceMotion)
  useEffect(() => {
    const h = () => setOn(getReduceMotion())
    window.addEventListener('dc-reduce-motion', h)
    return () => window.removeEventListener('dc-reduce-motion', h)
  }, [])
  return [on, setReduceMotion]
}
