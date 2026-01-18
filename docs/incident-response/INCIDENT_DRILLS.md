# Incident Response Drills

**Build:** H12 - Incident Response Documentation [MVP]
**Last Updated:** 2026-01-18

## Overview

Incident response drills test our procedures, tools, and team coordination in a controlled environment. Regular drills ensure we're prepared for real incidents.

## Why Drill?

**Benefits:**
- Validate runbooks work in practice
- Identify gaps in documentation
- Build muscle memory for incident response
- Cross-train team members
- Test tooling and access
- Reduce panic during real incidents
- Improve response times
- Build team confidence

**Cost of not drilling:**
- Runbooks untested → fail during real incidents
- Tools broken → discover during emergencies
- Team unprepared → slower response
- Procedures unclear → chaos under pressure

---

## Drill Schedule

### Monthly Drills (Light)

**Frequency:** 1st Tuesday of each month
**Duration:** 30 minutes
**Scope:** Single component or runbook

**Purpose:**
- Keep skills fresh
- Test specific procedures
- Quick team coordination practice

**Example scenarios:**
- Worker rollback
- Pages rollback
- Database backup restore (to staging)
- Health check verification
- Communication template usage

### Quarterly Drills (Moderate)

**Frequency:** First week of Q1, Q2, Q3, Q4
**Duration:** 90 minutes
**Scope:** Multi-component failure

**Purpose:**
- Test cross-component coordination
- Practice escalation paths
- Exercise post-mortem process
- Full incident flow from detection to resolution

**Example scenarios:**
- Deployment broke both Workers and Pages
- Regional outage with failover
- Database performance degradation
- Security incident simulation

### Annual Drill (Full)

**Frequency:** Once per year
**Duration:** Half day (4 hours)
**Scope:** Disaster recovery

**Purpose:**
- Test complete disaster recovery
- All hands participation
- Executive involvement
- Full communication protocols
- Post-incident process

**Example scenarios:**
- Complete Cloudflare outage
- Database corruption requiring restore
- Security breach with data exposure
- Multi-region simultaneous failure

---

## Drill Types

### 1. Tabletop Drill

**Format:** Discussion-based, no actual execution

**Process:**
1. Facilitator presents scenario
2. Team discusses response step-by-step
3. Identify gaps in procedures
4. Document findings
5. Update runbooks

**Duration:** 30-60 minutes

**Benefits:**
- No risk to production
- Good for new team members
- Identifies documentation gaps
- Quick and easy

**Limitations:**
- No hands-on practice
- Doesn't test tooling
- No time pressure

**Example:**
```
Scenario: "You receive alert: Database error rate 100%. All sync failing. What do you do?"

Team walks through:
1. Check severity (P1)
2. Alert team
3. Check database health
4. Review runbook
5. Identify cause
6. Execute fix
7. Verify resolution
8. Communicate

Discuss: What if X? What about Y?
```

---

### 2. Simulated Drill

**Format:** Execute in staging environment

**Process:**
1. Inject failure in staging
2. Team responds as if production
3. Follow actual procedures
4. Use real tools
5. Time the response
6. Debrief

**Duration:** 60-90 minutes

**Benefits:**
- Hands-on practice
- Tests actual tools
- Realistic pressure
- No production risk

**Limitations:**
- Staging may differ from production
- Less stress than real incident
- May not catch production-specific issues

**Example:**
```
Scenario: Deploy broken code to staging, trigger alerts

Team executes:
1. Receives alert
2. Investigates logs
3. Follows rollback runbook
4. Performs rollback
5. Verifies health checks
6. Documents actions

Measure: Time to detect, time to rollback, issues encountered
```

---

### 3. Live Fire Drill (Advanced)

**Format:** Controlled production test

**Process:**
1. Schedule maintenance window
2. Notify users (if appropriate)
3. Inject controlled failure in production
4. Team responds
5. Resolve quickly
6. Monitor closely after
7. Comprehensive debrief

**Duration:** 30-120 minutes

**Benefits:**
- Most realistic
- Tests production tools and access
- Real stress and pressure
- Validates actual RTO/RPO

**Risks:**
- Actual user impact
- Potential for uncontrolled failure
- Requires careful planning

**When to use:**
- Annual disaster recovery drill
- Testing critical new procedures
- After major infrastructure changes

**Safety measures:**
- Only during low-traffic windows
- Have abort plan ready
- Multiple engineers standby
- Controlled rollback prepared
- Executive approval required

**Example:**
```
Scenario: Deliberately take one sync region offline during maintenance window

Team executes:
1. Confirm failover works
2. Monitor user impact
3. Test manual failover
4. Restore region
5. Verify all regions healthy

Measure: Automatic failover time, user impact, recovery time
```

---

## Drill Scenarios Library

### Scenario 1: Worker Deployment Failure

**Severity:** P1
**Type:** Simulated or Live Fire
**Duration:** 30 minutes

**Setup:**
```bash
# Deploy broken Worker to staging
cd relay
# Introduce bug in code
git checkout -b drill-broken-worker
# Add syntax error or logic bug
git commit -am "drill: broken deployment"
git push origin drill-broken-worker
wrangler deploy --env staging
```

**Inject:**
- Deploy triggers errors
- Health checks fail
- Sync endpoints return 500

**Expected Response:**
1. Detect via monitoring (<5 min)
2. Check logs and identify deployment
3. Follow rollback runbook
4. Execute rollback (<2 min)
5. Verify health checks pass
6. Document incident

**Success Criteria:**
- [ ] Detected within 5 minutes
- [ ] Rolled back within 10 minutes total
- [ ] All health checks green
- [ ] Incident documented

---

### Scenario 2: Database Performance Degradation

**Severity:** P2
**Type:** Simulated
**Duration:** 45 minutes

**Setup:**
```bash
# In staging database, create slow query
turso db shell graceful-books-staging --execute "
  -- Simulate slow query by creating large dataset
  CREATE TABLE IF NOT EXISTS stress_test (id INTEGER, data TEXT);
  INSERT INTO stress_test SELECT seq, randomblob(1000) FROM generate_series(1, 100000);
"
```

**Inject:**
- Queries running slow (>2s)
- Workers timing out
- Users seeing "slow response" errors

**Expected Response:**
1. Detect via monitoring
2. Check database metrics
3. Identify slow queries
4. Review recent changes
5. Decide: rollback or optimize
6. Execute fix
7. Monitor improvement

**Success Criteria:**
- [ ] Root cause identified within 20 minutes
- [ ] Resolution plan within 30 minutes
- [ ] Performance back to normal within 45 minutes
- [ ] Escalated appropriately

---

### Scenario 3: Security Incident

**Severity:** P0
**Type:** Tabletop (DO NOT execute in production!)
**Duration:** 60 minutes

**Scenario:**
```
At 14:00 UTC, security monitoring alerts:
"Unusual authentication pattern detected:
- 1,000 failed login attempts in 5 minutes
- From single IP address
- Targeting 50 different user accounts"

5 minutes later:
"5 successful logins from same IP using valid credentials"

Question: How do you respond?
```

**Expected Response:**
1. Declare P0 security incident
2. Alert security team
3. Follow security incident runbook
4. Block attacking IP
5. Force logout affected accounts
6. Reset passwords for compromised accounts
7. Investigate how credentials obtained
8. Notify users
9. Document everything
10. Legal/compliance notification if needed

**Discussion Points:**
- When to involve legal?
- How to communicate to users?
- What data might be exposed?
- How to prevent recurrence?

**Success Criteria:**
- [ ] Correct severity assigned
- [ ] Proper escalation path followed
- [ ] Security runbook referenced
- [ ] Communication plan identified
- [ ] Prevention measures discussed

---

### Scenario 4: Multi-Region Failure

**Severity:** P0
**Type:** Simulated
**Duration:** 60 minutes

**Setup:**
```bash
# Take down 2 of 3 regions in staging
# Simulate by routing traffic away or blocking endpoints
```

**Inject:**
- US region: Health checks failing
- EU region: Health checks failing
- AP region: Healthy but overloaded

**Expected Response:**
1. Detect multi-region failure (P0)
2. Alert all hands
3. Check if Cloudflare platform issue
4. Investigate each region
5. Coordinate parallel recovery
6. Monitor remaining region capacity
7. Restore regions
8. Verify load balanced

**Success Criteria:**
- [ ] P0 declared immediately
- [ ] All hands alerted within 5 minutes
- [ ] Parallel investigation of regions
- [ ] Service restored within 30 minutes
- [ ] Communication sent to stakeholders

---

### Scenario 5: Database Backup Restore

**Severity:** P1 (drill) / P0 (real incident)
**Type:** Simulated
**Duration:** 90 minutes

**Setup:**
```bash
# Create test database
turso db create graceful-books-drill

# Populate with test data
turso db shell graceful-books-drill --execute "
  CREATE TABLE test_data (id INTEGER, value TEXT);
  INSERT INTO test_data VALUES (1, 'original data');
"

# Create backup
turso db shell graceful-books-drill --execute ".dump" > /tmp/test-backup.sql

# Modify data (simulate corruption)
turso db shell graceful-books-drill --execute "
  DROP TABLE test_data;
"
```

**Inject:**
- Database table corrupted
- Data missing
- Audit trail shows accidental deletion

**Expected Response:**
1. Identify data loss
2. Stop all writes (disable Workers)
3. Assess corruption extent
4. Locate latest good backup
5. Verify backup integrity
6. Restore to staging first
7. Test restored data
8. Restore to production
9. Re-enable Workers
10. Verify operations
11. Post-mortem on how data lost

**Success Criteria:**
- [ ] Writes stopped immediately
- [ ] Backup verified before restore
- [ ] Restore tested in staging first
- [ ] Production restored successfully
- [ ] Data integrity verified
- [ ] Users notified of any data loss
- [ ] Total time < 2 hours (RTO target)

---

## Drill Planning Checklist

### Before Drill

- [ ] Select scenario and type
- [ ] Set date and time (avoid conflicts)
- [ ] Identify participants
- [ ] Prepare scenario details
- [ ] Set up environment (if simulated/live)
- [ ] Notify team (at least 24 hours ahead)
- [ ] Prepare observation checklist
- [ ] Designate facilitator/observer
- [ ] Review relevant runbooks
- [ ] Ensure tools and access working

### During Drill

- [ ] Facilitator explains scenario
- [ ] Start timer
- [ ] Inject failure (if applicable)
- [ ] Observe team response
- [ ] Take notes on:
  - Response times
  - Decisions made
  - Confusion points
  - Tool issues
  - Communication quality
- [ ] Don't intervene unless safety issue
- [ ] Capture quotes and specifics

### After Drill

- [ ] Stop timer and record duration
- [ ] Immediate debrief (15-30 min)
- [ ] What went well?
- [ ] What could improve?
- [ ] Issues discovered
- [ ] Action items
- [ ] Thank participants
- [ ] Update runbooks with learnings
- [ ] Document drill results
- [ ] Schedule follow-up for action items

---

## Drill Documentation Template

```markdown
# Drill Report: [Scenario Name]

**Date:** [DATE]
**Type:** Tabletop | Simulated | Live Fire
**Duration:** [X] minutes
**Participants:** [Names]
**Facilitator:** [Name]

## Scenario

[Brief description of scenario]

## Objectives

- [Objective 1]
- [Objective 2]
- [Objective 3]

## Timeline

| Time | Event | Notes |
|------|-------|-------|
| 00:00 | Scenario presented | |
| 00:05 | Team began response | |
| 00:15 | [Milestone] | |
| 00:30 | Resolution | |

**Total Duration:** [X] minutes

## What Went Well

- ✅ [Positive observation 1]
- ✅ [Positive observation 2]
- ✅ [Positive observation 3]

## What Could Improve

- ⚠️ [Improvement area 1]
- ⚠️ [Improvement area 2]
- ⚠️ [Improvement area 3]

## Issues Discovered

1. **[Issue 1]**
   - Impact: [High/Medium/Low]
   - Action: [What to do]
   - Owner: [Who]

2. **[Issue 2]**
   - Impact: [High/Medium/Low]
   - Action: [What to do]
   - Owner: [Who]

## Metrics

- Detection time: [X] minutes (Target: [Y])
- Resolution time: [X] minutes (Target: [Y])
- Communication: [Timely/Delayed]
- Runbook followed: [Yes/No/Partially]

## Action Items

| Action | Owner | Priority | Due Date |
|--------|-------|----------|----------|
| [Specific action] | @name | P0 | [DATE] |
| [Update runbook] | @name | P1 | [DATE] |

## Recommendations

[Summary of key recommendations]

## Next Drill

**Suggested scenario:** [Based on learnings]
**Suggested date:** [DATE]
```

---

## Drill Best Practices

### DO:

✅ **Schedule regularly** - Don't skip drills
✅ **Rotate scenarios** - Cover different failure types
✅ **Include new team members** - Great onboarding
✅ **Document everything** - Capture learnings
✅ **Update runbooks** - Incorporate feedback
✅ **Celebrate participation** - Make it positive
✅ **Act on findings** - Fix identified issues
✅ **Make it realistic** - Use real tools and procedures
✅ **Time pressure** - Use timers for realism
✅ **Debrief thoroughly** - Learning happens here

### DON'T:

❌ **Skip drills** - "Too busy" leads to unpreparedness
❌ **Blame participants** - Drills are for learning
❌ **Ignore findings** - Action items must be completed
❌ **Make it too easy** - Drills should challenge
❌ **Surprise team** - Announce drills in advance
❌ **Forget to debrief** - Most valuable part
❌ **Drill only one person** - Whole team needs practice
❌ **Use fake tools** - Practice with real stack
❌ **Forget to document** - Learnings get lost

---

## Drill Metrics

Track over time:

### Response Metrics
- Average time to detect (by scenario type)
- Average time to resolve (by scenario type)
- Escalation clarity (were escalations smooth?)
- Communication effectiveness (timely updates?)

### Preparation Metrics
- Runbook gaps identified per drill
- Tools/access issues per drill
- Action items completed (target: >80%)
- Team participation rate (target: 100%)

### Improvement Metrics
- Response time trend (should decrease)
- Issues discovered trend (should decrease)
- Team confidence (survey after drills)
- Runbook quality (fewer gaps over time)

---

## Sample Annual Drill Calendar

| Month | Drill Type | Scenario | Focus Area |
|-------|------------|----------|------------|
| Jan | Monthly | Worker rollback | Deployment |
| Feb | Monthly | Database query debug | Performance |
| Mar | Quarterly | Multi-component failure | Coordination |
| Apr | Monthly | Pages deployment issue | Frontend |
| May | Monthly | Regional health check | Infrastructure |
| Jun | Quarterly | Security incident (tabletop) | Security |
| Jul | **Annual** | **Disaster recovery** | **Full system** |
| Aug | Monthly | Communication drill | Process |
| Sep | Quarterly | Database restore | Data recovery |
| Oct | Monthly | Monitoring/alerting test | Detection |
| Nov | Monthly | On-call handoff | Process |
| Dec | Quarterly | Year-end scenario review | Planning |

---

## Facilitator Guide

### Role of Facilitator

- Present scenario clearly
- Keep drill on track
- Observe without interfering
- Take detailed notes
- Manage time
- Lead debrief
- Ensure psychological safety

### Tips for Good Facilitation

1. **Set the stage:**
   - "This is practice, not a test"
   - "There are no wrong answers"
   - "Goal is to learn and improve"

2. **During drill:**
   - Let team struggle a bit (learning moment)
   - Only intervene for safety
   - Note confusion points
   - Watch for team dynamics

3. **Debrief structure:**
   - Start with what went well (positive)
   - Ask open questions ("What was challenging?")
   - Dig into confusion points
   - Capture action items with owners
   - End on positive note

4. **Follow-up:**
   - Document within 24 hours
   - Share report with team
   - Track action items
   - Schedule next drill

---

**Last Updated:** 2026-01-18
**Version:** 1.0.0

**Remember:** The more you drill, the better you respond. Drills are investments in readiness that pay off when real incidents occur.

**Questions?** Slack: #incidents

**Next drill:** [Date] - [Scenario] - Calendar invite sent
