# Chart of Accounts Wizard - Capability Specification

**Capability ID:** `coa-wizard`
**Related Roadmap Items:** D1
**SPEC Reference:** ACCT-001
**Status:** DONE (marked in roadmap)

## Overview

The Chart of Accounts (COA) Wizard provides a guided, step-by-step experience for users to set up their chart of accounts using industry templates and plain English explanations. This wizard reduces the intimidation factor of accounting setup and ensures users create a GAAP-compliant structure.

## ADDED Requirements


### Functional Requirements

#### FR-1: Industry Template Selection
**Priority:** Critical

The wizard SHALL provide industry-specific templates:
- Service Business (consultants, freelancers, agencies)
- Product Business (retail, e-commerce, manufacturing)
- Hybrid Business (mixed service and product)
- Creative Business (designers, writers, artists)
- Shopkeeper's Starter Kit (brick-and-mortar retail)

Each template SHALL include:
- Pre-configured common accounts for that industry
- Account descriptions in plain English
- Recommended account structure (parent/child relationships)
- Industry-specific examples

**Acceptance Criteria:**
- [ ] Minimum 5 industry templates available
- [ ] Each template covers 80%+ of common accounts for that industry
- [ ] Template selection screen uses friendly, descriptive names
- [ ] Users can preview accounts before selecting template

#### FR-2: Section-by-Section Walkthrough
**Priority:** Critical

The wizard SHALL guide users through account types in order:
1. Assets ("Things your business owns")
2. Liabilities ("What your business owes")
3. Equity ("Your ownership stake")
4. Income ("Money coming in")
5. Expenses ("Money going out")

Each section SHALL include:
- Plain English explanation of the account type
- Why this type matters
- Common accounts pre-suggested
- Ability to add custom accounts
- Visual progress indicator

**Acceptance Criteria:**
- [ ] Sections presented in logical order
- [ ] Users cannot skip required sections
- [ ] Progress saved between sessions
- [ ] Back navigation preserves entered data

#### FR-3: Educational Tooltips
**Priority:** High

The wizard SHALL provide contextual help:
- "What is this?" tooltips for every account type
- "Why do I need this?" explanations for suggested accounts
- Example transactions for each account
- Links to learning library for deeper explanations

**Acceptance Criteria:**
- [ ] Tooltips accessible via info icons
- [ ] Content written in plain English (6th-8th grade reading level)
- [ ] Examples relevant to selected industry
- [ ] Tooltips keyboard-accessible (WCAG 2.1 AA)

#### FR-4: Account Customization
**Priority:** High

Users SHALL be able to:
- Accept suggested accounts as-is
- Rename suggested accounts
- Add custom accounts to any section
- Set account numbers (optional)
- Mark accounts as active/inactive

**Acceptance Criteria:**
- [ ] Custom account names validated (2-255 characters)
- [ ] Account numbers optional but must be unique if provided
- [ ] Account type locked to current section
- [ ] Users can add unlimited custom accounts

#### FR-5: Save and Resume
**Priority:** High

The wizard SHALL allow users to:
- Save progress at any step
- Resume from last completed step
- Exit wizard and return later
- See completion percentage

**Acceptance Criteria:**
- [ ] Progress auto-saved every 30 seconds
- [ ] Manual save button available
- [ ] Resume link prominent on dashboard
- [ ] Wizard state persists across sessions

### Non-Functional Requirements

#### NFR-1: Performance
- Wizard loads in < 2 seconds
- Step transitions < 500ms
- Template preview renders in < 1 second
- Supports 500+ accounts without lag

#### NFR-2: Accessibility
- WCAG 2.1 AA compliant
- Keyboard navigation for all wizard steps
- Screen reader announces current step and progress
- High contrast mode supported

#### NFR-3: Usability
- Maximum 7 steps to complete
- Average completion time < 15 minutes for template users
- Clear "What's next?" messaging on completion
- Celebratory message on wizard completion

## Design Considerations

### User Experience

**Onboarding Flow:**
```
[Assessment Complete]
    → [COA Wizard Prompt: "Let's set up your accounts"]
    → [Template Selection]
    → [Section 1: Assets]
    → [Section 2: Liabilities]
    → [Section 3: Equity]
    → [Section 4: Income]
    → [Section 5: Expenses]
    → [Review & Confirm]
    → [Celebration: "Your chart of accounts is ready!"]
```

**Joy Opportunities:**
- Template cards with friendly names and icons
- Progress bar with encouraging messages ("Almost there!")
- Confetti animation on completion
- First account created: "Your first account! This is where the magic of organization begins."

**DISC Adaptations:**
- **D (Direct):** "Quick Setup - Get your accounts configured fast"
- **I (Influencing):** "Let's build your financial foundation together!"
- **S (Steady):** "Step-by-step guidance to set up your accounts safely"
- **C (Conscientious):** "Comprehensive account setup with full customization"

### Technical Architecture

**Components:**
- `CoaWizard.tsx` - Main wizard container
- `TemplateSelector.tsx` - Industry template selection
- `AccountSection.tsx` - Reusable section component
- `AccountRow.tsx` - Individual account entry/edit
- `ProgressIndicator.tsx` - Visual progress tracking
- `WizardNavigation.tsx` - Back/Next/Save buttons

**State Management:**
```typescript
interface WizardState {
  currentStep: number;
  selectedTemplate: TemplateId | null;
  sections: {
    assets: Account[];
    liabilities: Account[];
    equity: Account[];
    income: Account[];
    expenses: Account[];
  };
  completedSteps: Set<number>;
  lastSaved: Date;
}
```

**Data Flow:**
1. Load industry templates from configuration
2. User selects template
3. Pre-populate sections with template accounts
4. User customizes/adds accounts per section
5. Save to ACCOUNTS table on completion
6. Mark wizard as completed in user preferences

## Testing Strategy

### Unit Tests
- Template loading and parsing
- Account validation logic
- Progress calculation
- State save/restore

### Integration Tests
- Wizard completion flow
- Account creation in database
- Template application
- Session persistence

### User Acceptance Tests
- Complete wizard with each template
- Save and resume from each step
- Add custom accounts
- Navigate back and forward
- Accessibility with screen reader

## Open Questions

1. **Template Customization:** Should users be able to save their customized setup as a personal template?
   - **Decision Needed By:** Product Manager
   - **Impact:** Medium - affects user efficiency for multi-company scenarios

2. **Account Limits:** Should we warn users if they create 100+ accounts?
   - **Decision Needed By:** UX Designer + Product Manager
   - **Impact:** Low - affects only power users

3. **Post-Wizard Editing:** What happens if user wants to add account types after wizard completion?
   - **Decision Needed By:** Product Manager
   - **Impact:** High - affects long-term user experience

## Success Metrics

- **Completion Rate:** 80%+ of users who start wizard complete it
- **Template Usage:** 90%+ of users select a template vs. manual setup
- **Customization Rate:** 60%+ of users add at least one custom account
- **Time to Complete:** Average < 15 minutes
- **Satisfaction:** Post-wizard survey score > 4.5/5
- **Activation Impact:** Users who complete wizard 3x more likely to create first transaction

## Related Documentation

- SPEC.md § ACCT-001 (Chart of Accounts)
- ROADMAP.md Group D (Welcome Home)
- Database schema: ACCOUNTS table
- Design system: Wizard component patterns
