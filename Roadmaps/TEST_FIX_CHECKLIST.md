# Test Fix Checklist - Mandatory Process for All Agents

## Phase 1: Investigation (DO NOT SKIP)

### 1.1 Read the Test File First
- [ ] Read the ENTIRE test file to understand what's being tested
- [ ] Identify the test's purpose and requirements
- [ ] Note any setup in `beforeEach` and teardown in `afterEach`
- [ ] Check for shared state (arrays, objects declared outside beforeEach)

### 1.2 Analyze the Failure
- [ ] Read the exact error message carefully
- [ ] Identify the line number where the failure occurs
- [ ] Determine if it's: validation error, missing field, wrong value, or logic error
- [ ] Check if multiple tests fail with the same root cause

### 1.3 Find the Root Cause
- [ ] Read the implementation code being tested
- [ ] Check database schemas for required fields
- [ ] Look for similar patterns in OTHER test files that passed
- [ ] Verify field names match between test data and schema (camelCase vs snake_case)

## Phase 2: Common Patterns (Check These First)

### 2.1 Missing company_id Field
- [ ] Does the schema index include `company_id`?
- [ ] Are test objects missing `company_id` when adding to database?
- [ ] Are schema factory functions properly including `company_id`?

**Fix Pattern:**
```typescript
// BAD
await db.table.add({
  id: crypto.randomUUID(),
  name: 'Test',
  // Missing company_id
})

// GOOD
await db.table.add({
  id: crypto.randomUUID(),
  company_id: companyId,
  name: 'Test',
})
```

### 2.2 Stale Array Data Between Tests
- [ ] Are arrays declared outside `beforeEach` (e.g., `const categories: Category[] = []`)?
- [ ] Does the test push to these arrays in `beforeEach`?
- [ ] Could stale IDs from previous tests cause failures?

**Fix Pattern:**
```typescript
beforeEach(async () => {
  await deleteDatabase()
  await initializeDatabase()

  // CRITICAL: Clear array from previous test runs
  arrayName.length = 0

  // Now populate fresh data
})
```

### 2.3 Field Name Mismatches
- [ ] Check if API uses camelCase but database uses snake_case
- [ ] Verify conversion functions exist (toEntity, fromEntity)
- [ ] Ensure all fields are mapped correctly

**Common Mismatches:**
- `companyId` ↔ `company_id`
- `createdAt` ↔ `created_at`
- `updatedAt` ↔ `updated_at`
- `deletedAt` ↔ `deleted_at`

### 2.4 Schema Index Queries
- [ ] Check schema definition for indexed fields
- [ ] Can only use `.where()` on indexed fields
- [ ] Use compound indexes correctly: `[field1+field2]`

**Fix Pattern:**
```typescript
// Check schema first:
// Schema: 'id, company_id, [company_id+type], name'

// BAD - 'name' is not indexed
await db.table.where('name').equals('Test')

// GOOD - use indexed field
const item = array.find(i => i.name === 'Test')
await db.table.delete(item.id)
```

## Phase 3: Implementation

### 3.1 Make Minimal Changes
- [ ] Fix ONLY the root cause, nothing extra
- [ ] Don't refactor or "improve" unrelated code
- [ ] Don't change variable names unless required
- [ ] Keep existing code style and patterns

### 3.2 Verify the Fix Locally
- [ ] Run ONLY the test file you're fixing
- [ ] Verify ALL tests in that file pass
- [ ] Check for new failures you may have introduced
- [ ] Read the test output carefully

### 3.3 Check for Pattern Repetition
- [ ] If you fixed missing `company_id`, search for other instances in same file
- [ ] If you cleared an array, check if other tests in the file need it
- [ ] Apply the fix consistently across all similar cases

## Phase 4: Validation

### 4.1 Before Committing
- [ ] Run the test file one more time to confirm
- [ ] Verify you didn't introduce any NEW failures
- [ ] Check that your changes are minimal and targeted
- [ ] Review your changes for unintended modifications

### 4.2 Commit Message Standards
Use this format:
```
fix: [Test file name] ([X] failures → [Y/Y] passing)

Root cause: [One sentence describing the issue]

Changes:
- [Specific change 1]
- [Specific change 2]

Result: [X/Y tests passing] ✅

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Phase 5: Reporting

### 5.1 Report Results
- [ ] State clearly: "Fixed X of Y failures"
- [ ] List any remaining failures with root causes
- [ ] Mention if you found patterns applicable to other files
- [ ] Flag any issues that need discussion

## RED FLAGS - Stop and Report

### When to STOP and ask for guidance:
1. **Cascading Failures**: Your fix creates new failures elsewhere
2. **Unclear Requirements**: Test expectations don't match spec
3. **Schema Conflicts**: Changes would break other tests
4. **Missing Dependencies**: Required files or functions don't exist
5. **Regression Risk**: Fix might break production code

## Examples of Good Fixes

### Example 1: Missing Field
```typescript
// BEFORE (failing)
await db.trainingData.add({
  vendorName: 'Test',
  categoryId: cat.id,
  created_at: Date.now(),
})

// AFTER (passing) - added company_id
await db.trainingData.add({
  company_id: companyId,  // ← Added
  vendorName: 'Test',
  categoryId: cat.id,
  created_at: Date.now(),
})
```

### Example 2: Stale Data
```typescript
// BEFORE (failing)
const categories: Category[] = []

beforeEach(async () => {
  // Categories accumulate from previous tests!
  for (const name of categoryNames) {
    categories.push(category)
  }
})

// AFTER (passing)
const categories: Category[] = []

beforeEach(async () => {
  categories.length = 0  // ← Clear stale data

  for (const name of categoryNames) {
    categories.push(category)
  }
})
```

### Example 3: Schema Factory
```typescript
// BEFORE (failing) - factory doesn't include company_id
export const createTrainingDataPoint = (
  _companyId: string,  // ← Parameter ignored!
  ...
): Partial<TrainingDataPoint> => {
  return {
    vendorName,
    categoryId,
    // Missing company_id in return
  }
}

// AFTER (passing)
export const createTrainingDataPoint = (
  companyId: string,  // ← Use it
  ...
): Partial<TrainingDataPoint> => {
  return {
    company_id: companyId,  // ← Include it
    vendorName,
    categoryId,
  }
}
```

---

## Summary: The 5 Rules

1. **Understand First** - Read test and implementation before changing anything
2. **Root Cause Only** - Fix the actual problem, not symptoms
3. **Check Patterns** - Look for the same issue elsewhere in the file
4. **Verify Completely** - Run tests multiple times to confirm
5. **Commit Clearly** - Document what you fixed and why

**Remember: Passing tests with correct fixes > Quick fixes that introduce regressions**
