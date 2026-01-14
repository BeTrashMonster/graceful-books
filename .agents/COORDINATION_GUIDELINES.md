# Agent Coordination Guidelines

**Version:** 1.0
**Last Updated:** 2026-01-13
**Purpose:** Establish clear protocols for multi-agent collaboration on this codebase

---

## Core Principle

**Agents MUST coordinate through `.agents/chat/` ONLY.** No other communication channels exist. Agents cannot directly message each other, ping each other, or know what other agents are doing in real-time.

---

## Communication System

### The `.agents/chat/` Directory

**Purpose:** Asynchronous message board for agent-to-agent coordination

**How It Works:**
1. Agents write markdown files to `.agents/chat/[topic]-[date].md`
2. Other agents check this directory periodically
3. Agents respond by editing the same file or creating new ones
4. User may notify agents to check for new messages

**Key Limitation:** Agents CANNOT notify each other directly. Communication is asynchronous and requires patience.

---

## When to Coordinate

### ✅ MUST Coordinate Before Starting Work:

1. **Overlapping Features**
   - You're working on a feature another agent might be building
   - Your work touches files another agent recently modified
   - Multiple agents assigned to the same Group (A, B, C, etc.)

2. **Fixing Errors**
   - GitHub Actions failures
   - Build errors
   - Test failures
   - ANY error that might be from another agent's work

3. **Significant Changes**
   - Modifying shared infrastructure (database schema, types, stores)
   - Changing APIs other components depend on
   - Refactoring that affects multiple features

4. **Unclear Ownership**
   - Task ownership is ambiguous
   - You're not sure if someone else is already working on it
   - Work spans multiple groups or features

### ✅ Good to Coordinate:

1. **Related Work**
   - Your feature integrates with another agent's feature
   - You need to understand another agent's implementation
   - You want to follow patterns another agent established

2. **Seeking Help**
   - You're stuck and another agent might know the answer
   - You need clarification on requirements
   - You found something confusing in another agent's code

### ❌ Don't Need to Coordinate:

1. **Independent Work**
   - Your assigned task has no overlap with others
   - You're working on isolated components
   - Changes are purely internal to your feature

2. **Following Established Patterns**
   - You're implementing something with clear patterns already in place
   - The work is straightforward and isolated

---

## Coordination Protocol

### Step 1: Check for Existing Threads

**Before starting ANY work:**

```bash
ls .agents/chat/
```

**Look for:**
- Threads with related topics
- Recent threads (check dates)
- Your name mentioned in any thread
- The group/feature you're working on

**Read ALL relevant threads** before proceeding.

### Step 2: Determine If Coordination Is Needed

Ask yourself:
- [ ] Is another agent working on related code?
- [ ] Could my work conflict with someone else's?
- [ ] Am I fixing an error that might be from another agent?
- [ ] Am I touching shared infrastructure?
- [ ] Is ownership unclear?

If YES to any: **You MUST coordinate.**

### Step 3: Create or Update a Coordination Thread

**File Naming Convention:**
```
.agents/chat/[topic]-[YYYY-MM-DD].md
```

**Examples:**
- `.agents/chat/group-e-coordination-2026-01-13.md`
- `.agents/chat/database-schema-conflict-2026-01-13.md`
- `.agents/chat/build-errors-reconciliation-2026-01-13.md`

### Step 4: Write Your Coordination Message

**Template:**

```markdown
# [Topic] - [Date]

## Thread Status: ACTIVE - [What's Needed]

---

### Message from: [Your Agent Name/Role]
**Time:** [Date/Time]
**Priority:** [LOW/MEDIUM/HIGH/CRITICAL]
**Related to:** [Feature/Group/File]

---

## Context

[Explain what you're trying to do and why coordination is needed]

## What I Need to Know

1. [Specific question for other agent]
2. [Another specific question]
3. [What you need clarification on]

## What I'm Proposing

[Your proposed approach/solution]

## Coordination Options

[Provide 2-3 clear options for how to divide work]

**Option A:** [Description]
**Option B:** [Description]
**Option C:** [Description]

## My Current Status

- [ ] Waiting for response before starting work
- [ ] Have started investigation but made no changes
- [ ] Have made changes (describe them)

---

**Waiting for:** Response from [Other Agent]
**Will check back:** [When you'll check again]
```

### Step 5: WAIT for Response

**Critical:** After posting your coordination message:

1. **STOP all work** that could conflict
2. **DO NOT** make changes to shared files
3. **DO NOT** assume no response means "go ahead"
4. **CHECK BACK** at the interval you specified
5. **WAIT for explicit agreement** on how to proceed

**How long to wait:**
- **Critical issues:** Check every 30 minutes, escalate to user after 2 hours
- **High priority:** Check hourly, escalate after 4 hours
- **Medium priority:** Check every 2-4 hours, escalate after 1 day
- **Low priority:** Check daily, escalate after 2 days

**If no response:** Ask the user to notify the other agent.

### Step 6: Respond to Coordination Requests

**When you find a message for you:**

1. **Read the entire thread** carefully
2. **Respond in the SAME file** (don't create a new one)
3. **Be specific** about what you're working on
4. **Propose clear division of work**
5. **Commit to your part**

**Response Template:**

```markdown
---

## Response from: [Your Agent Name/Role]
**Time:** [Date/Time]
**Status:** [What you're currently doing]

### What I'm Working On

[Detailed description of your current work]

**Files I'm editing:**
- `path/to/file1.ts` - [what you're doing]
- `path/to/file2.ts` - [what you're doing]

**What I've completed:**
- [x] Thing 1
- [x] Thing 2

**What I'm about to do:**
- [ ] Thing 3
- [ ] Thing 4

### My Response to Your Questions

1. [Answer to question 1]
2. [Answer to question 2]

### Proposed Division of Work

I suggest:
- **You handle:** [Specific tasks]
- **I'll handle:** [Specific tasks]
- **We'll coordinate on:** [Shared areas]

### Agreement

Do you agree with this plan? Please confirm before we both proceed.

---
```

### Step 7: Agree and Document

**Both agents must:**
1. Explicitly agree on division of work
2. Document who's doing what
3. Set a sync-up time to verify no conflicts
4. Mark the thread with agreed plan

**Agreement Template:**

```markdown
---

## AGREED COORDINATION PLAN

**Date:** [Date]
**Participants:** [Agent 1], [Agent 2]

### Division of Work

**[Agent 1] will:**
- Task 1
- Task 2
- Files: [list]

**[Agent 2] will:**
- Task 3
- Task 4
- Files: [list]

**Shared Areas:**
- [Area 1] - [Who has lead, how to coordinate]

**Sync Point:**
- When: [After X is done / At time Y]
- Purpose: [Verify integration / Review approach]

**Status:** ✅ AGREED - Both agents may proceed

---
```

---

## Common Scenarios

### Scenario 1: Found an Error, Don't Know Whose

**DO:**
1. Create coordination thread: `.agents/chat/error-[description]-[date].md`
2. Include full error details, stack trace, files involved
3. Ask "Is anyone working on this?"
4. Wait at least 1 hour before attempting fix
5. If no response, document what you're going to fix
6. Check back after fix to see if anyone responds

**DON'T:**
1. Immediately start fixing without asking
2. Assume it's "orphaned" and yours to fix
3. Fix without documenting what you did

### Scenario 2: Another Agent Is Working on Your Feature

**DO:**
1. Ask them about their progress
2. Offer to help or take over if they're blocked
3. Discuss how to divide the work
4. Wait for agreement before starting

**DON'T:**
1. Start working on it anyway
2. Assume they're done if you don't see recent commits
3. Create parallel implementations

### Scenario 3: Need to Change Shared Infrastructure

**DO:**
1. Create thread: `.agents/chat/infrastructure-[what]-[date].md`
2. Explain why the change is needed
3. List all files that will be affected
4. Ask who might be impacted
5. Wait for responses from potentially affected agents
6. Get explicit approval before making changes

**DON'T:**
1. Make breaking changes without asking
2. Assume your change won't affect others
3. Change shared types/interfaces without coordination

### Scenario 4: User Assigned Two Agents to Same Group

**DO:**
1. Immediately create coordination thread
2. List all tasks in that group
3. Propose clear division based on:
   - Task independence
   - Agent expertise
   - Logical groupings
4. Agree on file ownership
5. Set up regular sync points

**DON'T:**
1. Start working without dividing tasks
2. Work on the same files simultaneously
3. Assume the other agent knows what you're doing

---

## Red Flags: You're Not Coordinating Enough

🚩 **You declare work "complete" without checking for errors**
🚩 **You find errors in tests/build but don't ask if someone's already fixing them**
🚩 **You modify files another agent recently touched without asking**
🚩 **You skip reading existing chat threads**
🚩 **You make changes to shared infrastructure without discussion**
🚩 **You start work on features with unclear ownership**
🚩 **You don't respond to coordination requests addressed to you**
🚩 **You create multiple implementations of the same feature**
🚩 **You "help" by fixing things without asking if someone's already on it**

---

## Best Practices

### 1. Overcommunicate

**Better to coordinate too much than too little.** If unsure, ask.

### 2. Be Specific

Don't say: "I'm working on Group E"
Say: "I'm implementing E1 reconciliation service (`reconciliationHistory.service.ts`), specifically the pattern learning CRUD operations (lines 50-300). I haven't touched the UI components yet."

### 3. Document Everything

When you make a change, update the coordination thread:
- What files you modified
- What you changed
- Why you changed it
- What's left to do

### 4. Check Frequently

When coordinating actively:
- Check `.agents/chat/` every hour
- Update your status every 2-4 hours
- Respond to questions within 4 hours

### 5. Assume Good Intent

If another agent:
- Makes a mistake
- Steps on your toes
- Creates a conflict

**Assume:** They didn't see your message or misunderstood, not malice.

**Respond with:** "Hey, I see you worked on X. I was also working on that. Let's coordinate so we don't duplicate effort."

### 6. Patience Over Speed

**Slow, coordinated work beats fast, conflicting work.**

It's better to:
- Wait 2 hours for a response
- Work in clear, agreed-upon areas
- Integrate smoothly

Than to:
- Rush ahead without coordination
- Create merge conflicts
- Duplicate work
- Break each other's code

---

## Thread Lifecycle

### Creating a Thread

1. Check if one already exists for your topic
2. If yes: add to existing thread
3. If no: create new thread with clear naming

### Active Threads

**Status:** `ACTIVE - [What's needed]`

**Characteristics:**
- Unanswered questions
- Pending decisions
- Ongoing coordination
- Work in progress

**Action:** Check regularly, respond promptly

### Resolved Threads

**Status:** `RESOLVED - [What was resolved]`

**Update when:**
- Agreement reached and documented
- Work completed
- Issue fixed
- Question answered

**Include:**
- Resolution summary
- What was decided
- Who did what
- Final outcome

### Archived Threads

After resolution:
1. Mark thread as RESOLVED
2. Add resolution date
3. Summarize outcome
4. Keep file for reference

**Don't delete coordination threads** - they're valuable history.

---

## Examples

### Example 1: Good Coordination

```markdown
# Group E Testing Coordination - 2026-01-13

## Thread Status: ACTIVE - Dividing Test Work

---

### Message from: Test Agent A
**Time:** 2026-01-13 10:00
**Priority:** HIGH
**Related to:** Group E - E10 Comprehensive Tests

I see we're both assigned to write tests for Group E. Let's divide the work to avoid overlap.

**My Proposal:**
- **I'll handle:** E1, E2, E3 (reconciliation, recurring transactions, templates)
- **You handle:** E4, E5, E6 (recurring invoices, categorization, bills)
- **We'll both:** E7 integration tests together

Files I'll create:
- `reconciliationHistory.service.test.ts`
- `recurring-transactions.test.ts`
- `invoice-templates.test.ts`

What do you think?

---

### Response from: Test Agent B
**Time:** 2026-01-13 10:30

Perfect! I agree with this division.

I'll create:
- `recurring-invoices.test.ts`
- `categorization.service.test.ts`
- `bills.test.ts`

For E7 integration tests, how about:
- **You write:** Reconciliation integration tests
- **I write:** Invoice/billing integration tests
- **We coordinate on:** The full end-to-end workflow test

Agree?

---

### Response from: Test Agent A
**Time:** 2026-01-13 10:45

✅ **AGREED**

Let's sync up tomorrow at this time to review progress and coordinate on the E2E test.

---

## AGREED COORDINATION PLAN

**Test Agent A:**
- E1, E2, E3 unit tests
- Reconciliation integration tests
- Files: `reconciliationHistory.service.test.ts`, `recurring-transactions.test.ts`, `invoice-templates.test.ts`

**Test Agent B:**
- E4, E5, E6 unit tests
- Invoice/billing integration tests
- Files: `recurring-invoices.test.ts`, `categorization.service.test.ts`, `bills.test.ts`

**Sync:** 2026-01-14 10:00 for E2E coordination

**Status:** ✅ AGREED - Both proceeding
```

### Example 2: Bad Coordination (Don't Do This)

```markdown
# Build Errors - 2026-01-13

### Message from: Agent A
Hey, I found some build errors. Going to fix them.

[No details provided]
[No wait for response]
[Immediately starts making changes]
[Doesn't document what was changed]
[Doesn't check if someone else is already fixing them]
```

**Problems:**
- ❌ No specific details about errors
- ❌ No list of files involved
- ❌ No wait for response
- ❌ No check if others are working on it
- ❌ No documentation of changes made

---

## Escalation

### When to Escalate to User

1. **No response after appropriate wait time**
   - Critical: 2 hours
   - High: 4 hours
   - Medium: 1 day
   - Low: 2 days

2. **Disagreement on approach**
   - You and another agent can't agree
   - Technical decisions need user input
   - Priority conflicts

3. **Blocked by another agent's work**
   - Can't proceed without their completion
   - Need their code to continue
   - Dependency chain blocked

4. **Conflicting assignments**
   - User assigned overlapping work
   - Unclear who should do what
   - Both agents claim same feature

### How to Escalate

**In coordination thread:**

```markdown
---

## ESCALATION TO USER

**Reason:** [Why escalation is needed]
**Attempted Resolution:** [What we tried]
**Need Decision On:** [Specific question for user]

@User - We need your input to proceed. Please review above and advise.

---
```

**Then:** Wait for user response. Do not proceed on conflicting work.

---

## Summary: The Golden Rules

1. **Check `.agents/chat/` before starting ANY work**
2. **Coordinate when there's ANY doubt about ownership or overlap**
3. **Write specific, detailed coordination messages**
4. **WAIT for responses before proceeding with potentially conflicting work**
5. **Respond to coordination requests within 4 hours when possible**
6. **Document what you're doing and what you've done**
7. **Get explicit agreement before starting coordinated work**
8. **Update threads with your progress**
9. **Mark threads RESOLVED when done**
10. **Patience beats speed - coordinated work is better than fast, conflicting work**

---

## Questions?

If you're unsure about whether to coordinate, **default to YES, coordinate.**

The time spent coordinating is always less than the time spent resolving conflicts.

---

**End of Guidelines**
