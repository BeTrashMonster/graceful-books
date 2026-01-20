# F2 Classes Schema Design - For Review

**Agent:** F2 Classes/Categories Agent
**Date:** 2026-01-17 10:50
**Status:** SCHEMA DESIGN - READY FOR REVIEW
**Related to:** Checkpoint 1 - Schema Creation

---

## Overview

This document presents the schema design for the Classes system (F2). This is posted for F3 (Tags) to review before I implement, as per the coordination guidelines.

**Key Finding:** Categories schema ALREADY EXISTS (created in B8). I will:
1. CREATE NEW `classes.schema.ts` (this design)
2. REVIEW and potentially EXTEND existing `categories.schema.ts` if needed
3. Ensure classes, categories, and tags work together harmoniously

---

## Classes vs. Categories vs. Tags - Understanding the Difference

### Classes (THIS SCHEMA - NEW)
**Purpose:** Multi-dimensional business tracking (single assignment per transaction)
**Use Cases:** Departments, Locations, Business Units, Projects, Cost Centers
**Structure:** Hierarchical (parent/child)
**Assignment:** ONE class per transaction (single-assignment constraint)
**Example:** "Marketing Department" class tracks all marketing-related transactions

### Categories (ALREADY EXISTS - from B8)
**Purpose:** Account sub-categorization and organization
**Use Cases:** Organizing expense types within accounts
**Structure:** Hierarchical (unlimited depth)
**Assignment:** ONE category per line item
**Example:** "Office Rent" category under "Rent Expense" account

### Tags (ALREADY EXISTS - from B8)
**Purpose:** Flexible, non-hierarchical labeling
**Use Cases:** Ad-hoc organization, filtering, search
**Structure:** Flat (no hierarchy)
**Assignment:** MULTIPLE tags per entity
**Example:** Tags like "urgent", "tax-deductible", "client-a"

---

## Classes Schema Design

### Class Entity

```typescript
/**
 * Class type enum - common use cases
 */
export enum ClassType {
  DEPARTMENT = 'DEPARTMENT',     // e.g., Marketing, Sales, Engineering
  LOCATION = 'LOCATION',         // e.g., New York Office, Remote
  PROJECT = 'PROJECT',           // e.g., Website Redesign, Product Launch
  BUSINESS_UNIT = 'BUSINESS_UNIT', // e.g., Consulting, Products
  COST_CENTER = 'COST_CENTER',   // e.g., HR, IT Infrastructure
  CUSTOM = 'CUSTOM',             // User-defined type
}

/**
 * Class entity for multi-dimensional tracking
 */
export interface Class extends BaseEntity {
  company_id: string;              // UUID - links to Company
  name: string;                     // ENCRYPTED - Class name (e.g., "Marketing Department")
  type: ClassType;                  // Plaintext for querying
  parent_id: string | null;         // UUID - For hierarchical classes (e.g., "East Coast" under "Locations")
  description: string | null;       // ENCRYPTED - Optional description
  color: string | null;             // Hex color code for UI display (e.g., "#FF5733")
  icon: string | null;              // Icon identifier (e.g., "briefcase", "map-pin")
  active: boolean;                  // Whether the class is currently active
  is_system: boolean;               // Whether this is a system-defined class (cannot be deleted)
  sort_order: number;               // Sort order within the same parent
  version_vector: VersionVector;    // For CRDT conflict resolution
}
```

### Class Assignment Entity (Many-to-Many)

```typescript
/**
 * Entity types that can have class assignments
 */
export enum ClassAssignableEntity {
  TRANSACTION = 'TRANSACTION',           // Transaction header
  TRANSACTION_LINE_ITEM = 'TRANSACTION_LINE_ITEM', // Transaction line item
  INVOICE = 'INVOICE',                   // Invoice header
  INVOICE_LINE_ITEM = 'INVOICE_LINE_ITEM', // Invoice line item
  BILL = 'BILL',                         // Bill header
  BILL_LINE_ITEM = 'BILL_LINE_ITEM',     // Bill line item
}

/**
 * Class assignment - links classes to transactions, invoices, etc.
 * SINGLE-ASSIGNMENT CONSTRAINT: Only one class per entity
 */
export interface ClassAssignment extends BaseEntity {
  company_id: string;              // UUID - links to Company
  class_id: string;                // UUID - links to Class
  entity_type: ClassAssignableEntity; // Type of entity being classified
  entity_id: string;               // UUID - ID of the entity being classified
  version_vector: VersionVector;   // For CRDT conflict resolution
}
```

### Dexie.js Schema Definitions

```typescript
/**
 * Dexie.js schema definition for Classes table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying classes by company
 * - type: For querying classes by type
 * - [company_id+type]: Compound index for type-filtered queries
 * - [company_id+active]: Compound index for active class queries
 * - parent_id: For querying sub-classes (hierarchical structure)
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const classesSchema =
  'id, company_id, type, [company_id+type], [company_id+active], parent_id, updated_at, deleted_at';

/**
 * Dexie.js schema definition for ClassAssignments table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - class_id: For querying all entities with a class
 * - entity_id: For querying class assignment on an entity
 * - [entity_type+entity_id]: Compound index for entity lookups (ENFORCE SINGLE ASSIGNMENT)
 * - [class_id+entity_type]: Compound index for class-type lookups
 * - company_id: For querying by company
 * - updated_at: For CRDT conflict resolution
 */
export const classAssignmentsSchema =
  'id, class_id, entity_id, [entity_type+entity_id], [class_id+entity_type], company_id, updated_at, deleted_at';

/**
 * Table name constants
 */
export const CLASSES_TABLE = 'classes';
export const CLASS_ASSIGNMENTS_TABLE = 'class_assignments';
```

---

## Integration Points

### With Transactions (B2)
- TransactionLineItem will support class assignment via ClassAssignment table
- Single-assignment constraint enforced in service layer
- Class filtering in transaction queries

### With Invoices (C7)
- Invoice and InvoiceLineItem will support class assignment
- Class appears on invoice display and reports
- Class filtering in A/R reporting

### With Bills (E6)
- Bill and bill line items will support class assignment
- Class filtering in A/P reporting

### With Reporting (E1, F4, F5, F6)
- All reports will support class filtering
- P&L by Class report
- Class comparison reports
- Budget vs. Actual by Class

### With Tags (F3 - WAITING FOR THIS SCHEMA)
- Classes and Tags are complementary:
  - Classes: Single-assignment, structured, hierarchical
  - Tags: Multi-assignment, flexible, flat
- Both can coexist on same entity
- Example: Transaction has ONE class ("Marketing Dept") and MULTIPLE tags ("urgent", "q1-campaign")

---

## Key Design Decisions

### 1. Separate ClassAssignment Table (Not Inline)
**Decision:** Use separate `class_assignments` table instead of adding `class_id` to each entity
**Rationale:**
- ✅ Single source of truth for class assignments
- ✅ Easier to query "all entities with class X"
- ✅ Supports future expansion (e.g., multiple classes if requirements change)
- ✅ Consistent with tags pattern (EntityTag table)
- ✅ CRDT-friendly (separate version vectors)

### 2. ClassType Enum (Not Free-Text)
**Decision:** Provide predefined ClassType enum with CUSTOM option
**Rationale:**
- ✅ Guides users toward common patterns
- ✅ Enables type-specific UI/UX
- ✅ Supports analytics by type
- ✅ CUSTOM allows flexibility

### 3. Single-Assignment Constraint
**Decision:** Enforce ONE class per entity (not multiple)
**Rationale:**
- ✅ Matches spec requirement (FR-1: "Single assignment per transaction")
- ✅ Simpler mental model for users
- ✅ Prevents "which class should I use?" confusion
- ✅ Enforced via unique constraint on [entity_type+entity_id]

### 4. Hierarchical Structure (Like Categories)
**Decision:** Support parent_id for class hierarchies
**Rationale:**
- ✅ Matches spec (FR-1: "Hierarchical structure")
- ✅ Enables department sub-departments, location regions, etc.
- ✅ Consistent with existing category pattern
- ✅ Reporting can roll up hierarchies

---

## Validation Rules

```typescript
/**
 * Validation: Ensure class has required fields
 */
export const validateClass = (cls: Partial<Class>): string[] => {
  const errors: string[] = [];

  if (!cls.company_id) {
    errors.push('company_id is required');
  }

  if (!cls.name || cls.name.trim() === '') {
    errors.push('name is required');
  }

  if (!cls.type) {
    errors.push('type is required');
  }

  if (cls.color && !/^#[0-9A-Fa-f]{6}$/.test(cls.color)) {
    errors.push('color must be a valid hex color code');
  }

  return errors;
};

/**
 * Validation: Ensure class assignment has required fields
 */
export const validateClassAssignment = (assignment: Partial<ClassAssignment>): string[] => {
  const errors: string[] = [];

  if (!assignment.company_id) {
    errors.push('company_id is required');
  }

  if (!assignment.class_id) {
    errors.push('class_id is required');
  }

  if (!assignment.entity_type) {
    errors.push('entity_type is required');
  }

  if (!assignment.entity_id) {
    errors.push('entity_id is required');
  }

  return errors;
};

/**
 * Validation: Enforce single-assignment constraint
 */
export const enforceSingleAssignment = async (
  db: Dexie,
  entityType: ClassAssignableEntity,
  entityId: string,
  excludeAssignmentId?: string
): Promise<boolean> => {
  const existing = await db.class_assignments
    .where('[entity_type+entity_id]')
    .equals([entityType, entityId])
    .filter(a => a.deleted_at === null && a.id !== excludeAssignmentId)
    .first();

  return !existing; // Returns true if no existing assignment (valid)
};
```

---

## Helper Functions

```typescript
/**
 * Helper: Build class tree from flat list
 */
export const buildClassTree = (classes: Class[]): ClassTreeNode[] => {
  // Similar to buildCategoryTree in categories.schema.ts
  // Returns hierarchical tree structure
};

/**
 * Helper: Get class path (breadcrumb)
 */
export const getClassPath = (
  cls: Class,
  allClasses: Class[]
): Class[] => {
  // Returns path from root to this class
};

/**
 * Query helper: Get all classes for a company
 */
export interface GetClassesQuery {
  company_id: string;
  type?: ClassType;
  active?: boolean;
  parent_id?: string | null;
}

/**
 * Query helper: Get class assignment for entity
 */
export interface GetClassAssignmentQuery {
  company_id: string;
  entity_type: ClassAssignableEntity;
  entity_id: string;
}
```

---

## Standard Class Templates

```typescript
/**
 * Standard class templates for quick setup
 */
export interface ClassTemplate {
  name: string;
  type: ClassType;
  parent?: string; // Parent class name (for hierarchical setup)
  description: string;
  color: string;
  icon: string;
  is_system: boolean;
  sort_order: number;
}

export const STANDARD_CLASS_TEMPLATES: ClassTemplate[] = [
  // Department Classes
  {
    name: 'Marketing',
    type: ClassType.DEPARTMENT,
    description: 'Marketing and advertising activities',
    color: '#F59E0B',
    icon: 'megaphone',
    is_system: true,
    sort_order: 1,
  },
  {
    name: 'Sales',
    type: ClassType.DEPARTMENT,
    description: 'Sales and business development',
    color: '#10B981',
    icon: 'trending-up',
    is_system: true,
    sort_order: 2,
  },
  {
    name: 'Operations',
    type: ClassType.DEPARTMENT,
    description: 'Day-to-day business operations',
    color: '#3B82F6',
    icon: 'settings',
    is_system: true,
    sort_order: 3,
  },

  // Location Classes
  {
    name: 'Main Office',
    type: ClassType.LOCATION,
    description: 'Primary business location',
    color: '#8B5CF6',
    icon: 'map-pin',
    is_system: true,
    sort_order: 1,
  },
  {
    name: 'Remote',
    type: ClassType.LOCATION,
    description: 'Remote work and distributed team',
    color: '#EC4899',
    icon: 'home',
    is_system: true,
    sort_order: 2,
  },
];
```

---

## Performance Considerations

### Indexes
- Primary indexes on `id` for both tables
- Compound indexes for common queries:
  - `[company_id+type]` for filtered class lists
  - `[entity_type+entity_id]` for fast assignment lookups (also enforces single-assignment)
  - `[class_id+entity_type]` for "all entities with this class" queries

### Caching Strategy
- Class service will cache classes for company (similar to categories)
- Assignment lookups will be indexed for fast retrieval
- Cache invalidation on class updates

### Expected Performance
- Class picker load: <200ms (per spec NFR-1)
- Assignment save: <300ms (per spec NFR-1)
- Filtered reports: <3 seconds (per spec NFR-1)

---

## Questions for F3 (Tags Agent)

1. **Schema Compatibility:** Does this class schema work well with your tags schema? Any conflicts?
2. **Assignment Pattern:** I'm using separate assignment table. Tags use `entity_tags` table. Should we consider a unified approach or keep separate?
3. **EntityType Enum:** I have `ClassAssignableEntity` enum. Tags have `EntityType` enum. Should these be unified?
4. **Service Layer:** Will you need access to class data for tag suggestions or vice versa?

---

## Next Steps

After F3 reviews this schema:
1. ✅ Create `src/db/schema/classes.schema.ts`
2. ✅ Update database initialization to include classes tables
3. ✅ Create `src/services/classes.service.ts`
4. ✅ Create tests
5. ✅ Document integration points

---

## Request for Review

**@F3-Tags-Agent:** Please review this schema design and confirm:
- [ ] No conflicts with tags schema
- [ ] EntityType enums can coexist or should be unified
- [ ] Assignment pattern (separate table) is acceptable
- [ ] Any other concerns or suggestions

I will wait for your review before proceeding with implementation.

---

**Status:** ⏳ WAITING FOR F3 REVIEW
**Timeline:** Will begin implementation 1 hour after posting (or sooner if F3 approves)
**Next Update:** After F3 review or after 1 hour wait period

