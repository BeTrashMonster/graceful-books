# Agent Code Review Checklist

Use this checklist after completing any coding task to ensure code quality, security, and consistency with the codebase standards.

---

## Pre-Commit Review Process

Before considering your task complete, run through each section below. Check off items as you verify them.

---

## 1. Security Review

### Zero-Knowledge Architecture
- [ ] **No sensitive data in logs** - Verify you haven't added `console.log` statements that output passwords, passphrases, keys, or financial data
- [ ] **Encryption used for sensitive fields** - Any user financial data (transactions, balances, memos) must be encrypted before storage
- [ ] **Keys never persisted in plaintext** - Encryption keys should only exist in memory, never localStorage/IndexedDB without encryption
- [ ] **No hardcoded secrets** - No API keys, passphrases, or test credentials in code

### Authentication & Sessions
- [ ] **Use existing auth module** - New auth features must use `src/auth/` functions, not custom implementations
- [ ] **Session validation** - Protected operations check for valid session before executing
- [ ] **Rate limiting preserved** - Any new endpoints or login attempts should be rate-limited

### Input Validation
- [ ] **User input sanitized** - All user input validated before use
- [ ] **SQL/NoSQL injection prevented** - Using parameterized queries or ORM methods (Dexie handles this)
- [ ] **XSS prevention** - React's JSX escaping used, no `dangerouslySetInnerHTML` without sanitization

---

## 2. Code Consistency

### Existing Patterns
- [ ] **Use shared utilities** - Check if functionality already exists before writing new code:
  - Device ID: Use `getDeviceId()` from `src/utils/device.ts`
  - Entity IDs: Use `generateId()` from `src/utils/device.ts`
  - Version vectors: Use functions from `src/utils/versionVector.ts`
  - Base64 encoding: Use functions from `src/utils/encoding.ts`
  - Money handling: Use `toCents()`, `fromCents()` from `src/utils/money.ts`
  - Logging: Use `logger` from `src/utils/logger.ts`
  - Errors: Use `ErrorCode`, `AppError` from `src/utils/errors.ts`
  - Encryption: Use `IEncryptionService` from `src/crypto/service.ts`
  - Audit logging: Use functions from `src/services/audit.ts`

- [ ] **Follow existing structure** - New files placed in appropriate directories:
  - Components: `src/components/{category}/`
  - Pages: `src/pages/`
  - Data access: `src/store/`
  - Types: `src/types/`
  - Crypto: `src/crypto/`
  - Auth: `src/auth/`

### Naming Conventions
- [ ] **Files**: PascalCase for components (`Button.tsx`), camelCase for utilities (`encryption.ts`)
- [ ] **Components**: PascalCase (`Button`, `MainLayout`)
- [ ] **Functions**: camelCase (`createAccount`, `validateBalance`)
- [ ] **Types/Interfaces**: PascalCase (`AccountEntity`, `DatabaseResult`)
- [ ] **Constants**: UPPER_SNAKE_CASE (`AUTH_TAG_LENGTH`, `PASSPHRASE_TEST_VALUE`)

### Export Patterns
- [ ] **Components**: Named exports (`export const Button = ...`)
- [ ] **Pages**: Default exports (`export default function Dashboard()`)
- [ ] **Utilities**: Named exports (`export function encrypt()`)
- [ ] **Types**: Named exports (`export interface Account {}`)
- [ ] **Index files**: Barrel exports (`export { Button } from './Button'`)

---

## 3. Type Safety

### TypeScript Best Practices
- [ ] **No `any` types** - Use specific types or `unknown` with type guards
- [ ] **Proper generics** - Use generics for reusable functions (`DatabaseResult<T>`)
- [ ] **Nullable handling** - Use optional chaining (`?.`) and nullish coalescing (`??`)
- [ ] **Type imports** - Use `import type` for type-only imports

### Error Handling
- [ ] **Specific error codes** - Use descriptive error codes, not just `'UNKNOWN_ERROR'`
  - `'VALIDATION_ERROR'` - Input validation failed
  - `'NOT_FOUND'` - Entity doesn't exist
  - `'CONSTRAINT_VIOLATION'` - Business rule violated
  - `'ENCRYPTION_ERROR'` - Crypto operation failed
  - `'DECRYPTION_FAILED'` - Decryption failed (wrong key?)
  - `'RATE_LIMITED'` - Too many requests

- [ ] **Error messages user-friendly** - Follow Steadiness communication style:
  - Bad: `"Invalid input"`
  - Good: `"We couldn't process that. Please check your entry and try again."`

---

## 4. CRDT & Sync Compatibility

### Entity Structure
- [ ] **CRDT fields present** - New entities include:
  ```typescript
  versionVector: VersionVector
  lastModifiedBy: string
  lastModifiedAt: Date
  deletedAt: Date | null  // Soft delete tombstone
  ```

- [ ] **ID generation** - Using `nanoid()` for entity IDs
- [ ] **Timestamps updated** - `updatedAt` set on every modification
- [ ] **Version vector incremented** - Using `incrementVersionVector()` on changes

### Soft Deletes
- [ ] **Never hard delete** - Use `deletedAt` timestamp instead of removing records
- [ ] **Query filters exclude deleted** - Add `.and((e) => !e.deletedAt)` to queries
- [ ] **Provide restore capability** - Soft-deleted items can be restored

---

## 5. Accessibility (WCAG 2.1 AA)

### Component Requirements
- [ ] **Keyboard navigation** - All interactive elements focusable and operable via keyboard
- [ ] **Focus indicators** - Visible focus states with 3:1+ contrast ratio
- [ ] **ARIA labels** - Screen reader support for non-text content
- [ ] **Color contrast** - 4.5:1 for text, 3:1 for interactive elements
- [ ] **Touch targets** - Minimum 44x44px for touch interactions

### Use Component Library
- [ ] **Forms**: Use `<Input>`, `<Select>`, `<Checkbox>` from `src/components/forms/`
- [ ] **Buttons**: Use `<Button>` from `src/components/core/`
- [ ] **Modals**: Use `<Modal>`, `<Drawer>` from `src/components/modals/`
- [ ] **Feedback**: Use `<Loading>`, `<ErrorMessage>` from `src/components/feedback/`

### Motion & Preferences
- [ ] **Reduced motion supported** - Animations respect `prefers-reduced-motion`
- [ ] **No auto-playing content** - Video/audio requires user action

---

## 6. Communication Style (Steadiness)

All user-facing messages must be:

### Tone Check
- [ ] **Patient** - Not rushed or demanding
- [ ] **Step-by-step** - Clear sequence of actions
- [ ] **Supportive** - Reassuring, not blaming
- [ ] **Stable** - Emphasizes security and reliability

### Message Templates

**Error Messages:**
```typescript
// Bad
error: 'Invalid email format'

// Good
error: "That email doesn't look quite right. It should be something like name@example.com"
```

**Success Messages:**
```typescript
// Bad
message: 'Saved'

// Good
message: "All saved! Your changes are safe and sound."
```

**Loading States:**
```typescript
// Bad
message: 'Loading...'

// Good
message: "Getting everything ready for you..."
```

**Empty States:**
```typescript
// Bad
message: 'No results'

// Good
message: "Nothing here yet. When you add your first transaction, it'll show up right here."
```

---

## 7. Performance

### Database Operations
- [ ] **Indexed queries** - Using indexed fields for queries (see schema definitions)
- [ ] **Pagination** - Large result sets paginated (max 50-100 items)
- [ ] **Batch operations** - Multiple writes use `batchInsert`/`batchUpdate`

### React Optimization
- [ ] **Memoization** - Expensive computations wrapped in `useMemo`
- [ ] **Callback stability** - Event handlers wrapped in `useCallback` when passed to children
- [ ] **Lazy loading** - Large components/pages use `lazy()` and `Suspense`

### Bundle Size
- [ ] **No large libraries** - Avoid importing entire libraries when you need one function
- [ ] **Tree-shakeable imports** - Use named imports, not default from large packages

---

## 8. Accounting Compliance

### Double-Entry Requirements
- [ ] **Balanced transactions** - Debits equal credits (use `validateBalance()`)
- [ ] **Minimum two lines** - Every transaction has at least 2 line items
- [ ] **Valid accounts** - All account IDs exist and are active

### Immutability
- [ ] **Posted transactions immutable** - Cannot edit transactions with `status: 'posted'`
- [ ] **Void instead of delete** - Use void capability for posted transactions
- [ ] **Audit trail** - All changes logged to audit log

### Money Handling
- [ ] **Integer cents preferred** - Store money as integers (cents) to avoid floating point
- [ ] **Consistent precision** - Use `.toFixed(2)` for display, integer math for calculations
- [ ] **Currency explicit** - Always store/display currency code with amounts

---

## 9. Testing

### Required Tests
- [ ] **Unit tests for utilities** - Pure functions tested with edge cases
- [ ] **Component tests** - Interactive components tested with React Testing Library
- [ ] **Accessibility tests** - Consider using `jest-axe` for automated checks

### Test File Location
- Tests alongside source: `ComponentName.test.tsx`
- Test utilities in `src/test/`

### Running Tests
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

---

## 10. Documentation

### Code Documentation
- [ ] **JSDoc for public APIs** - Functions exported from modules have JSDoc comments
- [ ] **Complex logic explained** - Non-obvious code has inline comments
- [ ] **TODO comments** - Incomplete work marked with `// TODO:` and explanation

### File Headers
- [ ] **Module purpose** - Top of file explains what the module does
- [ ] **Requirements reference** - Links to spec requirements (e.g., "Per ARCH-001")

---

## Quick Reference: Common Issues

| Issue | Fix |
|-------|-----|
| Adding `console.log` | Use `logger` from `src/utils/logger.ts` |
| Using `any` type | Define proper type or use `unknown` |
| Hardcoding strings | Move to constants file |
| Inline styles in pages | Use component library or CSS modules |
| Missing error handling | Use `ErrorCode` from `src/utils/errors.ts` |
| Floating point money | Use `toCents()`/`fromCents()` from `src/utils/money.ts` |
| Not soft deleting | Set `deletedAt` instead of removing |
| Generic error messages | Use `getUserFriendlyMessage()` from `src/utils/errors.ts` |
| Custom device ID | Use `getDeviceId()` from `src/utils/device.ts` |
| Custom base64 | Use functions from `src/utils/encoding.ts` |
| Missing audit log | Use `logCreate()`/`logUpdate()` from `src/services/audit.ts` |

---

## Final Checklist

Before marking task complete:

- [ ] Code compiles without TypeScript errors (`npm run build`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Reviewed all changed files against this checklist
- [ ] No new `console.log` statements (except in error boundaries)
- [ ] Follows existing code patterns and structure
- [ ] User-facing text uses Steadiness communication style
