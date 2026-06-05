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
