# AI Incident Response Playbook

**Document Version:** 1.0
**Last Updated:** 2026-11-10
**Owner:** Security Team
**Status:** Active

This playbook provides procedures for responding to AI-related security incidents in Graceful Books. All team members involved in incident response should be familiar with these procedures.

---

## Incident Classification

### Severity Levels

| Level | Description | Response Time | Escalation | Examples |
|-------|-------------|---------------|------------|----------|
| SEV1 | AI taking unauthorized actions | 15 minutes | Immediate to CEO | AI modifying data without approval, bypassing controls |
| SEV2 | AI producing dangerous outputs | 1 hour | Same day to CTO | Generating harmful suggestions, data leakage |
| SEV3 | AI accuracy degradation | 4 hours | Next business day | High rejection rates, proof gate failures |
| SEV4 | AI performance issues | 24 hours | Weekly review | Slow responses, minor bugs |

### Severity Determination Matrix

| Impact | Urgency High | Urgency Medium | Urgency Low |
|--------|--------------|----------------|-------------|
| High (Data/Financial) | SEV1 | SEV1 | SEV2 |
| Medium (Operations) | SEV2 | SEV2 | SEV3 |
| Low (User Experience) | SEV3 | SEV3 | SEV4 |

---

## Incident Types

### Type 1: AI Unauthorized Action

**Definition:** AI system performs actions without proper authorization or bypasses established controls.

**Indicators:**
- Audit log shows AI action without corresponding user approval
- Data modified outside staging area (CaMeL violation)
- Kill switch bypassed or circumvented
- Actions outside defined scope
- Proof gate validation failure followed by action

**Immediate Actions (< 15 minutes):**

1. **Activate Kill Switch**
   ```typescript
   import { killSwitch } from '@/services/ai/monitoring/killSwitch';

   killSwitch.disable('Incident response - unauthorized action', 'responder_id');
   ```

2. **Preserve State**
   - Export audit logs: `npm run export:audit -- --since="1h"`
   - Capture AI operation logs
   - Screenshot current system state
   - Document timeline of events

3. **Notify Stakeholders**
   - Alert AI Safety Lead (immediate)
   - Alert Security Lead (immediate)
   - Alert on-call engineer (immediate)
   - Notify CTO if data was modified (within 30 minutes)

4. **Isolate Affected Data**
   - Identify affected transactions/records
   - Mark as quarantined in database
   - Prevent further modifications

**Investigation (< 4 hours):**

1. **Audit Trail Review**
   - Review full action sequence leading to incident
   - Identify the entry point (user action, import, API call)
   - Check for signs of injection attack

2. **Root Cause Analysis**
   - Was this a prompt injection? (Check sanitization logs)
   - Was this a bug in control logic? (Review proof gate)
   - Was this an adversarial attack? (Check patterns)
   - Was this a configuration error? (Review settings)

3. **Data Exfiltration Check**
   - Review network logs for unusual outbound connections
   - Check for data sent to unauthorized endpoints
   - Verify no sensitive data was exposed

4. **Blast Radius Assessment**
   - How many users/accounts affected?
   - What data was accessed/modified?
   - What time period was impacted?

**Remediation:**

1. Identify and fix root cause in code/configuration
2. Add new detection pattern if injection-based
3. Test fix thoroughly in staging environment
4. Deploy fix with feature flag for gradual rollout
5. Monitor closely during re-enablement

**Post-Incident:**

1. Write detailed incident report (template below)
2. Update detection rules in sanitization service
3. Conduct blameless postmortem within 5 business days
4. Update this runbook with lessons learned
5. Schedule follow-up review in 30 days

---

### Type 2: Prompt Injection Detected

**Definition:** Malicious content designed to manipulate AI behavior is detected in user input or imported data.

**Indicators:**
- Sanitization system flags injection pattern
- AI behavior inconsistent with visible inputs
- Unusual patterns in audit trail
- User reports unexpected AI suggestions
- Proof gate failures with injection-like errors

**Immediate Actions (< 1 hour):**

1. **Quarantine Affected Data**
   - Mark flagged transactions/imports as quarantined
   - Prevent AI processing of quarantined items
   - Log quarantine action

2. **Review Recent AI Suggestions**
   - Check all suggestions made after injection
   - Verify no unauthorized actions were taken
   - Alert affected users if necessary

3. **Check for Successful Exploitation**
   - Review proof gate logs for passes after injection
   - Check audit trail for unusual patterns
   - Verify data integrity

**Investigation:**

1. **Analyze Injection Payload**
   - Document the exact payload
   - Identify injection technique used
   - Check if pattern matches known attacks
   - Assess sophistication level

2. **Determine Success/Failure**
   - Did injection reach AI system?
   - Did AI behavior change?
   - Did proof gate catch it?
   - Was any action taken?

3. **Scan for Variants**
   - Search historical data for similar patterns
   - Check other user accounts for same attack
   - Review import logs for injection attempts

**Remediation:**

1. **Update Sanitization Patterns**
   ```typescript
   // Add new pattern to sanitization service
   const newPattern = {
     id: 'INJ-XXX',
     pattern: /detected_pattern/i,
     name: 'Description of attack',
     severity: 'critical',
   };
   ```

2. **Retroactive Scan**
   - Run detection against historical data
   - Quarantine any newly identified threats

3. **User Notification**
   - If data was compromised, notify affected users
   - Provide guidance on any required actions

---

### Type 3: AI Accuracy Degradation

**Definition:** AI system quality drops significantly below acceptable thresholds.

**Indicators:**
- User rejection rate spike (>30% above baseline)
- Proof gate failure rate spike (>10% of suggestions)
- Confidence scores declining trend
- Increased user complaints about AI quality
- Dashboard alerts for accuracy metrics

**Immediate Actions (< 4 hours):**

1. **Verify Metrics**
   - Confirm degradation via dashboard
   - Check for data collection errors
   - Validate metric calculations

2. **Check for Model Changes**
   - Review recent deployments
   - Check model version in production
   - Verify model configuration

3. **Assess Severity**
   - Minor degradation: Monitor closely
   - Major degradation: Consider temporary disable
   - Critical degradation: Disable immediately

**Investigation:**

1. **Performance Comparison**
   - Compare last 7 days vs. previous 30 days
   - Identify when degradation began
   - Correlate with deployments/changes

2. **Data Distribution Analysis**
   - Check for input data distribution shift
   - Identify new transaction types
   - Review recent import sources

3. **Model Input Review**
   - Verify input preprocessing
   - Check for data quality issues
   - Review feature extraction

**Remediation:**

1. **Immediate Options:**
   - Rollback to previous known-good version
   - Adjust confidence thresholds
   - Temporarily disable most affected features

2. **Long-term Fixes:**
   - Retrain model with updated data
   - Update preprocessing logic
   - Add new handling for edge cases

---

## Communication Templates

### User Notification (SEV1/SEV2)

**Subject:** Important Notice About [Feature Name] in Graceful Books

---

We identified an issue with [feature] and have temporarily disabled it as a precaution.

**What happened:**
[Brief, non-technical explanation of the issue]

**What we did:**
- Immediately disabled the affected feature
- Secured all user data
- Began investigation to understand the cause

**What you should do:**
- [Specific user actions if any needed]
- Review any AI suggestions made in the past [timeframe]
- Contact support if you notice any issues

**Your data:**
Your financial data remains secure. [Add specifics about data status]

We're investigating and will update you within [timeframe]. We apologize for any inconvenience.

---

### Internal Escalation Template

```
═══════════════════════════════════════════════════════
INCIDENT NOTIFICATION
═══════════════════════════════════════════════════════

INCIDENT ID: [Auto-generated ID]
TYPE: [Unauthorized Action / Prompt Injection / Accuracy Degradation / Other]
SEVERITY: [SEV1 / SEV2 / SEV3 / SEV4]

TIME DETECTED: [Timestamp with timezone]
DETECTED BY: [System / User / Monitoring]

CURRENT STATUS: [Investigating / Contained / Mitigating / Resolved]

SUMMARY:
[2-3 sentence description of what happened]

IMPACT:
- Users affected: [Number or estimate]
- Data affected: [Description]
- Systems affected: [List]

ACTIONS TAKEN:
1. [Action 1]
2. [Action 2]
3. [Action 3]

NEXT STEPS:
1. [Next action with owner]
2. [Next action with owner]

OWNER: [Name and contact]
BACKUP: [Name and contact]

UPDATES:
- [Timestamp]: [Update]

═══════════════════════════════════════════════════════
```

### Incident Report Template

```markdown
# Incident Report: [INCIDENT ID]

## Summary
| Field | Value |
|-------|-------|
| Incident ID | INC-YYYY-XXXX |
| Date/Time | [Start time] - [End time] |
| Duration | [Hours/minutes] |
| Severity | [SEV1-4] |
| Type | [Category] |
| Status | Resolved |

## Timeline
| Time | Event |
|------|-------|
| HH:MM | Initial detection |
| HH:MM | Action taken |
| ... | ... |
| HH:MM | Resolution confirmed |

## Impact
- **Users Affected:** [Number]
- **Data Impact:** [Description]
- **Financial Impact:** [If any]
- **Reputation Impact:** [If any]

## Root Cause
[Detailed technical explanation]

## Resolution
[What was done to fix the issue]

## Lessons Learned
1. [Lesson 1]
2. [Lesson 2]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action] | [Name] | [Date] | [Status] |

## Appendix
[Attach relevant logs, screenshots, data]
```

---

## Emergency Procedures

### Kill Switch Activation

**When to Activate:**
- Any SEV1 incident
- Confirmed unauthorized AI action
- Suspected data exfiltration
- Any doubt about AI behavior

**How to Activate:**

**Via Dashboard:**
1. Navigate to Security Dashboard
2. Click "Emergency Stop - Disable AI"
3. Confirm with reason
4. Verify status shows "Disabled"

**Via Code:**
```typescript
import { killSwitch } from '@/services/ai/monitoring/killSwitch';

// Emergency disable
killSwitch.disable('Emergency: [reason]', 'your_user_id');

// Verify
console.log('AI Enabled:', killSwitch.isEnabled()); // Should be false
```

**Via API:**
```bash
curl -X POST https://api.gracefulbooks.com/admin/ai/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Emergency: [description]", "operator": "admin_id"}'
```

### Kill Switch Re-enablement

**Prerequisites:**
1. Root cause identified and fixed
2. Fix tested in staging environment
3. AI Safety Lead approval
4. Security Lead concurrence
5. Monitoring in place

**Process:**
1. AI Safety Lead initiates re-enablement
2. Enable with gradual rollout (10% → 50% → 100%)
3. Monitor metrics closely for 24 hours
4. Full enablement after stability confirmed

---

## Contacts

| Role | Name | Phone | Email | Backup |
|------|------|-------|-------|--------|
| AI Safety Lead | TBD | TBD | ai-safety@gracefulbooks.com | Security Lead |
| Security Lead | TBD | TBD | security@gracefulbooks.com | CTO |
| On-Call Engineer | Rotation | TBD | oncall@gracefulbooks.com | Engineering Lead |
| Engineering Lead | TBD | TBD | engineering@gracefulbooks.com | CTO |
| CTO | TBD | TBD | cto@gracefulbooks.com | CEO |
| CEO | TBD | TBD | ceo@gracefulbooks.com | Board Chair |

### Escalation Phone Tree

```
SEV1 (Immediate):
  1. On-Call Engineer (always first)
  2. AI Safety Lead
  3. Security Lead
  4. CTO
  5. CEO (if data breach or legal exposure)

SEV2 (1 hour):
  1. On-Call Engineer
  2. AI Safety Lead
  3. Security Lead (if security-related)

SEV3/4 (Business hours):
  1. AI Safety Lead
  2. Relevant team lead
```

---

## Tabletop Exercise Schedule

Quarterly tabletop exercises should be conducted using this playbook:

| Quarter | Scenario | Focus Area |
|---------|----------|------------|
| Q1 | Prompt injection leading to data modification | Detection and response |
| Q2 | AI accuracy degradation over time | Monitoring and thresholds |
| Q3 | Coordinated attack with multiple injections | Scale and coordination |
| Q4 | Full SEV1 with external notification | Communication and PR |

### Exercise Documentation

After each exercise:
1. Document what worked well
2. Document gaps identified
3. Update this playbook
4. Schedule remediation tasks

---

## Appendix: Quick Reference Card

### SEV1 Response (15 min)
1. Activate kill switch
2. Preserve logs
3. Notify AI Safety Lead
4. Notify Security Lead
5. Document timeline

### SEV2 Response (1 hour)
1. Assess scope
2. Quarantine affected data
3. Notify AI Safety Lead
4. Begin investigation
5. Prepare user communication

### Key Commands
```bash
# Disable AI
npm run ai:disable -- --reason="[reason]"

# Export audit logs
npm run export:audit -- --since="[time]"

# Check AI status
npm run ai:status

# Run integrity check
npm run audit:verify
```

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-10 | Security Team | Initial release |
