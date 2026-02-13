/**
 * Developer Reset Utility
 *
 * Provides options to reset data during development:
 * - resetChartOfAccounts(): Clears only chart of accounts, keeps everything else
 * - resetCompanyData(): Keeps login, clears all business data
 * - resetEverything(): Full wipe including login credentials
 */

import { db } from '../store/database';

/**
 * Reset ONLY the Chart of Accounts
 * Clears all accounts AND wizard state so you can go through setup again
 * Preserves everything else (transactions, contacts, etc.)
 */
export async function resetChartOfAccounts(): Promise<void> {
  try {
    console.log('🗑️ Resetting Chart of Accounts...');

    // Count existing accounts
    const accountCount = await db.accounts.count();
    console.log(`Found ${accountCount} accounts`);

    // Clear all accounts
    await db.accounts.clear();

    // Clear wizard state from localStorage
    const wizardKeys = Object.keys(localStorage).filter(key =>
      key.startsWith('graceful-books-wizard-')
    );

    wizardKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`Cleared wizard state: ${key}`);
    });

    // Verify
    const remaining = await db.accounts.count();
    console.log(`✅ Cleared ${accountCount} accounts. Remaining: ${remaining}`);
    console.log(`✅ Cleared ${wizardKeys.length} wizard state(s)`);
    console.log('✅ All other data remains intact');
    console.log('💡 Reloading page to start Chart of Accounts wizard...');

    // Reload to trigger wizard
    setTimeout(() => {
      window.location.reload();
    }, 1000);

  } catch (error) {
    console.error('❌ Error resetting Chart of Accounts:', error);
    throw error;
  }
}

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
  (window as any).devResetCOA = resetChartOfAccounts;
  (window as any).devResetCompany = resetCompanyData;
  (window as any).devResetAll = resetEverything;
}
