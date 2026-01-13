# Capability Spec: Assessment

## Overview
The Assessment capability provides a comprehensive onboarding assessment that determines each user's business phase, financial literacy level, business type, and communication preferences. This personalized profile drives checklist generation, feature visibility, and message adaptation throughout the application.

## ADDED Requirements


### ONB-001: Assessment Framework
**Priority:** Critical
**Category:** Onboarding

The system SHALL implement a comprehensive onboarding assessment that:

1. Determines user's current phase: Stabilize, Organize, Build, or Grow
2. Assesses Financial Literacy level (Beginner, Developing, Proficient, Advanced)
3. Categorizes business type: Service-based, Product-based, or Hybrid

**Constraints:**
- Maximum 40 questions total
- Branching logic based on business type selection
- Progress indicator throughout
- Ability to save and resume

**Acceptance Criteria:**
- [ ] Assessment feels quick and focused for users
- [ ] All four business phases correctly identified in testing
- [ ] Business type branching functions correctly
- [ ] Average completion time <10 minutes
- [ ] Save and resume works across sessions

### ONB-002: Assessment Structure
**Priority:** Critical
**Category:** Onboarding

Assessment SHALL be structured in sections:

**SECTION 1: BUSINESS FUNDAMENTALS (5-8 questions)**
- Business type (Service/Product/Hybrid)
- Time in business
- Revenue range
- Team size
- Legal structure

**SECTION 2: CURRENT FINANCIAL STATE (8-12 questions)**
- Existing bookkeeping practices
- Bank account separation (business/personal)
- Current tools/systems
- Outstanding reconciliation status
- Tax compliance status

**SECTION 3: FINANCIAL LITERACY (10-15 questions)**
- Understanding of basic accounting concepts
- Comfort with financial statements
- Knowledge of tax obligations
- Familiarity with accounting terminology

**SECTION 4: BUSINESS-TYPE SPECIFIC (5-10 questions)**
- [Service] Client billing practices, retainers, time tracking
- [Product] Inventory methods, COGS understanding, shipping
- [Hybrid] Revenue split, complexity factors

**SECTION 5: COMMUNICATION PREFERENCES (DISC assessment)**
- Communication style preferences
- Decision-making approach
- Information presentation preferences

**Acceptance Criteria:**
- [ ] Each section validates before proceeding
- [ ] Skip logic reduces questions for clear-path users
- [ ] Results page summarizes findings clearly
- [ ] Section transitions are smooth
- [ ] Users understand what each section accomplishes

### ONB-003: Phase Determination
**Priority:** High
**Category:** Onboarding

The system SHALL categorize users into phases:

**STABILIZE PHASE**
- **Characteristics:** Mixed personal/business finances, no formal bookkeeping, behind on reconciliation, unclear on tax obligations
- **Focus:** Separate accounts, catch up on records, establish basic tracking
- **Immediate Actions:** Bank account setup guidance, transaction categorization
- **Feature Access:** Dashboard (simplified), basic transactions, receipt capture, getting started checklist

**ORGANIZE PHASE**
- **Characteristics:** Basic separation exists, sporadic record-keeping, some understanding of obligations, reactive financial management
- **Focus:** Consistent processes, proper categorization, regular reconciliation
- **Immediate Actions:** Chart of accounts setup, reconciliation training
- **Feature Access:** All Stabilize + full chart of accounts, bank reconciliation, basic invoicing, expense tracking, basic reports

**BUILD PHASE**
- **Characteristics:** Regular bookkeeping, proper categorization, understanding of reports, proactive but not strategic
- **Focus:** Advanced features, reporting depth, forecasting introduction
- **Immediate Actions:** Custom reports, class/category optimization
- **Feature Access:** All Organize + advanced invoicing, bill management, classes/categories, custom reports, inventory

**GROW PHASE**
- **Characteristics:** Solid financial foundation, strategic use of data, scaling operations, ready for advanced features
- **Focus:** Multi-entity, advanced analytics, team collaboration
- **Immediate Actions:** Advanced reporting, integrations, team setup
- **Feature Access:** All Build + multi-currency, advanced inventory, forecasting, team collaboration, API access

**Acceptance Criteria:**
- [ ] Phase assignment algorithm documented and tested
- [ ] Users can request manual phase adjustment (with confirmation)
- [ ] Phase determines initial checklist and feature visibility
- [ ] Phase transitions trigger appropriate notifications
- [ ] Test coverage includes edge cases and boundary conditions

## Data Models

### AssessmentProfile
```typescript
interface AssessmentProfile {
  id: string;
  userId: string;
  completedAt: Date | null;

  // Phase determination
  phase: 'stabilize' | 'organize' | 'build' | 'grow';
  phaseScore: number; // 0-100, determines confidence in phase assignment

  // Business characteristics
  businessType: 'service' | 'product' | 'hybrid';
  timeInBusiness: 'new' | 'under-1-year' | '1-3-years' | '3-5-years' | 'over-5-years';
  revenueRange: 'pre-revenue' | 'under-50k' | '50k-250k' | '250k-1m' | 'over-1m';
  teamSize: 'solo' | '2-5' | '6-20' | 'over-20';
  legalStructure: 'sole-prop' | 'llc' | 's-corp' | 'c-corp' | 'partnership' | 'nonprofit';

  // Financial literacy
  literacyLevel: 'beginner' | 'developing' | 'proficient' | 'advanced';
  literacyScore: number; // 0-100

  // Current state
  hasBusinessBankAccount: boolean;
  currentBookkeepingMethod: 'none' | 'spreadsheet' | 'software' | 'accountant';
  reconciliationStatus: 'never' | 'behind' | 'current';
  taxComplianceStatus: 'unsure' | 'behind' | 'current';

  // Communication preferences (DISC)
  discProfile: 'dominance' | 'influence' | 'steadiness' | 'conscientiousness';

  // Progress tracking
  sections: {
    businessFundamentals: SectionProgress;
    currentFinancialState: SectionProgress;
    financialLiteracy: SectionProgress;
    businessTypeSpecific: SectionProgress;
    communicationPreferences: SectionProgress;
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: number; // for schema migrations
}

interface SectionProgress {
  completed: boolean;
  answers: Record<string, any>;
  startedAt: Date | null;
  completedAt: Date | null;
}
```

### AssessmentQuestion
```typescript
interface AssessmentQuestion {
  id: string;
  section: string;
  order: number;
  text: string;
  description?: string; // Additional context
  type: 'single-choice' | 'multiple-choice' | 'text' | 'number' | 'scale';

  // Display logic
  showIf?: Condition; // Branching logic

  // Options for choice questions
  options?: QuestionOption[];

  // Validation
  required: boolean;
  validation?: ValidationRule;

  // Scoring
  scoringRules?: ScoringRule[];
}

interface QuestionOption {
  value: string;
  label: string;
  description?: string;

  // Phase/literacy scoring impact
  phaseWeight?: Record<string, number>;
  literacyWeight?: number;
}

interface Condition {
  field: string;
  operator: 'equals' | 'not-equals' | 'includes' | 'greater-than' | 'less-than';
  value: any;
}
```

## API

### Assessment Engine API
```typescript
interface AssessmentEngine {
  // Start or resume assessment
  startAssessment(userId: string): Promise<AssessmentSession>;
  resumeAssessment(userId: string): Promise<AssessmentSession>;

  // Answer questions
  submitAnswer(
    sessionId: string,
    questionId: string,
    answer: any
  ): Promise<void>;

  submitSection(
    sessionId: string,
    section: string,
    answers: Record<string, any>
  ): Promise<SectionValidation>;

  // Progress
  getProgress(sessionId: string): Promise<AssessmentProgress>;

  // Complete and calculate
  completeAssessment(sessionId: string): Promise<AssessmentResults>;

  // Results
  getResults(userId: string): Promise<AssessmentProfile>;

  // Manual adjustments
  updatePhase(
    userId: string,
    phase: Phase,
    reason: string
  ): Promise<void>;
}

interface AssessmentSession {
  id: string;
  userId: string;
  currentSection: string;
  currentQuestion: string;
  percentComplete: number;
  answers: Record<string, any>;
}

interface AssessmentProgress {
  totalQuestions: number;
  answeredQuestions: number;
  percentComplete: number;
  currentSection: string;
  sections: SectionStatus[];
}

interface SectionStatus {
  name: string;
  completed: boolean;
  questionCount: number;
  answeredCount: number;
}

interface AssessmentResults {
  profile: AssessmentProfile;
  summary: {
    phase: Phase;
    phaseDescription: string;
    phaseCharacteristics: string[];
    nextSteps: string[];

    businessType: BusinessType;
    businessTypeDescription: string;

    literacyLevel: LiteracyLevel;
    literacyDescription: string;

    discProfile: DISCProfile;
    discDescription: string;
  };
  recommendations: Recommendation[];
}

interface Recommendation {
  type: 'feature' | 'checklist' | 'learning';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionUrl?: string;
}
```

## UI Components

### AssessmentWizard
Main container component for the assessment flow.

**Props:**
- `userId: string` - User taking the assessment
- `onComplete: (results: AssessmentResults) => void` - Callback when assessment completes
- `onSave: () => void` - Callback when user saves progress

**Features:**
- Section navigation with progress indicator
- Save and resume functionality
- Back button (within section, with warning about changing answers)
- Forward button (with validation)
- Responsive design for mobile/tablet/desktop

### AssessmentSection
Individual section component.

**Props:**
- `section: Section` - Section configuration
- `answers: Record<string, any>` - Current answers
- `onAnswerChange: (questionId: string, answer: any) => void`
- `onValidate: () => ValidationResult`

**Features:**
- Question rendering based on type
- Real-time validation
- Educational tooltips
- Progress within section

### AssessmentResults
Results summary and explanation component.

**Props:**
- `results: AssessmentResults` - Complete assessment results
- `onContinue: () => void` - Navigate to next step (dashboard)

**Features:**
- Phase visualization and description
- Business type and literacy summary
- Next steps recommendations
- Option to retake assessment
- Celebration animation on completion

## Business Logic

### Phase Determination Algorithm

```typescript
function determinePhase(answers: AssessmentAnswers): Phase {
  const scores = {
    stabilize: 0,
    organize: 0,
    build: 0,
    grow: 0
  };

  // Financial state scoring (40% weight)
  if (!answers.hasBusinessBankAccount) scores.stabilize += 40;
  if (answers.hasBusinessBankAccount && answers.currentBookkeeping === 'none') {
    scores.organize += 30;
    scores.stabilize += 10;
  }
  if (answers.reconciliationStatus === 'never') scores.stabilize += 20;
  if (answers.reconciliationStatus === 'behind') scores.organize += 20;
  if (answers.reconciliationStatus === 'current') {
    scores.build += 20;
    scores.organize += 10;
  }

  // Financial literacy scoring (30% weight)
  if (answers.literacyScore < 30) scores.stabilize += 30;
  else if (answers.literacyScore < 60) scores.organize += 30;
  else if (answers.literacyScore < 80) scores.build += 30;
  else scores.grow += 30;

  // Business maturity scoring (30% weight)
  const maturityScore = calculateMaturityScore(answers);
  if (maturityScore < 25) scores.stabilize += 30;
  else if (maturityScore < 50) scores.organize += 30;
  else if (maturityScore < 75) scores.build += 30;
  else scores.grow += 30;

  // Return highest scoring phase
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0][0] as Phase;
}
```

### Financial Literacy Scoring

```typescript
function calculateLiteracyScore(answers: Record<string, any>): number {
  let score = 0;
  let maxScore = 0;

  // Question scoring based on correct understanding
  literacyQuestions.forEach(question => {
    maxScore += question.maxPoints;
    const userAnswer = answers[question.id];
    score += scoreAnswer(question, userAnswer);
  });

  return (score / maxScore) * 100;
}

function determineLiteracyLevel(score: number): LiteracyLevel {
  if (score < 30) return 'beginner';
  if (score < 60) return 'developing';
  if (score < 85) return 'proficient';
  return 'advanced';
}
```

## User Experience

### Assessment Flow
1. **Welcome:** Brief intro explaining purpose (1 screen)
2. **Section 1:** Business Fundamentals (1-2 screens)
3. **Section 2:** Current Financial State (2-3 screens)
4. **Section 3:** Financial Literacy (3-4 screens with adaptive difficulty)
5. **Section 4:** Business-Type Specific (1-2 screens based on type)
6. **Section 5:** Communication Preferences (2 screens)
7. **Results:** Summary with celebration (1 screen)
8. **Next Steps:** Recommendations and entry to dashboard

### Educational Moments
- **Tooltips:** Every question has optional "Why we ask this" tooltip
- **Progress milestones:** Encouraging messages at 25%, 50%, 75% complete
- **Results explanation:** Clear, non-judgmental description of phase and what it means
- **Next steps:** Actionable recommendations specific to phase

### Tone & Messaging
- **Welcoming:** "Let's get to know your business so we can help you succeed"
- **Non-judgmental:** "There's no wrong answer - we're just learning about where you are right now"
- **Encouraging:** "You're halfway there! This helps us personalize your experience"
- **Educational:** "This question helps us understand your comfort with financial reports"

## Testing Requirements

### Unit Tests
- Phase determination algorithm with all edge cases
- Literacy scoring calculation
- Branching logic conditions
- Answer validation rules

### Integration Tests
- Complete assessment flow from start to finish
- Save and resume across sessions
- Results generation and storage
- Integration with DISC profile storage

### User Testing
- Average completion time <10 minutes
- Completion rate >85%
- Phase assignments validated against manual review
- Users report feeling understood and welcomed

## Performance Requirements
- Question rendering <100ms
- Section transitions <200ms
- Results calculation <2 seconds
- Save progress <500ms
- Works offline (saves locally, syncs when online)

## Accessibility
- Full keyboard navigation
- Screen reader support for all questions and explanations
- WCAG 2.1 AA compliance
- High contrast mode support
- Mobile-friendly touch targets (min 44px)

## Security & Privacy
- All answers encrypted at rest
- Assessment profile encrypted in local storage
- No tracking of individual answers for analytics (only aggregate, anonymized metrics)
- User can delete assessment and retake

## Future Enhancements
- Adaptive questioning (fewer questions if answers are clear)
- Question branching based on time in business
- Industry-specific questions beyond Service/Product/Hybrid
- Reassessment prompts at 6-month intervals
- Multi-language support
