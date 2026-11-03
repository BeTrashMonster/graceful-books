/**
 * Auth Context
 *
 * Provides authentication state and user/company information throughout the app.
 * Reads from sessionStorage where auth data is stored after login.
 *
 * If sessionStorage is empty but a valid auth token exists in localStorage,
 * we hydrate the session by verifying the token with the server.
 */

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import { verifyToken, getAuthToken } from '../services/auth.service'

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
    const loadAuthData = async () => {
      try {
        const sessionData = sessionStorage.getItem('graceful_books_session')
        if (sessionData) {
          const parsed = JSON.parse(sessionData)

          // Handle both session formats:
          // Flat format (current): { userId, userEmail, token, expiresAt }
          // Nested format (legacy): { user: { id, email }, token, products }
          const userId = parsed.userId || parsed.user?.id || null
          const userEmail = parsed.userEmail || parsed.user?.email || null
          const userName = parsed.user?.firstName && parsed.user?.lastName
            ? `${parsed.user.firstName} ${parsed.user.lastName}`
            : userEmail

          setAuthState({
            isAuthenticated: !!parsed.token,
            userIdentifier: userEmail,
            // IMPORTANT: companyId = userId is a temporary architectural shortcut.
            // See HANDOFF.md "Known Architectural Constraints" for implications.
            // If null (dev bypass without session), Dexie queries will fail.
            companyId: userId,
            currentCompany: userId ? {
              id: userId,
              name: userName || userId
            } : null,
            deviceId: userId, // Use user ID as device ID for now
            role: 'user',
            isLoading: false,
          })
        } else {
          // No sessionStorage - check if we have a valid auth token to hydrate from
          const authToken = getAuthToken()
          if (authToken) {
            console.log('[AuthContext] Session empty but auth token found, verifying...')
            try {
              const response = await verifyToken(authToken)
              if (response.valid && response.user) {
                console.log('[AuthContext] Token valid, hydrating session with products:', response.user.products)

                // Rebuild sessionStorage from verified token data
                const hydratedSession = {
                  token: authToken,
                  user: response.user,
                  products: response.user.products || [],
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                }
                sessionStorage.setItem('graceful_books_session', JSON.stringify(hydratedSession))

                // Set auth state from hydrated data
                const userId = response.user.id
                const userEmail = response.user.email
                setAuthState({
                  isAuthenticated: true,
                  userIdentifier: userEmail,
                  companyId: userId,
                  currentCompany: userId ? {
                    id: userId,
                    name: userEmail || userId
                  } : null,
                  deviceId: userId,
                  role: 'user',
                  isLoading: false,
                })
                return
              } else {
                console.log('[AuthContext] Token invalid, clearing...')
                localStorage.removeItem('auth_token')
              }
            } catch (err) {
              console.error('[AuthContext] Token verification failed:', err)
              // Don't clear token on network error - might be offline
            }
          }

          // Fallback: Check localStorage for dev/legacy setup
          const localData = localStorage.getItem('graceful_books_user')
          if (localData) {
            const parsed = JSON.parse(localData)
            setAuthState({
              isAuthenticated: true,
              userIdentifier: parsed.userIdentifier || null,
              companyId: parsed.companyId || null,
              currentCompany: parsed.companyId ? {
                id: parsed.companyId,
                name: parsed.companyName || parsed.companyId
              } : null,
              deviceId: parsed.deviceId || parsed.userIdentifier || null,
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
