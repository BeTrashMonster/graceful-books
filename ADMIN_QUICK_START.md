# Admin Quick Start Guide - Charity Management

Welcome to the Graceful Books Admin Panel! This guide will help you manage charities quickly and efficiently.

## Accessing the Admin Panel

1. **Log in** to your admin account
2. Navigate to: **`/admin/charities`**
3. You'll see the Charity Management Dashboard

> **Note:** Only users with admin role can access this page. Non-admin users will see a 403 error.

---

## Setting Up Your Admin Account (Dev Mode)

For development, set your admin role in localStorage:

```javascript
// Open browser console (F12)
localStorage.setItem('graceful_books_user', JSON.stringify({
  id: 'admin-123',
  email: 'admin@gracefulbooks.com',
  role: 'admin',
  name: 'Admin User'
}));

// Refresh the page
location.reload();
```

---

## Dashboard Overview

When you first open the admin panel, you'll see:

### Statistics Cards
- **Total Charities** - All charities in the system
- **Verified** - Available for users to select (green)
- **Pending Verification** - Awaiting your approval (yellow)
- **Rejected** - Failed verification (red)
- **Inactive** - Removed from selection (gray)

**Tip:** Click any card to filter the list by that status!

### Charity List
- Search by name, EIN, or description
- View all charity details
- Sortable columns

---

## Adding a New Charity

### Step 1: Click "Add Charity" Button

### Step 2: Fill Out the Form

**Required Fields:**
- **Charity Name:** Full legal name (e.g., "Khan Academy")
- **EIN (Tax ID):** Format: `XX-XXXXXXX` (e.g., "26-1544963")
- **Category:** Select from dropdown (Education, Environment, Health, etc.)
- **Website:** Full URL with HTTPS (e.g., "https://www.khanacademy.org")
- **Description:** 1-2 sentences about mission (min 20 characters)

**Optional Fields:**
- **Logo URL:** Direct link to charity's logo image

### Step 3: Submit

- Click "Create Charity"
- Charity is created with **PENDING** status
- You'll see it in the list with a yellow "Pending" badge

---

## Verifying a Charity (5-Step Process)

### Step 1: Initial Submission ✅ (Done when you create it)

### Step 2: EIN Validation ✅ (Automatic)
The system checks EIN format when you submit the form.

### Step 3: IRS 501(c)(3) Verification

1. Click the charity name or "View" button
2. In the detail modal, find **"Step 3: IRS Verification"**
3. Click **"Open IRS Tax Exempt Organization Search"**
4. In the IRS website:
   - Enter the charity's EIN
   - Click "Search"
   - Verify the organization appears with:
     - **Status:** Active
     - **Subsection:** 501(c)(3)
     - **Deductibility Code:** PC (Public Charity) or similar
5. Back in Graceful Books, add a verification note:
   ```
   Verified via IRS EOS on 2026-01-19. Status: Active PC.
   ```
6. Click "Add Note"

### Step 4: Website & Mission Verification

1. Visit the charity's website (click the link in the detail modal)
2. Check for:
   - ✅ HTTPS (secure connection)
   - ✅ Professional design
   - ✅ Contact information visible
   - ✅ Mission statement matches description
   - ✅ Financial transparency (annual reports, 990 forms)
   - ❌ **Red flags:** No HTTPS, no contact, outdated, suspicious donation requests

3. Add a verification note:
   ```
   Website verified 2026-01-19. Mission aligns. Transparency: Good.
   ```
4. Click "Add Note"

### Step 5: Final Approval

1. Review all information and notes
2. Click **"✓ Verify Charity"** button
3. Confirm in the popup
4. Status changes from **PENDING** to **VERIFIED** (green badge)
5. Charity now appears in user charity selection dropdown

**Done!** 🎉

---

## Rejecting a Charity

If verification fails:

1. In the charity detail modal, scroll to **"Or Reject"**
2. Enter rejection reason in the textarea:
   ```
   EIN not found in IRS database
   ```
   or
   ```
   Website appears suspicious - no HTTPS, no contact info
   ```
3. Click **"✗ Reject Charity"**
4. Confirm in the popup
5. Status changes to **REJECTED** (red badge)
6. Charity will NOT appear in user dropdown

---

## Common Tasks

### Searching for a Charity
- Use the search box at the top
- Searches: Name, EIN, Description
- Real-time filtering

### Filtering by Status
- Click any of the 5 statistics cards
- List updates instantly
- Click "Total Charities" to see all

### Updating Charity Details
1. Click charity name → Opens detail modal
2. Details can be updated via service (UI coming soon)

### Marking as Inactive
1. Click charity name → Opens detail modal
2. Scroll to bottom
3. Click **"Mark as Inactive"**
4. Charity removed from user selection (soft delete)

---

## Pre-Seeded Charities

The system comes with 15 pre-verified charities:

**Education:**
- Khan Academy
- Teach For America
- **Graceful Books Community Fund** (default)

**Environment:**
- The Nature Conservancy
- World Wildlife Fund

**Health:**
- St. Jude Children's Research Hospital
- Doctors Without Borders

**Poverty Relief:**
- Feeding America
- GiveDirectly

**Animal Welfare:**
- ASPCA

**Human Rights:**
- ACLU Foundation

**Disaster Relief:**
- American Red Cross

**Arts & Culture:**
- The Metropolitan Museum of Art

**Community:**
- Habitat for Humanity
- United Way Worldwide

All pre-seeded charities are **VERIFIED** and ready for user selection.

---

## Tips & Best Practices

### EIN Format
- Must be: `XX-XXXXXXX` (2 digits, hyphen, 7 digits)
- Example: `26-1544963`
- **Common mistake:** Entering without hyphen → Form will reject

### Verification Notes
- Be specific: Include dates, what you verified, results
- Good: "Verified via IRS EOS on 2026-01-19. Status: Active PC."
- Bad: "Looks good"

### IRS Verification
- Use official IRS EOS search: https://apps.irs.gov/app/eos/
- Check **both** EIN and organization name
- Verify **Active** status (not revoked)
- Confirm **501(c)(3)** subsection

### Website Checks
- Must have HTTPS (secure)
- Check for recent content (not abandoned)
- Verify contact information exists
- Look for transparency (financial reports, 990 forms)

### When to Reject
- EIN not found in IRS database
- Organization status is "Revoked" or "Terminated"
- Website appears fraudulent or suspicious
- Mission doesn't match description
- No financial transparency

---

## Keyboard Shortcuts

- **Tab** - Navigate between elements
- **Enter** - Click focused button
- **Esc** - Close modal
- **Arrow Keys** - Navigate dropdowns

All UI components are fully keyboard accessible!

---

## Troubleshooting

### "I can't access /admin/charities - I get 403 Forbidden"
- You need admin role in localStorage
- See "Setting Up Your Admin Account" above

### "EIN validation fails but format looks correct"
- Must be exactly: `XX-XXXXXXX`
- 2 digits, hyphen, 7 digits
- No spaces, no extra characters

### "IRS website won't load"
- IRS EOS search may be down temporarily
- Try again later or contact IRS support

### "Charity isn't showing in user dropdown"
- Check status: Must be **VERIFIED** (green)
- PENDING, REJECTED, and INACTIVE don't show

---

## Need Help?

- **Technical Issues:** Check console (F12) for errors
- **IRS Verification:** https://www.irs.gov/charities-non-profits
- **Documentation:** See `docs/IC3_ADMIN_CHARITY_MANAGEMENT_IMPLEMENTATION.md`

---

**Built with care by the Graceful Books team** 💙
