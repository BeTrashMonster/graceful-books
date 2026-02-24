# Pull Request

## Description
<!-- Provide a clear and concise description of what this PR does -->

## Related Issue
<!-- Link to the related issue or roadmap item (e.g., "Closes #123" or "Implements D10") -->

## Type of Change
<!-- Mark the relevant option with an 'x' -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes, code improvements)
- [ ] Documentation update
- [ ] Test coverage improvement
- [ ] Performance improvement
- [ ] Infrastructure/build changes

## Roadmap Item
<!-- If this implements a roadmap item, specify which group and item (e.g., "Group D, Item D3") -->

## Implementation Details
<!-- Describe your implementation approach and any key technical decisions -->

## Testing Strategy
<!-- Describe how you tested this change -->
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed
- [ ] Tested offline functionality (if applicable)
- [ ] Tested with encryption enabled (if handling user data)

## Security Review

**⚠️ IMPORTANT: Complete this section for all PRs. See [CODE_REVIEW_SECURITY_CHECKLIST.md](../docs/CODE_REVIEW_SECURITY_CHECKLIST.md) for detailed guidance.**

### Security Areas Modified
<!-- Mark all that apply with [x] - determines required reviewer level -->

**Critical Security Areas (Requires Senior Security Review):**
- [ ] Data access functions (`src/store/*.ts`)
- [ ] Authorization logic (`src/utils/authorization.ts`)
- [ ] Authentication (`src/auth/*.ts`)
- [ ] Encryption/decryption (`src/crypto/*.ts`)
- [ ] API endpoints (sync relay, webhooks)
- [ ] User input handling (forms, validation)
- [ ] RBAC permissions (`src/services/rbac.ts`)
- [ ] Session management
- [ ] Rate limiting

**Important Security Areas (Requires Security-Aware Review):**
- [ ] Database schema changes
- [ ] UI components accepting user input
- [ ] Third-party integrations
- [ ] Export/import functionality
- [ ] Security logging/audit trail
- [ ] Configuration changes
- [ ] CPG tool changes

**Standard Review:**
- [ ] None - no security-sensitive changes

### Security Testing Completed
<!-- Mark all that apply with [x] -->

- [ ] IDOR tests added/passing (for data access changes)
- [ ] Input validation tests added/passing
- [ ] XSS prevention verified (for UI changes)
- [ ] Permission tests added/passing (for RBAC changes)
- [ ] Rate limiting tested
- [ ] Manual security testing completed
- [ ] Security regression tests passing
- [ ] N/A - no security testing needed

### Security Checklist
<!-- Review and mark all applicable items with [x] -->

**Authorization (IDOR Prevention):**
- [ ] All data access functions have `companyId` parameter (required, not optional)
- [ ] `validateCompanyId()` called at start of functions
- [ ] `requireCompanyOwnership()` used for single entity access
- [ ] `requireBatchCompanyOwnership()` used for batch operations
- [ ] Query functions have `companyId` as first required parameter
- [ ] Returns `NOT_FOUND` (not `FORBIDDEN`) for unauthorized access
- [ ] N/A - no data access changes

**Input Validation:**
- [ ] All user input validated with Zod schemas
- [ ] String inputs have length limits (max 100-500 chars)
- [ ] Arrays have size limits (prevent DoS)
- [ ] Numbers validated for type, range, finiteness
- [ ] File uploads validated for type and size
- [ ] N/A - no user input handling

**XSS Prevention:**
- [ ] User content displayed via React JSX (automatic escaping)
- [ ] `dangerouslySetInnerHTML` uses `DOMPurify.sanitize()` if needed
- [ ] URLs sanitized with `sanitizeUrl()` before use in href/src
- [ ] No inline event handlers from user content
- [ ] No eval() or Function() with user input
- [ ] N/A - no UI changes

**RBAC (Role-Based Access Control):**
- [ ] Permission checks using `hasPermission()` from RBAC service
- [ ] Backend functions check both companyId AND permissions
- [ ] UI elements hidden/disabled based on permissions
- [ ] Tests cover unauthorized access scenarios
- [ ] N/A - no permission-gated features

**Cryptography:**
- [ ] Uses `IEncryptionService` (not custom crypto)
- [ ] No sensitive data in console.log or logger
- [ ] No passphrases, passwords, or keys in logs
- [ ] Encryption keys never persisted unencrypted
- [ ] Uses `crypto.getRandomValues()` for random values (not Math.random())
- [ ] N/A - no crypto changes

**Security Logging:**
- [ ] Security events logged (failed auth, authorization failures, etc.)
- [ ] Audit logging added (for financial changes)
- [ ] No sensitive data in logs (amounts, balances, keys)
- [ ] Structured logging with context (userId, operation, etc.)
- [ ] N/A - no security logging needed

**Dependencies & Secrets:**
- [ ] `npm audit` run before adding dependencies
- [ ] No high/critical vulnerabilities introduced
- [ ] No secrets or credentials in code
- [ ] Environment variables validated at startup
- [ ] N/A - no dependency/config changes

**Error Handling:**
- [ ] Error messages don't leak sensitive information
- [ ] Follows Steadiness communication style (patient, supportive)
- [ ] Fails secure (denies access on error, not grants)

### Security Review Required?

<!-- Mark one with [x] -->

- [ ] **YES - Senior Security Reviewer Required** (Critical security areas modified)
- [ ] **YES - Security-Aware Reviewer Required** (Important security areas modified)
- [ ] **NO - Standard Review Sufficient** (No security-sensitive changes)

### Additional Security Notes

<!-- Explain security implications, design decisions, trade-offs, etc. -->

## User Experience
<!-- For user-facing changes -->
- [ ] DISC-adapted messaging implemented (Steadiness approach)
- [ ] Progressive disclosure patterns followed
- [ ] Error messages are helpful and non-blaming
- [ ] Tooltips/help text added for accounting terms
- [ ] WCAG 2.1 AA accessibility verified
- [ ] Joy opportunities/delight details included

## Code Quality Checklist
- [ ] Code follows existing patterns and conventions
- [ ] TypeScript used properly (no `any` types)
- [ ] Error handling implemented
- [ ] Logging added for debugging
- [ ] SOLID principles followed
- [ ] Code comments added for complex logic
- [ ] No console.log statements left in code

## Testing Checklist
- [ ] All new code has test coverage
- [ ] All tests pass locally (`npm test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Test coverage meets requirements (>80%)
- [ ] Edge cases and error scenarios tested

## Documentation
- [ ] README updated (if needed)
- [ ] API/service interfaces documented
- [ ] Type definitions updated
- [ ] Code comments added for complex logic
- [ ] Breaking changes documented

## Performance
- [ ] No performance regressions
- [ ] Page load time acceptable (<2s)
- [ ] Transaction operations fast (<500ms)
- [ ] Report generation within targets

## Database Changes
<!-- If this PR includes database schema changes -->
- [ ] Migration script created (if applicable)
- [ ] Backward compatibility considered
- [ ] Encryption applied to sensitive fields
- [ ] Audit log structure maintained

## Screenshots/Videos
<!-- If this includes UI changes, add screenshots or videos showing the changes -->

## Deployment Notes
<!-- Any special considerations for deployment? -->

## Follow-up Work
<!-- List any known limitations or follow-up tasks needed -->

---

## Agent Review Checklist (if applicable)
<!-- For agent-based implementations, verify AGENT_REVIEW_CHECKLIST.md was followed -->
- [ ] Pre-implementation review completed
- [ ] Architecture review completed
- [ ] Test strategy review completed
- [ ] Code quality standards met
- [ ] Security & privacy review completed
- [ ] User experience standards met
- [ ] All acceptance criteria met
- [ ] Roadmap item marked complete

## Reviewer Notes
<!-- Space for reviewer comments and feedback -->
