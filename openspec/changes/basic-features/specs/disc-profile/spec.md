# Capability Spec: DISC Profile

## Overview
The `disc-profile` capability provides storage and retrieval of user DISC personality profiles for communication adaptation throughout the application. DISC (Dominance, Influence, Steadiness, Conscientiousness) profiling enables personalized messaging that matches each user's communication preferences.

## ADDED Requirements

## Requirements Reference
**Spec Reference:** ONB-004

## Functional Requirements

### DISC Profile Model
- **Four personality dimensions:**
  - **D - Dominance:** Direct, results-oriented, decisive, competitive
  - **I - Influence:** Enthusiastic, optimistic, social, persuasive
  - **S - Steadiness:** Patient, calm, supportive, reliable
  - **C - Conscientiousness:** Analytical, precise, systematic, quality-focused

- **Scoring:**
  - Each dimension scored 0-100
  - Scores don't necessarily sum to 100 (independent scales)
  - Primary style: Highest scoring dimension
  - Secondary style: Second highest scoring dimension
  - Example profile: D=75, I=40, S=60, C=80 → Primary: D, Secondary: C

### Profile Storage
- **Create profile:**
  - Store DISC scores after assessment (Group C)
  - Associate with user account
  - Set assessment completion date
  - Calculate primary and secondary styles

- **Update profile:**
  - Allow profile updates if user retakes assessment
  - Track update history
  - Preserve previous profiles for reference (optional)

- **Retrieve profile:**
  - Fast lookup by user ID (<10ms)
  - Return full profile with scores and styles
  - Cache in session for performance

- **Delete profile:**
  - Reset to default profile (Steadiness-style)
  - Confirm before deletion
  - Preserve in audit trail

### Default Profile Handling
- **Default profile when none exists:**
  - Primary style: S (Steadiness)
  - Scores: S=100, D=25, I=25, C=25
  - Rationale: Steadiness style is patient, supportive, judgment-free - works well for all users as default

- **Use cases for default:**
  - New users who haven't completed assessment yet
  - Users who opt out of DISC adaptation
  - Fallback if profile retrieval fails

### Manual Override
- **User preference settings:**
  - Option to disable DISC adaptation
  - "Use default communication style for everyone" toggle
  - Clear explanation: "This will use our standard supportive tone instead of adapting to your communication style"

- **Override behavior:**
  - When enabled: All messages use Steadiness-style (default)
  - Profile still stored but not used for message selection
  - User can re-enable adaptation at any time

### Profile Retrieval API
- **Fast lookup:**
  - `getProfile(userId)` - returns user's DISC profile
  - `getPrimaryStyle(userId)` - returns primary style letter (D/I/S/C)
  - `getSecondaryStyle(userId)` - returns secondary style letter
  - `hasProfile(userId)` - returns boolean (true if profile exists)

- **Performance:**
  - Lookup time: <10ms
  - Cached in session storage
  - Invalidate cache on profile update

## Technical Requirements

### Data Model
```javascript
DISCProfile {
  id: UUID (primary key)
  userId: UUID (foreign key to User, unique)
  dominanceScore: Integer (0-100)
  influenceScore: Integer (0-100)
  steadinessScore: Integer (0-100)
  conscientiousnessScore: Integer (0-100)
  primaryStyle: Enum [D, I, S, C] (calculated)
  secondaryStyle: Enum [D, I, S, C] (calculated)
  assessmentCompletedAt: DateTime (nullable)
  manualOverride: Boolean (default false)
  createdAt: DateTime
  updatedAt: DateTime
}

// Default profile constants
DEFAULT_PROFILE = {
  dominanceScore: 25,
  influenceScore: 25,
  steadinessScore: 100,
  conscientiousnessScore: 25,
  primaryStyle: 'S',
  secondaryStyle: 'C',
  assessmentCompletedAt: null,
  manualOverride: false
}
```

### Storage
- **Encrypted at rest** using encryption layer from Group A
- **Local-first** storage in IndexedDB (Group A data store)
- **Indexed field:** userId (unique)
- **Sync enabled** via Group B sync relay client

### Profile Calculation
- **Primary style:**
  - Find maximum score among D, I, S, C
  - If tie, prefer order: S, C, I, D (most supportive to most direct)

- **Secondary style:**
  - Find second-highest score
  - If tie with primary, use tiebreaker order
  - If all scores equal, secondary = primary

### Validation
- **Score validation:**
  - All scores must be integers 0-100
  - At least one score must be >50 (indicates clear preference)
  - Scores can be equal (ambiguous profile defaults to S)

- **User association:**
  - Profile must be associated with valid user ID
  - One profile per user (enforced by unique constraint)

## User Interface

### Profile Display (in Settings)
```
┌─────────────────────────────────────────────┐
│  Your Communication Style                   │
├─────────────────────────────────────────────┤
│                                              │
│  Your profile: Dominance (Primary)          │
│               Conscientiousness (Secondary) │
│                                              │
│  D - Dominance         ████████░░  75       │
│  I - Influence         ████░░░░░░  40       │
│  S - Steadiness        ██████░░░░  60       │
│  C - Conscientiousness ████████░░  80       │
│                                              │
│  What this means:                           │
│  You prefer direct, results-oriented        │
│  communication with attention to detail.    │
│  Messages will be concise and accurate.     │
│                                              │
│  ☐ Disable personalized messaging           │
│     (Use standard style for everyone)       │
│                                              │
│  [Retake Assessment]                        │
│                                              │
└─────────────────────────────────────────────┘
```

### No Profile Yet (Before Assessment)
```
┌─────────────────────────────────────────────┐
│  Your Communication Style                   │
├─────────────────────────────────────────────┤
│                                              │
│  We're using our standard supportive style  │
│  for you right now.                         │
│                                              │
│  Complete the assessment to personalize     │
│  how Graceful Books communicates with you.  │
│                                              │
│  [Take Assessment]                          │
│                                              │
│  No judgment, just understanding.           │
│  We'll remember how you like to             │
│  communicate.                                │
│                                              │
└─────────────────────────────────────────────┘
```

## Dependencies

### Requires (from Group A)
- `data-store` - Profile storage and retrieval
- `encryption` - Profile data encryption
- `auth` - User association and authentication

### Provides to (Group B and beyond)
- Profile data for message variant selection (B5)
- Communication style for assessment UI (Group C)
- User preferences for personalized experience
- Profile scores for analytics (track distribution of styles)

## Success Metrics
- Profile storage success rate: 100%
- Profile retrieval time: <10ms (99th percentile)
- Profile completion rate: >85% (after Group C assessment is available)
- Manual override usage: <5% (most users prefer personalization)
- Session cache hit rate: >95% (efficient caching)

## Privacy & Ethics

### Privacy Considerations
- **Profile is optional:**
  - Users can skip assessment (use default)
  - Users can disable personalization anytime
  - No penalty for opting out

- **Data minimization:**
  - Only store necessary scores
  - No detailed assessment responses stored (only final scores)
  - Profile not shared with third parties

- **Transparent usage:**
  - Clear explanation of what DISC is and how it's used
  - User can view their profile anytime
  - Examples of how messages change based on profile

### Ethical Guidelines
- **No stereotyping:**
  - Profile is a preference, not a personality judgment
  - All styles are equally valid
  - No "better" or "worse" styles

- **Non-manipulative:**
  - Adaptation is about clarity, not persuasion
  - Same information, different delivery
  - Users always have full control

- **Judgment-free:**
  - No implications about user capability based on profile
  - All users have access to all features regardless of profile
  - Profile only affects tone, not functionality

## Style Descriptions (for User Education)

### D - Dominance Style
**You value:** Results, efficiency, control, challenge
**Communication preference:** Get to the point quickly, focus on outcomes, minimal small talk
**Message examples:**
- "Transaction saved. What's next?"
- "Account created. Here's what you can do now..."
- "3 items need attention. Fix them?"

### I - Influence Style
**You value:** Enthusiasm, collaboration, recognition, creativity
**Communication preference:** Friendly, encouraging, social, celebrates achievements
**Message examples:**
- "Woohoo! Transaction saved! You're on a roll!"
- "Amazing! Your first account is created! This is so exciting!"
- "You've got 3 new opportunities to shine! Let's tackle them together!"

### S - Steadiness Style
**You value:** Stability, support, patience, harmony
**Communication preference:** Step-by-step, reassuring, consistent, patient
**Message examples:**
- "Transaction saved successfully. Don't worry - we'll guide you through each step."
- "Your first account is created! This is where the magic of organization begins."
- "You have 3 items on your list. Take your time - we'll work through them together."

### C - Conscientiousness Style
**You value:** Accuracy, quality, structure, expertise
**Communication preference:** Detailed, precise, logical, systematic
**Message examples:**
- "Transaction T-001 saved. Date: 01/10/26. Amount: $1,500.00. Category: Income. Validation: Passed."
- "Account created. Type: Asset. Number: 1000. Parent: None. Status: Active."
- "Checklist status: 3 pending items. Priority order: 1) Reconciliation, 2) Categorization, 3) Review."

## Accessibility
- Profile display uses both color and text labels
- Score bars include numeric values
- All style descriptions available as text (not just visual)
- WCAG 2.1 AA compliance

## Error Handling
- **Profile retrieval failed:** Fall back to default profile (Steadiness)
- **Invalid scores:** Reject with clear error message
- **Duplicate profile:** Update existing instead of creating new
- **Cache invalidation failed:** Refresh from database

## Future Enhancements (Beyond Group B)
- Team member profiles (for multi-user accounts in Group H)
- Profile insights (show user how their style affects their experience)
- A/B testing of message variants to improve effectiveness
- Machine learning to refine style detection over time
- Integration with external DISC assessment tools
- Profile-based feature recommendations
- Communication style compatibility for teams
