/**
 * Developer Reset Utility
 *
 * Completely wipes all data for a fresh start during development.
 * Use this when you need to test the onboarding flow from scratch.
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

    console.log('✅ All data cleared! Reloading in 1 second...')

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
  (window as any).devReset = resetEverything
}
