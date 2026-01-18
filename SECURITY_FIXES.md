# Security Fixes - Implementation Guide

This document provides specific code examples and implementation guidance for the security findings identified in the security review.

---

## High Priority Fixes

### H-1: Encrypt localStorage Data

**Current vulnerable code:**
```typescript
// src/auth/login.ts
async function loadPassphraseTestData(companyId: string): Promise<PassphraseTestData | null> {
  const stored = localStorage.getItem(`passphrase-test-${companyId}`);
  if (!stored) return null;
  return JSON.parse(stored);
}
```

**Recommended fix - Create encrypted storage utility:**

```typescript
// src/utils/secureStorage.ts
import { encrypt, decrypt, serializeEncryptedData, deserializeEncryptedData } from '../crypto/encryption';

/**
 * Secure localStorage wrapper with encryption
 */
export class SecureLocalStorage {
  private static async getStorageKey(): Promise<Uint8Array> {
    // Derive a device-specific key from browser fingerprint
    const fingerprint = await this.getDeviceFingerprint();
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint + 'graceful-books-storage-key');

    // Use PBKDF2 to derive storage key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const salt = new Uint8Array(16);
    // Use deterministic salt from fingerprint for consistency
    const saltData = await crypto.subtle.digest('SHA-256', data);
    salt.set(new Uint8Array(saltData).slice(0, 16));

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    return new Uint8Array(derivedBits);
  }

  private static async getDeviceFingerprint(): Promise<string> {
    // Combine stable browser characteristics
    const components = [
      navigator.userAgent,
      navigator.language,
      String(screen.width),
      String(screen.height),
      String(screen.colorDepth),
    ];

    const combined = components.join('|');
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(combined)
    );
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static async setItem(key: string, value: string): Promise<void> {
    try {
      const storageKey = await this.getStorageKey();

      const masterKey = {
        id: 'storage-key',
        keyMaterial: storageKey,
        derivationParams: {} as any,
        createdAt: Date.now(),
      };

      const encrypted = await encrypt(value, masterKey);
      if (encrypted.success && encrypted.data) {
        const serialized = serializeEncryptedData(encrypted.data);
        localStorage.setItem(
          `secure:${key}`,
          JSON.stringify(serialized)
        );
      } else {
        throw new Error('Encryption failed');
      }
    } catch (error) {
      console.error('SecureLocalStorage.setItem failed:', error);
      throw error;
    }
  }

  static async getItem(key: string): Promise<string | null> {
    try {
      const stored = localStorage.getItem(`secure:${key}`);
      if (!stored) return null;

      const storageKey = await this.getStorageKey();
      const masterKey = {
        id: 'storage-key',
        keyMaterial: storageKey,
        derivationParams: {} as any,
        createdAt: Date.now(),
      };

      const serialized = JSON.parse(stored);
      const encrypted = deserializeEncryptedData(serialized);

      const decrypted = await decrypt(encrypted, masterKey);
      if (decrypted.success && decrypted.data) {
        return decrypted.data;
      }

      return null;
    } catch (error) {
      console.error('SecureLocalStorage.getItem failed:', error);
      return null;
    }
  }

  static removeItem(key: string): void {
    localStorage.removeItem(`secure:${key}`);
  }

  static clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('secure:')) {
        localStorage.removeItem(key);
      }
    });
  }
}
```

**Updated usage:**
```typescript
// src/auth/login.ts
import { SecureLocalStorage } from '../utils/secureStorage';

async function loadPassphraseTestData(companyId: string): Promise<PassphraseTestData | null> {
  const stored = await SecureLocalStorage.getItem(`passphrase-test-${companyId}`);
  if (!stored) return null;
  return JSON.parse(stored);
}

export async function storePassphraseTestData(testData: PassphraseTestData): Promise<void> {
  await SecureLocalStorage.setItem(
    `passphrase-test-${testData.companyId}`,
    JSON.stringify(testData)
  );
}
```

---

### H-2: Fix Dependency Vulnerabilities

**Commands to run:**

```bash
# Update Vite to fix esbuild vulnerability
npm install vite@latest

# Update Vitest UI
npm install @vitest/ui@latest --save-dev

# Remove mjml or find alternative
# Option 1: Remove if not critical
npm uninstall mjml

# Option 2: Use alternative email template library
npm install @react-email/components
# or
npm install email-templates

# Audit and fix remaining issues
npm audit fix

# Check for remaining vulnerabilities
npm audit --production
```

**Alternative email template rendering without mjml:**

```typescript
// src/services/email/emailTemplateRenderer.ts

/**
 * Secure email template renderer without html-minifier
 */
export function renderInvoiceEmail(invoice: Invoice): string {
  // Use template literals or a safe templating library
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: #4CAF50; color: white; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice ${escapeHtml(invoice.number)}</h1>
          </div>
          <div class="content">
            <p>Amount: ${escapeHtml(invoice.total.toString())}</p>
            <!-- ... more content ... -->
          </div>
        </div>
      </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

---

### H-3: Implement Content Security Policy

**Create CSP configuration file:**

```typescript
// src/config/securityHeaders.ts

export const CONTENT_SECURITY_POLICY = {
  // Default: Only load resources from same origin
  'default-src': ["'self'"],

  // Scripts: Only from same origin, no inline scripts
  'script-src': ["'self'"],

  // Styles: Same origin + inline styles (for CSS-in-JS)
  'style-src': ["'self'", "'unsafe-inline'"],

  // Images: Same origin, data URIs, HTTPS
  'img-src': ["'self'", 'data:', 'https:'],

  // Fonts: Same origin only
  'font-src': ["'self'"],

  // AJAX/WebSocket/EventSource: Same origin only
  'connect-src': ["'self'"],

  // Frames: None allowed
  'frame-src': ["'none'"],

  // Forms: Only submit to same origin
  'form-action': ["'self'"],

  // Prevent framing by other sites
  'frame-ancestors': ["'none'"],

  // Base tag restrictions
  'base-uri': ["'self'"],

  // Object/embed restrictions
  'object-src': ["'none'"],

  // Upgrade insecure requests
  'upgrade-insecure-requests': [],
};

export function generateCSPString(): string {
  return Object.entries(CONTENT_SECURITY_POLICY)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

export const SECURITY_HEADERS = {
  'Content-Security-Policy': generateCSPString(),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
```

**Update Vite configuration:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { SECURITY_HEADERS } from './src/config/securityHeaders';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'security-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
            res.setHeader(header, value);
          });
          next();
        });
      },
    },
  ],
});
```

**Update index.html:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Security Headers via meta tags (backup for static hosting) -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'">
    <meta http-equiv="X-Frame-Options" content="DENY">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta name="referrer" content="no-referrer">

    <title>Graceful Books</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Medium Priority Fixes

### M-1: Comprehensive File Upload Validation

```typescript
// src/utils/fileValidation.ts

export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedTypes?: string[];
  requireMagicNumber?: boolean;
}

const MAGIC_NUMBERS = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  csv: null, // CSV has no magic number, validate content instead
  jpg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
};

const DEFAULT_OPTIONS: FileValidationOptions = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['application/pdf', 'text/csv'],
  requireMagicNumber: true,
};

export class FileValidator {
  static async validate(
    file: File,
    options: FileValidationOptions = DEFAULT_OPTIONS
  ): Promise<{ valid: boolean; error?: string }> {
    // Size validation
    if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${this.formatBytes(options.maxSizeBytes)}.`,
      };
    }

    // Minimum size check (empty files)
    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty.',
      };
    }

    // Type validation
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type not allowed. Accepted types: ${options.allowedTypes.join(', ')}`,
      };
    }

    // Magic number validation
    if (options.requireMagicNumber) {
      const magicValid = await this.validateMagicNumber(file);
      if (!magicValid) {
        return {
          valid: false,
          error: 'File appears to be corrupted or not the expected type.',
        };
      }
    }

    // Content validation for CSV
    if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
      const contentValid = await this.validateCSVContent(file);
      if (!contentValid) {
        return {
          valid: false,
          error: 'CSV file appears to be malformed.',
        };
      }
    }

    return { valid: true };
  }

  private static async validateMagicNumber(file: File): Promise<boolean> {
    const buffer = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check PDF magic number
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const pdfMagic = MAGIC_NUMBERS.pdf;
      return bytes[0] === pdfMagic[0] &&
             bytes[1] === pdfMagic[1] &&
             bytes[2] === pdfMagic[2] &&
             bytes[3] === pdfMagic[3];
    }

    return true; // Skip for types without magic numbers
  }

  private static async validateCSVContent(file: File): Promise<boolean> {
    try {
      // Read first 1KB to validate structure
      const chunk = await file.slice(0, 1024).text();

      // Check for common CSV patterns
      const lines = chunk.split('\n');
      if (lines.length < 2) {
        return false; // Need at least header + 1 row
      }

      // Check for consistent delimiters
      const firstLineDelimiters = (lines[0].match(/,/g) || []).length;
      if (firstLineDelimiters === 0) {
        return false; // No commas found
      }

      // Validate no null bytes or unusual characters
      if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(chunk)) {
        return false; // Contains control characters
      }

      return true;
    } catch {
      return false;
    }
  }

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}
```

**Usage in upload component:**

```typescript
// src/components/reconciliation/steps/UploadStatementStep.tsx

const handleFile = useCallback(async (file: File) => {
  setError(null);
  setIsProcessing(true);

  // Validate file
  const validation = await FileValidator.validate(file, {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf', 'text/csv'],
    requireMagicNumber: true,
  });

  if (!validation.valid) {
    setError(validation.error || 'File validation failed');
    setIsProcessing(false);
    return;
  }

  setProgress('Reading file...');
  // ... rest of file processing
}, []);
```

---

### M-2: Improved Constant-Time Comparison

```typescript
// src/utils/crypto/constantTime.ts

/**
 * Constant-time string comparison
 *
 * Prevents timing attacks by ensuring comparison takes the same time
 * regardless of input values.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  // Convert to UTF-8 bytes for comparison
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);

  // Determine max length
  const maxLength = Math.max(bytesA.length, bytesB.length);

  // Pad to same length
  const paddedA = new Uint8Array(maxLength);
  const paddedB = new Uint8Array(maxLength);
  paddedA.set(bytesA);
  paddedB.set(bytesB);

  // Compare in constant time
  let result = 0;
  for (let i = 0; i < maxLength; i++) {
    result |= paddedA[i] ^ paddedB[i];
  }

  // Also compare lengths in constant time
  result |= bytesA.length ^ bytesB.length;

  return result === 0;
}

/**
 * Constant-time byte array comparison
 */
export function constantTimeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    // Still do full comparison even if lengths differ
    const maxLength = Math.max(a.length, b.length);
    const paddedA = new Uint8Array(maxLength);
    const paddedB = new Uint8Array(maxLength);
    paddedA.set(a);
    paddedB.set(b);

    let result = 0;
    for (let i = 0; i < maxLength; i++) {
      result |= paddedA[i] ^ paddedB[i];
    }
    result |= a.length ^ b.length;
    return result === 0;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}
```

**Update existing code to use it:**

```typescript
// src/crypto/keyDerivation.ts
import { constantTimeEqual } from '../utils/crypto/constantTime';

export async function verifyPassphrase(
  passphrase: string,
  knownMasterKey: MasterKey
): Promise<boolean> {
  try {
    const result = await rederiveMasterKey(passphrase, knownMasterKey.derivationParams);

    if (!result.success || !result.data) {
      return false;
    }

    // Use imported constant-time comparison
    return constantTimeEqual(result.data.id, knownMasterKey.id);
  } catch {
    return false;
  }
}
```

---

### M-4: Rate Limiting Implementation

```typescript
// src/utils/rateLimiter.ts

export interface RateLimitConfig {
  maxOperations: number;
  windowMs: number;
}

export class RateLimiter {
  private operations: Map<string, number[]> = new Map();
  private cleanupInterval: number | null = null;

  constructor() {
    // Periodic cleanup of old operations
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Check if operation is allowed under rate limit
   */
  async check(
    operationKey: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; waitTimeMs?: number }> {
    const now = Date.now();
    const ops = this.operations.get(operationKey) || [];

    // Remove operations outside the window
    const recentOps = ops.filter(time => now - time < config.windowMs);

    if (recentOps.length >= config.maxOperations) {
      const oldestOp = Math.min(...recentOps);
      const waitTime = config.windowMs - (now - oldestOp);
      return {
        allowed: false,
        waitTimeMs: Math.max(0, waitTime),
      };
    }

    // Record this operation
    recentOps.push(now);
    this.operations.set(operationKey, recentOps);

    return { allowed: true };
  }

  /**
   * Clean up old operations
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, ops] of this.operations.entries()) {
      const recentOps = ops.filter(time => now - time < maxAge);
      if (recentOps.length === 0) {
        this.operations.delete(key);
      } else {
        this.operations.set(key, recentOps);
      }
    }
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.operations.clear();
  }

  /**
   * Destroy rate limiter and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
```

**Usage in encryption module:**

```typescript
// src/crypto/encryption.ts
import { rateLimiter } from '../utils/rateLimiter';

export async function batchEncrypt(
  values: (string | Uint8Array)[],
  key: MasterKey | DerivedKey
): Promise<CryptoResult<EncryptedData>[]> {
  // Rate limit batch operations
  const limitCheck = await rateLimiter.check('batch-encrypt', {
    maxOperations: 10,
    windowMs: 60000, // 10 operations per minute
  });

  if (!limitCheck.allowed) {
    const waitSeconds = Math.ceil((limitCheck.waitTimeMs || 0) / 1000);
    return values.map(() => ({
      success: false,
      error: `Rate limit exceeded. Please wait ${waitSeconds} seconds.`,
      errorCode: 'UNKNOWN_ERROR',
    }));
  }

  return Promise.all(values.map(value => encrypt(value, key)));
}
```

---

## ESLint Security Rules

**Create .eslintrc.security.js:**

```javascript
module.exports = {
  rules: {
    // Prevent use of Math.random() in production code
    'no-restricted-globals': [
      'error',
      {
        name: 'Math.random',
        message: 'Use crypto.getRandomValues() instead of Math.random() for security-critical operations',
      },
    ],

    // Prevent dangerous HTML methods
    'no-restricted-properties': [
      'error',
      {
        object: 'document',
        property: 'write',
        message: 'document.write() is unsafe and should not be used',
      },
      {
        property: 'innerHTML',
        message: 'Use textContent or a sanitization library instead of innerHTML',
      },
    ],

    // Prevent eval and similar dangerous functions
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Require use of strict mode
    'strict': ['error', 'never'], // Using ES modules

    // Prevent console.log in production
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
```

**Merge into main .eslintrc.cjs:**

```javascript
// .eslintrc.cjs
module.exports = {
  // ... existing config
  extends: [
    // ... existing extends
    './.eslintrc.security.js',
  ],
};
```

---

## Deployment Checklist

**Create DEPLOYMENT_CHECKLIST.md:**

```markdown
# Security Deployment Checklist

## Pre-Deployment

- [ ] All high-severity vulnerabilities fixed
- [ ] All medium-severity vulnerabilities fixed
- [ ] Dependency audit clean (`npm audit --production`)
- [ ] CSP headers configured
- [ ] Security headers configured
- [ ] HTTPS enforced (no HTTP access)
- [ ] localStorage encryption implemented
- [ ] File upload validation in place
- [ ] Rate limiting implemented
- [ ] Error messages sanitized

## Deployment Configuration

- [ ] Environment variables secured
- [ ] API keys rotated
- [ ] Logging configured
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Incident response plan documented

## Post-Deployment

- [ ] Security headers verified (securityheaders.com)
- [ ] CSP violations monitored
- [ ] Performance metrics baseline
- [ ] Penetration testing scheduled
- [ ] Bug bounty program considered
- [ ] Security documentation published

## Ongoing

- [ ] Weekly dependency scans
- [ ] Monthly security reviews
- [ ] Quarterly penetration testing
- [ ] Continuous monitoring active
- [ ] Incident response drills
```

---

## Quick Reference: Security Best Practices

### DO ✅
- Always use `crypto.getRandomValues()` for random numbers
- Always use `crypto.subtle` for encryption
- Always validate user input
- Always use prepared statements/parameterized queries
- Always implement rate limiting
- Always use HTTPS in production
- Always encrypt sensitive data in localStorage
- Always validate file uploads
- Always use Content Security Policy
- Always implement session timeouts

### DON'T ❌
- Never use `Math.random()` for security
- Never use `eval()` or `new Function()`
- Never trust user input
- Never store sensitive data in plaintext
- Never disable security features
- Never expose error details to users
- Never use `innerHTML` without sanitization
- Never commit secrets to version control
- Never skip security updates
- Never assume client-side validation is sufficient

---

**Document Version:** 1.0
**Last Updated:** January 18, 2026
**Next Review:** Before production deployment
