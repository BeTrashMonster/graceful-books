import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { AppRoutes } from './routes'
import { AuthProvider } from './contexts/AuthContext'
import { CPGSettingsProvider } from './contexts/CPGSettingsContext'

function App() {
  return (
    <ErrorBoundary level="root">
      <BrowserRouter>
        <AuthProvider>
          <CPGSettingsProvider>
            <AppRoutes />
          </CPGSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
