# Incident Communication Templates

**Build:** H12 - Incident Response Documentation [MVP]
**Last Updated:** 2026-01-18

## Overview

Clear, timely communication during incidents is critical. These templates provide ready-to-use messages for various scenarios and audiences.

## Communication Principles

1. **Be Honest** - Don't minimize or exaggerate
2. **Be Timely** - Communicate early and often
3. **Be Clear** - Avoid jargon, use plain English
4. **Be Empathetic** - Acknowledge user impact
5. **Be Actionable** - Tell users what to do (if anything)

## Template Usage

1. Copy appropriate template
2. Fill in [BRACKETS] with specifics
3. Adjust tone for severity
4. Review before sending
5. Send through appropriate channel

---

## Internal Communication (Slack)

### P0 - Critical Incident Alert

**Channel:** #incidents-critical
**When:** Immediately upon detecting P0 incident

```
🚨 P0 INCIDENT - [BRIEF DESCRIPTION]

Severity: P0 (Critical)
Started: [TIME] ([X] minutes ago)
On-call: @[YOUR_NAME]
Status: [Investigating / Identified / Fixing / Monitoring]

Impact:
[Clear description of what users are experiencing]

Current Actions:
- [Action 1]
- [Action 2]

Next Update: [TIME] (every 15 minutes)

Status Page: [Updated / Updating now]
User Notification: [Not yet / Sending now / Sent]

@channel - All hands on deck. Join #incidents-critical war room.
```

### P0 - Update Message (Every 15 minutes)

```
⏰ P0 UPDATE - [+X min]

Status: [Investigating / Identified / Fixing / Monitoring]

Progress:
✅ [What's been done]
🔄 [What's in progress]
⏳ [What's next]

Current hypothesis: [Or "Still investigating"]

ETA: [If known, or "Unknown - continuing to investigate"]

Next update: [TIME]
```

### P0 - Resolution Message

```
✅ P0 RESOLVED - [BRIEF DESCRIPTION]

Total Duration: [X] minutes ([START TIME] to [END TIME])
Resolved: [TIME]

What happened:
[Clear, brief explanation without excessive technical detail]

How we fixed it:
[What was done to resolve]

Impact:
[Number of users affected, data loss if any, etc.]

Next Steps:
- Monitoring: Next [X] hours
- Post-mortem: [DATE/TIME]
- User communication: [Sent / Sending now]

Thank you to everyone who helped: @[names]
```

### P1 - High Severity Alert

**Channel:** #incidents

```
⚠️ P1 INCIDENT - [BRIEF DESCRIPTION]

Severity: P1 (High)
Started: [TIME]
On-call: @[YOUR_NAME]
Status: [Investigating / Fixing]

Impact:
[What users are experiencing]

Actions:
- [Current action]

Next Update: 30 minutes

Status Page: [Updated / Not needed yet]
```

### P2 - Medium Severity Notice

**Channel:** #incidents

```
📋 P2 INCIDENT - [BRIEF DESCRIPTION]

Severity: P2 (Medium)
Detected: [TIME]
Owner: @[YOUR_NAME]

Issue: [Description]
Impact: [Limited impact description]
Plan: [How you'll fix it]

No immediate action required from team.
Will update in #incidents when resolved.
```

---

## Status Page Messages

### P0 - Complete Outage

**Initial Message (< 5 minutes):**

```
Major Outage

We're experiencing a complete service outage. Our team is investigating and working to restore service as quickly as possible.

Started: [TIME UTC]
Updates: Every 15 minutes

We apologize for the disruption.
```

**Investigation Update:**

```
Major Outage - Investigating

We've identified the issue: [BRIEF, NON-TECHNICAL DESCRIPTION]

Our team is actively working on a fix.

Started: [TIME UTC]
Updated: [TIME UTC]
Next update: [TIME UTC]
```

**Fixing Update:**

```
Major Outage - Implementing Fix

We've identified the problem and are implementing a fix now.

Expected resolution: [TIME UTC] or [X] minutes

Started: [TIME UTC]
Updated: [TIME UTC]
```

**Resolution Message:**

```
Service Restored

Service has been fully restored. All systems are operational.

We're monitoring closely to ensure stability.

Started: [TIME UTC]
Resolved: [TIME UTC]
Duration: [X] minutes

Full incident report will be available within 48 hours at: [LINK]

We sincerely apologize for the disruption.
```

### P1 - Partial Outage

**Initial:**

```
Partial Outage

We're experiencing issues with [SPECIFIC FUNCTIONALITY]. Some users may be affected.

Impact: [Clear description of what's not working]
Workaround: [If available, or "None available"]

Our team is investigating.

Started: [TIME UTC]
Updates: Every 30 minutes
```

**Resolution:**

```
Issue Resolved

[FUNCTIONALITY] is now working normally.

Started: [TIME UTC]
Resolved: [TIME UTC]
Duration: [X] minutes

We apologize for any inconvenience.
```

### P2 - Degraded Performance

```
Degraded Performance

We're experiencing slower than normal performance with [SPECIFIC AREA].

The application is still functional, but some operations may take longer than usual.

Our team is working to resolve this.

Started: [TIME UTC]
```

### Scheduled Maintenance

```
Scheduled Maintenance

We'll be performing scheduled maintenance on [DATE] from [START TIME] to [END TIME] UTC.

During this time:
- [What will be unavailable]
- [What will still work]

Expected impact: [Minimal / None / Brief interruption]

We'll notify you when maintenance is complete.
```

---

## User Email Communications

### P0 - Complete Outage (Post-Resolution)

**Subject:** Service Restored - Graceful Books

**Body:**

```
Hi there,

We wanted to let you know that we experienced a service outage today from [START TIME] to [END TIME] UTC (approximately [X] minutes).

What happened:
[Clear, non-technical explanation of what went wrong]

Your data is safe:
Thanks to our local-first architecture, all your financial data is stored securely on your device. Nothing was lost during this outage.

What we did:
[Brief explanation of how we fixed it]

What we're doing to prevent this:
[1-2 specific prevention measures]

Full details:
We'll publish a detailed incident report within 48 hours at:
[LINK]

We sincerely apologize for the disruption and appreciate your patience.

Questions?
Reply to this email or contact support@gracefulbooks.com

- The Graceful Books Team

P.S. Your local data will automatically sync when you next open the app.
```

### P1 - Significant Issue (Post-Resolution)

**Subject:** [FEATURE] Issue Resolved - Graceful Books

**Body:**

```
Hi there,

Earlier today, we experienced an issue with [SPECIFIC FEATURE] that may have affected your use of Graceful Books.

What happened:
From [START TIME] to [END TIME] UTC, [DESCRIPTION OF IMPACT]

This has been fully resolved.

Your data is safe:
[Reassurance specific to the issue]

What you should do:
[Specific actions if any, or "Nothing - everything is back to normal"]

We apologize for any inconvenience this may have caused.

Questions?
support@gracefulbooks.com

- The Graceful Books Team
```

### Security Incident

**Subject:** Important Security Notice - Graceful Books

**Body:**

```
[IMPORTANT: Legal review required before sending]

Hi [NAME],

We're writing to inform you of a security incident that may have affected your Graceful Books account.

What happened:
On [DATE], we discovered [CLEAR DESCRIPTION OF INCIDENT].

What information was involved:
[SPECIFIC DATA TYPES - be honest and complete]
[LIST EXACTLY what was potentially accessed]

What we're doing:
- [Security measure 1]
- [Security measure 2]
- [Security measure 3]

What you should do immediately:
1. Change your Graceful Books password at: [LINK]
2. Enable two-factor authentication: [LINK]
3. Review your account for any suspicious activity
4. [Any other specific actions]

Additional precautions:
If you used the same password on other services, change those passwords too.

Questions or concerns:
security@gracefulbooks.com
[PHONE NUMBER if appropriate]

Timeline:
- Incident occurred: [DATE/TIME]
- Discovered: [DATE/TIME]
- Contained: [DATE/TIME]
- Remediated: [DATE/TIME]

We take your data security very seriously and sincerely apologize for this incident.

Full details: [LINK to security advisory]

Legal notice:
[Required disclosures per GDPR, CCPA, etc.]

- The Graceful Books Team
```

### Data Loss Incident (Database Rollback)

**Subject:** Important: Recent Data Recovery - Graceful Books

**Body:**

```
Hi there,

We need to inform you about a technical issue that required us to restore our database from a backup.

What happened:
[CLEAR EXPLANATION of why database restore was necessary]

Impact on your data:
Any changes you made between [BACKUP TIME] and [RESTORE TIME] on [DATE] were not saved to our sync servers.

Your local data is safe:
Thanks to our local-first architecture, your data is still on your device. It will re-sync automatically.

What you should do:
1. Open Graceful Books on all your devices
2. Allow automatic sync to complete
3. If you see any sync conflicts, review them carefully
4. Contact support if anything looks wrong

What we're doing:
[Prevention measures]

We sincerely apologize for this disruption. We know how important your financial data is.

Questions or concerns:
support@gracefulbooks.com

Detailed timeline:
- Issue occurred: [TIME]
- Database restored from backup: [TIME]
- Backup timestamp: [TIME]
- Data loss window: [DURATION]

- The Graceful Books Team

P.S. We're adding additional safeguards to prevent this from happening again.
```

---

## Social Media Templates

### Twitter/X - Outage Notice

```
We're currently experiencing technical difficulties. Our team is investigating and working to restore service. Updates: [STATUS PAGE LINK] #Status
```

### Twitter/X - Resolution

```
✅ Service has been restored. We apologize for the disruption. Details: [BLOG POST LINK] #Status
```

### Twitter/X - Scheduled Maintenance

```
📅 Scheduled maintenance: [DATE] from [START]-[END] UTC. Brief interruption expected. Details: [LINK]
```

---

## Support Response Templates

### User Reports Outage We Know About

```
Subject: Re: [User's issue description]

Hi [NAME],

Thank you for letting us know. We're currently aware of this issue and our team is actively working on it.

Status: [Brief status]
Updates: [STATUS PAGE LINK]

We'll email you when it's resolved. We apologize for the inconvenience.

Best regards,
[YOUR NAME]
Graceful Books Support
```

### User Reports Issue We Don't Know About

```
Subject: Re: [User's issue description]

Hi [NAME],

Thank you for reporting this. We're investigating it now as a potential service issue.

Can you provide a few more details:
- When did you first notice this?
- Which feature were you using?
- What exact error message did you see (if any)?
- Can you try [BASIC TROUBLESHOOTING STEP]?

I've escalated this to our engineering team and will keep you updated.

Best regards,
[YOUR NAME]
Graceful Books Support

[Create incident ticket]
```

---

## Post-Mortem Communication

### Internal - Post-Mortem Announcement

**Slack #general:**

```
📝 Post-Mortem Published: [INCIDENT NAME]

We've completed our post-mortem for the [DATE] incident.

Read it here: [LINK]

Key takeaways:
- [Takeaway 1]
- [Takeaway 2]
- [Takeaway 3]

Action items assigned. Follow progress in [LINK/CHANNEL].

Thanks to everyone who contributed to the investigation and improvements.
```

### External - Incident Report Blog Post

**Blog Post Template:**

```markdown
# Incident Report: [DATE] - [BRIEF DESCRIPTION]

*Published: [DATE]*

On [DATE], Graceful Books experienced [BRIEF DESCRIPTION]. We want to share what happened, how we responded, and what we're doing to prevent it from happening again.

## Timeline (All times UTC)

- **[TIME]**: Issue first detected
- **[TIME]**: Team alerted
- **[TIME]**: Root cause identified
- **[TIME]**: Fix deployed
- **[TIME]**: Service fully restored

**Total Duration:** [X] minutes

## What Happened

[Clear, detailed but accessible explanation of the incident]

## Impact

- **Users affected:** [Number or percentage]
- **Services impacted:** [List]
- **Data loss:** [None / Minimal / Description]
- **Peak error rate:** [Percentage]

## Root Cause

[Technical but readable explanation of why it happened]

## Resolution

[What we did to fix it]

## Prevention

We're taking the following steps to prevent this from happening again:

1. **[Prevention measure 1]**
   [Brief explanation]

2. **[Prevention measure 2]**
   [Brief explanation]

3. **[Prevention measure 3]**
   [Brief explanation]

## What We're Changing

- [Process change 1]
- [Technical change 1]
- [Monitoring improvement 1]

## Our Commitment

We take reliability seriously. Your trust in us to handle your financial data is our top priority.

We're committed to:
- Transparent communication during incidents
- Thorough post-mortems after every major incident
- Continuous improvement of our systems and processes

## Questions?

If you have questions about this incident, please contact:
support@gracefulbooks.com

We appreciate your patience and understanding.

- The Graceful Books Team
```

---

## Press/Media Response

### Standard Media Statement

```
On [DATE], Graceful Books experienced a technical issue affecting [DESCRIPTION OF IMPACT].

The issue was resolved within [X] minutes/hours. No user data was lost [or specifics about data impact].

We notified affected users and have implemented additional safeguards to prevent recurrence.

User security and data integrity are our highest priorities.

For more information: [CONTACT]
```

### No Comment Yet Statement

```
We're aware of reports about [ISSUE]. We're investigating and will provide more information as soon as we have confirmed details.

For updates: [STATUS PAGE]
Media contact: [EMAIL]
```

---

## Communication Checklist

### During Incident

- [ ] Internal team alerted (Slack)
- [ ] Status page updated
- [ ] On-call and backup notified
- [ ] Regular updates posted (cadence per severity)
- [ ] Stakeholders informed (CEO/CTO for P0)

### After Resolution

- [ ] Final status page update
- [ ] Internal resolution message
- [ ] User email (if warranted)
- [ ] Social media update (if posted about it)
- [ ] Support team briefed
- [ ] Documentation updated

### Post-Mortem

- [ ] Post-mortem completed
- [ ] Findings shared internally
- [ ] Public incident report (for major incidents)
- [ ] Press statement (if needed)
- [ ] Lessons incorporated into runbooks

---

## DISC-Adapted Messaging

Remember: Graceful Books uses DISC-adapted communication. For major user communications, create variants:

### Example: Outage Resolution Email

**D (Dominance) - Direct:**
```
Service restored. [X] minute outage. Data safe. Fixed: [brief]. Preventing: [3 bullets]. Questions: support@gracefulbooks.com
```

**I (Influence) - Warm:**
```
Great news - we're back! We had a [X] minute hiccup, but your data is totally safe and sound. We've figured out what happened and we're making sure it doesn't happen again. Questions? We're here for you: support@gracefulbooks.com
```

**S (Steadiness) - Reassuring:**
```
We wanted to let you know that everything is back to normal now. We had a brief issue, but we've resolved it and your data is completely safe. We're taking steps to make sure this doesn't happen again. If you have any concerns, please don't hesitate to reach out: support@gracefulbooks.com
```

**C (Conscientiousness) - Detailed:**
```
Service Restored: Technical Summary

Duration: [X] minutes ([START] to [END] UTC)
Impact: [Specific description]
Root cause: [Technical but clear explanation]
Resolution: [Detailed steps taken]
Data integrity: Verified - no loss
Prevention measures: [Detailed list]
Full report: [Link]

Questions: support@gracefulbooks.com
```

---

## Tips for Effective Incident Communication

### DO:

- ✅ Communicate early, even if you don't have all details
- ✅ Set expectations for update frequency
- ✅ Be honest about what you know and don't know
- ✅ Acknowledge user impact and apologize
- ✅ Provide status page link in all messages
- ✅ Keep messages concise and clear
- ✅ Update when situation changes
- ✅ Close the loop with resolution message

### DON'T:

- ❌ Blame individuals or teams publicly
- ❌ Use excessive technical jargon
- ❌ Make promises you can't keep ("This will never happen again")
- ❌ Minimize the impact to users
- ❌ Go silent for long periods
- ❌ Over-communicate minor issues
- ❌ Forget to follow up after resolution

---

**Last Updated:** 2026-01-18
**Version:** 1.0.0

**Remember:** Clear communication during incidents builds trust. Silence creates anxiety.

**Questions?** Slack: #incidents
