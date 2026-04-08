import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { AppRoutes } from './routes'
import { AuthProvider } from './contexts/AuthContext'
import { CPGSettingsProvider } from './contexts/CPGSettingsContext'
import { SubscriptionProvider } from './contexts/SubscriptionContext'

function App() {
  return (
    <ErrorBoundary level="root">
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
            <CPGSettingsProvider>
              <AppRoutes />
            </CPGSettingsProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
