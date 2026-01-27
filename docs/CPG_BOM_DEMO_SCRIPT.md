# CPG BOM System Demo Script

**Event:** Thursday BOM System Demo
**Duration:** 25 minutes (20 min demo + 5 min Q&A)
**Audience:** Stakeholders, product team, potential users
**Presenter:** [Your Name]

---

## Pre-Demo Setup (15 minutes before)

### Environment Check
```bash
# 1. Start dev server
npm run dev

# 2. Open browser to http://localhost:5173

# 3. Clear existing data (if needed)
# Open browser console and run:
# await clearCPGDemoData('your-company-id')

# 4. Seed demo data
# await seedCPGDemoData('your-company-id', 'your-device-id')

# 5. Verify data loaded correctly
# Check categories, products, recipes, invoices all present

# 6. Open DevTools console (monitor for errors)

# 7. Set zoom to 100%

# 8. Close unnecessary tabs/windows

# 9. Disable notifications

# 10. Have backup browser ready
```

### Materials Ready
- [ ] This script (printed or on second monitor)
- [ ] Backup screenshots of expected results
- [ ] Calculator (for margin calculations)
- [ ] Notepad for capturing questions/feedback
- [ ] Glass of water

### Screen Share Setup
- [ ] Close personal tabs/windows
- [ ] Hide bookmarks bar
- [ ] Increase font size for readability (120-150%)
- [ ] Test screen share audio/video
- [ ] Position windows for easy navigation

---

## Opening (2 minutes)

### Hook (30 seconds)

> "Have you ever wondered exactly how much it costs to manufacture one of your products? Not just the ingredients, but everything - the bottle, the box, the label? And when those costs change, do you know immediately how it affects your margins?"

> "Today I'm excited to show you a system that answers these questions automatically. This is the CPG Bill of Materials system for Graceful Books."

### Problem Statement (1 minute)

> "Let me tell you about Sarah. She makes artisanal body oils. She knows she buys bulk oil for around 40 cents an ounce. She knows bottles cost about 50 cents each. But when her supplier changes prices, or she switches to a different size bottle, she spends hours in spreadsheets trying to figure out her new cost per product."

> "And it's not just Sarah. Every CPG entrepreneur faces this challenge:"

**Write on screen/whiteboard:**
- ❌ Spreadsheet hell (formulas break, versions multiply)
- ❌ Manual calculations (time-consuming, error-prone)
- ❌ No price change alerts (margins erode silently)
- ❌ Can't answer: "Can I afford this distributor deal?"

> "What if we could solve all of this automatically?"

### Solution Preview (30 seconds)

> "The BOM system does four things:"

**Show slide or write:**
1. **Tracks** raw material costs from invoices
2. **Defines** product recipes (bills of materials)
3. **Calculates** true product costs automatically
4. **Updates** instantly when prices change

> "Let me show you how it works."

---

## Demo Flow (18 minutes)

### Part 1: Understanding the Hierarchy (2 minutes)

> "Let's start with the data model. There are three levels:"

**Draw/show diagram:**
```
RAW MATERIALS (Categories)
    ↓ (combine via recipes)
FINISHED PRODUCTS
    ↓ (have a)
COST PER UNIT (CPU)
```

> "We're going to build Sarah's business. She makes two products: a 1-ounce body oil and a 5-ounce body oil."

> "To make these, she needs:"
- Bulk oil (measured in ounces)
- Bottles (two sizes: 1oz and 5oz)
- Boxes (two sizes: 1oz and 5oz)
- Labels (one size fits all)

> "Let's set this up step by step."

---

### Part 2: Categories - Raw Materials (4 minutes)

**Navigate to CPG Dashboard → Categories**

> "First, we define our raw material categories. Think of these as the building blocks."

**Create Category #1: Oil**
```
Click "Add Category"
Name: Oil - bulk
Description: Essential oil bulk purchases
Unit of Measure: oz
Variants: [leave empty - just bulk oil]
Click "Save"
```

> "Notice the unit of measure. This is important because we need to track ounces of oil."

**Create Category #2: Bottle**
```
Click "Add Category"
Name: Bottle
Description: Glass bottles for packaging
Unit of Measure: each
Variants: 1oz, 5oz [add both]
Click "Save"
```

> "Here we have variants. Sarah buys two different bottle sizes, so we track them separately. Each is counted as 'each' - one bottle at a time."

**Create Category #3: Box** (quickly)
```
Name: Box
Unit: each
Variants: 1oz, 5oz
Save
```

**Create Category #4: Label** (quickly)
```
Name: Label
Unit: each
Variants: [none]
Save
```

> "Great! Now we have all our raw materials defined. Notice each has a unit of measure - that's critical for accurate cost calculations."

**Show categories list**
- Oil - bulk (oz)
- Bottle (each) - variants: 1oz, 5oz
- Box (each) - variants: 1oz, 5oz
- Label (each)

---

### Part 3: Finished Products (2 minutes)

**Navigate to Products**

> "Now let's define what Sarah actually sells to customers."

**Create Product #1: 1oz Body Oil**
```
Click "Add Product"
Name: 1oz Body Oil
SKU: BO-1OZ
MSRP: $10.00
Unit of Measure: each
Pieces per Unit: 1
Click "Save"
```

> "The MSRP is what she sells it for. We'll compare that to the cost in a moment."

**Create Product #2: 5oz Body Oil** (quickly)
```
Name: 5oz Body Oil
SKU: BO-5OZ
MSRP: $25.00
Unit: each
Pieces per Unit: 1
Save
```

**Show products list**
- 1oz Body Oil (BO-1OZ) - MSRP: $10.00 - CPU: [empty - no recipe yet]
- 5oz Body Oil (BO-5OZ) - MSRP: $25.00 - CPU: [empty - no recipe yet]

> "Notice the CPU column is empty. That's because we haven't told the system how to make these products yet. That's what recipes are for."

---

### Part 4: Recipes - The Magic (5 minutes)

**Click on "1oz Body Oil" → "Edit Recipe"**

> "This is where we define the Bill of Materials. Let's build the recipe for our 1oz body oil."

> "To make one bottle of 1oz body oil, Sarah needs:"

**Add Component #1: Oil**
```
Click "Add Component"
Category: Oil - bulk
Variant: [none - it's bulk]
Quantity: 1.00
Notes: [leave empty]
Click "Save Component"
```

> "1 ounce of oil. Simple enough."

**Add Component #2: Bottle**
```
Click "Add Component"
Category: Bottle
Variant: 1oz
Quantity: 1
Save Component
```

> "One 1-ounce bottle to put it in."

**Add Component #3: Box**
```
Category: Box
Variant: 1oz
Quantity: 1
Save Component
```

> "One box to package it."

**Add Component #4: Label**
```
Category: Label
Variant: [none]
Quantity: 1
Save Component
```

> "And one label."

**Show recipe summary**
```
Recipe for 1oz Body Oil:
- Oil - bulk: 1.00 oz
- Bottle (1oz): 1 each
- Box (1oz): 1 each
- Label: 1 each

Estimated CPU: Incomplete ⚠️
(Awaiting cost data)
```

> "See that warning? The system knows the recipe, but we haven't entered any invoices yet, so it can't calculate the cost. Let's fix that."

**Click "Save Recipe"**

---

### Part 5: Invoices - Real Costs (6 minutes)

**Navigate to Invoices → Add Invoice**

> "Now we enter Sarah's actual purchase invoices. This is where the magic happens - real costs from real suppliers."

**Invoice #1: Bulk Oil**
```
Invoice Number: INV-001
Invoice Date: [30 days ago]
Vendor Name: ABC Oils
Total Invoice Amount: $504.00

Line Item 1:
  Category: Oil - bulk
  Variant: [none]
  Description: Bulk lavender essential oil
  Units Purchased: 1200
  Unit Price: $0.42
  Units Received: 1200 [auto-filled]

[Show running balance: $504.00 / $504.00 = BALANCED ✓]

Click "Save"
```

> "See the balance indicator? It shows that our line items match our total invoice amount. The system won't let you save if they don't match - that prevents errors."

> "Also notice Units Received. Usually it matches Units Purchased, but sometimes you might receive less due to breakage or shortages. The system uses Units Received for the CPU calculation."

**Show CPU calculation**
> "The system just calculated: $504 ÷ 1200 oz = **$0.42 per ounce** for oil."

**Invoice #2: Bottles (1oz)** (faster)
```
INV-002
Vendor: XYZ Packaging
Total: $50.00

Line Item:
  Category: Bottle
  Variant: 1oz
  Units: 100
  Price: $0.50
Save
```

> "**$0.50 each** for 1oz bottles."

**Invoice #3: Bottles (5oz)** (faster)
```
INV-003
Vendor: XYZ Packaging
Total: $30.00

Line Item:
  Category: Bottle
  Variant: 5oz
  Units: 50
  Price: $0.60
Save
```

> "**$0.60 each** for the larger 5oz bottles."

**Invoice #4: Boxes** (demonstrate multi-line invoice)
```
INV-004
Vendor: BoxCo
Total: $43.00

Line Item 1:
  Category: Box
  Variant: 1oz
  Units: 100
  Price: $0.25

Line Item 2:
  Category: Box
  Variant: 5oz
  Units: 50
  Price: $0.36

[Balance: ($25 + $18) = $43 ✓]
Save
```

> "Notice this invoice has two line items. You can buy multiple things from one vendor on one invoice. The system tracks them separately."

**Invoice #5: Labels** (quickly)
```
INV-005
Vendor: PrintPro
Total: $50.00

Line Item:
  Category: Label
  Units: 500
  Price: $0.10
Save
```

> "And **$0.10 each** for labels."

---

### Part 6: CPU Tracker - The Payoff (3 minutes)

**Navigate to CPU Tracker**

> "Now for the moment of truth. Let's see what it actually costs Sarah to make her products."

**Show CPU Display**

```
Product Manufacturing Costs

1oz Body Oil (BO-1OZ)
Total CPU: $1.27
MSRP: $10.00
Margin: 87.3% ✓ BEST

[Click "Show Breakdown"]

Breakdown:
- Oil - bulk (1.00 oz): $0.42
- Bottle - 1oz (1 each): $0.50
- Box - 1oz (1 each): $0.25
- Label (1 each): $0.10
────────────────────────────────
TOTAL: $1.27
```

> "Beautiful! To make one bottle of 1oz body oil costs Sarah **$1.27**."

> "She sells it for $10. That's an 87% margin. Excellent!"

**Scroll to second product**

```
5oz Body Oil (BO-5OZ)
Total CPU: $3.16
MSRP: $25.00
Margin: 87.4% ✓ BEST

[Click "Show Breakdown"]

Breakdown:
- Oil - bulk (5.00 oz): $2.10
- Bottle - 5oz (1 each): $0.60
- Box - 5oz (1 each): $0.36
- Label (1 each): $0.10
────────────────────────────────
TOTAL: $3.16
```

> "And her 5oz product costs **$3.16** to make."

> "Notice how the oil is different: 5 ounces at 42 cents = $2.10. The system multiplies the quantity from the recipe by the cost per unit from the invoice. Automatically."

**Emphasize the value:**

> "Here's what just happened:"
>
> "Sarah entered 5 invoices - maybe 5 minutes of work."
>
> "The system:"
> - ✓ Calculated 6 different raw material costs
> - ✓ Multiplied recipe quantities by component costs
> - ✓ Summed everything up accurately
> - ✓ Compared to MSRP to show margins
> - ✓ Color-coded margin quality (green = good)
>
> "And here's the kicker: If a supplier raises their prices tomorrow, Sarah just enters one new invoice, and the system recalculates EVERYTHING instantly."

---

### Part 7: What-If Scenarios (2 minutes)

> "Let me show you the power of this system with a real scenario."

**Demo: Price Change Impact**

> "Let's say Sarah's oil supplier increases their price from $0.42/oz to $0.50/oz. What happens to her margins?"

**Add new invoice** (quickly)
```
INV-006
Vendor: ABC Oils
Date: [today]
Total: $600.00

Line Item:
  Category: Oil - bulk
  Units: 1200
  Price: $0.50 [increased!]
Save
```

**Navigate back to CPU Tracker**

```
1oz Body Oil
Total CPU: $1.35 [was $1.27, now increased by $0.08]
MSRP: $10.00
Margin: 86.5% [still BEST, but decreased]

5oz Body Oil
Total CPU: $3.56 [was $3.16, now increased by $0.40]
MSRP: $25.00
Margin: 85.8% [still BEST, but decreased]
```

> "Instantly, Sarah can see the impact. Her 1oz product cost went up 8 cents. Her 5oz product went up 40 cents because it uses 5 times as much oil."

> "Before this system, that would've taken her an hour with a spreadsheet and a calculator. Now? It's automatic."

> "This is incredibly valuable for decision-making: Can I afford this price increase? Do I need to raise my MSRP? Should I find a different supplier?"

---

## Key Features Recap (1 minute)

> "Let me recap the key features you just saw:"

**Show slide or write:**

### Core Features
✓ **Raw Material Tracking** - Categories with variants, units of measure
✓ **Product Definitions** - SKUs, MSRP, metadata
✓ **Bill of Materials** - Multi-component recipes
✓ **Invoice Entry** - Real supplier costs, multi-line support
✓ **Automatic CPU Calculation** - Latest purchase price method
✓ **Margin Analysis** - CPU vs MSRP comparison
✓ **Instant Updates** - Price changes flow through immediately

### Smart Validations
✓ **Balance Checking** - Invoice line items must match total
✓ **Duplicate Prevention** - No duplicate SKUs or category names
✓ **Referential Integrity** - Can't delete categories used in recipes
✓ **Missing Data Warnings** - Shows which components need invoices
✓ **Variant Normalization** - "1oz" = "1 oz" = "1-oz" (smart matching)

### User Experience
✓ **Getting Started Flow** - Guides new users step-by-step
✓ **X-only Modals** - Prevents accidental data loss
✓ **Running Balance** - Shows invoice balance in real-time
✓ **Color-Coded Margins** - Green = good, Red = poor
✓ **Breakdown Views** - See exactly where costs come from

---

## Q&A (5 minutes)

### Anticipated Questions

**Q: What if I buy in bulk but sell by case?**
> "Great question. That's what the 'pieces per unit' field is for. If you buy 1200 ounces of oil but sell products by the case (12 bottles), you set pieces_per_unit to 12. The system handles the conversion."

**Q: Can I track multiple suppliers for the same raw material?**
> "Absolutely. Each invoice stores the vendor name. The CPU uses the latest purchase price, but you can see historical pricing from all vendors in the invoice history."

**Q: What if I have waste or yield loss?**
> "Right now, you handle that by entering the actual 'Units Received' vs 'Units Purchased'. If you ordered 100 bottles but only received 95 (5 broken), you enter 95 as units received. The CPU calculation uses the received amount."

**Q: Does this work for multi-step manufacturing?**
> "Not yet. This is single-level BOM. If you make an intermediate product (like a 'Body Oil Base') and then use that in multiple finished products, you'd need sub-assemblies. That's on the roadmap for Phase 2."

**Q: Can I export this data?**
> "Yes, all data lives in your local IndexedDB and can be exported as JSON. We're also planning CSV export for invoices and CPUs."

**Q: What about inventory tracking?**
> "This system calculates costs, not inventory levels. Inventory tracking is a separate feature planned for Phase 3."

**Q: How accurate are the calculations?**
> "Very. We use Decimal.js for all financial math to prevent floating-point rounding errors. Everything is precise to 2 decimal places."

**Q: What happens if I delete an invoice by accident?**
> "Soft delete. It's marked as deleted but not actually removed from the database. We can add an 'undo delete' feature if needed."

---

## Closing (1 minute)

### Summary

> "What we've built here solves a real problem for CPG entrepreneurs:"

**Show before/after:**

**BEFORE:**
- ❌ Hours in spreadsheets
- ❌ Manual calculations
- ❌ Errors and outdated costs
- ❌ No visibility into price changes

**AFTER:**
- ✓ Minutes to enter invoices
- ✓ Automatic calculations
- ✓ Always up-to-date
- ✓ Instant impact analysis

### Next Steps

> "This is ready for beta testing. We'd love to get feedback from:"
> - CPG manufacturers (food, beauty, supplements)
> - Artisan producers (candles, soaps, oils)
> - Anyone who combines raw materials into finished products

> "If you know someone who could benefit, please send them our way."

### Thank You

> "Thank you for your time. Questions?"

---

## Fallback Plans

### If Demo Data Doesn't Load

**Option A: Live Create** (more engaging but slower)
- Skip straight to "Let me show you how to set this up from scratch"
- Create one category, one product, one recipe, one invoice
- Show the CPU calculation
- Explain "imagine doing this for all your products"

**Option B: Show Screenshots**
- Have screenshots of completed setup
- Walk through each screenshot
- Explain what each screen does
- Less impressive but still valuable

**Option C: Screen Recording**
- Have pre-recorded video ready
- Play video with live commentary
- Pause at key moments to explain

### If Calculation Is Wrong

**Acknowledge and pivot:**
> "Hmm, that's not the expected result. Let me check the inputs... [verify data]. This is actually a great example of why we need thorough testing. Let me show you what it SHOULD look like."

**Show expected values:**
- Oil: $0.42/oz
- 1oz Product: $1.27
- 5oz Product: $3.16

**Make note to investigate after demo**

### If Modal Won't Close

**ESC key** → **Refresh page** → **Show backup browser**

### If Questions Go Over Time

> "These are great questions. I'm conscious of time, so let's take these offline. I'll send detailed answers via email after this call."

---

## Post-Demo Actions

### Immediate (within 1 hour)
- [ ] Send thank-you email to attendees
- [ ] Share recording link (if recorded)
- [ ] Document all questions asked
- [ ] Note all bugs/issues observed
- [ ] List all feature requests mentioned

### Follow-up (within 24 hours)
- [ ] Create GitHub issues for bugs
- [ ] Respond to all questions via email
- [ ] Schedule 1-on-1 with interested users
- [ ] Update roadmap based on feedback
- [ ] Send demo script to team for review

### Week After
- [ ] Analyze engagement metrics
- [ ] Incorporate feedback into next sprint
- [ ] Plan user testing sessions
- [ ] Document lessons learned
- [ ] Celebrate the successful demo! 🎉

---

## Presenter Notes

### Energy & Pacing
- **Speak clearly and slower than usual** (remote audience)
- **Pause after key points** (let them sink in)
- **Vary tone and pace** (avoid monotone)
- **Show enthusiasm** (you're excited about this!)
- **Smile** (it comes through in your voice)

### Interaction
- **Ask rhetorical questions** ("Can you imagine...?")
- **Use "we" language** ("Let's set this up together")
- **Acknowledge attendees** ("Great question, Sarah!")
- **Check understanding** ("Does that make sense?")

### Technical Tips
- **Narrate actions** ("I'm clicking 'Add Category' now")
- **Point with cursor** (circle important info)
- **Zoom in on details** (use browser zoom)
- **Read aloud key numbers** ($1.27, 87% margin)
- **Explain before clicking** (no surprises)

### Common Pitfalls to Avoid
- ❌ Moving too fast (slow down!)
- ❌ Assuming knowledge (explain jargon)
- ❌ Getting lost in details (stay high-level)
- ❌ Ignoring errors (acknowledge and move on)
- ❌ Going over time (watch the clock)

---

**Good luck with the demo! You've got this! 🚀**

---

**End of Demo Script**
