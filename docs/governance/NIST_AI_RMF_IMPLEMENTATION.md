# NIST AI RMF Implementation

**Document Version:** 1.0
**Last Updated:** 2026-11-10
**Owner:** Security Team
**Status:** Active

This document maps Graceful Books' AI security implementation to the NIST AI Risk Management Framework (AI RMF 1.0). The framework ensures trustworthy AI systems through four core functions: MAP, MEASURE, MANAGE, and GOVERN.

---

## 1. MAP Function

The MAP function establishes context and identifies risks associated with AI systems.

### 1.1 AI System Inventory

| System | Purpose | Risk Level | Data Types | Phase Implemented |
|--------|---------|------------|------------|-------------------|
| Transaction Categorizer | Auto-categorize transactions based on description | Medium | Financial transactions, descriptions | Phase 3-4 |
| Anomaly Detector | Flag unusual transaction patterns | Low | Transaction patterns, amounts | Phase 3-4 |
| Forecaster | Generate financial projections | Low | Historical financial data | Phase 3-4 |
| Import Assistant | Parse and suggest mappings for imported data | Medium | External file data, CSV/OFX content | Phase 2 |

### 1.2 Stakeholder Identification

| Stakeholder | Interest | Impact Level | Engagement Method |
|-------------|----------|--------------|-------------------|
| End Users (Business Owners) | Data privacy, accuracy, trust | High | User feedback, surveys |
| Accountants/Bookkeepers | Professional reliability, compliance | High | Professional review board |
| Regulators | GAAP compliance, data protection | Medium | Compliance audits |
| Development Team | System stability, maintainability | Medium | Code review, testing |
| Security Team | Threat prevention, incident response | High | Security audits, monitoring |

### 1.3 Context Mapping

**Business Context:**
- Small business accounting platform
- Users often lack financial expertise
- High trust required for financial data handling
- Local-first architecture prioritizes privacy

**Technical Context:**
- Local-first, zero-knowledge architecture
- AI features operate on client-side data only
- No AI model training on user data
- CaMeL architecture for AI safety

**Regulatory Context:**
- GAAP compliance requirements
- Potential EU AI Act applicability (if serving EU customers)
- SOC 2 Type II target compliance
- State-level data protection laws

### 1.4 Risk Identification

| Risk Category | Specific Risks | Likelihood | Impact |
|---------------|----------------|------------|--------|
| Security | Prompt injection attacks | Medium | High |
| Security | Data exfiltration via AI | Low | Critical |
| Accuracy | Transaction miscategorization | Medium | Medium |
| Reliability | AI hallucination in suggestions | Medium | High |
| Privacy | Unintended data exposure | Low | Critical |
| Trust | User confidence erosion | Medium | High |

---

## 2. MEASURE Function

The MEASURE function quantifies risks and establishes monitoring metrics.

### 2.1 Risk Metrics

| Metric | Description | Target | Warning | Critical | Current |
|--------|-------------|--------|---------|----------|---------|
| AI Accuracy | % correct categorizations | >90% | <85% | <75% | TBD |
| User Override Rate | % AI suggestions modified by users | <20% | >30% | >50% | TBD |
| Proof Gate Failure Rate | % actions blocked by invariants | <5% | >10% | >20% | TBD |
| False Positive Anomalies | % incorrectly flagged anomalies | <10% | >15% | >25% | TBD |
| Injection Block Rate | % detected/blocked injection attempts | >99% | <95% | <90% | TBD |
| User Rejection Rate | % AI suggestions rejected by users | <25% | >40% | >60% | TBD |

### 2.2 Measurement Schedule

| Frequency | Activities | Owner |
|-----------|------------|-------|
| Real-time | Proof gate monitoring, injection detection | Automated |
| Daily | Accuracy metrics aggregation, anomaly review | AI System |
| Weekly | User feedback analysis, trend identification | Product Team |
| Monthly | Comprehensive metric review, threshold evaluation | Security Lead |
| Quarterly | External assessment, stakeholder review | Governance Board |

### 2.3 Measurement Methods

**Automated Metrics:**
- Proof gate pass/fail counts via audit chain
- Injection pattern detection via sanitization service
- User interaction tracking (accept/modify/reject)

**Manual Assessment:**
- Sample review of AI categorizations
- User satisfaction surveys
- Expert review of edge cases

### 2.4 Baseline Establishment

Initial baselines will be established during the first 30 days of production deployment:
1. Collect raw metrics without alerting
2. Calculate statistical baselines (mean, standard deviation)
3. Set thresholds at 2-sigma for warnings, 3-sigma for critical
4. Document and approve baseline values

---

## 3. MANAGE Function

The MANAGE function implements risk treatments and controls.

### 3.1 Risk Treatments

| Risk | Treatment | Control Type | Owner | Status |
|------|-----------|--------------|-------|--------|
| Prompt injection | Input sanitization with pattern detection | Preventive | Security Team | Implemented |
| AI hallucination | Proof gate invariant validation | Detective/Corrective | Engineering | Implemented |
| Privacy leak | CaMeL architecture, local-first design | Preventive | Architecture | Implemented |
| Goal hijacking | Human-in-loop approval for actions | Preventive | Product | Implemented |
| Unauthorized actions | Kill switch, audit trail | Corrective | Security | Implemented |
| Integration compromise | Authority attenuation chain | Preventive | Security | Implemented |

### 3.2 Control Implementation Status

| Control | Phase | Test Coverage | Gate Status |
|---------|-------|---------------|-------------|
| Input Sanitization | Phase 2 | 98% | Passed |
| Proof Gate System | Phase 3-4 | 100% | Passed |
| Kill Switch | Phase 3-4 | 100% | Passed |
| Audit Chain | Phase 1 | 95% | Passed |
| CaMeL Architecture | Phase 3-4 | 90% | Passed |
| Authority Attenuation | Phase 5 | 100% | Passed |
| Payment Security | Phase 5 | 100% | Passed |

### 3.3 Residual Risk Acceptance

After all controls are implemented, the following residual risks are accepted:

1. **Novel Injection Patterns**
   - Risk: New injection techniques not covered by current patterns
   - Mitigation: Continuous monitoring, pattern updates, defense-in-depth
   - Residual Level: Low
   - Accepted By: Security Lead

2. **AI Capability Growth**
   - Risk: Future AI capabilities may circumvent current controls
   - Mitigation: Kill switch, regular security reviews, architecture updates
   - Residual Level: Low
   - Accepted By: CTO

3. **Zero-Day Vulnerabilities**
   - Risk: Unknown vulnerabilities in dependencies
   - Mitigation: Dependency scanning, rapid patching, sandboxing
   - Residual Level: Medium
   - Accepted By: Security Lead

### 3.4 Risk Treatment Effectiveness

| Treatment | Effectiveness Measure | Target | Last Assessment |
|-----------|----------------------|--------|-----------------|
| Input Sanitization | Injection block rate | >99% | TBD |
| Proof Gate | Invalid action prevention | 100% | TBD |
| Kill Switch | Time to disable | <1 second | Verified |
| Audit Chain | Integrity verification | 100% | Verified |

---

## 4. GOVERN Function

The GOVERN function establishes organizational oversight and accountability.

### 4.1 Governance Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Executive Sponsor (CEO)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                    AI Governance Board                       │
│    (CTO, Security Lead, Product Lead, Legal Advisor)        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ AI Safety    │  │ Security     │  │ Engineering  │       │
│  │ Lead         │  │ Lead         │  │ Lead         │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Roles and Responsibilities

| Role | Responsibilities |
|------|------------------|
| AI Safety Lead | AI risk assessment, safety reviews, incident classification |
| Security Lead | Security controls, incident response, audit coordination |
| Engineering Lead | Implementation, testing, deployment decisions |
| Product Lead | User impact assessment, feature decisions |
| CTO | Technical strategy, architecture decisions |
| CEO | Executive sponsorship, resource allocation |

### 4.3 Escalation Path

```
Level 1: Engineer → AI Safety Lead (Technical issues)
Level 2: AI Safety Lead → Security Lead (Security concerns)
Level 3: Security Lead → AI Governance Board (Policy decisions)
Level 4: AI Governance Board → CEO (Critical incidents, legal exposure)
```

### 4.4 Policy Documents

| Document | Purpose | Location | Review Cadence |
|----------|---------|----------|----------------|
| AI Ethics Policy | Ethical use of AI | docs/policies/AI_ETHICS.md | Annual |
| AI Security Policy | Security requirements | docs/security/AI_SECURITY_POLICY.md | Quarterly |
| Incident Response Playbook | Incident handling | docs/security/AI_INCIDENT_RESPONSE.md | Quarterly |
| Data Handling Policy | Data protection | docs/policies/DATA_HANDLING.md | Annual |

### 4.5 Review Cadence

| Frequency | Activities | Participants |
|-----------|------------|--------------|
| Weekly | Operational metrics review, alert triage | AI Safety Lead, Security Lead |
| Monthly | Policy compliance review, metric trends | AI Governance Board |
| Quarterly | Comprehensive governance assessment, external audit prep | Full Board + External |
| Annually | Full audit, framework update review, policy refresh | All stakeholders |

### 4.6 Decision Authority Matrix

| Decision Type | Authority Level | Approval Required |
|---------------|-----------------|-------------------|
| Enable/disable AI features | AI Safety Lead | Single approval |
| Security policy changes | Security Lead | Governance Board review |
| New AI system deployment | Engineering Lead | AI Safety Lead + Security Lead |
| Incident severity classification | AI Safety Lead | Immediate, notify Board |
| Kill switch activation | Any Engineer | Immediate, notify AI Safety Lead |
| Kill switch deactivation | AI Safety Lead | Security Lead concurrence |

### 4.7 Compliance Mapping

| Standard/Framework | Applicable Controls | Compliance Status |
|--------------------|---------------------|-------------------|
| NIST AI RMF 1.0 | All | This document |
| OWASP Top 10 for LLMs | Prompt injection, data security | Phase 2-4 |
| SOC 2 Type II | Audit trail, access control | Phase 1 + 6 |
| GDPR (if applicable) | Data minimization, local-first | Architecture |

---

## Appendix A: Metrics Dashboard Location

The Security Dashboard at `src/components/admin/security/SecurityDashboard.tsx` provides real-time visibility into:
- AI system health
- Threat detection metrics
- Audit chain integrity
- Kill switch status

## Appendix B: Related Documents

- [Agentic AI Security Roadmap](../security/AGENTIC_AI_SECURITY_ROADMAP.md)
- [AI Incident Response Playbook](../security/AI_INCIDENT_RESPONSE.md)
- [Phase 1-2 Foundation Security](../../Roadmaps/Phase1_2_Foundation_Import.md)
- [Phase 3-4 AI Security](../../Roadmaps/Phase3_4_AI_Security.md)
- [Phase 5-6 Integration Governance](../../Roadmaps/Phase5_6_Integration_Governance.md)

## Appendix C: Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-10 | Security Team | Initial release |
