# Infrastructure Capstone & Group J Implementation Guidelines
**User Story Format & WCAG 2.1 AA Compliance - Quick Reference for Agents**

## WCAG 2.1 AA Compliance Checklist (Apply to ALL UI Components)

Every UI component in IC and J must meet these requirements:

### ✅ Perceivable
- [ ] **Color contrast ratio ≥ 4.5:1** for normal text
- [ ] **Color contrast ratio ≥ 3:1** for large text (18pt+ or 14pt+ bold)
- [ ] **Color contrast ratio ≥ 3:1** for UI components and graphics
- [ ] **Text alternatives (alt text)** for all images, icons, graphics
- [ ] **Captions/transcripts** for video content
- [ ] **Information not conveyed by color alone** (use icons, labels, patterns)

### ✅ Operable
- [ ] **All functionality available via keyboard** (Tab, Enter, Esc, Arrow keys)
- [ ] **No keyboard traps** (user can navigate away from any element)
- [ ] **Skip links** provided ("Skip to main content")
- [ ] **Focus indicators visible** (blue outline or similar on focused elements)
- [ ] **Focus order logical** (follows visual layout top-to-bottom, left-to-right)
- [ ] **Link/button purpose clear** from text or context
- [ ] **No time limits** or provide option to extend (e.g., session timeout warnings)

### ✅ Understandable
- [ ] **Form labels visible** (not just placeholders)
- [ ] **Error messages clear and specific** ("Email is required" not "Invalid input")
- [ ] **Error messages associated with fields** via aria-describedby
- [ ] **Required fields marked** with asterisk (*) or "required" label
- [ ] **Instructions provided** for complex interactions
- [ ] **Consistent navigation** across all pages
- [ ] **Consistent identification** (icons/buttons mean same thing everywhere)

### ✅ Robust
- [ ] **Valid HTML** (passes W3C validation)
- [ ] **ARIA roles/properties used correctly** (avoid over-using ARIA)
- [ ] **Name, role, value for all UI components** (screen readers can identify)
- [ ] **Status messages announced** to screen readers (aria-live regions)

---

## User Story Templates for All IC & J Features

Use these templates when implementing. Add to each feature spec:

### Infrastructure Capstone (IC)

**IC-0: Group I Backend Validation**
```
As a project manager,
I want to verify all Group I backends are operational with passing tests,
So that IC1 UI components can be built on a solid foundation without blockers.
```

**IC1: Complete Group I UI Components**
```
As a business owner with team members,
I want to see and resolve data conflicts when my team edits the same transaction,
So that we don't lose anyone's work.

As a team member,
I want to comment on transactions and @mention colleagues,
So that we can collaborate effectively within our books.
```

**IC2: Billing Infrastructure**
```
As an advisor (accountant/CPA),
I want automatic billing that adjusts when I add or remove clients,
So that I can focus on serving clients instead of managing subscriptions.

As a client under an advisor's plan,
I want my subscription automatically covered by my advisor,
So that I don't have to manage payment separately.
```

**IC2.5: Charity Payment Distribution**
```
As the platform admin,
I want a monthly report of charity contributions to distribute,
So that I can ensure user donations actually reach the selected charities.

As a user,
I want an annual contribution receipt,
So that I can claim my charitable contribution for tax purposes.
```

**IC3: Admin Panel - Charity Management**
```
As the platform admin,
I want to verify charities before making them available to users,
So that contributions only go to legitimate 501(c)(3) organizations.

As a user,
I want to select my charity from a curated list,
So that I know my $5/month goes to a reputable organization.
```

**IC4: Email Service Integration**
```
As an advisor,
I want to send client invitations via email,
So that my clients can easily accept and connect their books.

As a client,
I want email notifications when my advisor shares scenarios or grants tax prep access,
So that I don't miss important updates.
```

**IC5: OpenSpec Documentation Sync**
```
As a developer agent,
I want OpenSpec files that match the current roadmap,
So that I implement the correct features without confusion.
```

**IC6: Infrastructure Capstone Validation**
```
As a project manager,
I want comprehensive validation of all IC features before Group J begins,
So that Group J is built on solid, tested infrastructure.
```

### Group J (Moonshots)

**J1: Financial Flow Widget**
```
As a non-accountant business owner,
I want to see my money flowing through my business visually,
So that I can understand my finances without reading spreadsheets.

As a landlord who only collects rent,
I want to toggle off barter transactions in my financial flow,
So that I see only the cash flows relevant to my business.
```

**J2: Smart Automation Assistant**
```
As a busy entrepreneur,
I want the system to suggest transaction categorizations,
So that I spend less time on bookkeeping.
```

**J3: Scenario Planner**
```
As a business owner planning growth,
I want to model "what-if" scenarios (hiring, new product line, loan),
So that I can make informed decisions about my business future.

As an advisor,
I want to push scenario analyses to my clients,
So that they can see my recommendations with real numbers.
```

**J4: Key Financial Metrics Reports**
```
As an accountant/advisor,
I want professional financial ratio reports,
So that I can prepare for client conversations with meaningful data.

As a client with barter transactions,
I want to include or exclude barter from revenue metrics,
So that I can analyze different views of my profitability.
```

**J5: Financial Goals Tracking**
```
As a goal-oriented business owner,
I want to set and track financial goals (revenue, profit, runway),
So that I can stay motivated and measure progress.
```

**J6: Emergency Fund & Runway Calculator**
```
As a business owner,
I want to see how many months of runway I have at current burn rate,
So that I can plan for cash flow needs proactively.

As an advisor,
I want to model revenue/expense changes to show runway impact,
So that I can help clients understand their cash position.
```

**J7: Mentor/Advisor Portal**
```
As an accountant managing 50+ clients,
I want all my client books in one multi-client dashboard,
So that I can efficiently serve all my clients without switching between accounts.

As a client,
I want my accountant to access my books securely (zero-knowledge),
So that I get professional help while maintaining data privacy.

As a team member working for an advisor,
I want access to only the clients assigned to me,
So that I can focus on my responsibilities without seeing irrelevant data.
```

**J8: Tax Time Preparation Mode**
```
As a business owner approaching tax season,
I want a guided workflow to gather all my tax documents,
So that I can hand my accountant an organized package.

As an advisor,
I want to grant clients temporary tax prep access,
So that they can prepare their data and I can review it during tax season.
```

**J9: CSV Import/Export**
```
As a user switching from another accounting system,
I want to import my transaction history via CSV,
So that I don't lose historical data when migrating.

As a user,
I want to export my books to CSV,
So that I can use my data in Excel or other tools.
```

---

## WCAG 2.1 AA Implementation Notes by Feature Type

### Form-Heavy Features (IC1, IC2, IC3, J7 Onboarding)
**Critical requirements:**
- Visible labels for all inputs (not just placeholders)
- Error messages below fields with aria-describedby
- Required field indicators (asterisks or "required" text)
- Submit buttons disabled until form valid
- Focus moves to first error on validation failure
- Success confirmations announced to screen readers

**Example:**
```html
<label for="email">Email Address <span class="required">*</span></label>
<input
  type="email"
  id="email"
  aria-describedby="email-error"
  aria-required="true"
/>
<span id="email-error" class="error" role="alert">
  Please enter a valid email address
</span>
```

### Dashboard/Data Visualization Features (J1, J4, J6)
**Critical requirements:**
- Screen reader descriptions for visual data
- Keyboard navigation for all interactive nodes/charts
- Data tables as fallback for complex visualizations
- Sufficient color contrast for all chart elements
- Alternative text descriptions for trends/patterns

**Example:**
```html
<div
  class="financial-flow-widget"
  role="img"
  aria-label="Financial flow visualization showing $50,000 revenue flowing to cash and accounts receivable"
>
  <!-- Visual chart here -->
</div>
<details class="sr-only">
  <summary>Financial Flow Data Table</summary>
  <table><!-- Accessible data table --></table>
</details>
```

### Modal/Popup Features (IC1 Conflict Resolution, J3 Scenario Sharing)
**Critical requirements:**
- Focus trap (Tab cycles within modal)
- Esc key closes modal
- Focus returns to trigger element on close
- Backdrop prevents background interaction
- aria-modal="true" and role="dialog"
- Descriptive aria-labelledby for modal title

**Example:**
```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="conflict-title"
>
  <h2 id="conflict-title">Resolve Transaction Conflict</h2>
  <!-- Modal content -->
  <button aria-label="Close conflict resolution modal">×</button>
</div>
```

### Navigation-Heavy Features (J7 Advisor Dashboard, Client Switcher)
**Critical requirements:**
- Skip links to main content
- Breadcrumb navigation with aria-label="Breadcrumb"
- Current page indicated with aria-current="page"
- Dropdown menus keyboard-accessible (arrow keys)
- Search functionality with clear labels

---

## Testing Checklist (Run Before Marking Feature Complete)

### Keyboard Navigation Test
- [ ] Tab through entire feature (all interactive elements reachable)
- [ ] Tab order follows visual layout (logical flow)
- [ ] Enter/Space activate buttons and links
- [ ] Esc closes modals and dropdowns
- [ ] Arrow keys navigate menus and lists
- [ ] No keyboard traps (can always Tab away)

### Screen Reader Test (NVDA or JAWS)
- [ ] All images/icons have alt text announced
- [ ] Form labels announced with inputs
- [ ] Error messages announced when triggered
- [ ] Button purposes clear from announced text
- [ ] Data visualizations have text descriptions
- [ ] Page headings create logical outline (H1 → H2 → H3)

### Color Contrast Test (Chrome DevTools or WebAIM Contrast Checker)
- [ ] All text meets 4.5:1 ratio (normal) or 3:1 (large)
- [ ] All buttons/form controls meet 3:1 ratio
- [ ] Icons/graphics meet 3:1 ratio
- [ ] Focus indicators visible against all backgrounds

### WAVE Accessibility Scanner
- [ ] 0 errors (red icons)
- [ ] 0 contrast errors
- [ ] Warnings reviewed and justified or fixed
- [ ] Structural elements present (headings, landmarks, lists)

### Manual Validation
- [ ] Form can be completed without mouse
- [ ] Error messages specific and helpful
- [ ] Success messages clear and encouraging
- [ ] All interactive elements have visible focus
- [ ] No information conveyed by color alone

---

## Common WCAG Pitfalls to Avoid

❌ **DON'T:**
- Use placeholder as the only label
- Convey status only with color (red = error, green = success)
- Create keyboard traps in modals or dropdowns
- Use generic link text ("Click here", "Read more")
- Auto-play videos or animations without controls
- Set low contrast for "subtle" design aesthetic
- Disable zoom/pinch on mobile
- Use CAPTCHA without audio alternative

✅ **DO:**
- Provide visible labels above/beside inputs
- Use icons + color + text for status ("✓ Success", "✗ Error")
- Implement focus traps in modals (Tab cycles, Esc escapes)
- Use descriptive link text ("Download tax package", "View transaction details")
- Require user interaction to start media
- Maintain 4.5:1 contrast minimum for all text
- Allow browser zoom up to 200%
- Use accessible alternatives to CAPTCHA (honeypot, rate limiting)

---

## Quick Reference: aria-* Attributes

| Attribute | Use Case | Example |
|-----------|----------|---------|
| `aria-label` | Label for element with no visible text | `<button aria-label="Close modal">×</button>` |
| `aria-labelledby` | Reference visible element as label | `<dialog aria-labelledby="modal-title">` |
| `aria-describedby` | Additional description (errors, hints) | `<input aria-describedby="email-error">` |
| `aria-required` | Mark required form fields | `<input aria-required="true">` |
| `aria-invalid` | Mark invalid form fields | `<input aria-invalid="true">` |
| `aria-live` | Announce dynamic updates | `<div aria-live="polite" role="status">` |
| `aria-current` | Current item in navigation | `<a aria-current="page">Dashboard</a>` |
| `aria-expanded` | Dropdown/accordion state | `<button aria-expanded="false">Menu</button>` |
| `aria-hidden` | Hide decorative elements | `<span aria-hidden="true">→</span>` |
| `aria-modal` | Mark modal dialogs | `<div role="dialog" aria-modal="true">` |

---

## Resources

- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **WebAIM Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **WAVE Browser Extension:** https://wave.webaim.org/extension/
- **ARIA Authoring Practices:** https://www.w3.org/WAI/ARIA/apg/
- **Screen Readers:** NVDA (Windows, free), JAWS (Windows, paid), VoiceOver (Mac, built-in)

---

## Implementation Priority

1. **Must Have (Launch Blockers):**
   - Keyboard navigation works
   - Color contrast meets 4.5:1
   - Form labels visible
   - Error messages clear

2. **Should Have (Pre-Launch):**
   - Screen reader tested
   - WAVE scan passes
   - Focus indicators visible
   - ARIA attributes correct

3. **Nice to Have (Post-Launch Refinement):**
   - Enhanced screen reader experience
   - Detailed aria-live announcements
   - Keyboard shortcuts
   - High contrast mode

---

**Bottom Line:** Every IC and J feature MUST meet WCAG 2.1 AA before being marked complete. Accessibility is not optional, it's a core requirement aligned with Graceful Books' mission of being judgment-free and inclusive for all users.
Human: awesome! I need to go to bed but I want to pass on that by the end of the night (11:30pm PST), please ensure that you've finished adding the summary roadmap to the map and ensure that the J7 docs are referenced. Love you!