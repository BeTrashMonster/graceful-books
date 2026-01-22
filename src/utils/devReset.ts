/**
 * Developer Reset Utility
 *
 * Provides options to reset data during development:
 * - resetCompanyData(): Keeps login, clears all business data
 * - resetEverything(): Full wipe including login credentials
 */

/**
 * Reset only company data (Chart of Accounts, transactions, etc.)
 * Preserves login credentials so you don't have to sign up again.
 */
export async function resetCompanyData(): Promise<void> {
  try {
    // Save login credentials
    const userLogin = localStorage.getItem('graceful_books_user')

    // 1. Clear all localStorage except login
    localStorage.clear()
    if (userLogin) {
      localStorage.setItem('graceful_books_user', userLogin)
    }

    // 2. Clear sessionStorage
    sessionStorage.clear()

    // 3. Close and delete all IndexedDB databases
    const databases = await indexedDB.databases()

    for (const db of databases) {
      if (db.name) {
        console.log(`Deleting database: ${db.name}`)
        indexedDB.deleteDatabase(db.name)
      }
    }

    // Also try the known database name directly
    indexedDB.deleteDatabase('graceful_books')

    // 4. Clear service worker caches if any
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
    }

    console.log('✅ Company data cleared! Login preserved. Reloading in 1 second...')

    // 5. Wait a moment for deletions to complete, then reload
    setTimeout(() => {
      window.location.href = '/dashboard'
    }, 1000)

  } catch (error) {
    console.error('Error during reset:', error)
    // Force reload anyway
    setTimeout(() => {
      window.location.href = '/dashboard'
    }, 1000)
  }
}

/**
 * Reset EVERYTHING including login credentials.
 * Use this to test the complete signup/onboarding flow.
 */
export async function resetEverything(): Promise<void> {
  try {
    // 1. Clear localStorage
    localStorage.clear()

    // 2. Clear sessionStorage
    sessionStorage.clear()

    // 3. Close and delete all IndexedDB databases
    const databases = await indexedDB.databases()

    for (const db of databases) {
      if (db.name) {
        console.log(`Deleting database: ${db.name}`)
        indexedDB.deleteDatabase(db.name)
      }
    }

    // Also try the known database name directly
    indexedDB.deleteDatabase('graceful_books')

    // 4. Clear service worker caches if any
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
    }

    console.log('✅ All data cleared including login! Reloading in 1 second...')

    // 5. Wait a moment for deletions to complete, then reload
    setTimeout(() => {
      window.location.href = '/'
    }, 1000)

  } catch (error) {
    console.error('Error during reset:', error)
    // Force reload anyway
    setTimeout(() => {
      window.location.href = '/'
    }, 1000)
  }
}

// Add to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).devResetCompany = resetCompanyData
  (window as any).devResetAll = resetEverything
}
