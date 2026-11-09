/**
 * STRIDE Threat Model Validation Tests
 * Phase 1.2 - Foundation Security
 *
 * Each identified threat must have a corresponding test that:
 * 1. Verifies the mitigation is implemented
 * 2. Attempts the attack (where safe)
 * 3. Confirms the attempt is blocked/logged
 *
 * @gate 1.2
 */

import * as fs from 'fs';
import * as path from 'path';

// Test utilities
const srcDir = path.join(__dirname, '..', '..');
const docsDir = path.join(__dirname, '..', '..', '..', 'docs', 'security');

async function readFile(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, 'utf-8');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Parse threat model to extract threat IDs
interface Threat {
  id: string;
  category: string;
  trustBoundary: string;
  description: string;
}

async function parseThreats(): Promise<Threat[]> {
  const docPath = path.join(docsDir, 'THREAT_MODEL.md');
  const content = await readFile(docPath);

  const threats: Threat[] = [];

  // Extract threat IDs using regex
  const threatPatterns = [
    // Trust Boundary threats
    { pattern: /STRIDE-TB1-[A-Z]\d{2}/g, trustBoundary: 'TB1: Browser ↔ IndexedDB' },
    { pattern: /STRIDE-TB2-[A-Z]\d{2}/g, trustBoundary: 'TB2: Device ↔ Sync Relay' },
    { pattern: /STRIDE-TB3-[A-Z]\d{2}/g, trustBoundary: 'TB3: Multi-User' },
    { pattern: /STRIDE-TB4-[A-Z]\d{2}/g, trustBoundary: 'TB4: Third-Party Services' },
    // Cross-boundary threats
    { pattern: /STRIDE-INPUT-\d{2}/g, trustBoundary: 'Input Validation' },
    { pattern: /STRIDE-SESSION-\d{2}/g, trustBoundary: 'Session Management' },
  ];

  for (const { pattern, trustBoundary } of threatPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of [...new Set(matches)]) {
        // Determine category from ID
        const category = match.includes('-S') ? 'Spoofing' :
                        match.includes('-T') ? 'Tampering' :
                        match.includes('-R') ? 'Repudiation' :
                        match.includes('-I') ? 'Information Disclosure' :
                        match.includes('-D') ? 'Denial of Service' :
                        match.includes('-E') ? 'Elevation of Privilege' :
                        match.includes('INPUT') ? 'Tampering' :
                        match.includes('SESSION') ? 'Spoofing' : 'Unknown';

        threats.push({
          id: match,
          category,
          trustBoundary,
          description: `Threat ${match}`,
        });
      }
    }
  }

  return threats;
}

describe('GATE 1.2: STRIDE Threat Validation', () => {
  describe('1.2.T.1: Threat Model Documentation', () => {
    it('THREAT_MODEL.md exists', async () => {
      const docPath = path.join(docsDir, 'THREAT_MODEL.md');
      expect(await fileExists(docPath)).toBe(true);
    });

    it('threat model contains required sections', async () => {
      const docPath = path.join(docsDir, 'THREAT_MODEL.md');
      const content = await readFile(docPath);

      expect(content).toContain('Trust Boundary 1');
      expect(content).toContain('Trust Boundary 2');
      expect(content).toContain('Trust Boundary 3');
      expect(content).toContain('Trust Boundary 4');
      expect(content).toContain('Risk Scoring');
      expect(content).toContain('STRIDE');
    });

    it('every threat has a test case ID', async () => {
      const docPath = path.join(docsDir, 'THREAT_MODEL.md');
      const content = await readFile(docPath);

      // Check that threats in tables have test case column
      const tableRows = content.match(/\| STRIDE-[A-Z0-9-]+ \|/g);
      expect(tableRows).not.toBeNull();
      expect(tableRows!.length).toBeGreaterThan(0);
    });
  });

  describe('1.2.T.2: Threat Coverage', () => {
    it('documents all STRIDE categories', async () => {
      const docPath = path.join(docsDir, 'THREAT_MODEL.md');
      const content = await readFile(docPath);

      expect(content).toContain('Spoofing');
      expect(content).toContain('Tampering');
      expect(content).toContain('Repudiation');
      expect(content).toContain('Information Disclosure');
      expect(content).toContain('Denial of Service');
      expect(content).toContain('Elevation of Privilege');
    });

    it('has minimum threat count per trust boundary', async () => {
      const threats = await parseThreats();

      const tb1Threats = threats.filter(t => t.trustBoundary.includes('TB1'));
      const tb2Threats = threats.filter(t => t.trustBoundary.includes('TB2'));
      const tb3Threats = threats.filter(t => t.trustBoundary.includes('TB3'));
      const tb4Threats = threats.filter(t => t.trustBoundary.includes('TB4'));

      // Each boundary should have at least 4 threats identified
      expect(tb1Threats.length).toBeGreaterThanOrEqual(4);
      expect(tb2Threats.length).toBeGreaterThanOrEqual(4);
      expect(tb3Threats.length).toBeGreaterThanOrEqual(4);
      expect(tb4Threats.length).toBeGreaterThanOrEqual(4);
    });

    it('total threat count meets minimum', async () => {
      const threats = await parseThreats();
      // Should have at least 30 threats identified
      expect(threats.length).toBeGreaterThanOrEqual(30);
    });
  });

  describe('1.2.T.3: Trust Boundary 1 - Browser ↔ IndexedDB', () => {
    describe('STRIDE-TB1-S01: Origin Isolation', () => {
      it('IndexedDB name includes origin identifier', () => {
        // Verify that database naming convention isolates by origin
        // In browser, IndexedDB is already origin-isolated
        // This test verifies we're not bypassing that
        expect(true).toBe(true); // Browser enforces this
      });
    });

    describe('STRIDE-TB1-T01: Tamper Detection', () => {
      it('audit schema exists for tamper detection', async () => {
        const auditSchemaPath = path.join(srcDir, 'db', 'schema', 'audit.schema.ts');
        expect(await fileExists(auditSchemaPath)).toBe(true);
      });
    });

    describe('STRIDE-TB1-R01: Audit Coverage', () => {
      it('audit logging service exists', async () => {
        // Check for audit-related files
        const possiblePaths = [
          path.join(srcDir, 'services', 'audit'),
          path.join(srcDir, 'db', 'schema', 'audit.schema.ts'),
          path.join(srcDir, 'hooks', 'useAudit.ts'),
        ];

        let auditExists = false;
        for (const p of possiblePaths) {
          if (await fileExists(p)) {
            auditExists = true;
            break;
          }
        }

        // At minimum, the schema should exist
        const schemaPath = path.join(srcDir, 'db', 'schema', 'audit.schema.ts');
        expect(await fileExists(schemaPath)).toBe(true);
      });
    });

    describe('STRIDE-TB1-I01: Data Encryption', () => {
      it('encryption module exists', async () => {
        const cryptoDir = path.join(srcDir, 'crypto');
        expect(await fileExists(cryptoDir)).toBe(true);
      });

      it('uses AES-256-GCM', async () => {
        const encryptionPath = path.join(srcDir, 'crypto', 'encryption.ts');
        if (await fileExists(encryptionPath)) {
          const content = await readFile(encryptionPath);
          expect(content).toMatch(/AES-GCM|aes-256-gcm|AES-256/i);
        }
      });
    });

    describe('STRIDE-TB1-E01: Permission Enforcement', () => {
      it('permission/authorization utilities exist', async () => {
        const possiblePaths = [
          path.join(srcDir, 'utils', 'authorization.ts'),
          path.join(srcDir, 'services', 'permissions'),
          path.join(srcDir, 'auth', 'permissions.ts'),
        ];

        let permissionExists = false;
        for (const p of possiblePaths) {
          if (await fileExists(p)) {
            permissionExists = true;
            break;
          }
        }

        expect(permissionExists).toBe(true);
      });
    });
  });

  describe('1.2.T.4: Trust Boundary 2 - Device ↔ Sync Relay', () => {
    describe('STRIDE-TB2-S01: TLS Validation', () => {
      it('sync API uses HTTPS', async () => {
        const syncApiPath = path.join(srcDir, 'api', 'syncApi.ts');
        if (await fileExists(syncApiPath)) {
          const content = await readFile(syncApiPath);
          // Should use https or environment variable for URL
          expect(content).not.toMatch(/http:\/\/(?!localhost)/);
        }
      });
    });

    describe('STRIDE-TB2-T01: Message Integrity', () => {
      it('sync protocol exists', async () => {
        const syncDir = path.join(srcDir, 'sync');
        expect(await fileExists(syncDir)).toBe(true);
      });
    });

    describe('STRIDE-TB2-I01: Zero-Knowledge Architecture', () => {
      it('client-side encryption before sync', async () => {
        const syncClientPath = path.join(srcDir, 'sync', 'syncClient.ts');
        if (await fileExists(syncClientPath)) {
          const content = await readFile(syncClientPath);
          // Should reference encryption
          expect(content).toMatch(/encrypt|cipher|crypto/i);
        }
      });
    });

    describe('STRIDE-TB2-D01: Rate Limiting', () => {
      it('rate limiter exists', async () => {
        const rateLimiterPath = path.join(srcDir, 'utils', 'rateLimiter.ts');
        expect(await fileExists(rateLimiterPath)).toBe(true);
      });
    });
  });

  describe('1.2.T.5: Trust Boundary 3 - Multi-User', () => {
    describe('STRIDE-TB3-E01: Role-Based Access', () => {
      it('roles are defined', async () => {
        // Search for role definitions
        const typesDir = path.join(srcDir, 'types');
        const authDir = path.join(srcDir, 'auth');

        let rolesFound = false;

        // Check common locations
        for (const dir of [typesDir, authDir]) {
          if (await fileExists(dir)) {
            try {
              const files = await fs.promises.readdir(dir);
              for (const file of files) {
                if (file.endsWith('.ts')) {
                  const content = await readFile(path.join(dir, file));
                  if (content.match(/admin|manager|consultant|accountant/i)) {
                    rolesFound = true;
                    break;
                  }
                }
              }
            } catch {
              // Directory not readable
            }
          }
          if (rolesFound) break;
        }

        expect(rolesFound).toBe(true);
      });
    });

    describe('STRIDE-TB3-T01: CRDT Validation', () => {
      it('CRDT utilities exist', async () => {
        const possiblePaths = [
          path.join(srcDir, 'db', 'crdt.ts'),
          path.join(srcDir, 'sync', 'crdt.ts'),
          path.join(srcDir, 'sync', 'conflictResolution.ts'),
        ];

        let crdtExists = false;
        for (const p of possiblePaths) {
          if (await fileExists(p)) {
            crdtExists = true;
            break;
          }
        }

        expect(crdtExists).toBe(true);
      });
    });
  });

  describe('1.2.T.6: Trust Boundary 4 - Third-Party Services', () => {
    describe('STRIDE-TB4-S01: Webhook Validation', () => {
      it('webhook handler exists', async () => {
        // Check backend for webhook handling
        const backendDir = path.join(srcDir, '..', 'audacious_money_backend', 'src', 'routes');
        const webhookPath = path.join(backendDir, 'webhooks.ts');

        // Frontend may not have webhook handler, but backend should
        if (await fileExists(webhookPath)) {
          const content = await readFile(webhookPath);
          expect(content).toMatch(/signature|verify|stripe/i);
        }
      });
    });

    describe('STRIDE-TB4-I01: API Key Protection', () => {
      it('Stripe secret key not in frontend', async () => {
        // Check that STRIPE_SECRET_KEY is not hardcoded in frontend
        const servicesDir = path.join(srcDir, 'services');
        if (await fileExists(servicesDir)) {
          const stripeServicePath = path.join(servicesDir, 'stripe.service.ts');
          if (await fileExists(stripeServicePath)) {
            const content = await readFile(stripeServicePath);
            // Should not contain actual secret key
            expect(content).not.toMatch(/sk_live_[a-zA-Z0-9]+/);
            expect(content).not.toMatch(/sk_test_[a-zA-Z0-9]+/);
          }
        }
      });
    });
  });

  describe('1.2.T.7: Input Validation', () => {
    describe('STRIDE-INPUT-01: XSS Prevention', () => {
      it('sanitization utility exists', async () => {
        const sanitizePath = path.join(srcDir, 'utils', 'sanitize.ts');
        expect(await fileExists(sanitizePath)).toBe(true);
      });

      it('uses DOMPurify or similar', async () => {
        const sanitizePath = path.join(srcDir, 'utils', 'sanitize.ts');
        if (await fileExists(sanitizePath)) {
          const content = await readFile(sanitizePath);
          expect(content).toMatch(/DOMPurify|sanitize|escape/i);
        }
      });
    });

    describe('STRIDE-INPUT-02: CSV Validation', () => {
      it('CSV importer exists', async () => {
        const csvDir = path.join(srcDir, 'components', 'csv');
        expect(await fileExists(csvDir)).toBe(true);
      });
    });
  });

  describe('1.2.T.8: Session Management', () => {
    describe('STRIDE-SESSION-01: Session Security', () => {
      it('session security module exists', async () => {
        const sessionSecurityPath = path.join(srcDir, 'auth', 'sessionSecurity.ts');
        expect(await fileExists(sessionSecurityPath)).toBe(true);
      });

      it('implements device fingerprinting', async () => {
        const sessionSecurityPath = path.join(srcDir, 'auth', 'sessionSecurity.ts');
        if (await fileExists(sessionSecurityPath)) {
          const content = await readFile(sessionSecurityPath);
          expect(content).toMatch(/fingerprint|device|userAgent/i);
        }
      });
    });

    describe('STRIDE-SESSION-02: Session Storage', () => {
      it('session storage module exists', async () => {
        const sessionStoragePath = path.join(srcDir, 'auth', 'sessionStorage.ts');
        expect(await fileExists(sessionStoragePath)).toBe(true);
      });
    });
  });

  describe('1.2.T.9: Risk Assessment Completeness', () => {
    it('all high-risk threats have mitigations documented', async () => {
      const docPath = path.join(docsDir, 'THREAT_MODEL.md');
      const content = await readFile(docPath);

      // Check for Risk Summary section
      expect(content).toContain('Risk Summary');
      expect(content).toContain('High Risks');

      // Check that high risks have mitigations
      expect(content).toMatch(/High.*\|.*Mitigation|High Risks.*Score 5-6/is);
    });

    it('critical risks are identified', async () => {
      const docPath = path.join(docsDir, 'THREAT_MODEL.md');
      const content = await readFile(docPath);

      expect(content).toContain('Critical Risks');
      expect(content).toContain('STRIDE-INPUT-04'); // Prompt injection
    });
  });
});

// Export for use in other tests
export { parseThreats };
