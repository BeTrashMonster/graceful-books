# ⚠️ BEFORE RUNNING NPM INSTALL ⚠️

**CRITICAL SECURITY STEP**

Before installing ANY new package, ALWAYS run:

```bash
npm audit
```

## Why This Matters

Graceful Books is a zero-knowledge security platform. Malicious packages could:
- Steal user data during encryption
- Compromise the zero-knowledge architecture
- Inject backdoors into the application

## The Process

**When adding a new package:**

1. **First, audit existing packages:**
   ```bash
   npm audit
   ```

2. **Check the package reputation:**
   - npm page (download count, last updated)
   - GitHub stars and recent activity
   - Known vulnerabilities

3. **Install the package:**
   ```bash
   npm install package-name
   ```

4. **Audit again after install:**
   ```bash
   npm audit
   ```

5. **Fix any vulnerabilities immediately:**
   ```bash
   npm audit fix
   ```

## Red Flags

🚩 Package with very few downloads
🚩 Recently created package with similar name to popular package (typosquatting)
🚩 No GitHub repo or inactive repo
🚩 Package updated recently after years of inactivity
🚩 npm audit shows HIGH or CRITICAL vulnerabilities

## This is Non-Negotiable

Security is the foundation of Graceful Books. Every dependency is a trust decision.

**Always audit before installing.**

---

*This checklist is read by Claude Code before any npm install command.*
