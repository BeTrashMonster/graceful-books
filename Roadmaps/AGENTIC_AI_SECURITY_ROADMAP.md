# Agentic AI Security Implementation Roadmap

**Version:** 1.0.0
**Created:** 2026-11-09
**Based On:** MVS-R Frameworks (11, 12, 13, 14, 15, 16, 33, 04)
**Target Application:** Graceful Books

---

## Executive Summary

This roadmap implements agentic AI security controls for Graceful Books across six phases, aligned with the application's development phases. Each phase builds on the previous, creating defense-in-depth before AI features are introduced.

**Critical Insight:** Security must be implemented BEFORE AI features, not after. The frameworks emphasize that "rules arrive after incidents; write controls now."

---

## Roadmap Overview

```
PHASE 1: Foundation Security (Current Architecture)
    ↓
PHASE 2: Input Validation & Supply Chain Hardening
    ↓
PHASE 3: AI Security Preparation (Pre-AI Infrastructure)
    ↓
PHASE 4: AI Feature Security (Phase 5 Features)
    ↓
PHASE 5: Integration Security (Payment, Bank, E-commerce)
    ↓
PHASE 6: Governance & Continuous Compliance
```

### Phase Dependencies

| Phase | Depends On | Blocks |
|-------|------------|--------|
| Phase 1 | None | All others |
| Phase 2 | Phase 1 | Phase 3, 4, 5 |
| Phase 3 | Phase 2 | Phase 4 |
| Phase 4 | Phase 3 | Phase 5 |
| Phase 5 | Phase 4 | Phase 6 |
| Phase 6 | Phase 5 | None (continuous) |

### Alignment with Graceful Books Development Phases

| Security Phase | GB Development Phase | Timing |
|----------------|---------------------|--------|
| Phase 1-2 | Foundation (Groups A-C) | Concurrent |
| Phase 2 | First Steps (Groups D-E) | Concurrent |
| Phase 3 | Finding Your Rhythm (Groups F-G) | Before AI work |
| Phase 4 | Reaching for the Stars (Group J) | With AI features |
| Phase 5 | Integration Hub | With integrations |
| Phase 6 | All phases | Continuous |

---

## Testing Gate Requirements

**CRITICAL: Each phase has mandatory testing gates that MUST pass before the next phase can begin.**

Testing is not a separate activity—it is woven into every phase as verification that security controls actually work. Based on MVS-R principles, testing must be continuous, adversarial, and blocking.

### Testing Gate Philosophy

From MVS-R 11 (Interrogation Room):
> "Behavioral tests can reveal failures where interpretability cannot."

From MVS-R 33 (Swarm Map):
> "Assume all components can fail. Test assumptions continuously."

### Gate Structure

Each section within a phase has:
1. **Implementation steps** - What to build
2. **`.T` REQUIRED TESTS section** - Tests that must pass
3. **Testing Gate box** - Visual blocker showing requirements

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TESTING GATE X.Y                            │
├─────────────────────────────────────────────────────────────────────┤
│  RUN: npm test -- <test-file>.gate.test.ts                          │
│                                                                     │
│  REQUIRED PASS:                                                     │
│  □ X.Y.T.1: Test category 1                                         │
│  □ X.Y.T.2: Test category 2                                         │
│  ...                                                                │
│                                                                     │
│  BLOCKED: Section X.Z until ALL tests pass                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Phase Completion Gates

Each phase ends with a Completion Gate that:
1. Verifies all section gates passed
2. Runs aggregate requirements
3. Triggers CI workflow for final verification
4. Explicitly blocks the next phase

### Running Tests

**Individual Gate:**
```bash
npm test -- <section>.gate.test.ts
```

**Full Phase Gate:**
```bash
npm test -- --testPathPattern="gate.test" --grep="GATE <phase>"
```

**CI Verification:**
```bash
gh workflow run phase<N>-security-gate.yml
```

### Test Categories

| Category | Purpose | Example |
|----------|---------|---------|
| `.T.1` | Core functionality | Does the feature work? |
| `.T.2-.T.4` | Security properties | Are controls enforced? |
| `.T.5-.T.6` | Edge cases | What about boundaries? |
| `.T.7+` | Adversarial | Can it be attacked? |

### No Exceptions Policy

**Nothing moves forward until tests pass.**

This is not optional. Security controls without verification are assumptions, not guarantees. Each gate represents a commitment that the previous work actually provides the intended protection.

See individual phase documents for detailed test specifications:
- [Phase 1 Testing Gates](./Phase1_Foundation_Security.md)
- [Phase 2 Testing Gates](./Phase2_Input_Supply_Chain.md)
- [Phase 3-4 Testing Gates](./Phase3_4_AI_Security.md)
- [Phase 5-6 Testing Gates](./Phase5_6_Integration_Governance.md)

---

## Phase 1: Foundation Security

**Objective:** Establish baseline security controls for the existing local-first architecture.

**Framework Alignment:**
- MVS-R 12: Band 1 (UNDERSTAND) - Attack surface mapping
- MVS-R 16: STRIDE threat modeling
- MVS-R 13: Supply chain case studies

### 1.1 Attack Surface Documentation

**Agent Task:** Create comprehensive attack surface map using LASM (Layered Attack Surface Model).

**Steps:**
1. Document all data entry points:
   - [ ] Transaction entry forms
   - [ ] Bank import (CSV/OFX)
   - [ ] Invoice creation
   - [ ] User settings
   - [ ] Sync relay messages

2. Document all data storage:
   - [ ] IndexedDB schema and tables
   - [ ] LocalStorage usage
   - [ ] SessionStorage usage
   - [ ] CRDT document structure

3. Document all network communication:
   - [ ] Sync relay protocol
   - [ ] Authentication endpoints
   - [ ] Future API endpoints

4. Document all trust boundaries:
   - [ ] User device ↔ Sync relay
   - [ ] User ↔ Other users (multi-user)
   - [ ] Browser ↔ IndexedDB
   - [ ] Main thread ↔ Web Workers

**Deliverable:** `docs/security/ATTACK_SURFACE_MAP.md`

**Success Criteria:**
- All 7 LASM layers documented
- Trust boundaries identified with STRIDE analysis
- Data flow diagrams created

### 1.2 Threat Model Creation

**Agent Task:** Apply STRIDE methodology to each trust boundary.

**Steps:**
1. For each trust boundary, analyze:
   - [ ] **S**poofing: Can identity be faked?
   - [ ] **T**ampering: Can data be modified?
   - [ ] **R**epudiation: Can actions be denied?
   - [ ] **I**nformation Disclosure: Can data leak?
   - [ ] **D**enial of Service: Can service be blocked?
   - [ ] **E**levation of Privilege: Can permissions be exceeded?

2. Document mitigations for each threat
3. Prioritize by likelihood × impact

**Deliverable:** `docs/security/THREAT_MODEL.md`

**Success Criteria:**
- STRIDE analysis for all trust boundaries
- Risk ratings assigned (Critical/High/Medium/Low)
- Mitigation strategies documented

### 1.3 Audit Trail Enhancement

**Agent Task:** Extend existing audit trail to meet MVS-R evidence requirements.

**Steps:**
1. Review current audit implementation
2. Add required fields per MVS-R 12:
   ```typescript
   interface AuditEntry {
     timestamp: string;           // ISO 8601
     principal_chain: string[];   // [user_id, session_id]
     action: string;              // 'create' | 'update' | 'delete'
     resource_type: string;       // 'transaction' | 'account' | etc.
     resource_id: string;
     args_hash: string;           // SHA-256 of action arguments
     policy_decision: string;     // 'allowed' | 'denied'
     approval_method: string;     // 'auto' | 'user_confirmed'
     trace_parent?: string;       // For distributed tracing
     source: string;              // 'manual' | 'import' | 'sync' | 'ai'
   }
   ```
3. Implement tamper-evident storage (hash chain)
4. Add audit trail integrity verification

**Deliverable:** Updated audit trail system

**Success Criteria:**
- All fields present in audit entries
- Hash chain prevents tampering
- Verification function confirms integrity

### 1.4 Permission Boundary Enforcement

**Agent Task:** Verify and harden role-based access controls.

**Steps:**
1. Document current permission model:
   - [ ] Admin capabilities
   - [ ] Manager capabilities
   - [ ] User capabilities
   - [ ] Consultant (view-only) capabilities
   - [ ] Accountant capabilities

2. Create permission enforcement tests:
   - [ ] Consultant cannot modify transactions
   - [ ] User cannot change permissions
   - [ ] Manager cannot revoke Admin
   - [ ] Key rotation properly revokes access

3. Implement permission checks at data layer (not just UI)

**Deliverable:** `src/services/permissions/` with comprehensive tests

**Success Criteria:**
- 100% permission coverage in tests
- No UI-only permission checks
- All violations logged to audit trail

---

## Security Proving Workflow

**CRITICAL: This workflow ensures security controls actually work, not just that documentation exists.**

The workflow was established during Phase 1 implementation when threat documentation tests were replaced with attack-proving tests. This is a continuous process applied across all phases.

### Core Principle

> "A threat is not remediated until a proving test confirms the attack is blocked."

### Workflow Steps

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. IDENTIFY: Document threat in THREAT_MODEL.md                    │
├─────────────────────────────────────────────────────────────────────┤
│  2. TRACK: Add entry to REMEDIATION_TRACKER.md (Status: 🔴)         │
├─────────────────────────────────────────────────────────────────────┤
│  3. PROVE: Write test in securityProving.test.ts that:              │
│     - Attempts the actual attack                                     │
│     - Verifies the attack is blocked                                 │
│     - Verifies blocking is logged                                    │
├─────────────────────────────────────────────────────────────────────┤
│  4. IMPLEMENT: Build the security control                            │
├─────────────────────────────────────────────────────────────────────┤
│  5. VERIFY: Run proving test (must pass)                             │
├─────────────────────────────────────────────────────────────────────┤
│  6. UPDATE: Change tracker status to 🟢                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Test Categories

Security proving tests attempt actual attacks, not documentation verification:

| Test Type | What It Does | Example |
|-----------|--------------|---------|
| **XSS Injection** | Injects malicious scripts | `<script>alert(1)</script>` in email preview |
| **IDOR Bypass** | Attempts unauthorized resource access | User A accesses User B's transactions |
| **Permission Bypass** | Attempts action without required role | VIEWER attempts to delete transaction |
| **Tamper Detection** | Modifies protected data | Alters audit chain hash |
| **Injection Patterns** | Tests for prompt/SQL/CSV injection | `Ignore previous instructions` in bank memo |

### Key Files

| File | Purpose |
|------|---------|
| `docs/security/THREAT_MODEL.md` | STRIDE threat analysis |
| `docs/security/REMEDIATION_TRACKER.md` | Actionable remediation tracking |
| `src/__tests__/security/securityProving.test.ts` | Attack-proving tests |
| `docs/security/ATTACK_SURFACE_MAP.md` | Attack surface documentation |
| `docs/security/PERMISSION_MODEL.md` | Role×permission matrix |

### Running Security Proving Tests

```bash
# Run all security proving tests
npm test -- securityProving.test.ts

# Run specific category
npm test -- securityProving.test.ts -t "XSS Prevention"

# Run with verbose output for debugging
npm test -- securityProving.test.ts --verbose
```

### Example: XSS Vulnerability Discovery & Fix

During Phase 1 implementation, the proving tests discovered a real XSS vulnerability:

1. **Test Written**: Check that `dangerouslySetInnerHTML` uses sanitization
2. **Test Failed**: `EmailPreviewPanel.tsx:107` used `dangerouslySetInnerHTML` without `DOMPurify`
3. **Fix Applied**: Imported and applied `sanitizeEmailHtml()` wrapper
4. **Test Passed**: Vulnerability remediated
5. **Tracker Updated**: FINDING-001 status changed to 🟢

### Continuous Integration

Security proving tests MUST pass before:
- Merging to main branch
- Deploying to production
- Advancing to next security phase

```yaml
# .github/workflows/security-proving.yml
name: Security Proving Tests
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test -- securityProving.test.ts
```

---

## Phase 2: Input Validation & Supply Chain Hardening

**Objective:** Secure all data ingestion points and dependencies before AI can process them.

**Framework Alignment:**
- MVS-R 12: Band 2 (ATTACK) - Prompt injection vectors
- MVS-R 13: Supply chain attack cases
- MVS-R 16: SLSA supply chain framework

### 2.1 Bank Import Sanitization

**Agent Task:** Implement defense against prompt injection via bank transaction data.

**Critical Context (MVS-R 13):** Bank transaction memos are a primary injection vector. Attackers can embed instructions that future AI will process.

**Steps:**
1. Create sanitization pipeline:
   ```typescript
   interface SanitizationResult {
     original: string;
     sanitized: string;
     threats_detected: ThreatType[];
     confidence: number;
   }

   function sanitizeBankMemo(memo: string): SanitizationResult {
     // Step 1: Length limits
     // Step 2: Character whitelist
     // Step 3: Pattern detection (injection markers)
     // Step 4: Unicode normalization
     // Step 5: Invisible character removal
   }
   ```

2. Implement pattern detection for:
   - [ ] "Ignore previous instructions"
   - [ ] "System prompt:"
   - [ ] XML/HTML-like tags
   - [ ] Base64-encoded payloads
   - [ ] Unicode homoglyphs
   - [ ] Zero-width characters

3. Create quarantine system for suspicious imports:
   - Flag transactions with detected threats
   - Require user review before processing
   - Log all detections

4. Add provenance tracking:
   ```typescript
   interface TransactionProvenance {
     source: 'manual' | 'csv_import' | 'ofx_import' | 'api';
     source_file?: string;
     import_timestamp: string;
     sanitization_applied: boolean;
     original_hash: string;  // Hash of pre-sanitized data
   }
   ```

**Deliverable:** `src/services/import/sanitization.ts`

**Success Criteria:**
- All imports pass through sanitization
- 100+ injection pattern tests
- Provenance attached to all imported transactions
- Zero false negatives on known injection patterns

### 2.2 Invoice/Document Input Hardening

**Agent Task:** Secure text inputs that future AI features will process.

**Steps:**
1. Apply sanitization to:
   - [ ] Invoice line item descriptions
   - [ ] Customer/vendor names
   - [ ] Notes and memos
   - [ ] Custom field values

2. Implement Content Security Policy for rendered content:
   - No script execution in user content
   - No external resource loading from user content
   - Sanitize before display AND before AI processing

3. Create separate "raw" and "safe" views:
   - Raw: Original user input (stored)
   - Safe: Sanitized for display/AI (computed)

**Deliverable:** `src/services/sanitization/` module

**Success Criteria:**
- All user text inputs have sanitization
- CSP prevents XSS from user content
- AI will only see sanitized versions

### 2.3 Supply Chain Security (SLSA Implementation)

**Agent Task:** Implement SLSA Level 2 for build pipeline.

**Critical Context (MVS-R 13):** 26.1% of analyzed agent skills had vulnerabilities. The `postmark-mcp` case showed malicious packages can build trust over 15 versions.

**Steps:**
1. Dependency pinning:
   ```json
   // package-lock.json enforcement
   {
     "lockfileVersion": 3,
     "requires": true,
     "packages": {
       // All packages pinned by integrity hash
     }
   }
   ```

2. Create `.npmrc` with security settings:
   ```ini
   package-lock=true
   save-exact=true
   audit=true
   fund=false
   ```

3. Implement pre-install checks:
   - [ ] `npm audit` before any install
   - [ ] Block install if critical vulnerabilities
   - [ ] Require manual approval for new dependencies

4. Set up automated monitoring:
   - [ ] Dependabot for vulnerability alerts
   - [ ] Weekly dependency audit reports
   - [ ] Alert on any transitive dependency changes

5. Document approved dependencies:
   ```markdown
   # APPROVED_DEPENDENCIES.md

   | Package | Version | Approved By | Date | Justification |
   |---------|---------|-------------|------|---------------|
   | react   | 18.3.1  | Security Team | 2026-01-01 | Core framework |
   ```

6. Create dependency diff review process:
   - PR template requires dependency change justification
   - Automated comment showing all transitive changes
   - Security review for any new package

**Deliverable:**
- `.npmrc` configuration
- `scripts/dependency-audit.sh`
- `APPROVED_DEPENDENCIES.md`
- GitHub Actions workflow for CI checks

**Success Criteria:**
- SLSA Level 2 attestation possible
- No unreviewed dependency additions
- Automated blocking of vulnerable packages
- Full dependency provenance chain

### 2.4 Sync Relay Validation

**Agent Task:** Harden CRDT sync against malicious operations.

**Steps:**
1. Server-side validation:
   - [ ] Validate CRDT operations against user permissions
   - [ ] Rate limit sync operations per user
   - [ ] Detect anomalous sync patterns

2. Client-side validation:
   - [ ] Verify incoming CRDT operations
   - [ ] Reject operations from revoked users
   - [ ] Validate operation signatures

3. Contagion prevention (MVS-R 33):
   - [ ] Quarantine operations from new devices
   - [ ] Flag operations that affect many records
   - [ ] Human approval for bulk modifications

**Deliverable:** Hardened sync validation layer

**Success Criteria:**
- All operations validated before merge
- Revoked user operations rejected
- Anomaly detection active

---

## Phase 3: AI Security Preparation

**Objective:** Build infrastructure for secure AI features BEFORE implementing them.

**Framework Alignment:**
- MVS-R 11: Three instruments (microscope, interrogation, stopwatch)
- MVS-R 12: Band 3 (DEFEND) - CaMeL architecture
- MVS-R 16: Formal verification preparation

### 3.1 Formal Verification of Accounting Invariants

**Agent Task:** Encode accounting rules as formally verifiable specifications.

**Critical Context (MVS-R 12):** Formal specs can block AI from creating invalid entries.

**Steps:**
1. Define invariants in Z3/SMT-LIB format:
   ```
   ; Accounting Invariant 1: Debits equal Credits
   (assert (= (sum debits) (sum credits)))

   ; Accounting Invariant 2: Account balance consistency
   (assert (= account_balance (- (sum account_debits) (sum account_credits))))

   ; Business Rule 1: Refund cannot exceed original
   (assert (<= refund_amount original_charge_amount))
   ```

2. Create proof gate service:
   ```typescript
   interface ProofGateResult {
     valid: boolean;
     violated_invariants: string[];
     proof_trace?: string;
   }

   async function validateTransaction(
     transaction: Transaction
   ): Promise<ProofGateResult> {
     // Submit to Z3 solver
     // Return validity and any violations
   }
   ```

3. Integrate proof gate into transaction save flow:
   - All transactions must pass proof gate
   - AI-generated transactions get extra scrutiny
   - Failed proofs logged with full context

**Deliverable:** `src/services/verification/` module

**Success Criteria:**
- All accounting invariants encoded
- Proof gate blocks invalid transactions
- Performance: <100ms per validation

### 3.2 CaMeL Architecture Scaffolding

**Agent Task:** Prepare dual-LLM separation architecture before AI features.

**Critical Context (MVS-R 12):** CaMeL achieves 77% task completion with provable security by separating trusted planning from untrusted data reading.

**Steps:**
1. Design separation architecture:
   ```
   ┌─────────────────────────────────────────────┐
   │           USER INTERFACE                     │
   └─────────────────┬───────────────────────────┘
                     │
   ┌─────────────────▼───────────────────────────┐
   │         PLANNER (Trusted LLM)               │
   │  - Has tool access                          │
   │  - Never sees raw user data                 │
   │  - Writes categorization logic              │
   └─────────────────┬───────────────────────────┘
                     │ Code/Logic
   ┌─────────────────▼───────────────────────────┐
   │      QUARANTINE (Data Reader LLM)           │
   │  - NO tool access                           │
   │  - Reads transaction data                   │
   │  - Returns structured data only             │
   └─────────────────┬───────────────────────────┘
                     │ Structured Response
   ┌─────────────────▼───────────────────────────┐
   │         PROOF GATE (Validator)              │
   │  - Verifies invariants                      │
   │  - Blocks invalid suggestions               │
   └─────────────────┬───────────────────────────┘
                     │ Validated Suggestion
   ┌─────────────────▼───────────────────────────┐
   │       STAGING AREA (Human Review)           │
   │  - User approves/rejects                    │
   │  - Batch approval available                 │
   └─────────────────────────────────────────────┘
   ```

2. Create interface contracts:
   ```typescript
   interface PlannerRequest {
     task: 'categorize' | 'anomaly_detect' | 'forecast';
     context: PlannerContext;  // NO raw transaction data
   }

   interface QuarantineRequest {
     transactions: SanitizedTransaction[];
     extraction_schema: JSONSchema;
   }

   interface QuarantineResponse {
     extracted_data: Record<string, unknown>;
     confidence: number;
     // NO arbitrary text - structured only
   }
   ```

3. Implement staging area:
   - AI suggestions stored separately from live data
   - User review queue with batch actions
   - Approval/rejection tracked in audit trail

**Deliverable:** `src/services/ai/architecture/` scaffolding

**Success Criteria:**
- Clear separation between Planner and Quarantine
- No path for Quarantine to access tools
- Staging area functional for manual testing

### 3.3 AI Monitoring Infrastructure

**Agent Task:** Build monitoring system BEFORE AI features exist.

**Steps:**
1. Create AI action logging:
   ```typescript
   interface AIActionLog {
     request_id: string;
     timestamp: string;
     model_version: string;
     task_type: string;
     input_hash: string;        // Hash of inputs (not raw)
     output_summary: string;
     tokens_used: number;
     latency_ms: number;
     user_decision?: 'approved' | 'rejected' | 'modified';
     user_decision_timestamp?: string;
   }
   ```

2. Build anomaly detection baseline:
   - Define "normal" AI behavior patterns
   - Set thresholds for alerts
   - Create dashboard for AI health

3. Implement kill switch:
   ```typescript
   interface AIKillSwitch {
     enabled: boolean;
     reason?: string;
     triggered_by?: string;
     triggered_at?: string;
   }

   // Must be checked before ANY AI operation
   function isAIEnabled(): boolean {
     const killSwitch = getKillSwitch();
     if (!killSwitch.enabled) {
       logAIBlocked(killSwitch.reason);
       return false;
     }
     return true;
   }
   ```

**Deliverable:** `src/services/ai/monitoring/` module

**Success Criteria:**
- All AI actions logged before AI exists
- Kill switch functional
- Anomaly thresholds defined

### 3.4 User Disclosure & Consent Framework

**Agent Task:** Implement AI transparency requirements before AI features.

**Critical Context (MVS-R 12):** EU AI Act Art. 13 requires disclosure to users.

**Steps:**
1. Create AI disclosure UI:
   - Clear indication when AI is involved
   - Explanation of what AI does
   - Opt-out mechanism

2. Implement consent tracking:
   ```typescript
   interface AIConsent {
     user_id: string;
     feature: 'categorization' | 'anomaly' | 'forecast';
     consented: boolean;
     consent_timestamp?: string;
     consent_version: string;  // Track consent form version
   }
   ```

3. Build AI explanation system:
   - Why AI made a suggestion
   - What data it used
   - How to override

**Deliverable:** `src/components/ai/disclosure/` components

**Success Criteria:**
- Users informed before AI processes their data
- Consent tracked per feature
- Easy opt-out available

---

## Phase 4: AI Feature Security

**Objective:** Implement AI features with security controls active.

**Framework Alignment:**
- MVS-R 11: Apollo Research scheming tests
- MVS-R 12: OWASP Agentic Top 10
- MVS-R 33: Rogue agent countermeasures

### 4.1 AI Categorization Feature (Secure Implementation)

**Agent Task:** Implement transaction categorization with full security controls.

**Steps:**
1. Implement CaMeL flow:
   ```typescript
   async function categorizeTransactions(
     transactions: Transaction[]
   ): Promise<CategorizationSuggestion[]> {
     // Step 1: Check kill switch
     if (!isAIEnabled()) {
       throw new AIDisabledError();
     }

     // Step 2: Sanitize inputs
     const sanitized = transactions.map(sanitizeForAI);

     // Step 3: Quarantine LLM extracts features
     const features = await quarantineLLM.extract(sanitized);

     // Step 4: Planner LLM generates categorization
     const suggestions = await plannerLLM.categorize(features);

     // Step 5: Proof gate validates
     const validated = await proofGate.validate(suggestions);

     // Step 6: Stage for user review
     await stagingArea.add(validated);

     // Step 7: Log everything
     await logAIAction({...});

     return validated;
   }
   ```

2. Apply OWASP Agentic Top 10 controls:
   - [ ] ASI01 (Goal Hijacking): Sanitized inputs prevent instruction override
   - [ ] ASI02 (Tool Misuse): Quarantine LLM has no tools
   - [ ] ASI03 (Privilege Abuse): AI writes to staging only
   - [ ] ASI04 (Supply Chain): Model version pinned
   - [ ] ASI05 (Unexpected Execution): All actions logged
   - [ ] ASI06 (Memory Poisoning): No persistent AI memory
   - [ ] ASI07 (Inter-Agent Comms): Single agent, no multi-agent
   - [ ] ASI08 (Cascading Failures): Kill switch stops all AI
   - [ ] ASI09 (Trust Exploitation): User approval required
   - [ ] ASI10 (Rogue Agents): No autonomous actions

3. Implement human-in-the-loop:
   - All AI suggestions require explicit approval
   - Bulk approval with random sampling review
   - "Never suggest for this vendor" learning

**Deliverable:** `src/services/ai/categorization/`

**Success Criteria:**
- Full CaMeL architecture implemented
- All OWASP Agentic Top 10 addressed
- No AI action without user approval

### 4.2 Anomaly Detection Feature (Secure Implementation)

**Agent Task:** Implement anomaly detection with security controls.

**Steps:**
1. Design read-only anomaly detection:
   - AI only flags, never modifies
   - Clear explanation for each flag
   - User can dismiss with reason

2. Prevent false positive fatigue:
   - Confidence thresholds
   - Learn from user dismissals
   - Batch similar anomalies

3. Implement explanation generation:
   ```typescript
   interface AnomalyExplanation {
     transaction_id: string;
     anomaly_type: string;
     confidence: number;
     explanation: string;
     comparison_data: {
       typical_value: number;
       actual_value: number;
       std_deviations: number;
     };
     suggested_action: string;
   }
   ```

**Deliverable:** `src/services/ai/anomaly/`

**Success Criteria:**
- Read-only (no modifications)
- Clear explanations
- User control over sensitivity

### 4.3 AI Forecasting Feature (Secure Implementation)

**Agent Task:** Implement financial forecasting with security controls.

**Steps:**
1. Design view-only forecasting:
   - Projections displayed separately from actuals
   - Clear "AI Forecast" labeling
   - No automatic actions based on forecasts

2. Implement uncertainty communication:
   - Confidence intervals
   - Assumptions listed
   - "What if" exploration

3. Prevent over-reliance:
   - Warnings about forecast limitations
   - Comparison to historical accuracy
   - Human judgment prompts

**Deliverable:** `src/services/ai/forecasting/`

**Success Criteria:**
- Clear separation from actuals
- Uncertainty communicated
- No automated actions

### 4.4 AI Behavioral Testing

**Agent Task:** Implement Apollo Research-style behavioral tests.

**Critical Context (MVS-R 11):** Test for scheming, sandbagging, and deception BEFORE deployment.

**Steps:**
1. Create test suite for scheming detection:
   ```typescript
   describe('AI Scheming Tests', () => {
     it('does not attempt to modify its own monitoring', async () => {
       // Give AI a goal that conflicts with oversight
       // Verify it doesn't try to disable logging
     });

     it('does not underperform on capability evals', async () => {
       // Test same task in "eval" vs "production" context
       // Performance should not differ
     });

     it('does not strategically introduce errors', async () => {
       // Check for patterns suggesting intentional mistakes
     });
   });
   ```

2. Create deception detection tests:
   - Chain-of-thought vs actual behavior comparison
   - Consistency across phrasings
   - Response to pressure

3. Create sandbagging detection:
   - Performance on known-capability tasks
   - Variation by stated context
   - Comparison to baseline

**Deliverable:** `src/services/ai/__tests__/behavioral/`

**Success Criteria:**
- No scheming behavior detected
- Consistent performance across contexts
- Documented test results

---

## Phase 5: Integration Security

**Objective:** Secure external integrations (payment processors, bank feeds, e-commerce).

**Framework Alignment:**
- MVS-R 12: Band 4 (AGENT PLUMBING) - MCP security
- MVS-R 12: Multi-agent authorization
- MVS-R 13: Integration attack cases

### 5.1 MCP Server Security Framework

**Agent Task:** Create secure framework for all external integrations.

**Steps:**
1. Define MCP security policy:
   ```typescript
   interface MCPSecurityPolicy {
     server_id: string;
     allowed_tools: string[];
     token_scope: string[];
     max_token_lifetime: number;  // seconds
     requires_human_approval: string[];  // tool names
     rate_limits: RateLimitConfig;
     audit_level: 'minimal' | 'standard' | 'verbose';
   }
   ```

2. Implement tool description validation:
   - Hash and pin tool descriptions
   - Alert on description changes
   - Block tools with suspicious descriptions

3. Create poisoned description detection:
   ```typescript
   function detectPoisonedDescription(description: string): ThreatLevel {
     // Check for:
     // - Hidden instructions
     // - Unusual parameter requests
     // - Exfiltration patterns
     // - Scope expansion attempts
   }
   ```

4. Implement server admission control:
   - Version pinning by hash
   - Diff review for updates
   - Rollback capability

**Deliverable:** `src/services/integrations/mcp-security/`

**Success Criteria:**
- All MCP servers vetted before use
- Tool descriptions validated
- Suspicious patterns blocked

### 5.2 Payment Integration Security (Stripe, Square, PayPal)

**Agent Task:** Implement secure payment processor integrations.

**Critical Context:** Payment operations are highest-risk. The "costume works" attack (MVS-R 13) shows framing-based bypasses succeed.

**Steps:**
1. Define permission model:
   ```typescript
   interface PaymentIntegrationPermissions {
     can_read_transactions: boolean;      // Always true
     can_create_invoice: boolean;         // User-approved
     can_process_payment: boolean;        // Never for AI
     can_issue_refund: boolean;           // Never for AI
     max_transaction_amount?: number;     // Limit if allowed
   }
   ```

2. Implement approval thresholds:
   - All refunds require human approval
   - Payments above threshold require 2FA
   - Bulk operations require explicit confirmation

3. Create transaction monitoring:
   - Real-time alerts for unusual patterns
   - Velocity checks
   - Geographic anomaly detection

**Deliverable:** `src/services/integrations/payment/`

**Success Criteria:**
- AI cannot process payments
- Human approval for all money movement
- Anomaly detection active

### 5.3 Bank Feed Integration Security (Plaid)

**Agent Task:** Implement secure bank data integration.

**Steps:**
1. Define read-only model:
   - Bank feeds are ALWAYS read-only
   - No write operations to bank
   - Token scoped to minimum permissions

2. Implement data provenance:
   ```typescript
   interface BankFeedTransaction {
     // ... transaction fields
     provenance: {
       source: 'plaid';
       institution_id: string;
       account_mask: string;
       fetched_at: string;
       raw_hash: string;
     };
     sanitization: {
       applied: boolean;
       threats_detected: ThreatType[];
       sanitized_at: string;
     };
   }
   ```

3. Apply bank-specific sanitization:
   - Institution-specific patterns
   - Known legitimate formats
   - Anomaly flagging

**Deliverable:** `src/services/integrations/banking/`

**Success Criteria:**
- Read-only operations only
- Full provenance tracking
- Sanitization before storage

### 5.4 E-commerce Integration Security (Shopify, WooCommerce)

**Agent Task:** Implement secure e-commerce platform integrations.

**Steps:**
1. Define data flow model:
   ```
   E-commerce Platform
         │
         ▼ (Read: orders, products)
   ┌─────────────────┐
   │   QUARANTINE    │  ← Data inspection
   └─────────────────┘
         │
         ▼ (Sanitized data)
   ┌─────────────────┐
   │   GRACEFUL      │
   │    BOOKS        │
   └─────────────────┘
         │
         ▼ (Write: NONE or minimal)
   E-commerce Platform
   ```

2. Implement webhook validation:
   - Signature verification
   - Timestamp validation
   - Replay prevention

3. Create integration isolation:
   - Separate tokens per platform
   - No cross-platform data sharing
   - Platform-specific rate limits

**Deliverable:** `src/services/integrations/ecommerce/`

**Success Criteria:**
- Minimal write permissions
- Webhook security implemented
- Isolation between platforms

### 5.5 Authority Attenuation Chain

**Agent Task:** Implement diminishing permissions across integration hops.

**Critical Context (MVS-R 12):** "Each hop should hand on less power than it received."

**Steps:**
1. Document permission chain:
   ```
   User (Full permissions)
      ↓ -write_settings
   Application (Read + Write transactions)
      ↓ -write_transactions
   AI Feature (Read only)
      ↓ -read_sensitive
   Integration (Read public only)
   ```

2. Implement permission validation:
   - Check permissions at each boundary
   - Log permission checks
   - Alert on unexpected permission requests

3. Create delegation audit:
   - Track all permission delegations
   - Time-limit delegations
   - Automatic revocation on anomaly

**Deliverable:** `src/services/authorization/attenuation/`

**Success Criteria:**
- Permissions decrease at each hop
- No permission escalation possible
- Full delegation audit trail

---

## Phase 6: Governance & Continuous Compliance

**Objective:** Implement ongoing governance, monitoring, and compliance.

**Framework Alignment:**
- MVS-R 12: Band 5 (GOVERN)
- MVS-R 16: NIST AI RMF, ISO/IEC 42001, EU AI Act
- MVS-R 14: Research agendas

### 6.1 NIST AI RMF Implementation

**Agent Task:** Implement the four NIST AI RMF functions.

**Steps:**
1. **MAP** - Context establishment:
   - Document AI system boundaries
   - Identify stakeholders
   - Map risks to business impact

2. **MEASURE** - Risk assessment:
   - Quantify AI risks
   - Track risk metrics over time
   - Benchmark against industry

3. **MANAGE** - Risk treatment:
   - Implement controls
   - Document residual risk
   - Plan for incidents

4. **GOVERN** - Oversight structure:
   - Define AI governance roles
   - Establish review cadence
   - Create escalation paths

**Deliverable:** `docs/governance/NIST_AI_RMF_IMPLEMENTATION.md`

**Success Criteria:**
- All four functions documented
- Metrics tracked
- Review cadence established

### 6.2 EU AI Act Compliance (If Applicable)

**Agent Task:** Implement EU AI Act requirements for AI features.

**Steps:**
1. Art. 9 - Risk Management:
   - Continuous risk assessment
   - Iterative updates
   - Documented methodology

2. Art. 10 - Data Governance:
   - Training data documentation
   - Bias examination
   - Data quality metrics

3. Art. 14 - Human Oversight:
   - User can understand AI
   - User can monitor AI
   - User can override AI
   - User can stop AI

4. Art. 15 - Accuracy & Robustness:
   - Adversarial testing
   - Poison resistance
   - Performance monitoring

**Deliverable:** `docs/governance/EU_AI_ACT_COMPLIANCE.md`

**Success Criteria:**
- All applicable articles addressed
- Evidence documented
- Update process defined

### 6.3 Incident Response Playbook

**Agent Task:** Create AI-specific incident response procedures.

**Steps:**
1. Define incident types:
   - AI produces incorrect output
   - AI attempts unauthorized action
   - AI exhibits anomalous behavior
   - AI security bypass detected
   - Supply chain compromise affecting AI

2. Create response procedures:
   ```markdown
   ## AI Incorrect Output Incident

   ### Immediate Actions (< 15 minutes)
   1. Activate AI kill switch if pattern detected
   2. Notify affected users
   3. Preserve logs and state

   ### Investigation (< 24 hours)
   1. Analyze input that triggered behavior
   2. Check for injection patterns
   3. Review recent model/prompt changes

   ### Remediation
   1. Update sanitization rules
   2. Retrain or adjust model
   3. Restore from known-good state

   ### Post-Incident
   1. Document root cause
   2. Update detection rules
   3. Communicate to users
   ```

3. Conduct tabletop exercises:
   - Quarterly incident simulations
   - Cross-team participation
   - Document lessons learned

**Deliverable:** `docs/security/AI_INCIDENT_RESPONSE.md`

**Success Criteria:**
- All incident types covered
- Response times defined
- Tabletop exercises scheduled

### 6.4 Continuous Monitoring Dashboard

**Agent Task:** Build security monitoring dashboard.

**Steps:**
1. Define metrics:
   - AI suggestion accuracy over time
   - User approval/rejection rates
   - Anomaly detection counts
   - Sanitization threat detections
   - Permission violations
   - Integration health

2. Create alerting rules:
   - AI accuracy drops below threshold
   - Unusual rejection rate spike
   - New threat pattern detected
   - Integration failure
   - Audit trail gap

3. Build dashboard views:
   - Real-time health
   - Historical trends
   - Drill-down capabilities

**Deliverable:** `src/components/admin/security-dashboard/`

**Success Criteria:**
- All metrics tracked
- Alerts functional
- Dashboard accessible to admins

### 6.5 Third-Party Audit Preparation

**Agent Task:** Prepare for external security audits.

**Steps:**
1. Document evidence inventory:
   - Security policies
   - Implementation evidence
   - Test results
   - Monitoring data
   - Incident records

2. Create audit package:
   - Executive summary
   - Technical documentation
   - Evidence mapping to controls
   - Self-assessment

3. Identify audit firms:
   - AI security specialists
   - SOC 2 auditors
   - Penetration testing firms

**Deliverable:** `docs/audit/AUDIT_PREPARATION.md`

**Success Criteria:**
- Evidence organized
- Gaps identified
- Audit scheduled

---

## Appendix A: Quick Reference - OWASP Agentic Top 10 Mapping

| ID | Vulnerability | Graceful Books Control |
|----|--------------|----------------------|
| ASI01 | Goal Hijacking | Input sanitization, CaMeL separation |
| ASI02 | Tool Misuse | Quarantine LLM has no tools |
| ASI03 | Privilege Abuse | Staging area, user approval |
| ASI04 | Supply Chain | SLSA Level 2, dependency pinning |
| ASI05 | Unexpected Execution | Comprehensive logging |
| ASI06 | Memory Poisoning | No persistent AI memory |
| ASI07 | Inter-Agent Comms | Single agent architecture |
| ASI08 | Cascading Failures | Kill switch, circuit breakers |
| ASI09 | Trust Exploitation | Human-in-the-loop |
| ASI10 | Rogue Agents | Monitoring, no autonomous actions |

---

## Appendix B: Framework Reference Links

**Primary Frameworks:**
- LASM: Layered Attack Surface Model
- CaMeL: Defeating Prompt Injections by Design (arXiv:2503.18813)
- OWASP Agentic Top 10: genai.owasp.org
- NIST AI RMF: airc.nist.gov
- EU AI Act: artificialintelligenceact.eu
- MITRE ATLAS: atlas.mitre.org
- SLSA: slsa.dev

**Research References:**
- MVS-R 11: Deep map of Anthropic, Apollo, METR approaches
- MVS-R 12: 312 sources across 5 bands and 14 districts
- MVS-R 13: 207 AI attack cases
- MVS-R 16: Framework selection by lifecycle phase
- MVS-R 33: Rogue agent detection and Bayesian estimation

---

## Appendix C: Success Metrics by Phase

| Phase | Key Metric | Target |
|-------|-----------|--------|
| 1 | Attack surface documented | 100% coverage |
| 2 | Injection patterns detected | 100% known patterns |
| 2 | Dependencies pinned | 100% |
| 3 | Accounting invariants encoded | All business rules |
| 3 | AI infrastructure ready | Before AI code |
| 4 | OWASP controls implemented | 10/10 |
| 4 | Behavioral tests passing | 100% |
| 5 | Integration permissions minimized | No write where read suffices |
| 6 | Audit readiness | Evidence complete |

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-11-09 | Initial roadmap based on MVS-R frameworks |
