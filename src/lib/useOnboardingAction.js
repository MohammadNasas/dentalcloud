import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Consume a navigation intent once; refresh/back must not reopen a saved form.
export function useOnboardingAction(action, onOpen) {
  const location = useLocation()
  const navigate = useNavigate()
  const consumed = useRef(null)
  useEffect(() => {
    if (location.state?.onboarding !== action || consumed.current === location.key) return
    consumed.current = location.key
    onOpen()
    const { onboarding, ...rest } = location.state
    navigate(location.pathname + location.search + location.hash, { replace: true, state: rest })
  }, [action, location, navigate, onOpen])
}
