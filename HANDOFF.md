# HANDOFF.md — Branch: feature/auto-backup-key-migration

**Last updated:** 2026-09-09
**Branch:** `feature/auto-backup-key-migration`
**Status:** In progress — do NOT merge or deploy

---

## Project Context

Local-first bookkeeping app (React/TS/Vite/Dexie). A security review found several serious issues. This branch addresses them.

### Architecture Decisions (SETTLED — do not revisit)

1. **Local IndexedDB data stays UNENCRYPTED.** We decided against at-rest encryption — the recovery risk outweighs the benefit since the server never holds the data. Docs were corrected across ~22 files (they falsely claimed "zero-knowledge").

2. **Backup files ARE encrypted.** That's where crypto belongs.

3. **Server holds only:** email, company name, support key, product tier, billing.

4. **Dual-database architecture (intentional):**
   - `TreasureChest` (`src/db/database.ts`) — CPG product, in beta with real users
   - `GracefulBooksDB` (`src/store/database.ts`) — Bookkeeping product, unfinished, no users yet

   Routes are gated by `requireProduct` in `src/routes/index.tsx`:
   - CPG users (`cpu-cpg-calculator`) → `/cpg/*` routes → TreasureChest
   - Bookkeeping users (`bookkeeping-suite`) → `/accounts`, `/vendors`, etc. → GracefulBooksDB

   **Backup currently covers TreasureChest only.** When bookkeeping ships, its backup coverage must be built separately. No cross-database reads/writes exist.

---

## Known Architectural Constraints

### companyId = userId (Temporary Shortcut)

The app uses `userId` as `companyId` for data isolation. This is set in `src/contexts/AuthContext.tsx:57`:

```typescript
companyId: userId, // Use user ID as company ID for data isolation
```

**Why this matters:**
- All data records include a `company_id` field for multi-tenant isolation
- Currently, this is ALWAYS the user's ID (no true multi-company support yet)
- Dev auth bypass (localhost + DEV mode) lets you access the app without a session
- But WITHOUT a session, `companyId` is `null` — causing Dexie `.where().equals(undefined)` errors
- This affects: CPG queries, backup restore, and any company-scoped data access

**Symptoms of missing companyId:**
- Cryptic Dexie error: `"Failed to execute 'only' on 'IDBKeyRange': The parameter is not a valid key."`
- Console shows Dexie stack trace mentioning `.equals(undefined)`
- Data exists but queries return nothing (because WHERE company_id = null matches nothing)

**Guards added:**
- `cpgSettings.service.ts` — throws meaningful error if companyId undefined
- `cpgReporting.service.ts` — all exported functions guard companyId
- `EncryptedBackup.tsx` — warns in dev mode, blocks in production

**For testing on fresh browser profile:**
Set sessionStorage before accessing protected routes:
```javascript
sessionStorage.setItem('graceful_books_session', JSON.stringify({
  token: 'dev-test-token',
  userId: 'YOUR-COMPANY-ID-FROM-BACKUP',  // See "Finding companyId in backup files"
  userEmail: 'test@example.com',
  expiresAt: Date.now() + 86400000
}))
```

**Finding companyId in backup files:**
1. Open any `.gbbackup` file in a text editor
2. The file is JSON — look for `company_id` fields in any table data
3. Or decrypt and search: any record's `company_id` is what you need
4. Common locations: `cpgSettings[0].company_id`, `cpgCategories[0].company_id`

---

## What's Been Fixed on This Branch

### 1. Backup Data Completeness
`exportAllData()` only covered 11 of 93 tables — every backup ever made was missing most of the data.

**Fix:** Now dynamic — iterates `db.tables`, 82 exported, 12 excluded with documented reasons. Test asserts every table is either exported or explicitly excluded.

### 2. Derivable Key Vulnerability — FIXED
Key was `SHA-256("audacious-money-backup:${userId}:stable-v1")` — derivable from a value our server holds.

**Fix:** Auto-mode removed entirely. All backups now use manual passphrase with sentinel verification:
- `EncryptedBackup.tsx` — Single backup path, uses passphrase verified against encrypted sentinel
- `DataSafetyPanel.tsx` — "Backup Now" button opens EncryptedBackup modal (no more raw prompt())
- `SmartAutoBackupService.ts` — Auto-backup disabled; requires passphrase caching design that doesn't exist

### 3. Restore UI Was Dead Code
`EncryptedBackup.tsx` existed but was never imported anywhere.

**Fix:** Now wired into Settings → Data Safety.

### 4. "Backup Now" Was Broken
Called `generateBackupBundle()` with wrong arguments and wrote an error object to the file. Backups had never actually worked.

**Fix:** Corrected the call signature.

### 5. Restore Modal Comparison
No way to see what restore would do.

**Fix:** Comparison table shows backup vs current DB counts, warns on ANY reduction.

### 6. Passphrase Model
**Manual mode only.** Auto-mode was removed entirely — the random-key-in-folder approach added complexity without clear UX benefit. All backups now use a user passphrase verified by an encrypted sentinel. The passphrase itself is NOT stored.

### 7. Argon2id Was Never Loading — FIXED (DEV AND PRODUCTION)
`argon2-browser` was in package.json but never imported — everything silently fell back to PBKDF2.

**Status (2026-09-13):** FIXED in both dev and production builds.

**Root cause:** Rollup couldn't bundle the WASM file. Dynamic `import('argon2-browser')` worked in dev (Vite serves from node_modules) but failed in production builds.

**Solution:**
1. Copy `argon2-bundled.min.js` to `public/` (has WASM embedded as base64)
2. Load via script tag at runtime instead of dynamic import
3. This bypasses Rollup entirely — works in both dev and prod

**Files changed:**
- `src/crypto/argon2Loader.ts` — Rewrote to use script tag loading
- `public/argon2-bundled.min.js` — Added bundled version with embedded WASM

**Verification (PRODUCTION BUILD):**
```bash
npm run build && npm run preview -- --port 3008
BASE_URL=http://localhost:3008 npx playwright test kdf-argon2-production.spec.ts
```

**E2E test output (production build):**
```
[Argon2] Module loaded successfully via script tag
[KDF] Key derived using Argon2id
Duration: 1566ms (Argon2 expected >500ms, PBKDF2 would be <200ms)
PBKDF2 fallback: NO (correct)
2 passed
```

**Production test added:** `e2e/kdf-argon2-production.spec.ts` — Runs against production build, not dev server. This test exists because Argon2 was incorrectly reported "fixed" 4 times while only working in dev.

---

## Known Issues

### Pre-existing TypeScript Errors (~2,400)
The codebase has ~2,424 TypeScript errors, mostly:
- Test files with stale type interfaces
- Unused imports/variables (TS6133)
- Not this branch's problem; do not attempt to fix

### This Branch's Fixes (Backup/Crypto)
All backup/crypto specific errors have been fixed:
- ✅ `argon2-browser.d.ts` created with real types
- ✅ `kdfMigration.test.ts` mock shape corrected (Argon2d/Argon2i/Argon2id)
- ✅ `kdfMigration.ts` BufferSource issues fixed with proper ArrayBuffer conversion
- ✅ `EncryptedBackup.tsx` undefined handling and @ts-expect-error removed
- ✅ `backupRestoreRoundTrip.test.ts` rewritten with typed seed data
- ✅ File System Access API types added (`file-system-access.d.ts`)

---

## Open Items (Do These In Order)

### a) TypeScript Check ✅ DONE
Run `tsc --noEmit`. Previous run was killed (exit 137 OOM).

**Result:** 2,424 pre-existing errors. Backup/crypto errors all fixed.

Use `NODE_OPTIONS=--max-old-space-size=4096` if needed.

### b) Re-run Backup Round-Trip Test ✅ DONE
The test was rewritten with:
- Typed seed data (compile-time safety)
- Deep field-level comparison (not just counts)
- Deliberately-broken control test

**Result:** 10/10 tests pass. Verified by:
1. Running test → all pass
2. Deliberately breaking restore (stripped `created_at`) → test FAILS naming exact field
3. Reverted → all pass again
4. Removed `balance` field from factory → TypeScript compile error (proof of compile-time safety)

### c) Tests for New Paths ✅ DONE

**Sentinel tests** (`backupPreferences.schema.test.ts`): 17/17 passed
- ✅ Manual mode: correct passphrase decrypts sentinel, backup proceeds
- ✅ Manual mode: wrong passphrase fails sentinel check, backup does NOT proceed
- ✅ Wrong/similar/empty passphrases all correctly rejected
- ✅ Corrupted ciphertext/IV/salt all correctly rejected

**Confirm:** `stored_passphrase` no longer exists anywhere in the codebase ✅

*Note: Auto-mode folder-key tests removed — auto-mode was removed entirely.*

### d) Backup Now Path ✅ DONE

**Root cause of original bug:** DataSafetyPanel's "Backup Now" used a raw browser `prompt()` for passphrase, bypassing the preference system entirely.

**Fix:** "Backup Now" now opens `EncryptedBackup` modal, which:
- Creates sentinel on first backup (for passphrase verification)
- Verifies passphrase against sentinel on subsequent backups
- Never stores the passphrase itself

**Test:** `BackupHistoryService.test.ts` verifies history filtering; backup creation path tested via round-trip tests.

### f) Rotation Pattern Fix ✅ DONE

**Bug found:** `cleanOldBackups()` matched `audacious-backup-*.encrypted` but real files were `graceful-books-backup-*.gbbackup`. Rotation never matched anything — files accumulated forever.

**RENAMED (2026-09-14):** Backup files now use `audacious-backup-*.gbbackup` format.

**Fixed in `SmartAutoBackupService.ts`:**
- Filename generation: `audacious-backup-${timestamp}.gbbackup`
- Rotation pattern matches BOTH new (`audacious-backup-`) and legacy (`graceful-books-backup-`)
- Timestamp extraction regex updated: `(?:audacious|graceful-books)-backup-(.+)\.gbbackup`

**Behavioral test added:** `SmartAutoBackupService.test.ts`
- `with 11 backups + key file: oldest backup deleted, key file remains`
- Creates 13 real-named backups + key file, calls cleanup, asserts oldest IS deleted AND key file IS NOT deleted
- Test was deliberately broken (wrong pattern) to verify it catches bugs — 3/4 failed as expected

### g) Argon2 Hard Requirement for New Backups ✅ DONE

**Problem:** If Argon2 WASM fails to load, code silently fell back to PBKDF2 — reinstating the derivable-key vulnerability we spent this project fixing.

**Fix:** New backups now HARD FAIL without Argon2. Old backups can still be restored with PBKDF2 fallback.

**Implementation:**
- Added `requireArgon2` option to `deriveMasterKey()` in `keyDerivation.ts`
- `backupService.ts:createBackup()` passes `requireArgon2: true`
- `BackupEncryption.ts:generateBackupBundle()` passes `requireArgon2: true`
- Restore paths use default `requireArgon2: false` for backward compatibility

**Error shown to user if Argon2 unavailable:**
```
Backup encryption unavailable: Argon2id key derivation failed.
This may be caused by browser security settings blocking WebAssembly.
Please try a different browser or check your Content Security Policy settings.
```

### h) Backup History Filtering ✅ DONE

**Problem:** History showed corrupted 98-byte `.json` files from old SmartAutoBackupService bugs.

**Fix:** `BackupHistoryService.ts:loadBackupHistory()` now filters:
- Only `.gbbackup` extension (not `.json`)
- Minimum size: 1KB (smaller files are corrupt error-JSON)

**Test:** `BackupHistoryService.test.ts` — verifies .json and sub-1KB files are filtered out.

---

## Known Test Gaps

### Argon2 Failure Path (requireArgon2: true)
When Argon2 WASM fails to load, new backups should hard-fail (not silently fall back to PBKDF2). The `requireArgon2` option exists and is passed, but the failure path is not tested — simulating WASM unavailability in tests is complex.

**Mitigation:** Production E2E test (`kdf-argon2-production.spec.ts`) proves Argon2 loads and is used. If it ever fails silently, that test catches it.

---

## Production Environment Differences

### Content Security Policy (CSP)

**CRITICAL:** Production serves a CSP header that dev does not. Anything touching WebAssembly or inline scripts MUST be verified against the deployed site, not just `npm run preview`.

**CSP location:** `public/_headers` (Cloudflare Pages)

**Current script-src:**
```
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://js.stripe.com
```

**What this means:**
- `'wasm-unsafe-eval'` permits WASM compilation (required for Argon2)
- Vite dev server sends NO CSP header — WASM works silently
- `npm run preview` also sends no CSP — still not a valid test
- Only the deployed site (app.audacious.money) enforces CSP

**How to test CSP locally:**
Add a meta tag to `index.html` temporarily:
```html
<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'">
```
Or use browser DevTools to add the header via a local proxy.

**Failure mode:** If WASM is blocked:
1. `argon2-bundled.min.js` loads successfully
2. `window.argon2` exists with function stubs
3. `argon2.hash()` throws `RuntimeError: abort(CompileError: ...)`
4. Key derivation falls back to PBKDF2 (less secure but functional)

---

## Working Rules

1. **Dev server on port 3006 only.** IndexedDB is per-origin — real test data lives on 3006. Port 3007 is empty/safe for experiments.

2. **Report before implementing anything structural.**

3. **No performance work.** Not the priority.

4. **Test skepticism rule:** Before reporting any test as passing, ask: "What would this look like if the thing under test were completely broken?" If the answer is "the same," the test isn't doing its job.

   Examples from this project:
   - Stubbed KDF (test passed but crypto was mocked)
   - Mocked crypto (same)
   - Selectivity test with no matching records
   - Self-regenerating fixture (test created what it verified)
   - Timeout reported as a measurement

---

## Key Files

| File | Purpose |
|------|---------|
| `src/services/backup/backupService.ts` | Main backup logic |
| `src/services/backup/FileSystemBackup.ts` | File system operations, key storage |
| `src/components/backup/EncryptedBackup.tsx` | Backup/restore UI |
| `src/crypto/kdfMigration.ts` | Argon2id/PBKDF2 migration logic |
| `src/crypto/argon2Loader.ts` | Argon2 WASM loading |
| `src/db/index.ts` | `exportAllData()` / `importAllData()` |
| `src/db/schema/backupPreferences.schema.ts` | Backup settings schema |

---

## Recent Commits (for context)

```
791aae6 feat: Add restore button to Settings and size limit to auto-restore
9e0d97b fix: Move fixture generation to one-time script, tests read-only
fc31666 test: Capture v1-derived backup fixture for migration verification
f1619d6 fix: Remove false zero-knowledge encryption claims from documentation
c242826 feat: Add full worksheet flow test page
```

---

## Commands

```bash
# TypeScript check (with memory increase)
NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit

# Run specific test
npm test -- src/services/backup/backupRestoreRoundTrip.test.ts

# Dev server (use 3006 for real data)
npm run dev -- --port 3006

# Check for stored_passphrase references
grep -r "stored_passphrase" src/
```
