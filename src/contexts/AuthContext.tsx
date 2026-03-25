/**
 * Auth Context
 *
 * Provides authentication state and user/company information throughout the app.
 * Reads from sessionStorage where auth data is stored after login.
 */

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'

interface AuthContextValue {
  isAuthenticated: boolean
  userIdentifier: string | null
  companyId: string | null
  currentCompany: { id: string; name: string } | null
  deviceId: string | null
  role: string
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthContextValue>({
    isAuthenticated: false,
    userIdentifier: null,
    companyId: null,
    currentCompany: null,
    deviceId: null,
    role: 'user',
    isLoading: true,
  })

  useEffect(() => {
    // Load auth data from sessionStorage (new authentication system)
    const loadAuthData = () => {
      try {
        const sessionData = sessionStorage.getItem('graceful_books_session')
        if (sessionData) {
          const parsed = JSON.parse(sessionData)

          // Extract user data from session
          const user = parsed.user || {}
          const userId = user.id || null

          setAuthState({
            isAuthenticated: !!parsed.token,
            userIdentifier: user.email || null,
            companyId: userId, // Use user ID as company ID for data isolation
            currentCompany: userId ? {
              id: userId,
              name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email
            } : null,
            deviceId: userId, // Use user ID as device ID for now
            role: 'user',
            isLoading: false,
          })
        } else {
          // No session found
          setAuthState({
            isAuthenticated: false,
            userIdentifier: null,
            companyId: null,
            currentCompany: null,
            deviceId: null,
            role: 'user',
            isLoading: false,
          })
        }
      } catch (error) {
        console.error('Failed to load auth data:', error)
        setAuthState({
          isAuthenticated: false,
          userIdentifier: null,
          companyId: null,
          currentCompany: null,
          deviceId: null,
          role: 'user',
          isLoading: false,
        })
      }
    }

    loadAuthData()

    // Listen for session storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'graceful_books_session') {
        loadAuthData()
      }
    }

    // Also listen for custom login event
    const handleLogin = () => {
      loadAuthData()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('graceful_books_login', handleLogin)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('graceful_books_login', handleLogin)
    }
  }, [])

  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth context
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
