import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installTelemetry } from './lib/telemetry'
import { applyTheme, loadTheme } from './lib/theme'

applyTheme(loadTheme())
installTelemetry()

// Tauri serves the app itself; a service worker would only cache the wrapper protocol.
const isTauri = '__TAURI_INTERNALS__' in window

if (import.meta.env.PROD && !isTauri && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('Service worker registration failed', error)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
