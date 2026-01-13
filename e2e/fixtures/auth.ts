/**
 * Authentication Fixtures
 *
 * Setup helpers for authenticated test scenarios
 */

import { Page } from '@playwright/test'

export interface TestUser {
  email: string
  passphrase: string
  companyId: string
  companyName: string
}

/**
 * Create a test user account
 */
export async function createTestUser(page: Page): Promise<TestUser> {
  const timestamp = Date.now()
  const user: TestUser = {
    email: `test-${timestamp}@example.com`,
    passphrase: 'Test-Passphrase-123!-Strong-Secure',
    companyId: `company-${timestamp}`,
    companyName: `Test Company ${timestamp}`,
  }

  await page.goto('/auth/signup')

  // Fill in signup form
  await page.fill('[name="email"]', user.email)
  await page.fill('[name="passphrase"]', user.passphrase)
  await page.fill('[name="passphraseConfirm"]', user.passphrase)
  await page.fill('[name="companyName"]', user.companyName)

  // Submit form
  await page.click('button[type="submit"]')

  // Wait for redirect to dashboard or onboarding
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 })

  return user
}

/**
 * Login with existing user credentials
 */
export async function loginUser(page: Page, email: string, passphrase: string): Promise<void> {
  await page.goto('/auth/login')

  await page.fill('[name="email"]', email)
  await page.fill('[name="passphrase"]', passphrase)

  await page.click('button[type="submit"]')

  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 })
}

/**
 * Logout current user
 */
export async function logoutUser(page: Page): Promise<void> {
  // Look for logout button (adjust selector based on your UI)
  await page.click('[aria-label="Logout"], button:has-text("Logout"), [data-testid="logout"]')

  // Wait for redirect to login page
  await page.waitForURL('/auth/login', { timeout: 5000 })
}

/**
 * Setup authenticated session
 */
export async function setupAuthenticatedSession(page: Page): Promise<TestUser> {
  const user = await createTestUser(page)

  // Skip onboarding/assessment if present
  const url = page.url()
  if (url.includes('/onboarding') || url.includes('/assessment')) {
    // Try to skip or complete quickly
    const skipButton = page.locator('button:has-text("Skip"), button:has-text("Later")')
    if (await skipButton.count() > 0) {
      await skipButton.first().click()
    }
  }

  return user
}

/**
 * Clear all user data and start fresh
 */
export async function clearUserData(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Clear IndexedDB
    if (window.indexedDB) {
      indexedDB.databases().then((dbs) => {
        dbs.forEach((db) => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name)
          }
        })
      })
    }

    // Clear localStorage
    localStorage.clear()

    // Clear sessionStorage
    sessionStorage.clear()
  })
}
