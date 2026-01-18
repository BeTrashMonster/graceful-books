# Post-Mortem Process

**Build:** H12 - Incident Response Documentation [MVP]
**Last Updated:** 2026-01-18

## Overview

Post-mortems are blameless reviews of incidents conducted to learn and improve. The goal is not to assign blame, but to understand what happened and prevent recurrence.

## Blameless Culture

**Core Principles:**

1. **No Blame, No Shame** - Focus on systems, not people
2. **Assume Good Intent** - Everyone did their best with information available
3. **Learn Together** - Incidents are learning opportunities
4. **Speak Freely** - Psychological safety is essential
5. **Action-Oriented** - Turn learnings into improvements

**Language Matters:**

- ✅ "The deployment process didn't catch this bug"
- ❌ "John didn't test properly"

- ✅ "Our monitoring didn't alert us in time"
- ❌ "Sarah should have been watching the dashboard"

- ✅ "The runbook was unclear at this step"
- ❌ "They followed the runbook wrong"

## When to Conduct Post-Mortems

### Required

- **All P0 incidents** - Always, no exceptions
- **All P1 incidents** - Always, no exceptions
- **Security incidents** - Any severity
- **Data loss events** - Any severity

### Recommended

- **P2 incidents** - If complex or recurring
- **Near misses** - Caught before user impact
- **Process failures** - Deployment issues, human errors

### Optional

- **P3 incidents** - Usually not needed
- **Single-occurrence minor issues** - Typically not needed

## Timeline

| Timeframe | Action |
|-----------|--------|
| **Immediately** | Assign post-mortem owner |
| **Within 24 hours** | Schedule post-mortem meeting |
| **Within 48 hours** | Complete draft post-mortem |
| **Within 1 week** | Publish final post-mortem |
| **Within 2 weeks** | Complete all action items (or have plan) |
| **Monthly** | Review open action items |

## Post-Mortem Roles

### Post-Mortem Owner

**Responsibilities:**
- Drive the post-mortem process
- Coordinate meeting and participants
- Write or delegate writing of post-mortem
- Track action items to completion
- Follow up on open items

**Usually:** On-call engineer during incident or team lead

### Participants

**Required:**
- On-call engineer(s) who responded
- Engineers who contributed to resolution
- Product owner (for P0/P1)
- Anyone who has relevant information

**Optional:**
- Team members who want to learn
- Engineers from related systems
- Support team representatives

### Facilitator

**For major incidents:** Consider using neutral facilitator
- Not directly involved in incident
- Can guide discussion objectively
- Ensures blameless culture maintained

## Post-Mortem Meeting

### Before the Meeting

**Post-Mortem Owner:**

1. **Create timeline** (30-60 minutes before meeting)
   ```
   [TIME] - Event 1
   [TIME] - Event 2
   [TIME] - Event 3
   ```

2. **Gather artifacts**
   - Logs
   - Metrics/graphs
   - Chat transcripts
   - Commands run
   - Screenshots

3. **Send pre-read** (24 hours before meeting)
   - Timeline draft
   - Key artifacts
   - Questions to consider

4. **Book meeting room**
   - 60-90 minutes for P0/P1
   - 30-45 minutes for P2
   - Include remote access link

### During the Meeting

**Agenda (60 minutes):**

1. **Introduction (5 min)**
   - State purpose: Learn and improve
   - Remind: Blameless culture
   - Review agenda

2. **Incident Overview (5 min)**
   - What happened (high level)
   - Duration and impact
   - How it was resolved

3. **Timeline Review (20 min)**
   - Walk through chronologically
   - Fill in gaps
   - Clarify confusion
   - Everyone contributes their perspective

4. **Root Cause Analysis (15 min)**
   - Why did this happen?
   - What contributed to it?
   - Use "5 Whys" technique
   - Identify all contributing factors

5. **What Went Well (5 min)**
   - Positive aspects of response
   - Good decisions made
   - Effective processes
   - Team collaboration wins

6. **What Could Be Better (10 min)**
   - Where did we struggle?
   - What was confusing?
   - What slowed us down?
   - What do we wish we had?

7. **Action Items (10 min)**
   - What should we do differently?
   - What should we build/fix?
   - What should we document?
   - Assign owners and deadlines
   - Prioritize (must/should/nice-to-have)

**Facilitator Tips:**

- Keep discussion focused on systems, not people
- Redirect blame → "What process could prevent this?"
- Encourage quieter voices
- Capture notes in real-time (shared doc)
- Park off-topic discussions for later
- End on positive note (thank participants)

### After the Meeting

**Post-Mortem Owner:**

1. **Clean up notes** (within 24 hours)
2. **Write formal post-mortem** (within 48 hours)
3. **Get review from participants**
4. **Publish to team** (within 1 week)
5. **Create action item tickets**
6. **Schedule follow-up** (2 weeks out)

## Post-Mortem Document Template

```markdown
# Post-Mortem: [Incident Name]

**Date:** [Incident Date]
**Authors:** [Name(s)]
**Reviewers:** [Name(s)]
**Status:** Draft | Review | Published

## Executive Summary

[2-3 sentence summary of incident, impact, and resolution]

## Impact

- **Duration:** [X] minutes ([START TIME] - [END TIME] UTC)
- **Severity:** P0 | P1 | P2 | P3
- **Users Affected:** [Number or percentage]
- **Services Impacted:** [List]
- **Data Loss:** None | [Description]
- **Revenue Impact:** [If applicable]
- **Customer Complaints:** [Number]

## Timeline (All times UTC)

| Time | Event |
|------|-------|
| [TIME] | [First event leading to incident] |
| [TIME] | [Incident begins / detected] |
| [TIME] | [Response started] |
| [TIME] | [Key milestone] |
| [TIME] | [Key milestone] |
| [TIME] | [Resolution] |
| [TIME] | [Verified healthy] |

**Total Response Time:** [X] minutes (detection to resolution)

## Root Cause Analysis

### What Happened

[Detailed, technical explanation of what occurred]

### Why It Happened

[Root cause analysis - can use 5 Whys format]

**Immediate Cause:**
[Direct trigger of incident]

**Contributing Factors:**
1. [Factor 1]
2. [Factor 2]
3. [Factor 3]

### Why It Wasn't Detected Sooner

[Analysis of detection and monitoring gaps]

### Why It Took [X] Time to Resolve

[Analysis of response, including bottlenecks]

## Detection and Response

### How We Detected It

[How incident was first identified]

**Detection Time:** [Lag between incident start and detection]

**Detection Method:**
- [ ] Automated monitoring/alerting
- [ ] User report
- [ ] Manual discovery
- [ ] Third-party notification
- [ ] Other: [describe]

### Response Actions

[Chronological list of actions taken to resolve]

1. [Action 1] - [Who] - [Result]
2. [Action 2] - [Who] - [Result]
3. [Action 3] - [Who] - [Result]

### What Worked Well

[Positive aspects of response]

- ✅ [Thing that worked well 1]
- ✅ [Thing that worked well 2]
- ✅ [Thing that worked well 3]

### What Could Be Improved

[Areas for improvement]

- ⚠️ [Thing that could be better 1]
- ⚠️ [Thing that could be better 2]
- ⚠️ [Thing that could be better 3]

## Action Items

### Prevent Recurrence

| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
| [Specific action to prevent recurrence] | @owner | P0 | [DATE] | Open |
| [Another prevention action] | @owner | P1 | [DATE] | Open |

### Improve Detection

| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
| [Specific monitoring/alerting improvement] | @owner | P0 | [DATE] | Open |

### Improve Response

| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
| [Specific response improvement] | @owner | P1 | [DATE] | Open |
| [Documentation update] | @owner | P2 | [DATE] | Open |

### Process Improvements

| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
| [Process change] | @owner | P2 | [DATE] | Open |

## Lessons Learned

### Technical Lessons

- [Lesson 1]
- [Lesson 2]

### Process Lessons

- [Lesson 1]
- [Lesson 2]

### Communication Lessons

- [Lesson 1]
- [Lesson 2]

## Supporting Information

### Logs

[Links to relevant logs, or key excerpts]

### Metrics

[Graphs/screenshots of relevant metrics]

### Related Incidents

[Links to similar past incidents, if any]

### References

[Links to relevant documentation, RFCs, etc.]

---

## Appendix: 5 Whys Analysis

**Problem:** [State the problem]

**Why 1:** [First why]
→ **Because:** [Answer]

**Why 2:** [Second why]
→ **Because:** [Answer]

**Why 3:** [Third why]
→ **Because:** [Answer]

**Why 4:** [Fourth why]
→ **Because:** [Answer]

**Why 5:** [Fifth why]
→ **Because:** [Answer]

**Root Cause:** [Ultimate root cause from 5 whys]

---

**Post-Mortem Meeting:**
- Date: [DATE]
- Attendees: [Names]
- Notes: [Link to meeting notes]

**Follow-up Review:**
- Scheduled: [DATE]
- Purpose: Review action item progress
```

## 5 Whys Technique

The "5 Whys" helps dig past surface causes to find root causes.

**Example:**

**Problem:** Website was down for 2 hours

**Why 1:** Why was the website down?
→ Because the Workers crashed

**Why 2:** Why did the Workers crash?
→ Because they ran out of memory

**Why 3:** Why did they run out of memory?
→ Because a query was loading too much data

**Why 4:** Why was the query loading too much data?
→ Because there was no pagination on the endpoint

**Why 5:** Why was there no pagination?
→ Because our API design guidelines don't require pagination

**Root Cause:** Missing API design guidelines for pagination

**Action:** Add pagination requirements to API design guidelines

## Action Item Management

### Prioritization

**P0 (Critical):**
- Prevents same incident from recurring
- Fixes data integrity issue
- Resolves security vulnerability

**P1 (High):**
- Significantly reduces likelihood of recurrence
- Major improvement to detection or response
- Important process change

**P2 (Medium):**
- Minor improvement
- Nice-to-have
- Long-term strategic work

### Tracking

```bash
# Create GitHub issues for all action items
gh issue create \
  --title "[Post-Mortem] [Brief description]" \
  --label "post-mortem,incident-response" \
  --body "From post-mortem: [LINK]

  Action: [Detailed description]

  Priority: [P0/P1/P2]
  Due: [DATE]"
```

### Follow-up

**2-Week Review:**
- Review progress on all action items
- Unblock any stuck items
- Adjust priorities if needed
- Celebrate completed items

**Monthly Review:**
- Review all open post-mortem action items
- Identify patterns across incidents
- Prioritize systemic improvements

## Publishing Post-Mortems

### Internal Publication

**Where:** Shared drive, wiki, or internal blog

**Audience:** Entire team

**Benefits:**
- Organizational learning
- Transparency
- Trust building
- Pattern identification

### External Publication

**When to publish externally:**
- Major outages (P0)
- Significant user impact
- Security incidents (after remediation)
- Good learning for community

**Where:** Company blog, GitHub, etc.

**Review before publishing:**
- [ ] Remove internal-only information
- [ ] Remove names of individuals
- [ ] Legal review (for security incidents)
- [ ] Ensure technical accuracy
- [ ] Check for competitive sensitivity
- [ ] CEO/CTO approval for major incidents

**Benefits:**
- Transparency builds trust
- Demonstrates accountability
- Shares learning with community
- Positive PR (shows maturity)

## Common Post-Mortem Pitfalls

### ❌ Blaming Individuals

**Bad:**
> "The incident occurred because John deployed without testing"

**Good:**
> "The incident occurred because our deployment process didn't include mandatory staging verification"

### ❌ Stopping at Surface Cause

**Bad:**
> "Root cause: Typo in configuration file"

**Good:**
> "Root cause: Configuration changes lack validation and testing process"

### ❌ Too Many Action Items

- Focus on high-impact items
- 3-5 action items typical for most incidents
- More than 10 suggests lack of prioritization

### ❌ Vague Action Items

**Bad:**
> "Improve monitoring"

**Good:**
> "Add alert for error rate >5% sustained for >2 minutes on /api/sync endpoint"

### ❌ No Follow-through

- Action items without owners → don't get done
- Action items without deadlines → don't get done
- No follow-up review → items forgotten

### ❌ Defensive Post-Mortems

- Trying to justify decisions instead of learning
- Hiding information
- Focusing on what went well, ignoring issues

## Post-Mortem Review Cycle

```
Incident
    ↓
Immediate Response
    ↓
Post-Mortem Meeting (within 48h)
    ↓
Document Written (within 1 week)
    ↓
Action Items Created
    ↓
2-Week Follow-up Review
    ↓
Monthly Pattern Analysis
    ↓
Continuous Improvement
```

## Post-Mortem Templates by Incident Type

### Deployment Failure

Focus areas:
- What broke in the deployment
- Why testing didn't catch it
- Rollback effectiveness
- Deployment process improvements

### Infrastructure Failure

Focus areas:
- Infrastructure component that failed
- Monitoring and alerting gaps
- Failover and redundancy
- Architecture improvements

### Security Incident

Focus areas:
- Attack vector or vulnerability
- Detection and response time
- Data exposure and impact
- Security improvements
- User communication

### Data Loss

Focus areas:
- How data was lost
- Backup and recovery process
- Data integrity verification
- Prevention measures
- User impact and communication

## Metrics to Track

Monitor post-mortem effectiveness:

- **Time to post-mortem:** Target <48 hours for draft
- **Action item completion rate:** Target >80%
- **Time to complete actions:** Track average
- **Repeat incidents:** Should decrease over time
- **MTTR improvement:** Mean time to resolution trending down
- **Detection improvement:** Time to detect trending down

## Resources

- [Google SRE Book - Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)
- [Atlassian Incident Postmortem Template](https://www.atlassian.com/incident-management/postmortem)
- [Etsy Debriefing Facilitation Guide](https://extfiles.etsy.com/DebriefingFacilitationGuide.pdf)

---

**Last Updated:** 2026-01-18
**Version:** 1.0.0

**Remember:** The goal of post-mortems is learning, not blame. A good post-mortem leaves the team feeling educated and empowered, not defensive and demoralized.

**Questions?** Slack: #incidents
