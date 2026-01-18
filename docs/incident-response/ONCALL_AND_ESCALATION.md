# On-Call Rotation and Escalation Paths

**Build:** H12 - Incident Response Documentation [MVP]
**Last Updated:** 2026-01-18

## Overview

This document defines on-call responsibilities, rotation schedules, and escalation paths for Graceful Books incident response.

## On-Call Philosophy

**Purpose:**
- Ensure 24/7 coverage for production incidents
- Clear ownership and accountability
- Rapid response to issues
- Knowledge distribution across team

**Principles:**
- On-call is respected and compensated
- On-call has authority to make decisions
- Team supports on-call engineer
- Work-life balance is important

## On-Call Roles

### Primary On-Call Engineer

**Responsibilities:**
- First responder to all incidents
- Incident commander for P0/P1 incidents
- Triage and assign severity
- Execute runbooks
- Coordinate response
- Communicate to stakeholders
- Write initial incident notes

**Expected Response Times:**
- P0: < 5 minutes
- P1: < 15 minutes
- P2: < 1 hour
- P3: Next business day

**Authority:**
- Rollback deployments without approval
- Page additional engineers
- Escalate to leadership
- Make service decisions during incidents

### Secondary On-Call Engineer

**Responsibilities:**
- Backup for primary on-call
- Support for complex incidents
- Pair programming during fixes
- Coverage when primary is hands-on

**Expected Response Times:**
- When paged by primary: < 15 minutes
- When primary non-responsive: Take over as primary

### On-Call Manager (Optional for small teams)

**Responsibilities:**
- Escalation point for complex decisions
- User communication coordination
- Cross-team coordination
- Post-mortem scheduling

## On-Call Schedule

### Rotation Schedule

**Recommended:**
- **1-week rotations** - Good balance of responsibility and recovery
- **Handoff:** Monday mornings (less weekend handoff confusion)
- **Minimum 2 weeks between shifts** - Avoid burnout

**Alternative (for small teams):**
- **24-hour rotations** - Follow the sun model
- **Weekend rotations** - Separate weekend coverage

### Sample Rotation (Team of 4)

```
Week 1: Engineer A (primary), Engineer B (secondary)
Week 2: Engineer B (primary), Engineer C (secondary)
Week 3: Engineer C (primary), Engineer D (secondary)
Week 4: Engineer D (primary), Engineer A (secondary)
```

### Rotation Calendar

Use shared calendar with:
- Primary on-call highlighted
- Secondary on-call noted
- Holidays marked
- Swap requests visible
- Exported to team calendars

### Swap Policy

**Requesting a swap:**

1. Find someone to cover your shift
2. Update shared calendar
3. Post in #oncall Slack channel
4. Update PagerDuty/alerting system
5. Document in rotation log

**Last-minute emergencies:**

- Contact secondary on-call to take primary
- Contact on-call manager
- Post in #oncall for volunteers
- Escalate to engineering manager if no coverage

## On-Call Compensation

**Recommended Policies:**

### Option 1: Pay + Time Off
- On-call stipend: $[X]/week on primary
- Time off: +1 day after week with P0/P1 incident
- Overtime pay: For hours worked during off-hours

### Option 2: Time Banking
- 1 hour on-call work = 1.5 hours time off
- Tracked in time-off system
- Can accumulate or use immediately

### Option 3: Rotation Bonus
- Monthly bonus for on-call participation
- Additional bonus for incident response
- Scaled by severity and duration

**Note:** Adjust based on company policy and local laws.

## Escalation Paths

### When to Escalate

**Immediate Escalation (< 5 min):**
- P0 incidents
- Security breaches
- Data loss events
- Any incident you're uncertain how to handle

**Quick Escalation (< 15 min):**
- P1 incidents
- Unusual or complex situations
- Need specialized expertise
- Response not effective

**Standard Escalation (< 1 hour):**
- P2 incidents needing expertise
- Issues crossing team boundaries
- Need additional resources

### Escalation Hierarchy

```
                    ┌─────────────┐
                    │     CEO     │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │     CTO     │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
      ┌──────┴──────┐ ┌───┴────┐ ┌─────┴──────┐
      │DevOps Lead  │ │Security│ │ Product    │
      │             │ │  Lead  │ │ Owner      │
      └──────┬──────┘ └───┬────┘ └─────┬──────┘
             │            │            │
      ┌──────┴──────┐    │            │
      │  Secondary  │    │            │
      │   On-Call   │    │            │
      └──────┬──────┘    │            │
             │            │            │
      ┌──────┴──────┐    │            │
      │   Primary   │────┴────────────┘
      │   On-Call   │
      └─────────────┘
```

### Escalation Matrix

| Incident Type | Primary On-Call | Secondary On-Call | DevOps Lead | Security Lead | CTO | CEO |
|---------------|----------------|-------------------|-------------|---------------|-----|-----|
| **P0 - Complete Outage** | ✅ Responds | ✅ Join immediately | ✅ Notified | 📧 Notified | ✅ Paged | 📧 Notified |
| **P0 - Security Breach** | ✅ Responds | ✅ Join immediately | 📧 Notified | ✅ Paged | ✅ Notified | 📧 Notified |
| **P0 - Data Loss** | ✅ Responds | ✅ Join immediately | ✅ Paged | 📧 Notified | ✅ Paged | 📧 Notified |
| **P1 - Major Feature Down** | ✅ Responds | 📞 Available | 📧 Notified | - | 📧 Notified | - |
| **P1 - Regional Outage** | ✅ Responds | 📞 Available | 📧 Notified | - | 📧 Notified | - |
| **P2 - Minor Issue** | ✅ Responds | 📞 If needed | - | - | - | - |

**Legend:**
- ✅ Paged immediately
- 📞 Available / on standby
- 📧 Email notification
- \- Not notified

### Contact Information

**Primary On-Call:**
- Slack: @oncall or /whoisoncall
- Phone: [PagerDuty or rotation tool]
- Email: oncall@gracefulbooks.com (forwards to current)

**Engineering Team:**
| Role | Name | Slack | Phone | Specialties |
|------|------|-------|-------|-------------|
| DevOps Lead | [Name] | @devops-lead | [#] | Infrastructure, deployments |
| Security Lead | [Name] | @security-lead | [#] | Security, auth, encryption |
| Database Admin | [Name] | @db-admin | [#] | Database, data integrity |
| Frontend Lead | [Name] | @frontend-lead | [#] | UI, Pages, client-side |
| Backend Lead | [Name] | @backend-lead | [#] | Workers, API, sync |

**Leadership:**
| Role | Name | Slack | Phone | When to Contact |
|------|------|-------|-------|-----------------|
| CTO | [Name] | @cto | [#] | P0/P1, major decisions |
| CEO | [Name] | @ceo | [#] | Security, PR, legal |
| Product Owner | [Name] | @product | [#] | User impact, communication |

**External Vendors:**
| Vendor | Contact | Use Case | SLA |
|--------|---------|----------|-----|
| Cloudflare | [Support Portal] | Platform issues | Enterprise support |
| Turso | [Support Email] | Database issues | Email support |
| [Security Firm] | [Contact] | Security incidents | On-call consultant |

## On-Call Handoff Process

### At Start of Shift

**Outgoing On-Call:**

1. **Review handoff notes** (15-30 min before)
2. **Prepare handoff summary:**
   ```markdown
   # On-Call Handoff - [DATE]

   ## Ongoing Issues
   - [Issue 1]: [Status and context]
   - [Issue 2]: [Status and context]

   ## Recent Incidents
   - [Date/Time]: [Brief description] - [Status]

   ## Monitoring Alerts
   - [Any active alerts or warnings]

   ## Upcoming
   - [Deployments scheduled]
   - [Maintenance planned]
   - [Known issues to watch]

   ## Notes
   - [Anything else to know]
   ```

3. **Join handoff call** (15 min)
4. **Transfer on-call in PagerDuty/rotation tool**
5. **Announce in Slack:**
   ```
   📟 On-call handoff complete
   Primary: @[new-primary]
   Secondary: @[new-secondary]

   /whoisoncall to see current rotation
   ```

**Incoming On-Call:**

1. **Read handoff notes**
2. **Ask questions during handoff call**
3. **Verify access:**
   - [ ] Cloudflare Dashboard
   - [ ] GitHub access
   - [ ] Turso CLI authenticated
   - [ ] Wrangler CLI authenticated
   - [ ] Slack notifications enabled
   - [ ] PagerDuty app working
   - [ ] Phone ringer ON
4. **Test alert delivery:**
   ```bash
   # Trigger test page to yourself
   # (Via PagerDuty or alerting system)
   ```
5. **Review recent changes:**
   ```bash
   # Check recent deployments
   gh run list --limit 5

   # Check recent commits
   git log --oneline --since="1 week ago"
   ```

## On-Call Best Practices

### Before Your Shift

- [ ] Clear your schedule of conflicting commitments
- [ ] Ensure you'll have laptop access
- [ ] Test all tools and access
- [ ] Read recent incident post-mortems
- [ ] Review recent deployments
- [ ] Check what's scheduled during your shift
- [ ] Ensure phone is charged and ringer ON
- [ ] Set up workspace if working remote

### During Your Shift

- [ ] Keep phone with you and charged
- [ ] Check Slack regularly (#incidents, #deployments)
- [ ] Review monitoring dashboards daily
- [ ] Respond to pages immediately
- [ ] Document all actions during incidents
- [ ] Don't hesitate to escalate
- [ ] Take breaks (you can't help if exhausted)
- [ ] Update handoff notes for next on-call

### After an Incident

- [ ] Verify resolution
- [ ] Complete incident notes
- [ ] Schedule post-mortem if needed
- [ ] Update runbooks if you found gaps
- [ ] Communicate resolution
- [ ] Monitor for recurrence

### If You're Overwhelmed

**It's okay to ask for help!**

1. Page secondary on-call
2. Post in #incidents: "Need help with [issue]"
3. Escalate to manager
4. Call DevOps lead

**Remember:** Asking for help is professional, not weakness.

## On-Call Expectations

### What On-Call Is Expected To Do

✅ **DO:**
- Respond within SLA timeframes
- Follow runbooks and documented procedures
- Escalate when uncertain
- Document actions taken
- Communicate to stakeholders
- Make decisions to restore service
- Learn from incidents

### What On-Call Is NOT Expected To Do

❌ **DON'T:**
- Have all the answers
- Work alone on complex issues
- Sacrifice health for incidents
- Skip post-mortems
- Make permanent fixes during incidents (rollback, then fix properly)
- Take blame for incidents

## On-Call Health and Wellness

### Avoiding Burnout

- **Limit rotation length:** 1 week recommended maximum
- **Ensure breaks:** Minimum 2 weeks between shifts
- **Compensate fairly:** Pay or time off for on-call work
- **Respect boundaries:** Don't page for non-urgent issues
- **Share knowledge:** Cross-train so not one person is critical
- **Improve systems:** Reduce incident frequency over time

### After Tough Incidents

- Take time to decompress
- Post-mortem should be supportive, not accusatory
- Consider extra time off after P0 incidents
- Team check-in to ensure well-being
- Recognize and thank on-call engineers

## On-Call Metrics

Track to improve process:

- **Response time by severity**
- **Incident resolution time**
- **Number of incidents per week**
- **Time spent on-call work**
- **Escalations needed**
- **On-call satisfaction** (survey quarterly)

Review quarterly and adjust process.

## On-Call FAQs

**Q: What if I miss a page?**
A: Secondary on-call will take over after 15 minutes. Contact them ASAP.

**Q: What if I'm sick during my shift?**
A: Contact secondary on-call and manager immediately. Health first.

**Q: Can I swap my shift?**
A: Yes, follow swap policy. Find coverage and update systems.

**Q: What if I don't know how to fix the issue?**
A: Escalate! That's what the escalation path is for.

**Q: Do I need to be at my computer 24/7?**
A: No, but you need to respond within SLA and have computer access within 30 min.

**Q: What if an incident happens during family time?**
A: We understand. Respond from phone if possible, escalate if you can't engage fully.

**Q: How much on-call work is expected?**
A: Varies by incident frequency. Goal: <2 hours per week on average.

## Resources

- **Runbooks:** [/docs/incident-response/runbooks/](./runbooks/)
- **Escalation Contacts:** See table above
- **PagerDuty:** [Link to PagerDuty dashboard]
- **Monitoring:** [Link to monitoring dashboards]
- **Incident Log:** [Link to incident tracking]

---

**Last Updated:** 2026-01-18
**Version:** 1.0.0

**Remember:** On-call is a team responsibility. Support each other, escalate when needed, and continuously improve the system to reduce incident load.

**Questions?** Slack: #oncall
