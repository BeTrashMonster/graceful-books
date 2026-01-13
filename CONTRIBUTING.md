# Contributing to Graceful Books

Welcome to the Graceful Books development community! We're building something special together - a platform that empowers entrepreneurs through judgment-free financial management. Take your time getting familiar with our workflow. We're here to support you every step of the way.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Code Review Guidelines](#code-review-guidelines)
- [Definition of Done](#definition-of-done)
- [Testing Requirements](#testing-requirements)
- [CI/CD Pipeline](#cicd-pipeline)
- [Troubleshooting](#troubleshooting)
- [Questions & Support](#questions--support)

---

## Getting Started

### Prerequisites

Before you begin, make sure you have these tools installed:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git** (latest version recommended)

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/graceful-books.git
   cd graceful-books
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Verify your setup:**
   ```bash
   # Run type checking
   npm run type-check

   # Run linting
   npm run lint

   # Run tests
   npm test
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

### Understanding the Project Structure

Take a moment to familiarize yourself with our codebase:

```
graceful-books/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── ui/         # Core component library
│   │   └── layout/     # Layout components
│   ├── pages/          # Route-level page components
│   ├── services/       # Business logic and services
│   ├── lib/            # Utilities and libraries
│   │   ├── db/        # Database (Dexie/IndexedDB)
│   │   └── crypto/    # Encryption utilities
│   ├── hooks/          # Custom React hooks
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Helper functions
├── tests/              # Test files
├── docs/               # Documentation
└── SPEC.md             # Complete product specification
```

**Key Documentation:**
- `SPEC.md` - Complete product requirements
- `ROADMAP.md` - Implementation roadmap with dependencies
- `CLAUDE.md` - Architecture and technical guidance
- `DEFINITION_OF_DONE.md` - Quality standards checklist
- `AGENT_REVIEW_CHECKLIST.md` - Pre/post implementation checklist

---

## Development Workflow

We follow a feature-branch workflow that supports both individual and parallel development. Here's how it works:

### 1. Pick Your Task

Review the `ROADMAP.md` to find tasks in the current group. Tasks within the same group (e.g., Group A, Group B) can be developed in parallel.

**Before starting:**
- Review the `AGENT_REVIEW_CHECKLIST.md` - Section 1: Pre-Implementation Review
- Understand all acceptance criteria for your task
- Identify and verify all dependencies are complete
- Check for external library requirements

### 2. Create Your Branch

Create a new branch from `master` with a descriptive name:

```bash
git checkout master
git pull origin master
git checkout -b feature/chart-of-accounts-crud
```

See [Branch Naming Conventions](#branch-naming-conventions) below for naming guidelines.

### 3. Develop Your Feature

- Write code following our [coding standards](#code-quality-standards)
- Add tests as you develop (not just at the end)
- Commit frequently with meaningful messages
- Keep your branch up to date with master

```bash
# Update your branch with latest master
git checkout master
git pull origin master
git checkout your-branch-name
git merge master
```

### 4. Test Thoroughly

Before considering your work complete:

```bash
# Run all checks
npm run type-check          # TypeScript compilation
npm run lint                # Code style and quality
npm test                    # Unit and integration tests
npm run test:coverage       # Verify coverage >80%
npm run e2e                 # End-to-end tests (if applicable)
```

All checks must pass before creating a pull request.

### 5. Create Pull Request

Once your feature is complete and tested:

```bash
# Push your branch
git push -u origin your-branch-name
```

Then create a pull request on GitHub. See [Pull Request Process](#pull-request-process) for details.

---

## Branch Naming Conventions

Use clear, descriptive branch names that indicate the type and scope of work:

### Format

```
<type>/<short-description>
```

### Types

- **`feature/`** - New features or functionality
  - Example: `feature/bank-reconciliation`
  - Example: `feature/invoice-templates`

- **`bugfix/`** - Bug fixes
  - Example: `bugfix/transaction-validation`
  - Example: `bugfix/dashboard-loading`

- **`hotfix/`** - Critical fixes for production
  - Example: `hotfix/encryption-key-rotation`
  - Example: `hotfix/security-vulnerability`

- **`refactor/`** - Code refactoring without changing functionality
  - Example: `refactor/database-queries`
  - Example: `refactor/component-structure`

- **`docs/`** - Documentation updates
  - Example: `docs/api-reference`
  - Example: `docs/contributing-guide`

- **`test/`** - Adding or updating tests
  - Example: `test/auth-service-coverage`
  - Example: `test/e2e-reconciliation`

- **`chore/`** - Maintenance tasks (dependencies, configs, etc.)
  - Example: `chore/update-dependencies`
  - Example: `chore/eslint-config`

### Short Description Guidelines

- Use lowercase with hyphens (kebab-case)
- Be specific but concise (2-4 words ideal)
- Reference roadmap item if applicable
- Avoid special characters or spaces

**Good Examples:**
```
feature/encryption-layer
feature/a1-database-schema
bugfix/transaction-balance-check
refactor/crypto-utilities
docs/d12-contributing-guide
```

**Poor Examples:**
```
feature/stuff               # Too vague
fix-bug                    # Missing type prefix
feature/THIS_NEW_THING     # Wrong case
feature/add all the things # Contains spaces
```

---

## Commit Message Format

We follow the **Conventional Commits** specification for clear, scannable commit history.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **`feat`** - A new feature
- **`fix`** - A bug fix
- **`docs`** - Documentation changes only
- **`style`** - Code style changes (formatting, semicolons, etc.)
- **`refactor`** - Code changes that neither fix bugs nor add features
- **`perf`** - Performance improvements
- **`test`** - Adding or updating tests
- **`chore`** - Build process, auxiliary tools, dependencies

### Scope (Optional)

The scope indicates what part of the codebase is affected:

- `auth` - Authentication/authorization
- `db` - Database layer
- `crypto` - Encryption/security
- `ui` - UI components
- `reports` - Reporting features
- `reconciliation` - Bank reconciliation
- `invoices` - Invoicing features
- `transactions` - Transaction management

### Subject Line

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Limit to 50 characters
- Be specific about what changed

### Body (Optional but Encouraged)

- Explain *why* not *what* (the diff shows what)
- Wrap at 72 characters
- Separate from subject with blank line
- Include context and reasoning

### Footer (Optional)

- Reference issues: `Closes #123` or `Refs #456`
- Breaking changes: `BREAKING CHANGE: description`

### Examples

**Simple feature:**
```
feat(auth): add passphrase-based authentication

Implements Argon2id key derivation with secure session
management. Users can now create accounts and log in
using a passphrase instead of traditional passwords.

Refs #42
```

**Bug fix:**
```
fix(transactions): prevent unbalanced journal entries

Add validation to ensure debits equal credits before
saving. Display helpful error message when entries
don't balance.

Closes #78
```

**Documentation:**
```
docs: add contributing guidelines

Create comprehensive CONTRIBUTING.md with workflow,
branch naming, commit conventions, and PR process.
```

**Refactoring:**
```
refactor(crypto): extract encryption utilities

Move encryption logic into reusable utility functions
to improve testability and code organization.
```

**Breaking change:**
```
feat(db): migrate to Dexie v4 schema

BREAKING CHANGE: Database schema version updated from v1 to v2.
Users will need to run migration on first launch.
```

**Multiple changes:**
```
feat(dashboard): add cash flow visualization

- Add recharts dependency for data visualization
- Create CashFlowChart component with responsive design
- Implement date range selector
- Add empty state for new users

The chart displays income and expenses over time,
helping users understand their business cash flow
at a glance.

Closes #156
```

---

## Pull Request Process

When your feature is ready for review, follow these steps to create a high-quality pull request.

### Before Creating Your PR

Complete the pre-submission checklist:

- [ ] All acceptance criteria met (check ROADMAP.md)
- [ ] Code reviewed against `AGENT_REVIEW_CHECKLIST.md`
- [ ] All tests passing locally
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] Test coverage >80% for new code
- [ ] Documentation updated
- [ ] Commits follow conventional format
- [ ] Branch is up to date with master

### Creating the Pull Request

1. **Push your branch:**
   ```bash
   git push -u origin your-branch-name
   ```

2. **Open a pull request on GitHub**

3. **Write a clear PR title:**
   - Use the same format as commit messages
   - Example: `feat(reports): add profit & loss statement`

4. **Complete the PR description:**

   Use this template:

   ```markdown
   ## Summary

   Brief description of what this PR does and why.

   ## Roadmap Item

   - Roadmap ID: [B1, D6, etc.]
   - Task: [Task name from ROADMAP.md]

   ## Changes

   - List key changes made
   - Highlight any notable decisions
   - Mention new dependencies added

   ## Testing

   - [ ] Unit tests added/updated
   - [ ] Integration tests added/updated
   - [ ] E2E tests added/updated (if applicable)
   - [ ] Manual testing completed
   - [ ] Accessibility tested (WCAG 2.1 AA)
   - [ ] Cross-browser tested

   ## Screenshots (if applicable)

   Include screenshots for UI changes

   ## Breaking Changes

   List any breaking changes or migration steps needed

   ## Checklist

   - [ ] Reviewed AGENT_REVIEW_CHECKLIST.md
   - [ ] All acceptance criteria met
   - [ ] Tests passing (100%)
   - [ ] TypeScript errors: 0
   - [ ] ESLint warnings: 0
   - [ ] Test coverage >80%
   - [ ] Documentation updated
   - [ ] ROADMAP.md status updated

   ## Related Issues

   Closes #123
   Refs #456
   ```

5. **Request reviewers:**
   - Assign at least one reviewer
   - Tag relevant team members
   - Link to related PRs if working on parallel tasks

### During Review

- Respond to feedback promptly and professionally
- Make requested changes in new commits (don't force push)
- Re-request review after addressing comments
- Discuss and resolve all conversations
- Ask questions if feedback is unclear

**Handling feedback gracefully:**
```
✅ "Great point! I'll refactor that to improve readability."
✅ "I hadn't considered that edge case. Adding test coverage now."
✅ "Could you clarify what you mean by...?"

❌ "That's just your opinion."
❌ "It works fine as is."
```

### Merging

Once approved:

1. **Ensure all checks pass** (CI/CD pipeline green)
2. **Squash and merge** (preferred) or standard merge
3. **Delete your branch** after merging
4. **Update ROADMAP.md** if not already done
5. **Celebrate!** You just made Graceful Books better

---

## Code Review Guidelines

Code reviews are opportunities for learning and improvement. We approach them with patience, respect, and supportiveness.

### For Authors

**Before requesting review:**
- Review your own code first (read the diff)
- Run all tests and checks
- Complete the `AGENT_REVIEW_CHECKLIST.md`
- Add comments explaining complex logic
- Ensure commits are clean and meaningful

**During review:**
- Respond to all comments (even if just "Done" or "👍")
- Ask for clarification if feedback is unclear
- Be open to suggestions and alternative approaches
- Thank reviewers for their time and insights

### For Reviewers

**Review philosophy:**
- We're reviewing code, not people
- Focus on making the code better, not perfect
- Be specific and constructive
- Ask questions rather than making demands
- Praise good work and clever solutions

**What to review:**

1. **Correctness**
   - Does it meet all acceptance criteria?
   - Are there logical errors or edge cases?
   - Does it handle errors gracefully?

2. **Code Quality**
   - Is it readable and maintainable?
   - Are names clear and descriptive?
   - Is there unnecessary complexity?
   - Does it follow project patterns?

3. **Testing**
   - Are there sufficient tests?
   - Do tests cover edge cases?
   - Are tests meaningful (not just coverage)?

4. **Security & Privacy**
   - Is sensitive data encrypted?
   - Are inputs validated?
   - Does it maintain zero-knowledge architecture?

5. **User Experience**
   - Does it follow Steadiness communication style?
   - Are error messages helpful, not blaming?
   - Is it accessible (WCAG 2.1 AA)?

6. **Performance**
   - Are there obvious performance issues?
   - Are queries optimized?
   - Does encryption happen efficiently?

**How to give feedback:**

```
✅ "Consider extracting this into a separate function for better testability."
✅ "This could be simplified using Array.reduce(). What do you think?"
✅ "Great solution! One edge case to consider: what if the array is empty?"
✅ "I love how you handled the error state here."

❌ "This is wrong."
❌ "You should have used X instead."
❌ "This is messy code."
```

**Review timing:**
- Aim to review within 1 business day
- For urgent PRs, communicate expected timeline
- If you're blocked, let the author know

### Approval Criteria

A PR should be approved when:

- [ ] All acceptance criteria met
- [ ] Code quality meets standards
- [ ] Tests are comprehensive and passing
- [ ] No obvious bugs or security issues
- [ ] Documentation is updated
- [ ] Zero-knowledge architecture maintained
- [ ] Steadiness communication style followed
- [ ] All review comments resolved

**Types of approval:**

- ✅ **Approve** - Looks great, ready to merge
- 💬 **Comment** - Suggestions but not blocking
- 🔄 **Request Changes** - Issues must be addressed

---

## Definition of Done

A task is considered "done" only when ALL applicable criteria are met. Review the complete `DEFINITION_OF_DONE.md` for comprehensive details.

### Quick Checklist

**Code Complete:**
- [ ] All acceptance criteria from roadmap item met
- [ ] Code peer reviewed and approved
- [ ] Follows project style guide and conventions
- [ ] ESLint passes with zero warnings
- [ ] TypeScript compiles without errors
- [ ] No console.log or debugging code remains
- [ ] Complex logic includes clear comments

**Graceful Books Principles:**
- [ ] Steadiness communication style used throughout
  - Patient, step-by-step guidance
  - Reassuring and supportive language
  - Clear expectations and next steps
- [ ] Plain English explanations for accounting concepts
- [ ] Error messages never blame the user
- [ ] Progressive feature disclosure respected
- [ ] Joy opportunities implemented where specified

**Testing:**
- [ ] Unit tests written for all business logic
- [ ] Test coverage meets or exceeds 80%
- [ ] Integration tests verify end-to-end functionality
- [ ] E2E tests for critical workflows (if applicable)
- [ ] WCAG 2.1 AA accessibility verified
- [ ] Cross-browser testing completed
- [ ] Mobile responsive design tested

**Zero-Knowledge Encryption:**
*(For features handling financial/sensitive data)*
- [ ] All financial data encrypted before storage
- [ ] Encryption uses AES-256 or equivalent
- [ ] No plaintext sensitive data in console or network
- [ ] Server cannot access unencrypted data
- [ ] Key derivation uses Argon2id

**Documentation:**
- [ ] Code comments for complex logic
- [ ] JSDoc comments on functions and classes
- [ ] API documentation updated (if applicable)
- [ ] User-facing help text in plain English
- [ ] ROADMAP.md status updated
- [ ] Known limitations documented

**Quality Gates:**
- [ ] All tests passing (100%)
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Performance acceptable (transaction save <500ms)
- [ ] Works offline (for applicable features)

**Agent Sign-Off:**
Before marking complete, verify:
- ✅ All checklist items reviewed and addressed
- ✅ All acceptance criteria met
- ✅ All tests passing
- ✅ Roadmap item marked complete
- ✅ Documentation updated

---

## Testing Requirements

Quality is non-negotiable at Graceful Books. We maintain high test coverage to ensure reliability and user trust.

### Testing Philosophy

- Write tests as you code (not after)
- Tests should verify behavior, not implementation
- Aim for >80% coverage, but focus on meaningful tests
- Every bug fix should include a regression test
- Accessibility testing is required, not optional

### Test Types

#### 1. Unit Tests

Test individual functions, components, and modules in isolation.

**Location:** Next to the file being tested
- `src/services/auth/authService.ts`
- `src/services/auth/authService.test.ts`

**Example:**
```typescript
import { describe, it, expect } from 'vitest'
import { calculateBalance } from './accountService'

describe('calculateBalance', () => {
  it('sums transaction amounts correctly', () => {
    const transactions = [
      { amount: 100, type: 'debit' },
      { amount: 50, type: 'credit' },
    ]
    expect(calculateBalance(transactions)).toBe(50)
  })

  it('handles empty transaction array', () => {
    expect(calculateBalance([])).toBe(0)
  })
})
```

**Run:**
```bash
npm test                    # Run all tests
npm test -- authService     # Run specific test file
npm run test:ui             # Run with UI
```

#### 2. Integration Tests

Test how multiple components/modules work together.

**Example:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@lib/db'
import { AccountService } from '@services/accounts'

describe('Account Service Integration', () => {
  beforeEach(async () => {
    await db.accounts.clear()
  })

  it('creates and retrieves account with encryption', async () => {
    const account = await AccountService.create({
      name: 'Cash',
      type: 'asset',
    })

    const retrieved = await AccountService.getById(account.id)
    expect(retrieved.name).toBe('Cash')
  })
})
```

#### 3. Accessibility Tests

Verify WCAG 2.1 AA compliance using jest-axe.

**Example:**
```typescript
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button } from './Button'

expect.extend(toHaveNoViolations)

describe('Button Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<Button>Click me</Button>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

#### 4. E2E Tests

Test complete user workflows using Playwright.

**Location:** `tests/e2e/`

**Example:**
```typescript
import { test, expect } from '@playwright/test'

test('user can create and reconcile transaction', async ({ page }) => {
  await page.goto('http://localhost:5173')

  // Login
  await page.fill('[name="passphrase"]', 'test-passphrase')
  await page.click('button:has-text("Sign In")')

  // Create transaction
  await page.click('text=New Transaction')
  await page.fill('[name="amount"]', '100.00')
  await page.click('button:has-text("Save")')

  // Verify
  await expect(page.locator('text=$100.00')).toBeVisible()
})
```

**Run:**
```bash
npm run e2e                 # Run all E2E tests
npm run e2e:ui              # Run with Playwright UI
```

### Coverage Requirements

- **Overall coverage:** >80%
- **Critical paths:** >90% (auth, encryption, transactions)
- **New code:** Must meet or exceed current coverage
- **Bug fixes:** Must include regression test

**Check coverage:**
```bash
npm run test:coverage
```

Coverage report will be generated in `coverage/` directory.

### Test Best Practices

**Do:**
- ✅ Test behavior, not implementation
- ✅ Use descriptive test names (what, when, expected result)
- ✅ Test edge cases and error conditions
- ✅ Keep tests focused and independent
- ✅ Use meaningful assertions
- ✅ Mock external dependencies
- ✅ Test accessibility for UI components

**Don't:**
- ❌ Test private methods directly
- ❌ Write tests just for coverage numbers
- ❌ Make tests dependent on each other
- ❌ Use random data (tests should be deterministic)
- ❌ Skip writing tests because "it's obvious"
- ❌ Test framework behavior

---

## CI/CD Pipeline

Our continuous integration and deployment pipeline ensures code quality and reliability.

### Pipeline Overview

When you push commits or create a pull request, the following checks run automatically:

```
┌─────────────────┐
│   Code Push     │
└────────┬────────┘
         │
    ┌────▼────┐
    │  Lint   │ ESLint checks
    └────┬────┘
         │
    ┌────▼─────────┐
    │ Type Check   │ TypeScript compilation
    └────┬─────────┘
         │
    ┌────▼──────┐
    │  Tests    │ Unit + Integration
    └────┬──────┘
         │
    ┌────▼────────┐
    │  Coverage   │ >80% required
    └────┬────────┘
         │
    ┌────▼──────┐
    │  Build    │ Production build
    └────┬──────┘
         │
    ┌────▼──────┐
    │ E2E Tests │ (on PR only)
    └────┬──────┘
         │
    ┌────▼─────┐
    │  Deploy  │ (on merge to master)
    └──────────┘
```

### Checks Required for Merge

All PRs must pass these checks before merging:

1. **ESLint** - Code style and quality
   - Must have 0 errors
   - Must have 0 warnings
   - Run locally: `npm run lint`

2. **TypeScript** - Type safety
   - Must compile without errors
   - Run locally: `npm run type-check`

3. **Unit Tests** - Functionality
   - Must achieve 100% pass rate
   - Must maintain >80% coverage
   - Run locally: `npm test`

4. **Build** - Production readiness
   - Must build successfully
   - Run locally: `npm run build`

5. **E2E Tests** - User workflows (PR only)
   - Critical paths must pass
   - Run locally: `npm run e2e`

### Pipeline Scripts

The following npm scripts are used by CI/CD:

```json
{
  "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
  "type-check": "tsc --noEmit",
  "test": "vitest",
  "test:coverage": "vitest --coverage",
  "build": "tsc && vite build",
  "e2e": "playwright test"
}
```

### Local Pre-Push Check

Run this command before pushing to catch issues early:

```bash
npm run lint && npm run type-check && npm test && npm run build
```

Consider adding this as a git pre-push hook:

```bash
# .git/hooks/pre-push
#!/bin/sh
npm run lint && npm run type-check && npm test
```

### Failed Checks

If CI/CD checks fail:

1. **Review the logs** on GitHub Actions
2. **Reproduce locally** using the same commands
3. **Fix the issues** in your branch
4. **Push the fixes** to re-trigger checks

**Common failures:**

- **Lint errors:** Run `npm run lint:fix` to auto-fix
- **Type errors:** Check the output of `npm run type-check`
- **Test failures:** Run `npm test` and debug failing tests
- **Coverage drop:** Add tests for uncovered code

### Deployment

Deployments happen automatically on successful merge to `master`:

1. All checks pass
2. PR is approved and merged
3. Production build created
4. Deployed to staging environment
5. Smoke tests run
6. Deployed to production (if staging passes)

**Rollback:**
If issues are detected post-deployment, the previous version can be restored within minutes. Contact the team lead immediately if you suspect a deployment issue.

---

## Troubleshooting

Common issues and solutions to help you get unstuck quickly.

### Installation Issues

**Problem:** `npm install` fails with dependency errors

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and lock file
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

**Problem:** Node version mismatch

**Solution:**
```bash
# Check your Node version
node --version

# Install correct version (use nvm)
nvm install 18
nvm use 18
```

---

### TypeScript Errors

**Problem:** Path alias imports not resolving

**Solution:**
Check `tsconfig.json` has correct paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@components/*": ["./src/components/*"],
      "@lib/*": ["./src/lib/*"],
      "@services/*": ["./src/services/*"]
    }
  }
}
```

**Problem:** Type errors after dependency update

**Solution:**
```bash
# Reinstall types
npm install --save-dev @types/react @types/react-dom @types/node
```

---

### Testing Issues

**Problem:** Tests fail with "Cannot find module"

**Solution:**
Check `vitest.config.ts` has matching path aliases:
```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
    }
  }
})
```

**Problem:** IndexedDB tests fail

**Solution:**
Ensure `fake-indexeddb` is imported in test setup:
```typescript
// vitest.setup.ts
import 'fake-indexeddb/auto'
```

**Problem:** E2E tests timing out

**Solution:**
```bash
# Increase timeout
npx playwright test --timeout=60000

# Run in headed mode to debug
npx playwright test --headed

# Run specific test
npx playwright test tests/e2e/auth.spec.ts
```

---

### Development Server Issues

**Problem:** Dev server won't start

**Solution:**
```bash
# Check if port 5173 is in use
lsof -ti:5173

# Kill the process
kill -9 $(lsof -ti:5173)

# Or use a different port
npm run dev -- --port 3000
```

**Problem:** Hot reload not working

**Solution:**
- Check that file paths use forward slashes
- Restart the dev server
- Clear browser cache
- Check for file system watcher limits (Linux):
  ```bash
  echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
  sudo sysctl -p
  ```

---

### Database Issues

**Problem:** Database schema errors

**Solution:**
```typescript
// Clear database in browser console
await db.delete()
await db.open()

// Or bump version in schema
this.version(2).stores({ /* new schema */ })
```

**Problem:** Encrypted data not decrypting

**Solution:**
- Verify master key is correct
- Check encryption/decryption logic
- Ensure IV (initialization vector) is stored with ciphertext
- Test with known plaintext/ciphertext pairs

---

### Build Issues

**Problem:** Production build fails

**Solution:**
```bash
# Clear build cache
rm -rf dist

# Check for dynamic imports issues
npm run build -- --logLevel verbose

# Verify all dependencies are in package.json (not just devDependencies)
```

**Problem:** Build size too large

**Solution:**
- Check bundle analyzer: `npm run build -- --analyze`
- Verify code splitting is working
- Look for accidentally imported large libraries
- Ensure tree-shaking is working

---

### Git Issues

**Problem:** Merge conflicts

**Solution:**
```bash
# Update master
git checkout master
git pull origin master

# Rebase your branch (preferred)
git checkout your-branch
git rebase master

# Or merge (if rebase is complicated)
git merge master

# Resolve conflicts in your editor, then:
git add .
git rebase --continue  # or git merge --continue
```

**Problem:** Accidentally committed to master

**Solution:**
```bash
# Create a branch with current changes
git branch feature/my-changes

# Reset master to origin
git checkout master
git reset --hard origin/master

# Continue working on feature branch
git checkout feature/my-changes
```

---

### Performance Issues

**Problem:** Slow transaction saves

**Solution:**
- Check encryption is not synchronous
- Verify batch operations are being used
- Profile with browser DevTools
- Check for unnecessary re-renders (React DevTools)

**Problem:** UI feels sluggish

**Solution:**
- Use React DevTools Profiler
- Check for expensive calculations in render
- Verify useMemo/useCallback usage
- Look for redundant re-renders

---

### Getting Help

If you're stuck and can't find a solution:

1. **Search existing issues** on GitHub
2. **Check documentation** (SPEC.md, CLAUDE.md, ROADMAP.md)
3. **Ask in the team chat** - we're here to help!
4. **Create a detailed issue** with:
   - What you're trying to do
   - What you've tried
   - Error messages (full stack trace)
   - Environment info (OS, Node version, browser)

Remember: There are no "stupid questions." We're all learning together, and asking questions helps everyone.

---

## Questions & Support

### Communication Channels

- **GitHub Issues** - Bug reports, feature requests
- **GitHub Discussions** - Questions, ideas, general discussion
- **Team Chat** - Quick questions, daily coordination

### Getting Help

We're here to support you:

- Take your time understanding the codebase
- Ask questions when something is unclear
- Request code reviews and feedback
- Share what you're learning

### Response Times

- **Critical issues:** Within a few hours
- **Bug reports:** Within 1 business day
- **Feature questions:** Within 2 business days
- **Code reviews:** Within 1 business day

### Documentation

If you find documentation unclear or incomplete:

1. **Ask for clarification** - We'll help immediately
2. **Submit improvements** - Update docs as you learn
3. **Share feedback** - Help us make docs better

---

## Core Principles

As you contribute, keep these principles in mind:

### User Data Sovereignty
- All financial data must be encrypted client-side
- Zero-knowledge architecture is non-negotiable
- Users own and control their data completely

### Progressive Empowerment
- Features reveal as users are ready
- Never overwhelm with complexity
- Support intentional exploration

### Judgment-Free Education
- Use plain English, not jargon
- Error messages are helpful, never blaming
- Steady, patient, supportive communication

### GAAP Compliance
- Professional accounting standards beneath friendly UI
- Maintain audit trails
- Ensure financial data integrity

### Social Impact
- $5/month goes to user-selected charity
- Transparency in charitable giving
- Build a platform that gives back

---

## Thank You

Thank you for contributing to Graceful Books! Your work helps entrepreneurs build confidence in managing their finances. Every line of code, every test, every documentation improvement makes the platform more empowering and accessible.

Take your time. Ask questions. Build gracefully.

**We're glad you're here.**

---

*"Build gracefully. Code with empathy. Empower with clarity."*

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-13 | 1.0.0 | Initial CONTRIBUTING.md created for D12 |
