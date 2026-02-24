# IC6 Manual Validation Checklist

**Quick Reference for Manual Testing**
**Total:** 30 Manual Checks
**Estimated Time:** 12-17 hours

Copy this checklist and mark each item as you complete testing.

---

## 1. Performance Validation (7 checks) - 2-3 hours

- [ ] **P1.** Page load < 2s (Lighthouse) - Run: `npm run build && npx lhci autorun`
- [ ] **P2.** IC1 conflict modal < 500ms - DevTools Performance tab
- [ ] **P3.** IC2 billing calculation < 1s - Test with 100 clients, 10 users
- [ ] **P4.** IC4 email queuing < 100ms - Measure queueEmail() time
- [ ] **P5.** Dashboard < 3s (cold load) - Clear cache, measure
- [ ] **P6.** No memory leaks (10-min) - Chrome Memory Profiler
- [ ] **P7.** API endpoints < 1s (p95) - Network monitoring

**Notes:**
- Use Chrome DevTools Performance tab for timing
- Document actual times in IC6_VALIDATION_REPORT.md

---

## 2. Security Validation (5 checks) - 1-2 hours

- [ ] **S1.** CSRF protection enabled - Verify tokens in admin forms
- [ ] **S2.** Billing data not logged - Check server logs for sensitive data
- [ ] **S3.** Session timeout (30 min) - Wait 30 min idle, verify logout
- [ ] **S4.** Rate limiting on auth - 10 failed logins, verify block
- [ ] **S5.** Non-admin blocked from charity mgmt - Test as regular user

**Notes:**
- If CSRF/session/rate limiting not implemented, document as blockers
- Use Incognito/Private mode for isolated testing

---

## 3. Accessibility Validation (7 checks) - 3-4 hours

- [ ] **A1.** IC1 modal keyboard navigable - Tab through, Esc closes
- [ ] **A2.** IC1 screen reader announces - Test with NVDA/VoiceOver (AUTOMATED: ✅)
- [ ] **A3.** IC3 admin panel WAVE check - Run WAVE extension, 0 errors
- [ ] **A4.** IC4 email contrast 4.5:1 - WebAIM Contrast Checker
- [ ] **A5.** All forms have visible labels - Not just placeholders
- [ ] **A6.** Focus indicators visible - Tab through, verify outline
- [ ] **A7.** Errors use aria-describedby - Inspect error messages

**Tools:**
- WAVE Extension: [Chrome](https://chrome.google.com/webstore/detail/wave-evaluation-tool/jbbplnpkjmmeebjpijfedlgcdilocofh) | [Firefox](https://addons.mozilla.org/en-US/firefox/addon/wave-accessibility-tool/)
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- NVDA (Windows): https://www.nvaccess.org/download/
- VoiceOver (Mac): Built-in

---

## 4. Integration Validation (6 checks) - 2-3 hours

- [ ] **I1.** E2E: Subscription → Charity → Email - Complete workflow
- [ ] **I2.** E2E: Charity verification - Admin verify → User select
- [ ] **I3.** E2E: @mention → Notification → Email - Comment workflow
- [ ] **I4.** IC1 + I1: Conflict UI + Service (AUTOMATED: ✅)
- [ ] **I5.** IC2 + H1: Team member billing (AUTOMATED: ✅)
- [ ] **I6.** IC4 + IC2: Billing emails from webhooks - Stripe CLI

**Tools:**
- Stripe CLI: `stripe listen --forward-to localhost:5173/api/webhooks/stripe`
- Email test mode: Set `EMAIL_TEST_MODE=true` in .env

---

## 5. Cross-Browser Validation (8 checks) - 4-5 hours

- [ ] **B1.** IC1 components in Chrome - ConflictListModal
- [ ] **B2.** IC1 components in Firefox - ConflictListModal
- [ ] **B3.** IC1 components in Safari - ConflictListModal
- [ ] **B4.** IC1 components in Edge - ConflictListModal
- [ ] **B5.** IC2 Stripe checkout all browsers - Card input, submit
- [ ] **B6.** IC3 admin panel tablet (1024x768) - DevTools Device Toolbar
- [ ] **B7.** IC4 emails Gmail/Outlook/Apple - Send test, verify rendering
- [ ] **B8.** Mobile responsive (375px) - iPhone SE in DevTools

**Browsers:**
- Chrome (latest): https://www.google.com/chrome/
- Firefox (latest): https://www.mozilla.org/firefox/
- Safari (latest): macOS only or use BrowserStack
- Edge (latest): Built-in on Windows

**Alternative:** Use BrowserStack for cross-browser testing if needed

---

## Summary Tracking

**Completed:** ___/30
**Passing:** ___/30
**Failing:** ___/30

**Pass Rate:** ___% (Target: 100%)

---

## Failure Tracking

**If any check fails, document here:**

### Failure 1: [Check ID]
- **What failed:**
- **Expected:**
- **Actual:**
- **Root cause:**
- **Fix:**
- **Priority:**

### Failure 2: [Check ID]
- **What failed:**
- **Expected:**
- **Actual:**
- **Root cause:**
- **Fix:**
- **Priority:**

*(Add more as needed)*

---

## Final Recommendation

**After completing all 30 checks:**

- [ ] **ALL PASSING** → ✅ GREEN LIGHT for Group J
- [ ] **SOME FAILING** → ❌ BLOCK Group J until fixes complete

**Signature:** _________________
**Date:** _________________

---

## Quick Links

- **Full Report:** `IC6_VALIDATION_REPORT.md`
- **Execution Summary:** `IC6_EXECUTION_SUMMARY.md`
- **Automated Results:** `ic6-validation-results.json`
- **Validation Script:** `scripts/ic6-validation.js`

---

**Created:** 2026-01-20
**By:** Claude Code (Sonnet 4.5)
