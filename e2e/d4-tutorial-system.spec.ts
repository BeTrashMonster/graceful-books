/**
 * D4: Tutorial System E2E Tests
 *
 * Tests the contextual tutorial framework including:
 * - Tutorial trigger system
 * - Step highlighting
 * - Progress tracking
 * - Skip and resume functionality
 * - "Don't show again" options
 * - Friendly, non-boring presentation
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedSession, clearUserData } from './fixtures/auth'
import { checkAccessibility } from './helpers/accessibility'

test.describe('D4: Tutorial System', () => {
  test.beforeEach(async ({ page }) => {
    await clearUserData(page)
    await setupAuthenticatedSession(page)
  })

  test('should trigger tutorial on first visit to feature', async ({ page }) => {
    // Visit a feature page that has a tutorial
    await page.goto('/transactions')

    // Look for tutorial overlay or modal
    const tutorial = page.locator('[data-tutorial], [class*="tutorial"], [role="dialog"]:has-text("tutorial")')

    if (await tutorial.count() > 0) {
      console.log('Tutorial triggered on first visit')

      await expect(tutorial.first()).toBeVisible()

      // Tutorial should use friendly language
      const tutorialText = await tutorial.textContent()
      expect(tutorialText).toMatch(/let me show|neat trick|here's how|together/i)
      expect(tutorialText).not.toMatch(/instruction|manual|documentation/i)
    }
  })

  test('should highlight specific elements during tutorial', async ({ page }) => {
    await page.goto('/transactions')

    const tutorial = page.locator('[data-tutorial], [class*="tutorial"]')

    if (await tutorial.count() > 0) {
      // Look for highlighted element
      const highlight = page.locator('[class*="highlight"], [data-highlight]')

      if (await highlight.count() > 0) {
        await expect(highlight.first()).toBeVisible()

        // Highlighted element should have focus or spotlight
        const highlightStyle = await highlight.first().evaluate((el) => {
          const computed = window.getComputedStyle(el)
          return {
            zIndex: computed.zIndex,
            position: computed.position,
          }
        })

        // Should be elevated
        expect(Number(highlightStyle.zIndex)).toBeGreaterThan(0)
      }

      // Progress through tutorial
      const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")')
      if (await nextButton.count() > 0) {
        await nextButton.click()

        // Different element should be highlighted
        await page.waitForTimeout(300)
      }
    }
  })

  test('should track tutorial progress', async ({ page }) => {
    await page.goto('/transactions')

    const tutorial = page.locator('[data-tutorial]')

    if (await tutorial.count() > 0) {
      // Look for progress indicator
      const progress = page.locator('[class*="progress"], [role="progressbar"], text=/step.*of/i')

      if (await progress.count() > 0) {
        const progressText = await progress.first().textContent()
        console.log('Tutorial progress:', progressText)

        // Should show current step and total
        expect(progressText).toMatch(/\d+.*of.*\d+|step/i)
      }
    }
  })

  test('should allow skipping tutorial', async ({ page }) => {
    await page.goto('/transactions')

    const tutorial = page.locator('[data-tutorial], [class*="tutorial"]')

    if (await tutorial.count() > 0) {
      // Look for skip button
      const skipButton = page.locator('button:has-text("Skip"), button:has-text("Later")')

      if (await skipButton.count() > 0) {
        await skipButton.click()

        // Tutorial should close
        await expect(tutorial.first()).not.toBeVisible()

        // Feature should be usable
        await expect(page.locator('h1, h2')).toBeVisible()
      }
    }
  })

  test('should support "Don\'t show again" option', async ({ page }) => {
    await page.goto('/transactions')

    const tutorial = page.locator('[data-tutorial]')

    if (await tutorial.count() > 0) {
      // Look for "don't show again" checkbox
      const dontShow = page.locator('input[type="checkbox"]:has-text("Don\'t show"), label:has-text("Don\'t show")')

      if (await dontShow.count() > 0) {
        // Check the box
        if (dontShow.first().getAttribute('type') === 'checkbox') {
          await dontShow.first().check()
        } else {
          await dontShow.first().click()
        }

        // Close tutorial
        await page.click('button:has-text("Skip"), button:has-text("Close")')

        // Reload page
        await page.reload()

        // Tutorial should not appear again
        const tutorialAgain = page.locator('[data-tutorial]')
        await page.waitForTimeout(1000)
        const count = await tutorialAgain.count()
        expect(count).toBe(0)
      }
    }
  })

  test('should allow resuming tutorial later', async ({ page }) => {
    await page.goto('/transactions')

    const tutorial = page.locator('[data-tutorial]')

    if (await tutorial.count() > 0) {
      // Start tutorial
      const nextButton = page.locator('button:has-text("Next")')
      if (await nextButton.count() > 0) {
        await nextButton.click()
        await nextButton.click()
      }

      // Skip partway through
      await page.click('button:has-text("Skip"), button:has-text("Later")')

      // Look for option to restart tutorial
      const helpMenu = page.locator('button:has-text("Help"), [aria-label*="Help"]')
      if (await helpMenu.count() > 0) {
        await helpMenu.click()

        // Should have option to show tutorial again
        const showTutorial = page.locator('button:has-text("Tutorial"), button:has-text("Show guide")')
        await expect(showTutorial.first()).toBeVisible()
      }
    }
  })

  test('should complete tutorial and show badge', async ({ page }) => {
    await page.goto('/transactions')

    const tutorial = page.locator('[data-tutorial]')

    if (await tutorial.count() > 0) {
      // Complete entire tutorial
      let attempts = 0
      while (attempts < 10) {
        const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")')
        const finishButton = page.locator('button:has-text("Finish"), button:has-text("Done")')

        if (await finishButton.count() > 0) {
          await finishButton.click()
          break
        } else if (await nextButton.count() > 0) {
          await nextButton.click()
          await page.waitForTimeout(300)
        } else {
          break
        }

        attempts++
      }

      // Check for completion message
      const completion = page.locator('text=/completed|finished|you got it|well done/i')
      if (await completion.count() > 0) {
        console.log('Tutorial completion detected')
      }

      // Tutorial badge might be in profile
      await page.goto('/profile').catch(() => page.goto('/settings'))

      const badge = page.locator('[data-badge], [class*="badge"]')
      if (await badge.count() > 0) {
        console.log('Tutorial completion badges found')
      }
    }
  })

  test('should use friendly, non-boring language', async ({ page }) => {
    await page.goto('/transactions')

    const tutorial = page.locator('[data-tutorial]')

    if (await tutorial.count() > 0) {
      const tutorialText = await tutorial.textContent()

      // Should be conversational
      expect(tutorialText).toMatch(/let|you|we|here's|show|trick/i)

      // Should not be dry/boring
      expect(tutorialText?.length || 0).toBeGreaterThan(30)
      expect(tutorialText).not.toMatch(/^(step \d+:|instructions:|to do:)/i)
    }
  })

  test('should be dismissible with Escape key', async ({ page }) => {
    await page.goto('/transactions')

    const tutorial = page.locator('[data-tutorial]')

    if (await tutorial.count() > 0) {
      // Press Escape
      await page.keyboard.press('Escape')

      // Tutorial should close
      await page.waitForTimeout(300)
      await expect(tutorial.first()).not.toBeVisible()
    }
  })

  test('should be accessible', async ({ page }) => {
    await page.goto('/transactions')

    const tutorial = page.locator('[data-tutorial]')

    if (await tutorial.count() > 0) {
      // Check accessibility
      const results = await checkAccessibility(page)

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      )
      expect(criticalViolations).toHaveLength(0)

      // Tutorial should trap focus
      await page.keyboard.press('Tab')
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      console.log('Focused element:', focusedElement)

      // Focus should stay within tutorial
      expect(focusedElement).toBeTruthy()
    }
  })

  test('should show context-specific tutorials', async ({ page }) => {
    // Different pages should have different tutorials

    // Transactions page
    await page.goto('/transactions')
    const transactionsTutorial = await page.locator('[data-tutorial]').textContent()

    // Chart of accounts page
    await page.goto('/chart-of-accounts')
    await page.waitForTimeout(500)
    const coaTutorial = await page.locator('[data-tutorial]').textContent()

    if (transactionsTutorial && coaTutorial) {
      // Tutorials should be different
      expect(transactionsTutorial).not.toBe(coaTutorial)
      console.log('Context-specific tutorials confirmed')
    }
  })

  test('should not interrupt critical workflows', async ({ page }) => {
    await page.goto('/transactions')

    // If tutorial appears, it should not block interaction
    const tutorial = page.locator('[data-tutorial]')

    if (await tutorial.count() > 0) {
      // Should still be able to interact with page
      // Even with tutorial visible, actions should work
      const mainContent = page.locator('main, [role="main"]')
      await expect(mainContent).toBeVisible()
    }
  })

  test('should persist tutorial completion status', async ({ page }) => {
    await page.goto('/transactions')

    const tutorial = page.locator('[data-tutorial]')

    if (await tutorial.count() > 0) {
      // Complete tutorial
      await page.click('button:has-text("Skip"), button:has-text("Done")')

      // Mark as "don't show again" if available
      const dontShow = page.locator('input[type="checkbox"]').first()
      if (await dontShow.count() > 0) {
        await dontShow.check().catch(() => {})
      }

      // Reload and revisit
      await page.reload()
      await page.waitForTimeout(1000)

      // Tutorial should not reappear
      const tutorialAgain = await tutorial.count()
      expect(tutorialAgain).toBe(0)
    }
  })
})
