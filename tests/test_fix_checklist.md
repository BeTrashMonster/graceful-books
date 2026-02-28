# Test Fix Checklist
**Systematic Approach to Fixing Test Failures**

When tests fail, **DO NOT** skip them, comment them out, or ignore them. Follow this systematic checklist to diagnose and fix the root cause.

---

## 🚨 When Tests Fail - DO THIS FIRST

### Step 0: Don't Panic
- [ ] Read the error message completely (don't just skim)
- [ ] Take a deep breath (seriously, panicked debugging leads to broken fixes)
- [ ] Accept that test failures are normal and fixable
- [ ] Commit to fixing the root cause (not just making tests pass)

---

## 📊 Phase 1: Gather Information

### Understand the Failure
- [ ] Copy the full error message to a text file
- [ ] Note which test file(s) are failing
- [ ] Note which test case(s) within each file are failing
- [ ] Count total failures (e.g., "12 tests failing in 3 files")

### Categorize the Failure
Check which category applies:

**Type 1: Import/Module Errors**
```
Error: Cannot find module './someFile'
Error: Module not found
Error: Cannot resolve dependency
```
- [ ] This is Type 1 → Go to Phase 2: Import Errors

**Type 2: Type Errors (TypeScript)**
```
Error: Type 'X' is not assignable to type 'Y'
Error: Property 'foo' does not exist on type 'Bar'
Error: Expected 2 arguments, but got 1
```
- [ ] This is Type 2 → Go to Phase 2: Type Errors

**Type 3: Assertion Failures**
```
Error: expect(received).toBe(expected)
Error: Expected element not found
Error: Received: X, Expected: Y
```
- [ ] This is Type 3 → Go to Phase 2: Assertion Failures

**Type 4: Runtime Errors**
```
Error: Cannot read property 'x' of undefined
Error: Cannot call method on null
Error: Network request failed
```
- [ ] This is Type 4 → Go to Phase 2: Runtime Errors

**Type 5: Timeout Errors**
```
Error: Timeout - Async operation did not complete within 5000ms
Error: Test exceeded timeout
```
- [ ] This is Type 5 → Go to Phase 2: Timeout Errors

**Type 6: Setup/Teardown Errors**
```
Error: beforeEach hook failed
Error: afterEach hook failed
Error: Test cleanup failed
```
- [ ] This is Type 6 → Go to Phase 2: Setup/Teardown Errors

---

## 🔍 Phase 2: Diagnose Root Cause

### Type 1: Import/Module Errors

#### Step 1: Verify File Exists
- [ ] Check if the imported file actually exists at the path
- [ ] Check for typos in the import path
- [ ] Check file extension (`.ts` vs `.tsx` vs `.js`)

#### Step 2: Check Import Syntax
- [ ] Named import vs default import matches export
  ```typescript
  // If file exports: export const foo = ...
  import { foo } from './file'; // ✅ Correct

  // If file exports: export default foo
  import foo from './file'; // ✅ Correct
  ```

#### Step 3: Check tsconfig Paths
- [ ] If using path aliases (`@/components`), verify tsconfig.json has mapping
- [ ] Verify vitest.config.ts includes path resolution

#### Step 4: Check Circular Dependencies
- [ ] Use `madge` or similar to detect circular imports
  ```bash
  npx madge --circular src/
  ```

#### Fix Checklist for Import Errors:
- [ ] Correct the import path
- [ ] Fix import syntax (named vs default)
- [ ] Add missing file
- [ ] Resolve circular dependencies
- [ ] Re-run tests

---

### Type 2: Type Errors (TypeScript)

#### Step 1: Read the Type Mismatch
- [ ] Identify what type is received
- [ ] Identify what type is expected
- [ ] Identify where the mismatch occurs (file:line)

#### Step 2: Check Test Mocks
- [ ] If error mentions "jest.fn()" or mock objects, check mock return types
- [ ] Ensure mock return values match interface requirements
  ```typescript
  // ❌ Wrong: Returns string, function expects number
  vi.fn().mockReturnValue('123');

  // ✅ Correct: Returns number
  vi.fn().mockReturnValue(123);
  ```

#### Step 3: Check Test Data
- [ ] Verify test data objects match expected interfaces
- [ ] Check for missing required properties
- [ ] Check for extra properties (strict mode)

#### Step 4: Check Type Assertions
- [ ] Look for `as` type assertions that might be lying
- [ ] Replace `as` with proper type guards when possible

#### Fix Checklist for Type Errors:
- [ ] Update mock return types to match interface
- [ ] Add missing properties to test data
- [ ] Remove incorrect type assertions
- [ ] Update interface if requirements changed
- [ ] Re-run tests

---

### Type 3: Assertion Failures

#### Step 1: Understand What's Being Asserted
- [ ] Read the assertion: `expect(actual).toBe(expected)`
- [ ] Identify what `actual` value is (from error message)
- [ ] Identify what `expected` value is (from test code)

#### Step 2: Check Query Selectors (for UI tests)
Common issues:
```typescript
// ❌ Wrong: Query doesn't match actual element
screen.getByRole('button', { name: /submit/i });
// Actual button: <button>Send</button>

// ✅ Correct: Use text instead
screen.getByText('Send');

// OR update button to match query
<button aria-label="Submit">Send</button>
```

#### Step 3: Check Async Operations
- [ ] If testing async code, ensure you're using `await`
- [ ] Use `waitFor` for elements that appear after async operation
  ```typescript
  // ❌ Wrong: Element not in DOM yet
  expect(screen.getByText('Success')).toBeInTheDocument();

  // ✅ Correct: Wait for element
  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
  ```

#### Step 4: Check Test Isolation
- [ ] Verify tests aren't interfering with each other
- [ ] Ensure proper cleanup in afterEach hooks
- [ ] Check if tests can run in isolation: `npm test -- -t "specific test"`

#### Fix Checklist for Assertion Failures:
- [ ] Update query selectors to match actual DOM
- [ ] Add `await` and `waitFor` for async assertions
- [ ] Fix test isolation issues
- [ ] Update expected values if implementation changed correctly
- [ ] Re-run tests

---

### Type 4: Runtime Errors

#### Step 1: Find the Null/Undefined
- [ ] Error says "Cannot read property 'x' of undefined"
- [ ] Identify which variable is undefined
- [ ] Trace backwards to where it should have been defined

#### Step 2: Check Mocks
- [ ] If error happens in code that calls external service, check mock
- [ ] Ensure mock is defined before test runs
  ```typescript
  // ✅ Correct order: Mock BEFORE importing component
  vi.mock('./service', () => ({
    fetchData: vi.fn().mockResolvedValue({ data: [] })
  }));

  import { MyComponent } from './MyComponent';
  ```

#### Step 3: Check Test Setup
- [ ] Verify beforeEach creates all required objects
- [ ] Check if component expects props that aren't provided
  ```typescript
  // ❌ Wrong: Missing required prop
  render(<MyComponent />);

  // ✅ Correct: Provide required prop
  render(<MyComponent userId="123" />);
  ```

#### Step 4: Check Lifecycle Issues
- [ ] If using React hooks, ensure component is rendered
- [ ] If using store, ensure store is initialized
- [ ] If using database, ensure database is mocked/seeded

#### Fix Checklist for Runtime Errors:
- [ ] Add missing mock implementations
- [ ] Provide required props/parameters
- [ ] Initialize stores/databases properly
- [ ] Add null checks if truly optional
- [ ] Re-run tests

---

### Type 5: Timeout Errors

#### Step 1: Identify What's Timing Out
- [ ] Look at test name to see what operation
- [ ] Check if test involves network requests
- [ ] Check if test involves animations/delays

#### Step 2: Check Async Handling
- [ ] Ensure promises are being resolved
- [ ] Check if mock functions return resolved promises
  ```typescript
  // ❌ Wrong: Returns pending promise (never resolves)
  vi.fn().mockReturnValue(Promise.resolve(data));

  // ✅ Correct: Use mockResolvedValue
  vi.fn().mockResolvedValue(data);
  ```

#### Step 3: Check Infinite Loops
- [ ] Review useEffect dependencies
- [ ] Look for infinite re-render triggers
- [ ] Check for recursive function calls

#### Step 4: Increase Timeout (Last Resort)
- [ ] Only if test legitimately needs more time
  ```typescript
  it('should handle slow operation', async () => {
    // Test code...
  }, 10000); // 10 second timeout
  ```

#### Fix Checklist for Timeout Errors:
- [ ] Fix async mock to resolve properly
- [ ] Fix infinite loops in useEffect
- [ ] Add proper cleanup to prevent hanging operations
- [ ] Increase timeout only if necessary
- [ ] Re-run tests

---

### Type 6: Setup/Teardown Errors

#### Step 1: Check beforeEach/afterEach
- [ ] Read error message for which hook failed
- [ ] Check if beforeEach creates state that afterEach expects
- [ ] Ensure cleanup doesn't fail if setup failed

#### Step 2: Check Test Order Dependencies
- [ ] Tests should NEVER depend on order
- [ ] Each test should be fully isolated
- [ ] Use beforeEach to set up fresh state, not rely on previous test

#### Step 3: Check Global State
- [ ] Clear any global state in afterEach
- [ ] Reset mocks: `vi.clearAllMocks()`
- [ ] Clear local storage: `localStorage.clear()`
- [ ] Clear IndexedDB if used

#### Fix Checklist for Setup/Teardown Errors:
- [ ] Add proper cleanup in afterEach
- [ ] Remove test order dependencies
- [ ] Reset global state between tests
- [ ] Make hooks resilient to failures
- [ ] Re-run tests

---

## 🔧 Phase 3: Apply the Fix

### Implementation
- [ ] Make the smallest possible change to fix the root cause
- [ ] Don't fix by changing expected values unless implementation is correct
- [ ] Don't fix by skipping tests (test.skip)
- [ ] Don't fix by commenting out assertions

### Verification
- [ ] Run the specific failing test: `npm test -- -t "test name"`
- [ ] Verify it now passes
- [ ] Run the full test suite: `npm test`
- [ ] Verify no new tests broke

### Documentation
- [ ] Document what was wrong (in git commit message)
- [ ] Document what you fixed
- [ ] If fix was non-obvious, add code comment explaining why

---

## 🎯 Phase 4: Prevent Future Failures

### Add Better Tests
- [ ] If bug was caught by test, good! Test worked.
- [ ] If bug wasn't caught, add test for that scenario
- [ ] If fix was complex, add tests for edge cases

### Improve Code
- [ ] If fix required adding null checks, consider if type system could prevent this
- [ ] If fix required catching error, consider if error should be prevented earlier
- [ ] If fix required async handling, consider if API could be simpler

### Update Documentation
- [ ] If error was due to misunderstanding, update docs
- [ ] If error was due to missing example, add example
- [ ] If error was due to unclear types, add JSDoc comments

---

## 🚫 Common Mistakes to Avoid

### ❌ DON'T: Skip or Ignore Failing Tests
```typescript
// ❌ NEVER DO THIS
test.skip('should work correctly', () => {
  // Test that fails...
});
```
**Why:** Skipping tests hides bugs. Bugs in production are worse than failing tests.

### ❌ DON'T: Change Expected Values to Match Wrong Implementation
```typescript
// ❌ WRONG: Test expected 100, implementation returns 50, so change test
expect(calculateTotal()).toBe(50); // Changed from 100 to make test pass

// ✅ CORRECT: Fix the implementation to return 100
```
**Why:** Tests document correct behavior. Changing tests means accepting wrong behavior.

### ❌ DON'T: Comment Out Assertions
```typescript
// ❌ WRONG: Assertion fails, so comment it out
// expect(result.status).toBe('success');
expect(result.data).toEqual(expectedData);
```
**Why:** Commented assertions don't protect you from regressions.

### ❌ DON'T: Use `try/catch` to Swallow Errors in Tests
```typescript
// ❌ WRONG: Hiding the real error
try {
  expect(someFunction()).toBe(expected);
} catch (e) {
  // Ignore error
}
```
**Why:** You need to see the error to fix it.

### ❌ DON'T: Increase Timeout Without Understanding Why
```typescript
// ❌ WRONG: Test times out at 5s, so increase to 60s
it('should load data', async () => {
  // Test code...
}, 60000); // This is hiding a problem!
```
**Why:** If test needs 60 seconds, there's a real performance issue or infinite loop.

---

## ✅ Test Fix Success Criteria

**A test fix is complete when ALL of these are true:**
1. ✅ Failing tests now pass
2. ✅ No new tests broke
3. ✅ Root cause was fixed (not just symptoms)
4. ✅ Fix was minimal (didn't rewrite everything)
5. ✅ Fix is documented (commit message explains)
6. ✅ No tests skipped or commented out
7. ✅ Full test suite passes: `npm test`
8. ✅ Build still works: `npm run build`

**If ANY of these are false, the fix is incomplete.**

---

## 📝 Test Fix Template for Reporting

When reporting test fixes in summary documents, use this format:

```markdown
## Test Failures & Fixes

### Initial Status
- **Total Tests:** XXX
- **Passing:** XX
- **Failing:** XX
- **Pass Rate:** XX%

### Failures Diagnosed

#### Failure 1: [Category]
- **File:** path/to/test.test.ts
- **Test:** "should do something"
- **Error:** Brief error message
- **Root Cause:** Why it failed
- **Fix:** What was changed
- **Result:** ✅ Now passing

#### Failure 2: [Category]
[Same format]

### Final Status
- **Total Tests:** XXX
- **Passing:** XXX
- **Failing:** 0
- **Pass Rate:** 100%

### Prevention Measures
- Added tests for edge cases
- Improved type safety in X component
- Updated documentation for Y service
```

---

## 🎓 Learning from Test Failures

Every test failure is an opportunity to improve. Ask yourself:

1. **Could this have been prevented?**
   - Better types? More specific interfaces?
   - Better abstractions? Clearer function signatures?
   - Better documentation? More examples?

2. **Is the test testing the right thing?**
   - Is it testing implementation details (bad)?
   - Is it testing user behavior (good)?
   - Is it testing a requirement from ROADMAP.md (best)?

3. **Is the code easy to test?**
   - If test is complicated, is code too complex?
   - If test needs lots of mocks, are there too many dependencies?
   - If test is brittle, is implementation too coupled?

4. **What did I learn?**
   - Document the lesson for future reference
   - Share the lesson with other agents (in docs)
   - Prevent similar failures by improving patterns

---

## 🔄 Iterative Debugging Process

If you're stuck on a test failure after following this checklist:

### Round 1: Read the Error (10 minutes)
- [ ] Read error message carefully
- [ ] Identify the category
- [ ] Follow the phase 2 steps for that category
- [ ] Apply fix
- [ ] Re-run tests

### Round 2: Isolate the Problem (20 minutes)
- [ ] Run only the failing test
- [ ] Add console.log to understand what's happening
- [ ] Check what actual values are vs expected
- [ ] Review recent changes (git diff)
- [ ] Apply fix
- [ ] Re-run tests

### Round 3: Ask for Help (30 minutes)
- [ ] Document what you've tried
- [ ] Document what you've learned
- [ ] Document what you're confused about
- [ ] Ask user or another agent for guidance

**Don't spend more than 1 hour stuck on a single test failure.** Ask for help!

---

## 📚 Resources for Test Debugging

### Tools
- **Vitest UI:** `npm run test:ui` (visual test runner)
- **Vitest Watch:** `npm test -- --watch` (re-run on changes)
- **Chrome DevTools:** For debugging React components
- **React DevTools:** For inspecting component state

### Documentation
- **Vitest:** https://vitest.dev/guide/
- **React Testing Library:** https://testing-library.com/docs/react-testing-library/intro/
- **Testing Library Queries:** https://testing-library.com/docs/queries/about

### Common Query Priorities (Testing Library)
1. `getByRole` (most accessible)
2. `getByLabelText` (forms)
3. `getByPlaceholderText` (forms)
4. `getByText` (content)
5. `getByTestId` (last resort)

---

**Remember:** Tests exist to catch bugs BEFORE production. A failing test is doing its job. Your job is to fix the bug, not silence the test.

**Last Updated:** 2026-01-19
