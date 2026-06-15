import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { I18nProvider } from './i18n/I18nContext.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import './index.css'

// HashRouter so routing works identically as a website AND inside the packaged
// desktop app (Electron loads from file://, where path-based routing breaks).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <StoreProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </StoreProvider>
    </I18nProvider>
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
