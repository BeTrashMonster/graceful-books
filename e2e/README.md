# Graceful Books E2E Tests - Group D Guided Setup Workflows

## Overview

This directory contains comprehensive end-to-end tests for Group D features using Playwright. These tests cover the complete guided setup workflows for first-time users.

## Test Coverage

### D1: Chart of Accounts Setup Wizard (`d1-coa-wizard.spec.ts`)
- ✅ Complete wizard workflow (welcome → template → customize → review → completion)
- ✅ Progress indicators and step tracking
- ✅ Save and resume functionality
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ Page load performance (<2s)
- ✅ Back navigation between steps
- ✅ Plain English explanations for account types
- ✅ Form validation with helpful error messages
- ✅ Joy moment: Confetti celebration on completion

### D2: First Reconciliation Experience (`d2-reconciliation.spec.ts`)
- ✅ Guided reconciliation workflow with education
- ✅ Statement upload (CSV/PDF) support
- ✅ "What is reconciliation?" explainer in plain English
- ✅ Auto-matching transactions
- ✅ Discrepancy handling with helpful explanations
- ✅ Reconciliation history and streak tracking
- ✅ Unreconciled transaction highlighting
- ✅ Save and resume progress
- ✅ Performance: Form submission <2s
- ✅ Joy moment: Celebration on completion with encouraging message

### D3: Email Summary Configuration (`d3-email-summary.spec.ts`)
- ✅ Day/time selection for weekly emails
- ✅ Content preferences configuration
- ✅ Email preview functionality
- ✅ DISC-adapted email content (Steadiness style)
- ✅ Unsubscribe mechanism
- ✅ Form validation with helpful messages
- ✅ Settings persistence across sessions
- ✅ Encouraging subject lines (no urgent/critical language)

### D4: Tutorial System (`d4-tutorial-system.spec.ts`)
- ✅ Contextual tutorial triggering on first visit
- ✅ Element highlighting during tutorials
- ✅ Progress tracking (step X of Y)
- ✅ Skip and resume functionality
- ✅ "Don't show again" option
- ✅ Tutorial completion badges
- ✅ Friendly, conversational language (not boring manual style)
- ✅ Dismissible with Escape key
- ✅ Focus trapping for accessibility
- ✅ Context-specific tutorials per feature

### D5: Vendor Management (`d5-vendor-management.spec.ts`)
- ✅ Create new vendors
- ✅ Edit existing vendors
- ✅ Delete vendors with confirmation (reassuring about data preservation)
- ✅ Search and filter functionality
- ✅ Duplicate detection with helpful warnings
- ✅ Vendor count milestone celebrations (1, 10, 25, 50, 100)
- ✅ Performance: Save <500ms
- ✅ Link to vendor expenses
- ✅ Keyboard navigation
- ✅ Empty state with encouraging message
- ✅ Data persistence

### D6 & D7: Reports (`d6-d7-reports.spec.ts`)

#### D6: Profit & Loss Report
- ✅ Date range selection
- ✅ Report generation <5s (standard)
- ✅ Plain English explanations toggle
- ✅ Encouraging messages for profitability (green glow, positive language)
- ✅ Period comparison (current vs previous)
- ✅ Export to PDF
- ✅ Main sections: Revenue, Expenses, Profit
- ✅ Accessible table structure

#### D7: Balance Sheet Report
- ✅ As-of date selection
- ✅ Report generation <5s
- ✅ Plain English explanation ("snapshot of what you own, owe, left over")
- ✅ Three main sections: Assets, Liabilities, Equity
- ✅ Balance equation validation
- ✅ Export to PDF
- ✅ Encouraging empty state for no data

#### Performance Tests
- ✅ Large dataset handling (<30s for 100+ transactions)
- ✅ Navigation between reports
- ✅ Memory usage monitoring

### Integration Tests (`group-d-integration.spec.ts`)
- ✅ Complete first-time user journey (signup → COA → vendor → transactions → reports)
- ✅ Tutorial consistency throughout journey
- ✅ Accessibility maintained across all pages
- ✅ Consistent Steadiness communication style
- ✅ Milestone celebrations at appropriate moments
- ✅ Graceful error handling throughout
- ✅ Data consistency across features
- ✅ Total onboarding time <2 minutes

## Test Helpers

### Accessibility (`helpers/accessibility.ts`)
- `checkAccessibility()` - Run axe-core WCAG 2.1 AA tests
- `testKeyboardNavigation()` - Test Tab key navigation and focus management
- `checkAriaAttributes()` - Verify proper ARIA labels
- `checkColorContrast()` - Validate color contrast ratios
- `getAriaLiveRegions()` - Check screen reader announcements

### Performance (`helpers/performance.ts`)
- `measurePageLoad()` - Measure TTFB, FCP, LCP, TTI
- `measureAction()` - Time specific user actions
- `measureReportGeneration()` - Time report generation
- `measureTransactionSave()` - Time transaction save operations
- `assertPerformance()` - Assert against requirements
- `monitorPerformance()` - Track long tasks and layout shifts

### Test Fixtures

#### Authentication (`fixtures/auth.ts`)
- `createTestUser()` - Create new test account
- `loginUser()` - Login existing user
- `setupAuthenticatedSession()` - Full setup with auth
- `clearUserData()` - Reset IndexedDB and storage

#### Data (`fixtures/data.ts`)
- `createAccount()` - Create test account via UI
- `createTransaction()` - Create test transaction
- `createVendor()` - Create test vendor
- `uploadBankStatement()` - Upload reconciliation statement
- `quickSetupCOA()` - Fast COA setup for testing
- `generateSampleTransactions()` - Create multiple transactions

## Performance Requirements

All tests validate against Graceful Books performance requirements:

- **Page load:** <2 seconds
- **Transaction save:** <500ms
- **Report generation:** <5s (standard), <30s (complex)
- **Sync completion:** <5s (not tested in E2E)
- **Encryption/decryption:** Imperceptible (handled by integration tests)

## Accessibility Requirements

All tests validate WCAG 2.1 AA compliance:

- ✅ Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- ✅ Screen reader support (ARIA labels, roles, live regions)
- ✅ Color contrast ratios (4.5:1 minimum)
- ✅ Focus indicators
- ✅ Form labels
- ✅ Error announcements

## Joy Moments Tested

Celebrations and delight features validated:

- ✅ Confetti on COA wizard completion
- ✅ "First vendor!" celebration
- ✅ "You reconciled!" completion message with emphasis
- ✅ Vendor count milestones (10, 50, 100)
- ✅ Profitability encouragement with green glow
- ✅ Tutorial completion badges
- ✅ Encouraging progress messages

## Running Tests

### Run all tests
```bash
npm run e2e
```

### Run specific test file
```bash
npx playwright test e2e/d1-coa-wizard.spec.ts
```

### Run with UI mode
```bash
npm run e2e:ui
```

### Run specific browser
```bash
npx playwright test --project=chromium
```

### Debug mode
```bash
npx playwright test --debug
```

### View report
```bash
npx playwright show-report
```

## Test Results

Tests generate:
- HTML report: `playwright-report/index.html`
- JSON results: `playwright-results.json`
- Screenshots on failure
- Video recordings on failure
- Trace files on retry

## Test Structure

Each test file follows this pattern:

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await clearUserData(page)
    await setupAuthenticatedSession(page)
  })

  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/feature')

    // Act
    await page.click('button')

    // Assert
    await expect(page.locator('element')).toBeVisible()

    // Performance
    assertPerformance(duration, limit, 'operation')

    // Accessibility
    const results = await checkAccessibility(page)
    expect(results.violations).toHaveLength(0)
  })
})
```

## Continuous Integration

Tests run on:
- ✅ Chromium (Desktop Chrome)
- ✅ Firefox (Desktop Firefox)
- ✅ Webkit (Desktop Safari)
- ✅ Mobile Chrome (Pixel 5)
- ✅ Mobile Safari (iPhone 12)

## Debugging Failed Tests

1. Check screenshots in `test-results/`
2. Watch video recordings of failures
3. Review trace files: `npx playwright show-trace trace.zip`
4. Run in debug mode: `npx playwright test --debug`
5. Check console logs in test output

## Known Issues / Limitations

- Some tests may need actual implementation to exist before passing
- Tutorial tests depend on driver.js or similar library being configured
- Email preview requires email service integration
- Bank statement upload requires file upload handling

## Future Enhancements

- [ ] Add visual regression tests
- [ ] Add mobile-specific gesture tests
- [ ] Add offline mode tests
- [ ] Add sync conflict resolution tests
- [ ] Add multi-user collaboration tests
- [ ] Add performance regression monitoring
- [ ] Add load testing for concurrent users

## Contributing

When adding new E2E tests:

1. Follow the existing test structure
2. Use fixtures for setup
3. Test accessibility with every workflow
4. Verify performance requirements
5. Check for joy moments and celebrations
6. Use helpful, non-blaming error messages
7. Document new test helpers
8. Update this README

## Support

For issues with E2E tests:
- Check test output for detailed error messages
- Review Playwright documentation: https://playwright.dev
- Check axe-core docs for accessibility: https://github.com/dequelabs/axe-core
- See AGENT_REVIEW_CHECKLIST.md for implementation requirements
