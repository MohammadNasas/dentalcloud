import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import App from './App.jsx'
import { I18nProvider } from './i18n/I18nContext.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import { applyReduceMotionOnBoot, useReduceMotion } from './lib/motionPref'
import './index.css'
import { isElectron } from './lib/downloads'
import { legacyWebRoute } from './lib/routing'
import { shouldShowSiteMigration } from './lib/siteMigration'
import SiteMoved from './pages/SiteMoved'

// Apply the saved performance-mode choice before the first paint.
applyReduceMotionOnBoot()

// Wraps the app so "performance mode" can disable Framer Motion animations
// app-wide (CSS animations/transitions are handled by the .reduce-motion class).
function Root() {
  const [reduce] = useReduceMotion()
  return (
    <MotionConfig reducedMotion={reduce ? 'always' : 'never'}>
      <App />
    </MotionConfig>
  )
}

// The website has shareable paths; packaged file:// pages keep hash routing.
const desktopRouting = isElectron || location.protocol === 'file:'
const siteMoved = shouldShowSiteMigration(location, desktopRouting)
const Router = desktopRouting ? HashRouter : BrowserRouter
if (!desktopRouting) {
  const legacy = legacyWebRoute(location)
  if (legacy) window.history.replaceState(window.history.state, '', legacy)
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {siteMoved ? <SiteMoved /> : <I18nProvider>
      <StoreProvider>
        <Router>
          <Root />
        </Router>
      </StoreProvider>
    </I18nProvider>}
  </React.StrictMode>
)

// Register the PWA service worker on the deployed web build only (skip dev so it
// never interferes with HMR, and skip Electron's file:// where it isn't needed).
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Capture the Android/Chrome install prompt as early as possible so the Download
// page can offer a real "Install app" button (the event fires once, on load).
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__pwaInstallPrompt = e
  window.dispatchEvent(new Event('pwa-installable'))
})
