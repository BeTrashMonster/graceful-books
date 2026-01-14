# TypeScript Error Fix Completion Guide

## Current Status
- **Fixed:** 140 errors (hooks, pages, categories.test.ts, tags.test.ts, charities.test.ts, AccountForm, syncClient)
- **Remaining:** ~90 errors (primarily in discProfiles.test.ts and metricsCalculation.test.ts)
- **Target:** 0 errors

## Remaining Files

### 1. src/store/discProfiles.test.ts (~63 errors)
All errors follow the same DatabaseResult pattern. Apply these fixes:

**Pattern to fix:**
```typescript
// BEFORE:
expect(result.success).toBe(true);
expect(result.data!.field).toBe(value);

// AFTER:
expect(result.success).toBe(true);
if (result.success) {
  expect(result.data.field).toBe(value);
}
```

**Error pattern:**
```typescript
// BEFORE:
expect(result.success).toBe(false);
expect(result.error!.code).toBe('NOT_FOUND');

// AFTER:
expect(result.success).toBe(false);
if (!result.success) {
  expect(result.error.code).toBe('NOT_FOUND');
}
```

**Data access pattern:**
```typescript
// BEFORE:
const id = createResult.data!.id;

// AFTER:
if (!createResult.success) throw new Error('Creation failed');
const id = createResult.data.id;
```

### 2. src/utils/metricsCalculation.test.ts (~17 errors)
Similar DatabaseResult patterns plus potential AccountType enum issues.

### 3. Apply Fixes

You can manually apply the patterns above, or use this Node.js script:

```javascript
// fix-tests.js
const fs = require('fs');

function fixDatabaseResultPatterns(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  const fixed = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for success assertion followed by .data! access
    if (line.includes('expect(') && line.includes('.success).toBe(true)')) {
      fixed.push(line);

      // Check if next lines have .data! patterns
      let j = i + 1;
      const dataLines = [];
      while (j < lines.length && lines[j].includes('.data!')) {
        dataLines.push(lines[j]);
        j++;
      }

      if (dataLines.length > 0) {
        const indent = line.match(/^\s*/)[0];
        fixed.push(`${indent}if (result.success) {`);
        dataLines.forEach(dl => {
          fixed.push(dl.replace(/\.data!/g, '.data').replace(/^(\s*)/, '$1  '));
        });
        fixed.push(`${indent}}`);
        i = j - 1;
        continue;
      }
    }

    // Check for error! pattern
    if (line.includes('.error!') && i > 0 && lines[i-1].includes('.toBe(false)')) {
      const indent = line.match(/^\s*/)[0];
      fixed.push(`${indent}if (!result.success) {`);
      fixed.push(line.replace(/\.error!/g, '.error'));
      fixed.push(`${indent}}`);
      continue;
    }

    fixed.push(line);
  }

  fs.writeFileSync(filepath, fixed.join('\n'), 'utf8');
  console.log(`Fixed ${filepath}`);
}

// Run fixes
fixDatabaseResultPatterns('src/store/discProfiles.test.ts');
fixDatabaseResultPatterns('src/utils/metricsCalculation.test.ts');
```

Run with: `node fix-tests.js`

## Verification

After applying fixes:

```bash
# Check remaining errors
npm run type-check

# Run tests to ensure nothing broke
npm test -- --run

# Expected results:
# - 0 TypeScript errors
# - All 1147 tests passing
```

## Success Criteria

- ✅ `npm run type-check` outputs: "Found 0 errors"
- ✅ `npm test -- --run` shows: All tests passing
- ✅ No breaking changes to functionality

## Summary of Changes Made

1. **useSync.ts** - Fixed stats state type to use ReturnType<SyncClient['getStats']>
2. **ChartOfAccounts.tsx + AccountForm.tsx** - Changed subType from string to AccountSubType
3. **categories.test.ts** - Added type guards for all 54 DatabaseResult accesses
4. **tags.test.ts** - Added type guards for all 85 DatabaseResult accesses
5. **charities.test.ts** - Fixed targetCharity undefined check
6. **syncClient.ts** - Prefixed unused method with underscore

## Pattern Reference

The fix pattern is consistent across all test files:

1. After checking `result.success === true`, wrap `.data` access in type guard
2. After checking `result.success === false`, wrap `.error` access in type guard
3. Replace `.data!` with `.data` inside type guards
4. Replace `.error!` with `.error` inside type guards
5. For function arguments, add safety check before access: `if (!result.success) throw new Error(...)`

This ensures TypeScript correctly narrows the DatabaseResult type to either SuccessResult or ErrorResult.
