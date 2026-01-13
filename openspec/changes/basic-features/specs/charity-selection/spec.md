# Capability Spec: Charity Selection

## Overview
The `charity-selection` capability allows users to select a charitable cause to support as part of their Graceful Books subscription. $5 of each monthly subscription goes to the user's chosen charity, giving users a sense of purpose and social impact while supporting important causes.

## ADDED Requirements

## Requirements Reference
**Spec Reference:** CHARITY-001

## Functional Requirements

### Charity Selection Flow
- **During onboarding/signup:**
  - Present charity selection after account creation
  - Required step (cannot skip)
  - Visual card layout with charity logos and descriptions
  - Clear explanation: "Part of your subscription helps others. Choose a cause close to your heart."

- **After selection:**
  - Confirmation message: "You've chosen to support [Charity Name]. Every month, $5 of your subscription goes directly to them."
  - Link to learn more about chosen charity
  - Reminder that selection can be changed monthly

### Charity Management
- **View available charities:**
  - Display all active charities
  - Show charity name, logo, mission statement
  - Category badges (Education, Health, Environment, Social Justice, etc.)
  - Link to charity's website (opens in new tab)

- **Select charity:**
  - Radio button or card selection interface
  - One charity per user at a time
  - Confirmation before saving
  - Success message after selection saved

- **Change charity selection:**
  - Available in user settings
  - Monthly limit enforced (cannot change more than once per 30 days)
  - Confirmation dialog: "You can change your charity selection once per month. Current selection: [Charity]. Are you sure you want to change to [New Charity]?"
  - Track last change date to enforce limit

- **View contribution history:**
  - Annual summary in user profile
  - Example: "In 2026, your subscription contributed $60 to [Charity Name]. Thank you for making a difference!"
  - Link to public transparency page

### Charity Data
- **Initial charity list (5-7 charities):**
  - Education (e.g., First Book, DonorsChoose)
  - Health (e.g., Doctors Without Borders, American Cancer Society)
  - Environment (e.g., The Nature Conservancy, Ocean Conservancy)
  - Social Justice (e.g., ACLU, Southern Poverty Law Center)
  - Poverty Relief (e.g., Feeding America, Habitat for Humanity)
  - Community Development (e.g., local food banks, literacy programs)

- **Charity attributes:**
  - Name (official legal name)
  - Display name (short, friendly name)
  - Logo/image URL
  - Mission statement (1-2 sentences)
  - Detailed description (2-3 paragraphs)
  - Website URL
  - Category/categories
  - Tax ID / EIN (for verification)
  - Active status (active charities shown to users)

### Admin Capabilities
- **Charity management:**
  - Add new charity
  - Edit charity details
  - Activate/deactivate charity
  - Set display order/priority
  - View charity statistics (number of supporters, total donated)

- **Donation tracking:**
  - Monthly disbursement reports
  - Per-charity totals
  - Tax documentation generation
  - Export reports for accounting

- **Public transparency:**
  - Update public transparency page monthly
  - Show total donated across all users
  - Breakdown by charity
  - Number of supporters per charity
  - Recent milestones (e.g., "$10,000 donated to Education!")

## Technical Requirements

### Data Models

#### Charity Model
```javascript
Charity {
  id: UUID (primary key)
  name: String (required, official legal name)
  displayName: String (required, short name)
  logoUrl: String (required, URL to logo image)
  missionStatement: String (required, max 200 chars)
  description: Text (required, 500-1000 chars)
  websiteUrl: String (required, URL)
  category: Enum [Education, Health, Environment, SocialJustice, PovertyRelief, CommunityDevelopment]
  taxId: String (EIN, required for US charities)
  isActive: Boolean (default true)
  displayOrder: Integer (for sorting, default 0)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### User Charity Selection Model
```javascript
UserCharitySelection {
  id: UUID (primary key)
  userId: UUID (foreign key to User, unique)
  charityId: UUID (foreign key to Charity)
  selectedAt: DateTime (when first selected)
  lastChangedAt: DateTime (when last changed)
  changeCount: Integer (total number of changes)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Business Rules
- **Monthly change limit:**
  - User can change charity once per 30 days
  - Calculate: days_since_last_change = today - lastChangedAt
  - If days_since_last_change < 30, prevent change
  - Show message: "You can change your charity again on [date]"

- **Selection required:**
  - Cannot complete onboarding without selecting charity
  - If user tries to skip, show gentle reminder
  - No negative consequences, just encouragement

- **Inactive charity handling:**
  - If user's selected charity becomes inactive, notify user
  - Allow immediate change (waive 30-day limit)
  - Suggest similar charities in same category

### Storage
- **Charity data:**
  - NOT encrypted (public information)
  - Stored in local database for offline access
  - Synced from server on app load

- **User selection:**
  - Encrypted at rest (associated with user profile)
  - Local-first storage in IndexedDB
  - Synced via relay client

### Performance
- **Load charity list:** <100ms (cached locally)
- **Save selection:** <200ms including encryption and sync
- **Change validation:** <10ms (check last change date)

## User Interface

### Charity Selection (During Onboarding)
```
┌───────────────────────────────────────────────────────┐
│  Choose a Cause to Support                           │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Part of your subscription helps others. Choose a     │
│  cause close to your heart. Every month, $5 goes      │
│  directly to your chosen charity.                     │
│                                                        │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│ │ [Logo]       │  │ [Logo]       │  │ [Logo]       │ │
│ │ First Book   │  │ Doctors W/B  │  │ The Nature   │ │
│ │ Education    │  │ Health       │  │ Environment  │ │
│ │              │  │              │  │              │ │
│ │ Providing    │  │ Medical care │  │ Protecting   │ │
│ │ books to     │  │ where needed │  │ lands and    │ │
│ │ children...  │  │ most...      │  │ waters...    │ │
│ │              │  │              │  │              │ │
│ │ [Learn More] │  │ [Learn More] │  │ [Learn More] │ │
│ │ [○ Select]   │  │ [○ Select]   │  │ [◉ Select]   │ │
│ └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                        │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│ │ [More charities...]                                │ │
│ └──────────────┘                                      │
│                                                        │
│  [Continue with The Nature Conservancy]               │
│                                                        │
└───────────────────────────────────────────────────────┘
```

### Confirmation Message
```
┌───────────────────────────────────────────────────────┐
│  🎉 Thank You!                                        │
├───────────────────────────────────────────────────────┤
│                                                        │
│  You've chosen to support The Nature Conservancy.     │
│                                                        │
│  Every month, $5 of your $30 subscription goes        │
│  directly to them. That's $60 per year making a       │
│  difference.                                           │
│                                                        │
│  You can change your selection once per month in      │
│  your settings.                                        │
│                                                        │
│  [Continue to Dashboard]                              │
│                                                        │
└───────────────────────────────────────────────────────┘
```

### Charity Selection (in Settings)
```
┌───────────────────────────────────────────────────────┐
│  Your Charitable Giving                               │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Current selection:                                   │
│  [Logo] The Nature Conservancy                        │
│         Protecting lands and waters worldwide         │
│                                                        │
│  In 2026, you've contributed $60 so far.              │
│  Thank you for making a difference!                   │
│                                                        │
│  Last changed: December 10, 2025                      │
│  Next change available: January 10, 2026              │
│                                                        │
│  [Change Charity Selection]                           │
│  [View Public Transparency Page]                      │
│                                                        │
└───────────────────────────────────────────────────────┘
```

### Change Confirmation Dialog
```
┌───────────────────────────────────────────────────────┐
│  Change Charity Selection                             │
├───────────────────────────────────────────────────────┤
│                                                        │
│  You can change your charity selection once per       │
│  month.                                                │
│                                                        │
│  Current:  The Nature Conservancy                     │
│  New:      First Book                                 │
│                                                        │
│  Starting next month, $5 of your subscription will    │
│  go to First Book instead.                            │
│                                                        │
│  Are you sure you want to change?                     │
│                                                        │
│  [Cancel]  [Yes, Change Selection]                    │
│                                                        │
└───────────────────────────────────────────────────────┘
```

### Public Transparency Page
```
┌───────────────────────────────────────────────────────┐
│  Graceful Books Charitable Impact                     │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Since launch, Graceful Books users have donated:     │
│                                                        │
│  $127,450 to important causes                         │
│  2,549 supporters making a difference                 │
│                                                        │
│  Breakdown by Charity:                                │
│                                                        │
│  First Book (Education)          $32,500   650 users  │
│  Doctors Without Borders         $28,750   575 users  │
│  The Nature Conservancy          $24,000   480 users  │
│  ACLU (Social Justice)           $18,500   370 users  │
│  Feeding America                 $15,200   304 users  │
│  Habitat for Humanity            $8,500    170 users  │
│                                                        │
│  Updated: January 1, 2026                             │
│                                                        │
│  All donations are verified and auditable. We are     │
│  committed to full transparency.                      │
│                                                        │
└───────────────────────────────────────────────────────┘
```

## Dependencies

### Requires (from Group A)
- `data-store` - Charity and selection storage
- `encryption` - User selection encryption
- `auth` - User association

### Provides to
- Social impact awareness for users
- Differentiation for Graceful Books brand
- Community building opportunity

## Success Metrics
- Charity selection completion rate: >85% during onboarding
- Change frequency: <20% of users change per month (indicates good initial choices)
- Public page views: >30% of users view at least once
- Charity distribution: No single charity >50% (indicates diverse causes)
- User satisfaction: "I'm glad my subscription supports charity" >80% agree

## Privacy Considerations
- **User selection is private:**
  - Not shown publicly (only aggregated totals)
  - Not shared with charities (maintain zero-knowledge)
  - Not used for marketing

- **Aggregated transparency:**
  - Public page shows totals per charity
  - Number of supporters per charity
  - No individual user amounts
  - Updated monthly (not real-time, to prevent inference)

## Ethical Considerations
- **Charity vetting:**
  - Only verified 501(c)(3) organizations (US)
  - Financial transparency required (annual reports, Form 990)
  - No political campaign organizations
  - No religious organizations that discriminate

- **Fair representation:**
  - Diverse categories represented
  - No favoritism in display order
  - Rotate featured charity monthly (optional)

- **Honest communication:**
  - Clear about $5 per month amount
  - Annual summary shows exact contribution
  - No hidden fees or overhead (full $5 goes to charity)

## Admin Features

### Charity Management UI (Admin Only)
- Add/edit charity details
- Upload charity logo
- Verify tax-exempt status
- Activate/deactivate charity
- Set display order
- View supporter count and total donated
- Generate disbursement reports

### Monthly Disbursement Process
1. Calculate total owed per charity (supporters × $5)
2. Generate disbursement report
3. Process payments to charities
4. Update transparency page
5. Archive reports for auditing

## Accessibility
- Charity cards are keyboard navigable
- Screen reader describes each charity fully
- Logo images have alt text
- Selection state clearly indicated (not just color)
- WCAG 2.1 AA compliance

## Error Handling
- **Charity list load failed:** Show cached charities with warning
- **Selection save failed:** Retry with exponential backoff, show error if fails
- **Monthly limit exceeded:** Clear message with next available date
- **Inactive charity selected:** Notify user, suggest alternatives, allow immediate change

## Future Enhancements (Beyond Group B)
- User-suggested charities (submit for review)
- Charity impact stories (how donations are used)
- Matching campaigns (Graceful Books matches user donations)
- Team charity selection (companies choose charity for all users)
- Custom donation amount (pay extra to increase contribution)
- Charity badges for profile (show support publicly, if user opts in)
- Annual giving summary email (year-end tax documentation)
- Integration with charity APIs (real-time impact data)
