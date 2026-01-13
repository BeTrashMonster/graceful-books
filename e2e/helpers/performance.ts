/**
 * Performance Testing Helpers
 *
 * Utilities for measuring and asserting performance metrics
 * against Graceful Books requirements:
 * - Page load: <2 seconds
 * - Transaction save: <500ms
 * - Report generation: <5s (standard), <30s (complex)
 */

import { Page } from '@playwright/test'

export interface PerformanceMetrics {
  /**
   * Time to first byte (TTFB)
   */
  ttfb: number

  /**
   * DOM content loaded event
   */
  domContentLoaded: number

  /**
   * Load event (all resources)
   */
  load: number

  /**
   * First contentful paint
   */
  fcp: number

  /**
   * Largest contentful paint
   */
  lcp: number

  /**
   * Time to interactive
   */
  tti: number

  /**
   * Total blocking time
   */
  tbt: number
}

/**
 * Measure page load performance
 */
export async function measurePageLoad(page: Page): Promise<PerformanceMetrics> {
  const perfMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const paint = performance.getEntriesByType('paint')
    const fcp = paint.find((p) => p.name === 'first-contentful-paint')

    return {
      ttfb: navigation.responseStart - navigation.requestStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      load: navigation.loadEventEnd - navigation.fetchStart,
      fcp: fcp?.startTime || 0,
      lcp: 0, // Will be populated by observer
      tti: 0,
      tbt: 0,
    }
  })

  // Get LCP from observer
  const lcp = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      let lcpValue = 0
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as any
        lcpValue = lastEntry.renderTime || lastEntry.loadTime
      })
      observer.observe({ entryTypes: ['largest-contentful-paint'] })

      // Resolve after 2 seconds
      setTimeout(() => {
        observer.disconnect()
        resolve(lcpValue)
      }, 2000)
    })
  })

  return {
    ...perfMetrics,
    lcp,
  }
}

/**
 * Measure operation duration with high precision
 */
export async function measureOperation<T>(
  operation: () => Promise<T>
): Promise<{
  result: T
  duration: number
}> {
  const start = performance.now()
  const result = await operation()
  const end = performance.now()

  return {
    result,
    duration: end - start,
  }
}

/**
 * Measure time for a page action (click, form submission, etc.)
 */
export async function measureAction(
  page: Page,
  action: () => Promise<void>,
  waitForSelector?: string
): Promise<number> {
  await page.evaluate(() => performance.mark('action-start'))

  await action()

  if (waitForSelector) {
    await page.waitForSelector(waitForSelector, { timeout: 30000 })
  }

  const duration = await page.evaluate(() => {
    performance.mark('action-end')
    const measure = performance.measure('action', 'action-start', 'action-end')
    return measure.duration
  })

  return duration
}

/**
 * Measure report generation time
 */
export async function measureReportGeneration(
  page: Page,
  generateAction: () => Promise<void>,
  reportSelector: string
): Promise<number> {
  const start = performance.now()

  await generateAction()

  // Wait for report to be visible
  await page.waitForSelector(reportSelector, { state: 'visible', timeout: 35000 })

  const end = performance.now()
  return end - start
}

/**
 * Measure transaction save time
 */
export async function measureTransactionSave(
  page: Page,
  saveAction: () => Promise<void>,
  successSelector: string
): Promise<number> {
  const start = performance.now()

  await saveAction()

  // Wait for success indicator
  await page.waitForSelector(successSelector, { timeout: 5000 })

  const end = performance.now()
  return end - start
}

/**
 * Assert performance meets requirements
 */
export function assertPerformance(
  actual: number,
  expected: number,
  label: string
): void {
  if (actual > expected) {
    throw new Error(
      `Performance requirement not met: ${label} took ${actual.toFixed(2)}ms but should be under ${expected}ms`
    )
  }
}

/**
 * Get memory usage snapshot
 */
export async function getMemoryUsage(page: Page): Promise<{
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}> {
  return await page.evaluate(() => {
    const memory = (performance as any).memory
    return {
      usedJSHeapSize: memory?.usedJSHeapSize || 0,
      totalJSHeapSize: memory?.totalJSHeapSize || 0,
      jsHeapSizeLimit: memory?.jsHeapSizeLimit || 0,
    }
  })
}

/**
 * Monitor for performance issues during operation
 */
export async function monitorPerformance(
  page: Page,
  duration: number = 5000
): Promise<{
  longTasks: number
  layoutShifts: number
  maxShiftScore: number
}> {
  await page.evaluate((dur) => {
    return new Promise<void>((resolve) => {
      (window as any).__perfMetrics = {
        longTasks: 0,
        layoutShifts: 0,
        maxShiftScore: 0,
      }

      // Monitor long tasks
      const taskObserver = new PerformanceObserver((list) => {
        (window as any).__perfMetrics.longTasks += list.getEntries().length
      })
      taskObserver.observe({ entryTypes: ['longtask'] })

      // Monitor layout shifts
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shiftEntry = entry as any
          if (shiftEntry.hadRecentInput) continue
          ;(window as any).__perfMetrics.layoutShifts++
          ;(window as any).__perfMetrics.maxShiftScore = Math.max(
            (window as any).__perfMetrics.maxShiftScore,
            shiftEntry.value
          )
        }
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })

      setTimeout(() => {
        taskObserver.disconnect()
        clsObserver.disconnect()
        resolve()
      }, dur)
    })
  }, duration)

  return await page.evaluate(() => (window as any).__perfMetrics)
}

/**
 * Format performance metrics for reporting
 */
export function formatMetrics(metrics: PerformanceMetrics): string {
  return `
Performance Metrics:
  TTFB: ${metrics.ttfb.toFixed(2)}ms
  DOM Content Loaded: ${metrics.domContentLoaded.toFixed(2)}ms
  Load: ${metrics.load.toFixed(2)}ms
  FCP: ${metrics.fcp.toFixed(2)}ms
  LCP: ${metrics.lcp.toFixed(2)}ms
  TTI: ${metrics.tti.toFixed(2)}ms
  TBT: ${metrics.tbt.toFixed(2)}ms
  `.trim()
}
