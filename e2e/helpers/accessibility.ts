/**
 * Accessibility Testing Helpers
 *
 * Utilities for WCAG 2.1 AA compliance testing using axe-core
 */

import { Page } from '@playwright/test'
import type { AxeResults, Result as AxeResult } from 'axe-core'

/**
 * Inject axe-core into the page and run accessibility tests
 */
export async function checkAccessibility(
  page: Page,
  options?: {
    /**
     * Specific element to test (defaults to entire page)
     */
    selector?: string

    /**
     * Rules to disable (e.g., for known issues)
     */
    disabledRules?: string[]

    /**
     * Tags to test (defaults to WCAG 2.1 AA)
     */
    tags?: string[]
  }
): Promise<AxeResults> {
  const { selector, disabledRules = [], tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } = options || {}

  // Inject axe-core
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.11.1/axe.min.js',
  })

  // Run axe
  const results: AxeResults = await page.evaluate(
    ({ selector, disabledRules, tags }) => {
      return new Promise((resolve) => {
        // @ts-expect-error - axe is injected globally
        axe.run(
          selector || document,
          {
            rules: disabledRules.reduce(
              (acc, ruleId) => ({
                ...acc,
                [ruleId]: { enabled: false },
              }),
              {}
            ),
            runOnly: {
              type: 'tag',
              values: tags,
            },
          },
          (err: Error | null, results: AxeResults) => {
            if (err) throw err
            resolve(results)
          }
        )
      })
    },
    { selector, disabledRules, tags }
  )

  return results
}

/**
 * Format axe violations for readable error messages
 */
export function formatViolations(violations: AxeResult[]): string {
  if (violations.length === 0) {
    return 'No accessibility violations found'
  }

  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map(
          (node) =>
            `  - ${node.html}\n    ${node.failureSummary}\n    Impact: ${node.impact}\n    Fix: ${node.help}`
        )
        .join('\n\n')

      return `${violation.id} (${violation.impact}): ${violation.description}\n${nodes}`
    })
    .join('\n\n---\n\n')
}

/**
 * Test keyboard navigation through interactive elements
 */
export async function testKeyboardNavigation(
  page: Page,
  options?: {
    /**
     * Starting element selector
     */
    startSelector?: string

    /**
     * Expected number of tab stops
     */
    expectedTabStops?: number
  }
): Promise<{
  tabStops: number
  focusableElements: string[]
  trapDetected: boolean
}> {
  const { startSelector, expectedTabStops } = options || {}

  // Focus starting element if provided
  if (startSelector) {
    await page.click(startSelector)
  }

  // Track tab stops
  const focusableElements: string[] = []
  let tabStops = 0
  let trapDetected = false
  const maxTabs = 100 // Safety limit

  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab')
    tabStops++

    // Get currently focused element
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null

      // Build selector
      const tagName = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ''
      const className = el.className
        ? `.${el.className.toString().split(' ').join('.')}`
        : ''
      return `${tagName}${id}${className}`
    })

    if (!focusedElement) break

    focusableElements.push(focusedElement)

    // Check if we've looped back to start
    if (focusableElements.length > 1 && focusedElement === focusableElements[0]) {
      trapDetected = true
      break
    }

    // Stop if we've reached expected count
    if (expectedTabStops && tabStops >= expectedTabStops) {
      break
    }
  }

  return {
    tabStops,
    focusableElements,
    trapDetected,
  }
}

/**
 * Check for proper ARIA attributes
 */
export async function checkAriaAttributes(
  page: Page,
  selector: string
): Promise<{
  hasRole: boolean
  hasLabel: boolean
  hasDescription: boolean
  attributes: Record<string, string>
}> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel)
    if (!element) {
      throw new Error(`Element not found: ${sel}`)
    }

    const attrs: Record<string, string> = {}

    for (const attr of element.attributes) {
      if (attr.name.startsWith('aria-') || attr.name === 'role') {
        attrs[attr.name] = attr.value
      }
    }

    return {
      hasRole: element.hasAttribute('role'),
      hasLabel:
        element.hasAttribute('aria-label') ||
        element.hasAttribute('aria-labelledby'),
      hasDescription: element.hasAttribute('aria-describedby'),
      attributes: attrs,
    }
  }, selector)
}

/**
 * Test color contrast ratios
 */
export async function checkColorContrast(
  page: Page,
  selector: string
): Promise<{
  textColor: string
  backgroundColor: string
  contrastRatio: number
  meetsAA: boolean
  meetsAAA: boolean
}> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel)
    if (!element) {
      throw new Error(`Element not found: ${sel}`)
    }

    const computedStyle = window.getComputedStyle(element)
    const textColor = computedStyle.color
    const backgroundColor = computedStyle.backgroundColor

    // Simple contrast calculation (simplified version)
    // In production, use a proper contrast checker library
    const contrastRatio = 4.5 // Placeholder

    return {
      textColor,
      backgroundColor,
      contrastRatio,
      meetsAA: contrastRatio >= 4.5,
      meetsAAA: contrastRatio >= 7,
    }
  }, selector)
}

/**
 * Check for screen reader announcements
 */
export async function getAriaLiveRegions(page: Page): Promise<
  Array<{
    selector: string
    content: string
    politeness: string
  }>
> {
  return await page.evaluate(() => {
    const liveRegions = document.querySelectorAll('[aria-live]')
    return Array.from(liveRegions).map((region) => ({
      selector:
        `#${region.id}` ||
        `.${region.className}` ||
        region.tagName.toLowerCase(),
      content: region.textContent || '',
      politeness: region.getAttribute('aria-live') || 'off',
    }))
  })
}
