import { useState } from 'react'
import Landing from './Landing'
import Login from './Login'

// Public (logged-out) experience: marketing landing page first, then the
// sign-in / registration form when the visitor chooses to continue.
export default function PublicEntry() {
  const [auth, setAuth] = useState(null) // null = landing; 'signin' | 'register' = form

  if (auth) return <Login initialTab={auth} onBack={() => setAuth(null)} />
  return <Landing onEnter={(tab) => setAuth(tab || 'signin')} />
}
