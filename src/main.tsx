import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Import dev utilities for browser console access
import './utils/devReset'
import './utils/clearCPGData'
import './utils/cpg/cleanupDistributorsConsole'

// Initialize global error handlers BEFORE React renders
// This catches unhandled errors, promise rejections, and stale module errors
import { initGlobalErrorHandlers } from './services/globalErrorHandler'
initGlobalErrorHandlers();

// Request durable storage to prevent IndexedDB eviction under storage pressure
// Called once; result cached in localStorage for DataSafetyPanel to display
import { initStoragePersistence } from './services/storagePersistence'
initStoragePersistence();

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Failed to find the root element')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
