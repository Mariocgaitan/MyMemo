import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// Auto-update service worker: when a new version is available,
// activate it immediately and reload all tabs silently.
registerSW({
  immediate: true,
  onNeedRefresh() {
    // New SW is waiting — tell it to skip waiting, then reload
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
    // Small delay so any in-flight requests finish before reload
    setTimeout(() => window.location.reload(), 1500);
  },
  onOfflineReady() {
    // App is ready to work offline — no action needed
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
