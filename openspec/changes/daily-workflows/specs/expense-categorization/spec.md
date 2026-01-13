# Expense Categorization AI - Capability Specification

**Capability ID:** `expense-categorization`
**Related Roadmap Items:** E5
**SPEC Reference:** ACCT-003, AI-001
**Status:** Nice-to-Have

## Overview

AI-powered expense categorization suggests categories based on vendor patterns, transaction descriptions, and user correction history. This reduces manual categorization effort by 60%+.

## ADDED Requirements

### Functional Requirements

#### FR-1: Category Suggestion Engine
**Pattern Matching:**
- Vendor name → category associations
- Description keyword analysis
- Amount range patterns
- User's historical categorization

**Suggestion Display:**
- Inline during expense entry
- Confidence score (High: 95%+, Medium: 80-95%, Low: <80%)
- Alternative suggestions (top 3)
- "I noticed this looks like 'Office Supplies'. Am I right?"

#### FR-2: Learning from Corrections
**User Feedback Loop:**
- When user changes suggestion, record correction
- Build vendor-category associations
- Improve keyword matching
- Update confidence scores

**Learning Acknowledgment:**
- "Got it! I'll remember that [Vendor] is usually 'Marketing.'"
- Show improvement: "Suggestion accuracy: 85% (up from 72%)"

#### FR-3: Bulk Categorization
- Select multiple similar transactions
- Suggest category for batch
- Apply to all with one click
- Review exceptions

#### FR-4: Accuracy Tracking
- Display per-user accuracy percentage
- Track improvement over time
- Alert if accuracy drops (data quality issue)

### Technical Architecture


**Suggestion Algorithm:**
```typescript
interface CategorySuggestion {
  category_id: string;
  confidence: number; // 0-100
  reason: 'vendor_match' | 'description_match' | 'amount_pattern' | 'user_history';
}

async function suggestCategory(
  vendor: string,
  description: string,
  amount: number,
  userId: string
): Promise<CategorySuggestion[]> {
  // 1. Check exact vendor match (90%+ confidence)
  // 2. Check description keywords (70-90% confidence)
  // 3. Check amount patterns (60-80% confidence)
  // 4. Check user history for similar transactions
  // 5. Return top 3 suggestions sorted by confidence
}
```

**Pattern Storage:**
```typescript
interface CategorizationPattern {
  user_id: string;
  vendor_name: string;
  category_id: string;
  confidence: number;
  occurrence_count: number; // Increases with each match
  last_used: Date;
}
```

## Success Metrics
- 75%+ categorization accuracy after 100 transactions
- 60% reduction in manual categorization time
- 80%+ acceptance rate of high-confidence suggestions
- Accuracy improves 5%+ per month for active users
