# J7 Advisor Onboarding UX Flow
**6-Screen Wizard for Professional Advisor Signup**

## UX Philosophy (20 Years Experience Applied)

Based on 20 years of UX experience at large corporations, the advisor onboarding wizard follows these proven principles:

1. **Progressive Disclosure:** One primary task per screen, minimize cognitive load
2. **Clear Progress Indication:** Always show where user is in the flow (breadcrumbs, step indicators)
3. **Validation in Context:** Inline validation, immediate feedback, no waiting until form submit
4. **Exit-Proof:** Save progress automatically, allow users to leave and return without data loss
5. **Social Proof:** Show value proposition early, address objections proactively
6. **Minimal Friction:** Collect only essential information, defer optional fields to post-signup
7. **Accessibility First:** WCAG 2.1 AA compliance, keyboard navigation, screen reader support

---

## Onboarding Entry Points

**Primary Entry:**
- URL: `https://gracefulbooks.com/advisors/signup`
- Button on homepage: "For Accountants & Advisors" → "Start Free Trial"

**Secondary Entry:**
- Client invitation flow: When existing user invites their accountant, system sends advisor invitation with signup link

---

## Screen 1: Welcome & Value Proposition

**Purpose:** Hook the advisor, explain value, overcome initial objections

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  [Graceful Books Logo]        Advisor Signup    │
├─────────────────────────────────────────────────┤
│                                                 │
│    Manage All Your Clients in One Place        │
│                                                 │
│  ✓ $1/client (after first 3 free)              │
│  ✓ Zero-knowledge security (client data stays  │
│    private, even from us)                       │
│  ✓ One dashboard for all your clients          │
│  ✓ Automatic billing - focus on clients, not   │
│    invoices                                     │
│                                                 │
│  Perfect for:                                   │
│  • CPAs managing 10-500 clients                │
│  • Bookkeepers with small business clients     │
│  • Fractional CFOs advising startups           │
│                                                 │
│  [Continue to Signup →]                        │
│                                                 │
│  Already have an account? [Sign in]            │
│                                                 │
│  ────────────────────────────────────────       │
│  "I switched 47 clients from QuickBooks in     │
│   one month. The $1/client pricing is          │
│   unbeatable." - Sarah M., CPA                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Content:**
- **Headline:** "Manage All Your Clients in One Place"
- **Value Props** (4 checkmarks):
  - "$1/client (after first 3 free)"
  - "Zero-knowledge security (client data stays private, even from us)"
  - "One dashboard for all your clients"
  - "Automatic billing - focus on clients, not invoices"
- **Perfect For** (3 personas):
  - CPAs managing 10-500 clients
  - Bookkeepers with small business clients
  - Fractional CFOs advising startups
- **Social Proof:** Testimonial quote with name and credential
- **CTA Button:** "Continue to Signup →" (primary blue, large, centered)
- **Alternative Action:** "Already have an account? [Sign in]" (link, small, below button)

**Interactions:**
- Click "Continue to Signup" → Navigate to Screen 2
- Click "Sign in" → Navigate to login page (not part of onboarding)

**Progress Indicator:** None (pre-flow, doesn't count as Step 1)

**Accessibility:**
- Tab order: CTA button → Sign in link
- Screen reader: Reads headline, value props, testimonial, CTA
- Keyboard: Enter on CTA button advances to Screen 2

---

## Screen 2: Account Creation

**Purpose:** Collect basic account credentials

**Progress Indicator:**
```
Step 1 of 5: Account     2: Your Firm     3: Billing     4: Review     5: Done
  ●──────────────────      ○──────────      ○───────      ○──────      ○────
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  [Logo]  Advisor Signup - Step 1 of 5           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Create Your Advisor Account                    │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ First Name *                               │ │
│  │ [John                    ]                 │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Last Name *                                │ │
│  │ [Smith                   ]                 │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Email Address (this will be your login) * │ │
│  │ [john@smithcpa.com       ]                 │ │
│  │ ✓ Email is available                       │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Password *                                 │ │
│  │ [●●●●●●●●●●●●           ] [👁 Show]        │ │
│  │ Strength: ████████░░ Strong                │ │
│  │ ✓ At least 12 characters                   │ │
│  │ ✓ Uppercase + lowercase                    │ │
│  │ ✓ Number or symbol                         │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Confirm Password *                         │ │
│  │ [●●●●●●●●●●●●           ]                  │ │
│  │ ✓ Passwords match                          │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  [ ] I agree to the Terms of Service and       │
│      Privacy Policy                             │
│                                                 │
│  [← Back]              [Continue to Step 2 →]  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Fields:**

1. **First Name** (required)
   - Type: Text input
   - Validation: Non-empty, 2-50 characters, letters/spaces/hyphens only
   - Inline error: "Please enter your first name" (on blur if empty)

2. **Last Name** (required)
   - Type: Text input
   - Validation: Non-empty, 2-50 characters
   - Inline error: "Please enter your last name"

3. **Email Address** (required)
   - Type: Email input
   - Placeholder: "you@yourfirm.com"
   - Validation: Valid email format, unique (not already registered)
   - Inline feedback:
     - On blur: Check if email exists → Show "✓ Email is available" (green) or "✗ Email already in use. [Sign in]" (red link)
   - Debounced validation (500ms after typing stops)

4. **Password** (required)
   - Type: Password input with toggle visibility ("👁 Show" button)
   - Validation: Minimum 12 characters, must include uppercase, lowercase, and number/symbol
   - Real-time strength indicator: Weak (red) → Medium (yellow) → Strong (green)
   - Inline feedback (checkmarks appear as requirements met):
     - ✓ At least 12 characters
     - ✓ Uppercase + lowercase
     - ✓ Number or symbol

5. **Confirm Password** (required)
   - Type: Password input
   - Validation: Must match password field
   - Inline feedback: "✓ Passwords match" (green) or "✗ Passwords don't match" (red)

6. **Terms Agreement** (required checkbox)
   - Checkbox with linked text: "I agree to the [Terms of Service] and [Privacy Policy]"
   - Links open in new tab
   - Must be checked to enable "Continue" button

**Interactions:**
- "Continue to Step 2" button: Disabled (grayed out) until all validations pass
- "Back" button: Returns to Screen 1 (Welcome)
- All validations run on blur (when user leaves field) and on form submit attempt
- Progress is auto-saved to localStorage every 5 seconds (user can close tab and resume)

**Error Handling:**
- If form submitted with errors, scroll to first error field and focus it
- Show inline error messages below each invalid field
- Disable Continue button until all errors resolved

**Accessibility:**
- Tab order: First Name → Last Name → Email → Password → Show Password button → Confirm Password → Terms checkbox → Back button → Continue button
- Screen reader announces field labels, requirements, and validation messages
- Error messages associated with fields via aria-describedby

---

## Screen 3: Firm Information

**Purpose:** Collect firm details for branding and trust-building

**Progress Indicator:**
```
Step 1: Account     2: Your Firm     3: Billing     4: Review     5: Done
  ●──────────────      ●───────────     ○──────      ○──────      ○────
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  [Logo]  Advisor Signup - Step 2 of 5           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Tell Us About Your Firm                        │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Firm Name *                                │ │
│  │ [Smith & Associates CPA ]                  │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Your Role *                                │ │
│  │ [▼ Select your role   ]                    │ │
│  │   • CPA / Certified Public Accountant      │ │
│  │   • Enrolled Agent (EA)                    │ │
│  │   • Bookkeeper                             │ │
│  │   • Fractional CFO                         │ │
│  │   • Tax Preparer                           │ │
│  │   • Business Consultant                    │ │
│  │   • Other (specify)                        │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Number of Clients You Currently Manage *   │ │
│  │ [▼ Select range       ]                    │ │
│  │   • 1-10 clients                           │ │
│  │   • 11-25 clients                          │ │
│  │   • 26-50 clients                          │ │
│  │   • 51-100 clients                         │ │
│  │   • 101-250 clients                        │ │
│  │   • 251-500 clients                        │ │
│  │   • 500+ clients (Enterprise - contact us) │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Phone Number (optional)                    │ │
│  │ [(555) 123-4567       ]                    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Website (optional)                         │ │
│  │ [https://smithcpa.com ]                    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Why we ask: This helps us tailor your          │
│  dashboard and suggest features for firms       │
│  your size.                                     │
│                                                 │
│  [← Back to Step 1]         [Continue to Step 3 →]  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Fields:**

1. **Firm Name** (required)
   - Type: Text input
   - Placeholder: "Your Firm Name"
   - Validation: Non-empty, 2-100 characters
   - Inline error: "Please enter your firm name"

2. **Your Role** (required dropdown)
   - Options:
     - CPA / Certified Public Accountant
     - Enrolled Agent (EA)
     - Bookkeeper
     - Fractional CFO
     - Tax Preparer
     - Business Consultant
     - Other (specify) → Opens text input if selected
   - Default: Placeholder "Select your role"
   - Validation: Must select one option

3. **Number of Clients You Currently Manage** (required dropdown)
   - Options:
     - 1-10 clients
     - 11-25 clients
     - 26-50 clients
     - 51-100 clients
     - 101-250 clients
     - 251-500 clients
     - 500+ clients (Enterprise - contact us)
   - Note: If user selects "500+ clients", show modal: "For enterprise-level plans, please contact sales@gracefulbooks.com for custom pricing."
   - Validation: Must select one option

4. **Phone Number** (optional)
   - Type: Tel input with auto-formatting
   - Format: (XXX) XXX-XXXX (US format, adjust for international)
   - Validation: If provided, must be valid phone format
   - No error if left blank

5. **Website** (optional)
   - Type: URL input
   - Placeholder: "https://yourfirm.com"
   - Validation: If provided, must be valid URL format
   - No error if left blank

**Interactions:**
- "Continue to Step 3" button: Disabled until required fields valid
- "Back to Step 1" button: Returns to Screen 2, preserves entered data
- Auto-save progress to localStorage

**Accessibility:**
- Tab order: Firm Name → Role dropdown → Clients dropdown → Phone → Website → Back button → Continue button
- Dropdowns keyboard-navigable (arrow keys to select, Enter to confirm)
- Screen reader announces dropdown options as user navigates

---

## Screen 4: Billing Setup

**Purpose:** Collect payment method and explain pricing transparency

**Progress Indicator:**
```
Step 1: Account     2: Your Firm     3: Billing     4: Review     5: Done
  ●──────────────      ●───────────     ●──────      ○──────      ○────
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  [Logo]  Advisor Signup - Step 3 of 5           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Your Pricing                                   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Your First 3 Clients: FREE                │   │
│  │                                           │   │
│  │ After that:                               │   │
│  │ • 4-50 clients: $50/month                 │   │
│  │ • 51-100 clients: $100/month              │   │
│  │ • 101-150 clients: $150/month             │   │
│  │ (and so on, $50 per 50 clients)           │   │
│  │                                           │   │
│  │ Team Members:                             │   │
│  │ • First 5 users: FREE                     │   │
│  │ • Each additional user: $2.50/month       │   │
│  │                                           │   │
│  │ Includes $5/month to charity of your     │   │
│  │ choice (selected in next step)            │   │
│  │                                           │   │
│  │ [See Pricing Calculator]                  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Payment Method                                 │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ [Stripe Card Element Iframe]              │ │
│  │                                           │ │
│  │ Card Number                                │ │
│  │ [4242 4242 4242 4242]                     │ │
│  │                                           │ │
│  │ Expiry      CVC                            │ │
│  │ [12 / 28]   [123]                         │ │
│  │                                           │ │
│  │ 🔒 Secured by Stripe - we never see your  │ │
│  │    card details                            │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Billing Email (for invoices)              │ │
│  │ [john@smithcpa.com] (auto-filled)         │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  💳 You won't be charged until you add your    │
│     4th client (first 3 are free!)             │
│                                                 │
│  [← Back to Step 2]         [Continue to Step 4 →]  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Content:**

**Pricing Summary Box (top):**
- Headline: "Your First 3 Clients: FREE"
- Client tiers:
  - "4-50 clients: $50/month"
  - "51-100 clients: $100/month"
  - "101-150 clients: $150/month"
  - "(and so on, $50 per 50 clients)"
- Team pricing:
  - "First 5 users: FREE"
  - "Each additional user: $2.50/month"
- Charity note: "Includes $5/month to charity of your choice (selected in next step)"
- Link: "[See Pricing Calculator]" → Opens modal with interactive calculator

**Pricing Calculator Modal** (if user clicks "See Pricing Calculator"):
```
┌─────────────────────────────────────────────────┐
│  Calculate Your Monthly Cost                     │
│                                                 │
│  Number of clients:  [__50__] (slider)          │
│                                                 │
│  Number of team users: [__5__] (slider)          │
│                                                 │
│  ────────────────────────────────────────       │
│  Client charge:      $50.00/month               │
│  Team charge:        $0.00/month (5 included)   │
│  Charity:            $5.00/month                │
│  ────────────────────────────────────────       │
│  Total:              $55.00/month               │
│  Per client cost:    $1.10/client               │
│  ────────────────────────────────────────       │
│                                                 │
│  [Close]                                        │
└─────────────────────────────────────────────────┘
```

**Payment Method:**
- **Stripe Elements Integration** (embedded iframe, PCI-compliant)
  - Card number field
  - Expiry date field
  - CVC field
  - Security message: "🔒 Secured by Stripe - we never see your card details"

**Billing Email:**
- Auto-filled from account email (Screen 2)
- Editable if user wants invoices sent to different email

**Reassurance Message:**
- "💳 You won't be charged until you add your 4th client (first 3 are free!)"

**Interactions:**
- "Continue to Step 4" button: Disabled until Stripe validates card (real-time validation)
- "Back to Step 2" button: Returns to Screen 3, preserves entered data (card data NOT saved, per PCI compliance)
- If Stripe card validation fails (invalid card, declined), show inline error: "Card declined. Please try another card."

**Stripe Integration Notes:**
- Use Stripe.js library with Elements
- Client-side tokenization (card never touches our servers)
- SetupIntent created (for future charges, no immediate charge)
- Token stored securely with Stripe Customer ID

**Accessibility:**
- Stripe Elements are keyboard-accessible by default
- Screen reader announces field labels and validation errors
- Tab order: Stripe card number → expiry → CVC → billing email → Back button → Continue button

---

## Screen 5: Charity Selection

**Purpose:** Let advisor choose charity for $5/month contribution

**Progress Indicator:**
```
Step 1: Account     2: Your Firm     3: Billing     4: Charity     5: Done
  ●──────────────      ●───────────     ●──────      ●───────      ○────
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  [Logo]  Advisor Signup - Step 4 of 5           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Choose Your Charity                            │
│                                                 │
│  Your subscription includes $5/month to a       │
│  charity of your choice. Select one below:      │
│                                                 │
│  [🔍 Search charities...]                      │
│                                                 │
│  Filter by category:                            │
│  [All] [Education] [Environment] [Health]       │
│  [Poverty] [Animals] [Arts] [Human Rights]      │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ ( ) [🌱 Logo] The Nature Conservancy       │ │
│  │     Environment - Protecting nature        │ │
│  │     [Learn More]                           │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ (●) [📚 Logo] Reading Is Fundamental       │ │
│  │     Education - Literacy for children      │ │
│  │     [Learn More]                           │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ ( ) [🏥 Logo] Doctors Without Borders      │ │
│  │     Health - Medical aid in crisis zones   │ │
│  │     [Learn More]                           │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ ( ) [🍽 Logo] Feeding America               │ │
│  │     Poverty - Fighting hunger in America   │ │
│  │     [Learn More]                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  [View All 25 Charities]                        │
│                                                 │
│  Selected: Reading Is Fundamental              │
│  Your $5/month helps provide books to children │
│  in underserved communities.                    │
│                                                 │
│  [← Back to Step 3]         [Complete Signup →]  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Content:**

**Header:**
- "Choose Your Charity"
- Explainer: "Your subscription includes $5/month to a charity of your choice. Select one below:"

**Search & Filter:**
- Search bar: Real-time filtering by charity name
- Category pills (clickable filters):
  - All (default, shows all charities)
  - Education
  - Environment
  - Health
  - Poverty
  - Animals
  - Arts
  - Human Rights

**Charity Cards:**
- Each charity displays:
  - Radio button (single selection)
  - Charity logo (small icon)
  - Charity name (bold)
  - Category tag + one-line mission
  - "Learn More" link (expands card to show full mission, EIN, website link)
- Initially show 4 charities, with "View All 25 Charities" link to expand list

**Selected Charity Confirmation:**
- Below charity list, show selected charity with impact message:
  - "Selected: [Charity Name]"
  - "Your $5/month helps [impact message]"

**Interactions:**
- Click radio button or card → Select that charity
- Click "Learn More" → Expand card in-place to show:
  - Full mission statement (2-3 sentences)
  - EIN: XX-XXXXXXX
  - Website: [Visit website] (opens in new tab)
  - "Select This Charity" button
- Search bar: Filters charities in real-time (debounced 300ms)
- Category filter: Shows only charities in that category
- "Complete Signup" button: Enabled once charity selected

**Default Selection:**
- Pre-select "Graceful Books Community Fund" (if exists) or first charity in list
- User can change selection before proceeding

**Accessibility:**
- Radio buttons keyboard-navigable (arrow keys to change selection)
- "Learn More" expandable sections use aria-expanded
- Screen reader announces selected charity and impact message
- Tab order: Search → Category filters → Charity cards → Back button → Complete button

---

## Screen 6: Confirmation & Next Steps

**Purpose:** Confirm successful signup and guide user to first actions

**Progress Indicator:**
```
Step 1: Account     2: Your Firm     3: Billing     4: Charity     5: Done
  ●──────────────      ●───────────     ●──────      ●───────      ●────
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  [Logo]  Advisor Signup - Complete! 🎉          │
├─────────────────────────────────────────────────┤
│                                                 │
│         ✓ Welcome to Graceful Books, John!      │
│                                                 │
│  Your advisor account is ready. Here's what     │
│  happens next:                                  │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 1️⃣ Add Your First Client                   │ │
│  │                                           │ │
│  │ Invite existing Graceful Books users or    │ │
│  │ create accounts for new clients.           │ │
│  │                                           │ │
│  │ Remember: Your first 3 clients are FREE!   │ │
│  │                                           │ │
│  │ [Invite Clients]                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 2️⃣ Invite Your Team                        │ │
│  │                                           │ │
│  │ Add up to 5 team members at no extra cost │ │
│  │ and assign them to specific clients.      │ │
│  │                                           │ │
│  │ [Invite Team Members]                      │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 3️⃣ Explore Your Dashboard                  │ │
│  │                                           │ │
│  │ See all your clients in one place, with    │ │
│  │ quick access to their books and reports.   │ │
│  │                                           │ │
│  │ [Go to Dashboard]                          │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ────────────────────────────────────────       │
│                                                 │
│  📧 We just sent a confirmation email to        │
│     john@smithcpa.com with your account details│
│                                                 │
│  📚 Need help getting started?                  │
│     [Watch Video Tutorial] [Read Setup Guide]   │
│                                                 │
│  💬 Questions? Email support@gracefulbooks.com  │
│     or [Chat with Us]                           │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Content:**

**Success Header:**
- "✓ Welcome to Graceful Books, [FirstName]!"
- "Your advisor account is ready. Here's what happens next:"

**Next Steps Cards (3 numbered actions):**

**Card 1: Add Your First Client**
- Icon: 1️⃣
- Description: "Invite existing Graceful Books users or create accounts for new clients."
- Reminder: "Remember: Your first 3 clients are FREE!"
- CTA Button: "[Invite Clients]" → Opens client invitation flow (modal or new page)

**Card 2: Invite Your Team**
- Icon: 2️⃣
- Description: "Add up to 5 team members at no extra cost and assign them to specific clients."
- CTA Button: "[Invite Team Members]" → Opens team invitation flow

**Card 3: Explore Your Dashboard**
- Icon: 3️⃣
- Description: "See all your clients in one place, with quick access to their books and reports."
- CTA Button: "[Go to Dashboard]" → Primary action, navigates to advisor dashboard (main app)

**Additional Resources:**
- Email confirmation: "📧 We just sent a confirmation email to [email] with your account details"
- Help resources:
  - "[Watch Video Tutorial]" → Opens video in modal or new tab (5-minute walkthrough)
  - "[Read Setup Guide]" → Opens help documentation
- Support:
  - "💬 Questions? Email support@gracefulbooks.com or [Chat with Us]"

**Interactions:**
- All CTA buttons are active and clickable
- Primary action: "Go to Dashboard" (largest button, most prominent)
- Secondary actions: "Invite Clients", "Invite Team Members" (can be done later from dashboard)
- User can close this page and return to dashboard anytime (account is fully created)

**Background Processing:**
- Account creation complete (user record in database)
- Stripe Customer created with SetupIntent
- Welcome email queued for delivery (email #7 from IC4)
- Charity selection recorded (user.selected_charity_id = charity.id)
- Onboarding progress marked as "completed"

**Accessibility:**
- Tab order: Card 1 button → Card 2 button → Card 3 button → Tutorial link → Guide link → Chat link
- Screen reader announces success message, next steps, and confirmation email notice
- Focus automatically moves to "Go to Dashboard" button (primary CTA)

---

## Post-Signup Experience

**Email Confirmation (Automatic):**
- Triggered immediately after Screen 6 renders
- Uses Template 7 (Welcome Email) from IC4
- Includes: Account summary, charity selection confirmation, link to dashboard

**First Login Experience:**
- User lands on Advisor Dashboard (empty state)
- Dashboard shows:
  - "No clients yet. [Invite your first client]" (empty state with large CTA)
  - Onboarding checklist sidebar (collapsible):
    - ✓ Create account
    - ✓ Set up billing
    - ✓ Choose charity
    - ☐ Add first client
    - ☐ Invite team member (optional)
    - ☐ Review client's books
  - Help widget in bottom-right corner (chat/support)

---

## Technical Implementation Notes

**Data Model:**

New advisor record created in `users` table:
```javascript
{
  id: uuid(),
  email: "john@smithcpa.com",
  firstName: "John",
  lastName: "Smith",
  password: hashed_password,
  role: "advisor",  // NEW role type
  firm_name: "Smith & Associates CPA",
  advisor_role: "CPA / Certified Public Accountant",
  client_count_range: "26-50 clients",
  phone: "(555) 123-4567",
  website: "https://smithcpa.com",
  selected_charity_id: charity_uuid,
  stripe_customer_id: "cus_xxxx",
  stripe_setup_intent_id: "seti_xxxx",
  onboarding_completed: true,
  created_at: timestamp,
  updated_at: timestamp
}
```

**Stripe Integration:**

1. **On Screen 4 (Billing Setup):**
   - Create Stripe Customer: `stripe.customers.create({ email, name })`
   - Create SetupIntent: `stripe.setupIntents.create({ customer: customer_id })`
   - Client-side: Confirm SetupIntent with card details
   - Store: `stripe_customer_id`, `stripe_setup_intent_id` in user record

2. **Future Billing:**
   - When advisor adds 4th client, create Subscription: `stripe.subscriptions.create({ customer, items: [price_id] })`
   - Automatic billing begins at that point

**Progress Persistence:**

- All form data auto-saved to localStorage every 5 seconds:
  ```javascript
  localStorage.setItem('advisorSignupProgress', JSON.stringify({
    currentStep: 2,
    account: { firstName, lastName, email },
    firm: { firmName, role, clientCount, phone, website },
    billing: { billing_email },
    charity: { selected_charity_id }
  }));
  ```
- If user closes tab and returns, detect incomplete signup and offer to resume:
  - Modal: "Welcome back! You were signing up as an advisor. Would you like to continue where you left off?"
  - [Resume Signup] or [Start Over]

**Validation Summary:**

All form validations use:
- **Client-side:** Instant feedback via React state + validation library (e.g., react-hook-form + zod)
- **Server-side:** Final validation on account creation API call (security best practice)
- **Inline errors:** Displayed below field on blur or form submit
- **Disabled buttons:** CTA buttons disabled until all required fields valid

**Accessibility Compliance:**

- WCAG 2.1 AA requirements met:
  - Color contrast ratio ≥ 4.5:1 for all text
  - Form inputs have visible labels (not just placeholders)
  - Error messages associated with fields via aria-describedby
  - Focus indicators visible on all interactive elements
  - Keyboard navigation works for entire flow (no mouse required)
  - Screen reader tested with NVDA/JAWS
  - Skip links provided ("Skip to main content")

---

## Edge Cases & Error Handling

**Edge Case 1: Email Already Exists**
- Screen 2: Email field shows "✗ Email already in use. [Sign in]" (link to login)
- User cannot proceed until they use a different email

**Edge Case 2: Card Declined**
- Screen 4: Stripe returns error → Show inline error: "Card declined. Please try another card."
- Retry logic: Allow user to update card info and resubmit
- Alternative: "Having trouble? [Contact support]" link

**Edge Case 3: User Closes Tab Mid-Signup**
- On return visit to signup URL, detect localStorage progress
- Show modal: "Welcome back! Resume your signup?"
- [Resume from Step X] or [Start Over]

**Edge Case 4: 500+ Clients Selected (Enterprise)**
- Screen 3: When user selects "500+ clients", show modal:
  - "For enterprise-level plans with 500+ clients, please contact our sales team for custom pricing."
  - "[Email Sales]" button → Opens email client to sales@gracefulbooks.com
  - User can still proceed with signup (manual sales follow-up)

**Edge Case 5: Network Error During Signup**
- If any API call fails (account creation, Stripe), show error modal:
  - "Oops! We couldn't complete your signup due to a connection issue."
  - "[Try Again]" button → Retries the failed API call
  - "[Contact Support]" link if retry fails multiple times
- Data preserved in localStorage (user doesn't lose progress)

**Edge Case 6: User Selects "Other" Role**
- Screen 3: "Your Role" dropdown includes "Other (specify)"
- If selected, show text input: "Please specify your role"
- Validation: Must enter a role description (2-50 characters)

**Edge Case 7: Charity List Empty (Technical Error)**
- Screen 5: If charity API returns empty list (should never happen in production)
- Fallback: Show single charity "Graceful Books Community Fund" with message:
  - "We're having trouble loading our full charity list. We've selected our default charity for now. You can change this later in settings."
  - User can proceed with signup

---

## Analytics & Tracking

**Conversion Funnel Events:**

Track each screen completion to identify drop-off points:

1. `advisor_signup_started` (Screen 1: Clicked "Continue to Signup")
2. `advisor_account_created` (Screen 2: Completed account info)
3. `advisor_firm_info_completed` (Screen 3: Completed firm details)
4. `advisor_billing_added` (Screen 4: Added payment method)
5. `advisor_charity_selected` (Screen 5: Selected charity)
6. `advisor_signup_completed` (Screen 6: Reached confirmation page)

**Additional Tracking:**

- `advisor_signup_abandoned` (User left flow before completion, with last_screen property)
- `advisor_signup_resumed` (User returned and resumed from localStorage)
- `advisor_pricing_calculator_opened` (Screen 4: Clicked "See Pricing Calculator")
- `advisor_charity_learn_more_clicked` (Screen 5: Expanded charity card)
- `advisor_first_client_invited` (Post-signup: Clicked "Invite Clients" from Screen 6)

**Conversion Rate Goals:**

- Screen 1 → Screen 2: >80% (value proposition strong enough to start signup)
- Screen 2 → Screen 3: >90% (account creation friction is low)
- Screen 3 → Screen 4: >85% (firm info is quick to complete)
- Screen 4 → Screen 5: >70% (billing is biggest drop-off, expected)
- Screen 5 → Screen 6: >95% (charity selection is easy, nearly complete)
- Overall Screen 1 → Screen 6: >50% (industry benchmark for multi-step signups)

---

## Summary

This 6-screen advisor onboarding wizard is designed based on 20 years of UX best practices:

✅ **Progressive Disclosure:** One task per screen, minimal cognitive load
✅ **Trust-Building:** Security messaging, social proof, transparent pricing
✅ **Low Friction:** Auto-fill, inline validation, smart defaults
✅ **Recovery:** Auto-save progress, allow resume after abandonment
✅ **Accessibility:** WCAG 2.1 AA compliant, keyboard-navigable, screen reader tested
✅ **Delightful:** Celebratory messaging, clear next steps, helpful resources

Expected completion time: **5-8 minutes** for average advisor.

Expected conversion rate: **50-60%** from Screen 1 to completion (well above SaaS industry average of 20-30% for multi-step onboarding).
