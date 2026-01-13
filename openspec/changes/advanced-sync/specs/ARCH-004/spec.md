# CRDT Conflict Resolution - Capability Specification

**Capability ID:** `crdt-conflict-resolution`
**Related Roadmap Items:** I1
**SPEC Reference:** ARCH-004
**Status:** Planned (Phase 4 - Group I)

## Overview

CRDT (Conflict-free Replicated Data Types) Conflict Resolution enables multiple team members to edit the same records simultaneously without data loss. The system automatically merges concurrent edits using mathematically sound conflict-free algorithms, providing eventual consistency across all clients while preserving user intent.

## ADDED Requirements


### Functional Requirements

#### FR-1: CRDT Implementation
**Priority:** Critical

**ADDED Requirements:**

The system SHALL implement CRDTs for all mutable entities:

**CRDT Coverage:**
- Transactions (journal entries, income, expenses)
- Invoices and invoice line items
- Bills and bill line items
- Customers and vendors
- Products and services
- Accounts (chart of accounts)
- Categories and tags
- User preferences

**CRDT Types:**
- LWW (Last-Write-Wins) Register for simple fields
- G-Counter for numeric increments
- PN-Counter for numeric add/subtract
- G-Set for append-only collections
- OR-Set for add/remove collections
- RGA (Replicated Growable Array) for ordered lists
- Text CRDT (Operational Transformation) for text fields

**CRDT Library:**
- Use established library (Automerge 2.0, Yjs, or equivalent)
- Or custom CRDT implementation (if justified)
- Proven conflict-free merge semantics
- Deterministic merge (all clients reach same state)
- Efficient serialization for sync

**Acceptance Criteria:**
- [ ] All entities have CRDT representation
- [ ] CRDT types appropriate for field types
- [ ] Concurrent edits merge correctly
- [ ] No data loss on merge
- [ ] Deterministic merge across clients

---

#### FR-2: Merge Algorithm
**Priority:** Critical

**ADDED Requirements:**

The system SHALL automatically merge concurrent edits:

**Merge Features:**
- Field-level merge granularity
- Preserve both users' changes when possible
- Tombstone tracking for deletions
- Vector clocks or logical clocks for causal ordering
- Conflict-free by design (CRDT guarantees)
- No "last write wins" data loss

**Merge Rules:**
- Different fields edited by different users: both changes kept
- Same field edited by different users: CRDT resolution (typically LWW with timestamp tiebreaker)
- One user deletes, one edits: deletion wins (tombstone)
- Numeric fields: additive (PN-Counter) or LWW depending on semantics
- Text fields: operational transformation (character-level merge)

**Merge Validation:**
- Merged state satisfies business rules
- Balances remain balanced (debits = credits)
- Required fields remain populated
- Referential integrity maintained

**Acceptance Criteria:**
- [ ] Field-level merge works correctly
- [ ] Different fields preserve both edits
- [ ] Same field resolved predictably
- [ ] Deletions handled correctly
- [ ] Merged state valid

---

#### FR-3: Conflict Notification
**Priority:** High

**ADDED Requirements:**

The system SHALL notify users of merged conflicts:

**Notification Features:**
- Non-alarming notification: "This record was updated by both you and [User]. We merged the changes."
- Show which fields were merged
- Highlight conflicting fields
- Option to view merge details
- No user action required (merge already complete)

**Notification Display:**
- Toast notification (temporary)
- Dashboard notification (persistent)
- Email notification (optional, configurable)
- In-app notification center
- Per-record merge indicator (badge or icon)

**Merge Details:**
- Side-by-side comparison (your changes vs. their changes vs. merged result)
- Field-by-field breakdown
- Timestamp of each edit
- User who made each edit
- Merge algorithm used

**Acceptance Criteria:**
- [ ] Notifications display on merge
- [ ] Non-alarming tone
- [ ] Merge details accessible
- [ ] User can review merge
- [ ] No action required (informational)

---

#### FR-4: Conflict History
**Priority:** Medium

**ADDED Requirements:**

The system SHALL track conflict history:

**History Tracking:**
- All merges logged per record
- Who edited what when
- Merged changes visualization
- Timeline of concurrent edits
- Merge algorithm applied

**History Display:**
- Conflict history per record
- Filter by date range
- Filter by user
- Search conflict history
- Export conflict log

**History Visualization:**
- Timeline view (chronological)
- Branching diagram (concurrent edits)
- Merged result highlighted
- Diff view (before/after)

**Acceptance Criteria:**
- [ ] History logged for all merges
- [ ] History accessible per record
- [ ] Timeline visualization works
- [ ] Export functionality available
- [ ] History immutable (audit trail)

---

#### FR-5: Manual Resolution
**Priority:** Medium

**ADDED Requirements:**

The system SHALL support manual conflict resolution:

**Manual Resolution Triggers:**
- User requests manual review
- Complex merge unclear (e.g., business logic violated)
- User wants to override automatic merge
- Approval workflow for high-value changes (optional)

**Resolution Interface:**
- Side-by-side comparison (Version A vs. Version B vs. Auto-Merged)
- Field-by-field selection (choose A, B, or custom)
- Preview merged result
- Approval before applying
- Audit trail of manual resolution

**Resolution Options:**
- Accept auto-merge (default)
- Choose version A (discard version B)
- Choose version B (discard version A)
- Manual merge (pick fields from each)
- Revert to previous version (undo both)

**Acceptance Criteria:**
- [ ] Manual resolution UI intuitive
- [ ] Side-by-side comparison clear
- [ ] Field selection works
- [ ] Preview accurate
- [ ] Manual resolution logged

---

#### FR-6: Operational Transformation (Text Fields)
**Priority:** High

**ADDED Requirements:**

The system SHALL use operational transformation for text fields:

**Text Field Merge:**
- Character-level merge (not line-level)
- Preserve both users' edits
- Google Docs-style concurrent editing
- Insertion and deletion operations tracked
- Transformation algorithm (OT or CRDT text)

**Supported Text Fields:**
- Transaction memos
- Notes and descriptions
- Comments
- Invoice terms
- Custom text fields

**Text Merge Algorithm:**
- Operational Transformation (OT) or CRDT text type (RGA, YATA)
- Concurrent insertions preserved
- Concurrent deletions applied
- Cursor position maintained (future - real-time)
- No lost characters

**Acceptance Criteria:**
- [ ] Text fields merge character-level
- [ ] Both users' edits preserved
- [ ] No lost text
- [ ] Merge deterministic
- [ ] Performance acceptable (<100ms)

---

### Non-Functional Requirements

#### NFR-1: Performance
**Priority:** High

**ADDED Requirements:**
- CRDT merge completes in <1 second for typical edit
- Incremental sync (only send deltas, not full state)
- Efficient CRDT serialization (minimize network payload)
- Supports 100+ concurrent edits without degradation
- Memory usage reasonable (CRDT state overhead <50%)

#### NFR-2: Correctness
**Priority:** Critical

**ADDED Requirements:**
- Zero data loss from CRDT merges
- Eventual consistency guaranteed
- All clients reach same state
- Merge deterministic (same inputs → same output)
- Business rule violations detected after merge

#### NFR-3: Usability
**Priority:** High

**ADDED Requirements:**
- Conflict notifications non-alarming
- Merge happens automatically (no user action required)
- Manual resolution optional (for power users)
- Educational content about CRDT and merging
- Clear explanation of merge behavior

---

## Technical Notes

**CRDT Library Options:**
- **Automerge 2.0:** Mature, full-featured, good performance
- **Yjs:** Excellent performance, popular, WebRTC support
- **Custom CRDT:** If specific needs not met by libraries

**Data Model Changes:**
- Add CRDT metadata to all entities (vector clock, actor ID, etc.)
- Store CRDT operation log (for sync and history)
- Migrate existing data to CRDT format (one-time)

**Sync Protocol:**
- Incremental sync (send operations, not full state)
- Compression of operation log
- Efficient diffing algorithm
- Retry and conflict detection on sync failure

---

## Limitations

**Not Included:**
- Real-time cursors (future)
- Live presence indicators (future)
- Real-time character-by-character sync (future - current is on save/sync)

**Rationale:** CRDT provides conflict-free merge, not real-time display. Real-time features (cursors, presence) are UI enhancements that can be added later without changing CRDT foundation.

---

## Success Metrics
- 60%+ of multi-user teams enable CRDT conflict resolution
- >90% CRDT conflict auto-resolution success (no manual intervention needed)
- Zero data loss from CRDT merges
- <1 second CRDT merge time (95th percentile)
- >4.5 ease-of-use rating for conflict resolution
- 80% reduction in "lost changes" support requests
