/**
 * Auth Context
 *
 * Provides authentication state and user/company information throughout the app.
 * Reads from localStorage where auth data is stored after login.
 */

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'

interface AuthContextValue {
  isAuthenticated: boolean
  userIdentifier: string | null
  companyId: string | null
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
    role: 'admin',
    isLoading: true,
  })

  useEffect(() => {
    // Load auth data from localStorage
    const loadAuthData = () => {
      try {
        const userData = localStorage.getItem('graceful_books_user')
        if (userData) {
          const parsed = JSON.parse(userData)
          setAuthState({
            isAuthenticated: true,
            userIdentifier: parsed.userIdentifier || null,
            companyId: parsed.companyId || null,
            role: parsed.role || 'admin',
            isLoading: false,
          })
        } else {
          setAuthState({
            isAuthenticated: false,
            userIdentifier: null,
            companyId: null,
            role: 'admin',
            isLoading: false,
          })
        }
      } catch (error) {
        console.error('Failed to load auth data:', error)
        setAuthState({
          isAuthenticated: false,
          userIdentifier: null,
          companyId: null,
          role: 'admin',
          isLoading: false,
        })
      }
    }

    loadAuthData()

    // Listen for storage changes (e.g., login in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'graceful_books_user') {
        loadAuthData()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
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
