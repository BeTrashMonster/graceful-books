# CPG BOM Bug Report Template

**Use this template to document any bugs found during testing or demo.**

---

## Bug Report #[NUMBER]

**Date Found:** YYYY-MM-DD
**Found By:** [Your Name]
**Severity:** Critical / High / Medium / Low
**Status:** New / In Progress / Fixed / Won't Fix

---

### Summary
[One-sentence description of the bug]

Example: "CPU calculation shows $0.00 when recipe has missing component"

---

### Environment
- **Browser:** Chrome / Firefox / Safari / Edge [Version]
- **OS:** Windows / Mac / Linux
- **Screen Resolution:** 1920x1080 / etc.
- **Database State:** Fresh / With Demo Data / Production Data

---

### Steps to Reproduce

1. [First step]
2. [Second step]
3. [Third step]
4. [etc.]

Example:
1. Navigate to /cpg/products
2. Click "1oz Body Oil"
3. Click "Edit Recipe"
4. Add component: Oil, quantity 1.00
5. Save recipe
6. Navigate to /cpg/cpu-tracker
7. Observe CPU value

---

### Expected Behavior
[What should happen]

Example: "Should show 'Incomplete - Awaiting cost data' with warning icon"

---

### Actual Behavior
[What actually happens]

Example: "Shows '$0.00' with no warning"

---

### Screenshots
[Attach screenshots or describe visual issues]

---

### Console Errors
[Copy/paste any errors from browser console]

```
Example:
Uncaught TypeError: Cannot read property 'cpu' of null
  at calculateFinishedProductCPU (cpuCalculator.service.ts:735)
```

---

### Network Errors
[Copy/paste any failed network requests]

```
Example:
GET /api/categories/cat-123 404 Not Found
```

---

### Database State
[Describe relevant database records]

Example:
```typescript
// Recipe record
{
  id: "recipe-123",
  finished_product_id: "prod-1oz",
  category_id: "cat-oil",
  variant: null,
  quantity: "1.00"
}

// No corresponding invoice found
```

---

### Impact
[How does this affect users?]

Example: "User cannot see accurate product costs, critical for pricing decisions"

---

### Workaround
[Is there a temporary workaround?]

Example: "Manually calculate CPU using spreadsheet until fixed"

---

### Suggested Fix
[If you have an idea how to fix it]

Example: "Check if invoice exists before calculating CPU, show 'Incomplete' instead of $0.00"

---

### Priority Justification
**Why is this Critical / High / Medium / Low?**

Example: "Critical because it prevents core functionality (CPU calculation) from working correctly"

---

### Related Issues
[Link to related bugs or feature requests]

Example: "Related to #123 - Missing data handling"

---

### Additional Context
[Any other relevant information]

---

---

# Quick Bug Report (Shorter Version)

**For rapid documentation during testing:**

**Bug:** [One-line description]
**Severity:** Critical / High / Medium / Low
**Steps:** [1, 2, 3...]
**Expected:** [What should happen]
**Actual:** [What happens]
**Error:** [Console error if any]

---

---

# Common Bug Categories

## Category 1: Calculation Errors
- CPU calculation wrong
- Margin calculation wrong
- Invoice balance calculation wrong
- Variant matching fails

## Category 2: Validation Failures
- Duplicate detection not working
- Required field not enforced
- Balance checking fails
- Negative values allowed

## Category 3: UI/UX Issues
- Modal won't close
- Tooltip cut off
- Alignment issues
- Focus indicators missing
- Color contrast issues

## Category 4: Data Integrity
- Soft delete not working
- Referential integrity violated
- Version vector not incrementing
- Deleted records showing

## Category 5: Performance
- Page load too slow (>2s)
- Save operation too slow (>500ms)
- Search/filter lagging
- Infinite scroll issues

## Category 6: Accessibility
- Keyboard navigation broken
- Screen reader issues
- ARIA labels missing
- Focus trap

## Category 7: Responsive Design
- Mobile layout broken
- Tablet issues
- Horizontal scroll
- Touch targets too small

---

# Bug Tracking

| # | Summary | Severity | Status | Assigned | Due Date |
|---|---------|----------|--------|----------|----------|
| 1 | [Bug description] | Critical | New | [Name] | [Date] |
| 2 | [Bug description] | High | In Progress | [Name] | [Date] |
| 3 | [Bug description] | Medium | Fixed | [Name] | [Date] |

---

# Priority Definitions

**Critical:**
- Prevents core functionality from working
- Data loss or corruption possible
- Security vulnerability
- Demo blocker
- **Fix immediately**

**High:**
- Major feature broken
- Affects many users
- No workaround available
- Poor user experience
- **Fix before demo**

**Medium:**
- Minor feature broken
- Affects some users
- Workaround available
- Annoying but not blocking
- **Fix within sprint**

**Low:**
- Cosmetic issue
- Edge case
- Affects very few users
- Workaround easy
- **Fix when time allows**

---

# Resolution Codes

**Fixed:** Bug resolved and verified
**Won't Fix:** Bug accepted as current behavior
**Duplicate:** Already reported elsewhere
**Cannot Reproduce:** Unable to replicate issue
**By Design:** Not a bug, working as intended
**Deferred:** Will fix in future sprint

---

**End of Template**
