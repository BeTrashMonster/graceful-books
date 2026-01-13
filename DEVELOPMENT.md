# Development Guide

This guide provides instructions for developing Graceful Books.

## Initial Setup Complete ✓

The project has been initialized with:

- ✅ React 18 + TypeScript + Vite
- ✅ Custom component library foundation (Button, Input, Card)
- ✅ Project structure aligned with architecture
- ✅ TypeScript configuration with path aliases
- ✅ ESLint configuration
- ✅ Testing setup (Vitest + Playwright)
- ✅ CSS Modules with design tokens
- ✅ Core type definitions

## What Changed from Original Spec

**Communication Style Simplification:**
- Original spec called for DISC-adapted messaging (4 variants per message)
- **Now using Steadiness (S) profile only** throughout the entire platform
- This means: patient, step-by-step, supportive communication everywhere
- No assessment needed for communication style
- Simpler implementation, consistent experience

## Next Steps (Following ROADMAP.md)

### Phase 1: The Foundation - Group A Items

These can all be developed in parallel:

1. **A1. Database Schema & Core Data Models**
   - Location: `src/lib/db/schema.ts`
   - Implement Dexie database schema
   - Create tables for: accounts, transactions, contacts, products, users, audit logs

2. **A2. Encryption Layer Foundation**
   - Location: `src/lib/crypto/`
   - Implement Argon2id key derivation
   - Create encryption/decryption utilities
   - Secure key storage patterns

3. **A3. Local-First Data Store**
   - Location: `src/lib/db/`
   - Set up Dexie with IndexedDB
   - Create CRUD operations
   - Implement offline queue

4. **A4. Authentication & Session Management**
   - Location: `src/services/auth/`
   - Passphrase-based authentication
   - Session token management
   - Remember device functionality

5. **A5. UI Component Library - Core** (Started!)
   - Location: `src/components/ui/`
   - ✅ Button, Input, Card completed
   - TODO: Select, Checkbox, Radio, Modal, Drawer
   - All components must be WCAG 2.1 AA compliant

6. **A6. Application Shell & Routing**
   - Location: `src/pages/`, `src/components/layout/`
   - Main layout structure
   - Navigation sidebar
   - Route definitions

## Path Aliases

The following path aliases are configured:

```typescript
import { Button } from '@components/ui'
import { db } from '@lib/db'
import { encrypt } from '@lib/crypto'
import { useAuth } from '@hooks/useAuth'
import type { Account } from '@types'
import { formatCurrency } from '@utils/formatters'
import { AccountService } from '@services/accounts'
```

## Component Development Guidelines

### Accessibility Requirements

Every component must:
- Support keyboard navigation
- Provide proper ARIA labels
- Have sufficient color contrast (WCAG AA)
- Work with screen readers
- Support reduced motion preferences

### Steadiness Communication Style

All user-facing text should be:
- **Patient:** "Take your time with this."
- **Step-by-step:** "Here's exactly what happens next..."
- **Supportive:** "We'll guide you through everything."
- **Reassuring:** Clear expectations and timelines
- **Stable:** Emphasize security and reliability

### Example Messages

❌ Bad (too terse): "Required field"
✅ Good: "We need this information to continue. Take your time filling it out."

❌ Bad (too demanding): "You must enter a valid email"
✅ Good: "Please check your email address. It should look like name@example.com"

❌ Bad (creates anxiety): "Error! Failed to save!"
✅ Good: "We couldn't save that right now. Your data is safe. Let's try again."

## Testing

```bash
# Unit tests
npm test

# With UI
npm run test:ui

# Coverage
npm run test:coverage

# E2E tests
npm run e2e
```

### Writing Tests

All components should have:
- Unit tests for logic
- Integration tests for user interactions
- Accessibility tests (using jest-axe recommended)

Example:
```typescript
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('is keyboard accessible', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button')
    button.focus()
    expect(button).toHaveFocus()
  })
})
```

## Database Schema Example

Using Dexie:

```typescript
// src/lib/db/schema.ts
import Dexie, { Table } from 'dexie'
import type { Account, Transaction, Contact } from '@types'

export class GracefulBooksDB extends Dexie {
  accounts!: Table<Account>
  transactions!: Table<Transaction>
  contacts!: Table<Contact>

  constructor() {
    super('GracefulBooks')
    this.version(1).stores({
      accounts: 'id, companyId, type, isActive',
      transactions: 'id, companyId, date, status',
      contacts: 'id, companyId, type, name',
    })
  }
}

export const db = new GracefulBooksDB()
```

## Encryption Example

```typescript
// src/lib/crypto/encrypt.ts
import { argon2id } from 'argon2-browser'

export async function deriveMasterKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Derive key using Argon2id
  const hash = await argon2id({
    pass: passphrase,
    salt: salt,
    time: 3,
    mem: 65536,
    hashLen: 32,
    parallelism: 4,
  })

  // Import as CryptoKey for Web Crypto API
  return await crypto.subtle.importKey(
    'raw',
    hash.hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/database-schema

# Make changes, commit
git add .
git commit -m "Add database schema with Dexie"

# Push
git push -u origin feature/database-schema
```

## Resources

- **Project Spec:** `SPEC.md` - Complete product requirements
- **Implementation Plan:** `ROADMAP.md` - Detailed roadmap with dependencies
- **Dev Guidance:** `CLAUDE.md` - Architecture and technical guidance
- [Dexie.js Docs](https://dexie.org/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## Questions?

Refer to:
1. `CLAUDE.md` for architectural decisions
2. `SPEC.md` for feature requirements
3. `ROADMAP.md` for implementation order and dependencies
