import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()

  // TODO: Replace with actual authentication check
  // For now, we'll check if user data exists in localStorage
  const isAuthenticated = () => {
    try {
      const userData = localStorage.getItem('graceful_books_user')
      return !!userData
    } catch {
      return false
    }
  }

  if (!isAuthenticated()) {
    // Redirect to login, saving the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
