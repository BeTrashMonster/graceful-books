# Classes & Categories System - Capability Specification

**Capability ID:** `classes-categories`
**Related Roadmap Items:** F2
**SPEC Reference:** CLASS-001
**Status:** In Development

## Overview

The Classes & Categories System provides multi-dimensional tracking for departments, locations, projects, and sub-categorization within accounts. This enables deep business insights and sophisticated reporting for growing businesses.

## ADDED Requirements


### Functional Requirements

#### FR-1: Class Management
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support class creation and management:

**Class Features:**
- Create unlimited classes
- Hierarchical structure (parent/child classes)
- Single assignment per transaction (one class only)
- Active/inactive status
- Plain English descriptions
- Common use cases: Departments, Locations, Business Units, Projects

**Class CRUD:**
- Create new class with name and description
- Edit class properties
- Archive class (preserve historical data)
- Restore archived class
- Bulk class operations

**Acceptance Criteria:**
- [ ] Single-assignment constraint enforced
- [ ] Hierarchical relationships maintained
- [ ] Archived classes hidden but preserved
- [ ] Bulk operations performant

---

#### FR-2: Category Management
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support hierarchical categories:

**Category Features:**
- Hierarchical categories within accounts
- Unlimited depth
- Sub-category relationships
- One category per line item
- Category templates by business type

**Category Tree:**
- Parent-child relationships
- Breadcrumb navigation
- Drag-and-drop reordering
- Indentation visual

**Acceptance Criteria:**
- [ ] Hierarchy traversal accurate
- [ ] Category templates available
- [ ] Tree navigation intuitive
- [ ] Performance with 1,000+ categories

---

#### FR-3: Assignment to Transactions
**Priority:** Critical

**ADDED Requirements:**

Classes and categories SHALL be assignable to:

**Transaction Types:**
- Invoices (header and line level)
- Bills (header and line level)
- Expenses
- Journal entries
- Transfers
- Income transactions

**Assignment UI:**
- Inline class/category picker
- Quick-select common classes
- Bulk assignment tools
- Assignment history
- Default class per customer/vendor

**Acceptance Criteria:**
- [ ] All transaction types support assignment
- [ ] Inline picker fast and intuitive
- [ ] Bulk assignment works for 1,000+ transactions
- [ ] Defaults save time

---

#### FR-4: Reporting Integration
**Priority:** Critical

**ADDED Requirements:**

All reports SHALL support class/category filtering:

**Report Enhancements:**
- Filter any report by class
- Filter any report by category
- P&L by Class report
- Class Comparison report
- Category drill-down
- Budget vs. Actual by Class

**Cross-Cutting Filters:**
- Combine class + date range
- Combine category + account filters
- Multi-class selection (OR logic)
- Export includes classifications

**Acceptance Criteria:**
- [ ] All existing reports filterable
- [ ] P&L by Class GAAP-compliant
- [ ] Export includes all dimensions
- [ ] Performance acceptable

---

### Non-Functional Requirements

#### NFR-1: Performance
**Priority:** High

**ADDED Requirements:**
- Class/category picker MUST load in <200ms
- Assignment MUST save in <300ms
- Filtered reports MUST generate in <3 seconds
- Support 1,000+ classes and 5,000+ categories

---

## User Experience

### Educational Content
- "Classes let you see your business from different angles"
- "Like having X-ray vision for your finances"
- Examples: Department tracking, Location analysis, Project profitability

### Joy Opportunities
- First class creation celebration
- Multi-dimensional insights highlighting
- "X-ray vision unlocked!" badge

---

## Success Metrics
- 50%+ of active users create at least 1 class
- 30%+ use categories for sub-categorization
- 40%+ filter reports by class monthly
- <300ms assignment performance
