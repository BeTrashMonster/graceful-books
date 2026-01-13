# Product/Service Catalog - Capability Specification

**Capability ID:** `product-service-catalog`
**Related Roadmap Items:** G2
**SPEC Reference:** ACCT-006
**Status:** In Development

## Overview

The Product/Service Catalog enables businesses to manage what they sell with pricing, costs, and organization. This is foundational for product-based businesses and enables inventory tracking, profitability analysis, and streamlined invoicing.

## ADDED Requirements


### Functional Requirements

#### FR-1: Product Management
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support comprehensive product management:

**Product Fields:**
- Product name (required)
- Description
- SKU/Product code (unique)
- Category
- Unit of measure
- Base price
- Cost per unit (for COGS)
- Product image
- Active/inactive status

**Product Categories:**
- Hierarchical categories
- Multiple categories per product
- Category filtering
- Category-based reporting

**Product Images:**
- Upload product images
- Multiple images per product
- Primary image selection
- Automatic resizing
- Image display on invoices

**Acceptance Criteria:**
- [ ] All fields save correctly
- [ ] SKU uniqueness enforced
- [ ] Images upload and display
- [ ] Categories functional

---

#### FR-2: Service Management
**Priority:** High

**ADDED Requirements:**

The system SHALL support service management:

**Service Fields:**
- Service name (required)
- Description
- Service code
- Category
- Hourly vs. fixed pricing
- Base rate
- Service packages
- Active/inactive status

**Service Packages:**
- Bundle multiple services
- Package pricing
- Component services listed
- Package discounts

**Acceptance Criteria:**
- [ ] Services create and edit successfully
- [ ] Hourly vs. fixed pricing works
- [ ] Packages functional
- [ ] Integration with invoicing works

---

#### FR-3: Pricing Management
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support flexible pricing:

**Pricing Features:**
- Base price (default)
- Tiered pricing (volume discounts)
- Customer-specific pricing
- Price effective dates
- Price history

**Tiered Pricing:**
- Quantity breaks
- Discount percentages or fixed prices
- Display on invoices
- Automatic tier selection

**Customer Pricing:**
- Override default pricing per customer
- Customer price lists
- Negotiated pricing tracking
- Price agreements

**Acceptance Criteria:**
- [ ] Base pricing works
- [ ] Tiered pricing calculates correctly
- [ ] Customer pricing overrides default
- [ ] Price history maintained

---

#### FR-4: Integration with Invoicing
**Priority:** Critical

**ADDED Requirements:**

Products/services SHALL integrate with invoicing:

**Invoice Integration:**
- Product/service picker on invoice lines
- Auto-populate price
- Override price if needed
- Link to inventory (products)
- COGS calculation on sale
- Profitability per line item

**Quick-Add:**
- Search products/services by name or SKU
- Recently used items
- Favorites marking
- Bulk add multiple items

**Acceptance Criteria:**
- [ ] Picker fast and intuitive
- [ ] Prices auto-populate correctly
- [ ] COGS posts on invoice save
- [ ] Profitability calculates accurately

---

### Non-Functional Requirements

#### NFR-1: Performance
**Priority:** High

**ADDED Requirements:**
- Product search MUST return results in <300ms
- Product picker MUST load in <200ms
- Support 10,000+ products without degradation
- Image loading optimized

#### NFR-2: Data Integrity
**Priority:** Critical

**ADDED Requirements:**
- SKU uniqueness enforced
- Price changes tracked in history
- Deletion blocked if used in invoices (archive instead)
- Data validation on all fields

---

## Success Metrics
- 70%+ of product businesses use catalog
- 50%+ use tiered pricing
- >4.5 ease-of-use rating
- <300ms search performance
