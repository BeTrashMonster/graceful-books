import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { AppRoutes } from './routes'

function App() {
  return (
    <ErrorBoundary level="root">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
