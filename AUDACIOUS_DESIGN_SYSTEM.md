# Audacious Design System

**"Plant that seed of success and watch yourself bloom baby!"**

This document defines the visual design standards for the CPG module and all future pages.

---

## 🎯 Big Picture Roadmap

**Major items still to build:**
- Connect email collection for waitlist on Financial Entry page (and program)
- Create signup flow
- Create admin backend

---

## 🎨 Complete Color Palette

### Primary Brand Colors
```css
--deep-purple: #4b006e;        /* Headers, important elements, buttons */
--light-purple: #f3e8ff;       /* Accents, table headers, hover states */
--very-light-purple: #faf5ff;  /* Subtle backgrounds (optional) */

--metallic-gold: #D4AF37;      /* Borders, focus states, primary actions */
--light-champagne: #E8D4A0;    /* Gold gradient start */
--dark-goldenrod: #B8860B;     /* Gold gradient end, hover states */

--rich-green: #509724;         /* Distribution costs, success states */
--light-green: #E5F6DF;        /* Input fields, success backgrounds */
--success-green: #22c55e;      /* Success borders/text */

--white: #ffffff;              /* Main backgrounds, text on dark */
--border-gray: #e0e0e0;        /* Default borders */
--text-primary: #1a1a1a;       /* Body text */
--text-secondary: #666;        /* Helper text */
```

### Moody Romantic Accent Colors
For card customization and highlights:
- **Dusty Rose**: `#E5D8DB`
- **Mint Aqua**: `#D5E8E5`
- **Warm Linen**: `#E8E0D5`
- **Soft Moss**: `#D8E5D8`
- **Soft Mauve**: `#E0D8E8`

---

## 📏 Layout Structure (Top to Bottom)

### 1. Page Container
All pages must use consistent container sizing:

```css
.container {
  max-width: 1400px;           /* Limits content width */
  margin: 0 auto;              /* Centers horizontally */
  padding: 2rem;               /* 1.25" inset spacing on left/right */
}
```

**Why 1400px?** Ensures content never stretches too wide on large monitors while maintaining optimal readability.

### 2. Page Header
Large, bold page title with subtle gold gradient background:

```css
.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  padding-left: 1rem;
  color: #1a1a1a;
  background: linear-gradient(90deg, rgba(232, 212, 160, 0.08) 0%, rgba(255, 255, 255, 0) 100%);
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.header p {
  font-size: 1rem;
  color: #666;
  margin: 0;
}
```

### 3. Tab Navigation
Tabs with gold active state:

```css
.analysisTypeSelector {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
}

.analysisTypeSelector button {
  flex: 1;
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  color: #666;
  transition: all 0.2s ease;
}

.analysisTypeSelector button:hover {
  color: #D4AF37;              /* Gold on hover */
  background: rgba(212, 175, 55, 0.05);
}

.analysisTypeSelector button.active {
  color: #D4AF37;              /* Gold when active */
  border-bottom-color: #D4AF37;
  background: linear-gradient(135deg, rgba(232, 212, 160, 0.1) 0%, rgba(212, 175, 55, 0.15) 100%);
  font-weight: 600;
}
```

---

## 📦 Section Box Anatomy

**This is the KEY structure** - each tab content lives in a `.section`:

### The Box Container
```css
.section {
  background-color: #ffffff;           /* White inside */
  border-left: 4px solid #D4AF37;      /* Gold borders (no top!) */
  border-right: 4px solid #D4AF37;
  border-bottom: 4px solid #D4AF37;
  border-radius: 8px;
  padding: 0;                          /* No padding on container */
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(184, 134, 11, 0.15);
  overflow: hidden;                    /* Important for header */
}
```

### Section Header (h2)
```css
.section h2 {
  font-size: 2rem;
  font-weight: 600;
  margin: 0;                           /* No margin */
  padding: 1.25rem 2rem;               /* Internal padding */
  color: #ffffff;                      /* White text */
  background: #4b006e;                 /* Deep purple bar */
  /* No border - clean edge to edge */
}
```

### Section Description (p)
```css
.section > p {
  font-size: 1rem;
  color: #666;
  margin: 0 0 1.5rem 0;
  padding: 1.5rem 2rem 0 2rem;        /* Top padding + side padding */
}
```

### Section Content Padding
```css
/* All content after header gets side padding */
.section > *:not(h2) {
  padding-left: 2rem;
  padding-right: 2rem;
}

.section > *:last-child {
  padding-bottom: 2rem;                /* Bottom padding on last element */
}

/* Exception for specific layouts that handle their own spacing */
.section > .distributorGrid,
.section > .variantConfig,
.section > .whatIfConfig,
.section > .breakEvenForm,
.section > .formGroup {
  padding-top: 0;
}
```

### Subsection Headers (h3)
```css
.section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  margin-top: 1.5rem;
  color: #4b006e;                      /* Deep purple, NO background */
}
```

---

## 📝 Form Elements

### Input Fields & Selects
```css
.formGroup {
  margin-bottom: 1.5rem;
}

.formGroup label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #1a1a1a;
}

.formGroup input,
.formGroup select {
  width: 100%;
  padding: 0.75rem;
  background-color: #E5F6DF;           /* Light green background */
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.formGroup input:focus,
.formGroup select:focus {
  outline: none;
  border-color: #D4AF37;               /* Gold focus */
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
}

.formGroup input:hover:not(:focus),
.formGroup select:hover:not(:focus) {
  border-color: #D4AF37;               /* Gold hover */
}
```

### Variant Row Inputs
```css
.variantConfig {
  margin-bottom: 2rem;
}

.variantRow {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
}

.variantRow input {
  flex: 1;
  padding: 0.75rem;
  background-color: #E5F6DF;           /* Light green */
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.variantRow input:focus {
  outline: none;
  border-color: #D4AF37;
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
}

.variantRow input:hover:not(:focus) {
  border-color: #D4AF37;
}
```

### Price Input Fields (What-If Calculator)
```css
.priceInputs {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.priceInputs > div {
  flex: 1;
}

.priceInputs label {
  display: block;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
  color: #666;
}

.priceInputs input {
  width: 100%;
  padding: 0.5rem;
  background-color: #E5F6DF;           /* Light green */
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.priceInputs input:focus {
  outline: none;
  border-color: #D4AF37;
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
}

.priceInputs input:hover:not(:focus) {
  border-color: #D4AF37;
}
```

---

## 🎯 Selection Elements

### Distributor Cards (Checkboxes)
```css
.distributorGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.distributorCard {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.distributorCard:hover {
  border-color: #D4AF37;               /* Gold hover */
  background: #faf5ff;                 /* Very light purple */
}

.distributorCard:has(input:checked) {
  border-color: #4b006e;               /* Deep purple when selected */
  background: #f3e8ff;                 /* Light purple */
}

.distributorCard input[type='checkbox'] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.distributorName {
  font-size: 1rem;
  color: #1a1a1a;
}
```

---

## 🔘 Buttons

### Button Container (Right-aligned)
```css
.buttonContainer {
  display: flex;
  justify-content: flex-end;          /* Right-aligned */
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
}
```

### Gold Button (Primary Actions)
Signature metallic gold gradient for main actions:

```css
/* In Button.module.css */
.gold {
  background: linear-gradient(135deg, #E8D4A0 0%, #D4AF37 50%, #B8860B 100%);
  color: #2d1b00;
  border: 1px solid #B8860B;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(184, 134, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.gold:hover:not(:disabled) {
  background: linear-gradient(135deg, #F4E5C3 0%, #E8D4A0 50%, #C9A961 100%);
  box-shadow: 0 4px 12px rgba(184, 134, 11, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.gold:active:not(:disabled) {
  background: linear-gradient(135deg, #D4AF37 0%, #B8860B 50%, #9A7209 100%);
  box-shadow: 0 1px 4px rgba(184, 134, 11, 0.3), inset 0 1px 2px rgba(0, 0, 0, 0.2);
}
```

**Use for**: New Invoice, Add Product, Save, Create, Primary submissions

### Quick Add Button (Sidebar)
```css
/* In CPGLayout.module.css */
.quickAddButton {
  padding: 0.875rem 1rem;
  background: linear-gradient(135deg, #E8D4A0 0%, #D4AF37 50%, #B8860B 100%);
  color: #2d1b00;
  border: 1px solid #B8860B;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(184, 134, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
```

### Purple Button (Secondary/Add Actions)
```css
/* In Button.module.css */
.purple {
  background-color: #4b006e;          /* Deep purple */
  color: #ffffff;                     /* White text */
  border-color: #4b006e;
}

.purple:hover:not(:disabled) {
  background-color: #6d28d9;          /* Lighter purple hover */
  border-color: #6d28d9;
}

.purple:active:not(:disabled) {
  background-color: #3a0052;          /* Darker purple active */
  border-color: #3a0052;
}
```

**Use for**: Manage Categories, Edit Bundle, Recipe, Important settings

### Outline Button (Tertiary)
```css
.outline {
  background-color: transparent;
  color: #1f2937;
  border: 2px solid #d1d5db;
}
```

**Use for**: Cancel, Import, utility actions

---

## 📊 Results Display

### Summary/Impact Cards
```css
.summaryCard,
.impactCard {
  padding: 2rem;
  background: linear-gradient(135deg, #faf5ff 0%, #ffffff 100%);
  border: 2px solid #f3e8ff;
  border-radius: 8px;
  text-align: center;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.summaryCard:hover,
.impactCard:hover {
  transform: translateY(-2px);        /* Subtle lift */
  border-color: #D4AF37;              /* Gold on hover */
}

.summaryCard .label,
.impactCard .label {
  display: block;
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.summaryCard .value,
.impactCard .value {
  display: block;
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
}

.summaryCard .bigValue {
  display: block;
  font-size: 2rem;
  font-weight: 600;
  color: #D4AF37;                     /* Gold for big values */
}
```

### Best Distributor (Success Callout)
```css
.bestDistributor {
  padding: 1.5rem;
  background: #E5F6DF;                /* Light green */
  border: 2px solid #22c55e;          /* Green border */
  border-left: 4px solid #D4AF37;     /* Gold accent */
  border-radius: 8px;
  margin-bottom: 2rem;
}

.bestDistributor strong {
  font-size: 1.125rem;
  color: #22c55e;
}

.bestDistributor p {
  margin-top: 0.5rem;
  color: #1a1a1a;
}
```

---

## 📋 Data Tables

### Standard Table
```css
.comparisonTable {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
}

.comparisonTable th,
.comparisonTable td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.comparisonTable th {
  background: #f9fafb;
  font-weight: 600;
  color: #1a1a1a;
}

.comparisonTable tr:hover {
  background: #f5f5f5;
}
```

### Table Headers - Two Options

**Dark Purple Header** (High emphasis):
- Background: `#4b006e`
- Text: `#ffffff`

**Light Purple Header** (Softer, preferred for most tables):
- Background: `#f3e8ff`
- Text: `#4b006e`

---

## 🎭 Loading & States

### Loading Spinner
```css
.spinner {
  border: 4px solid #e5e7eb;
  border-top-color: #D4AF37;         /* Gold */
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

---

## 📱 Responsive Design

```css
@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  .analysisTypeSelector {
    flex-direction: column;
    gap: 0;
  }

  .analysisTypeSelector button {
    border-bottom: 1px solid #e0e0e0;
  }

  .distributorGrid {
    grid-template-columns: 1fr;
  }

  .variantRow {
    flex-direction: column;
    align-items: stretch;
  }

  .priceInputs {
    flex-direction: column;
  }
}
```

---

## ✨ Key Design Principles

1. **Color Hierarchy:**
   - Deep Purple (#4b006e) = Headers, important actions
   - Metallic Gold (#D4AF37) = Borders, focus, primary buttons
   - Rich Green (#509724) = Distribution costs, success indicators
   - Light Green (#E5F6DF) = Input fields (shows "fill me in")
   - White = Clean canvas

2. **Spacing System:**
   - 0.5rem (8px) = Tight spacing
   - 1rem (16px) = Default gap
   - 1.5rem (24px) = Section spacing
   - 2rem (32px) = Container padding

3. **Border Radius:**
   - 6px = Input fields
   - 8px = Cards, sections

4. **Transitions:**
   - 0.2s ease for all interactions
   - Hover/focus states on all interactive elements

5. **Box Model:**
   - Section container has `padding: 0`
   - Child elements manage their own padding
   - Last child gets bottom padding

---

## 🎯 To Replicate This Design

1. Use white `.section` containers with **LEFT/RIGHT/BOTTOM** gold borders
2. Dark purple `h2` header bars (no top border from section)
3. Light green backgrounds on **ALL** input fields
4. Gold borders/focus states
5. Right-aligned gold primary buttons
6. Purple secondary/add buttons
7. 2rem horizontal padding on all content

---

## 🔧 Accessibility

- **Minimum contrast ratio**: WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text)
- **Focus indicators**: Always visible, gold outline preferred
- **Touch targets**: Minimum 44×44px
- **Reduced motion**: Respect `prefers-reduced-motion`

---

## 📚 Examples

See implementations in:
- `/src/pages/cpg/CPGDashboard.tsx` - Financial Web visualization
- `/src/pages/cpg/FinishedProducts.tsx` - Product cards with gold borders
- `/src/pages/cpg/ScenarioPlanning.tsx` - Complete tab system with all patterns
- `/src/components/cpg/RecipeBuilder.tsx` - Light purple table headers
- `/src/components/layouts/CPGLayout.tsx` - Sidebar with gold Quick Add button

---

**That's the complete system! Copy these patterns and you'll get the same professional, cohesive look.** 🎨✨

**Last Updated**: 2026-03-18
