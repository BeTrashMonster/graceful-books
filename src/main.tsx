import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Import dev utilities for browser console access
import './utils/devReset'
import './utils/clearCPGData'
import './utils/cpg/cleanupDistributorsConsole'

// Handle chunk load failures (from deployments while user is active)
// This catches "Failed to fetch dynamically imported module" errors
window.addEventListener('error', (event) => {
  if (event.message?.includes('Failed to fetch dynamically imported module')) {
    console.warn('⚠️ Detected stale code after deployment. Reloading page...');
    // Clear cache and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  }
});

// Also handle unhandled promise rejections from dynamic imports
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('Failed to fetch dynamically imported module')) {
    console.warn('⚠️ Detected stale code after deployment. Reloading page...');
    event.preventDefault(); // Prevent error from showing in console
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  }
});

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Failed to find the root element')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
