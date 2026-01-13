/**
 * Assessment Engine Type Definitions
 *
 * Defines all types for the onboarding assessment system.
 * This assessment determines user phase, financial literacy, and business type.
 *
 * Per ONB-001, ONB-002, ONB-003
 */

/**
 * Business phases - determines feature visibility and checklist items
 */
export enum BusinessPhase {
  STABILIZE = 'STABILIZE', // Getting finances under control
  ORGANIZE = 'ORGANIZE', // Setting up systems
  BUILD = 'BUILD', // Scaling operations
  GROW = 'GROW', // Advanced growth
}

/**
 * Financial literacy levels
 */
export enum FinancialLiteracyLevel {
  BEGINNER = 'BEGINNER', // New to bookkeeping
  INTERMEDIATE = 'INTERMEDIATE', // Some experience
  ADVANCED = 'ADVANCED', // Experienced with accounting
}

/**
 * Business structure types
 */
export enum BusinessType {
  SOLE_PROPRIETOR = 'SOLE_PROPRIETOR',
  LLC = 'LLC',
  S_CORP = 'S_CORP',
  C_CORP = 'C_CORP',
  PARTNERSHIP = 'PARTNERSHIP',
  NONPROFIT = 'NONPROFIT',
  OTHER = 'OTHER',
}

/**
 * Business revenue ranges
 */
export enum RevenueRange {
  ZERO_TO_25K = 'ZERO_TO_25K',
  TWENTY_FIVE_TO_100K = 'TWENTY_FIVE_TO_100K',
  ONE_HUNDRED_TO_500K = 'ONE_HUNDRED_TO_500K',
  FIVE_HUNDRED_K_TO_1M = 'FIVE_HUNDRED_K_TO_1M',
  OVER_1M = 'OVER_1M',
}

/**
 * Question types
 */
export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE', // Radio buttons
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE', // Checkboxes
  SCALE = 'SCALE', // 1-5 rating
  TEXT = 'TEXT', // Short text input
}

/**
 * Question definition
 */
export interface AssessmentQuestion {
  id: string;
  section: AssessmentSection;
  text: string;
  helpText?: string; // Optional explanation
  type: QuestionType;
  options?: QuestionOption[]; // For choice questions
  scaleMin?: number; // For scale questions
  scaleMax?: number; // For scale questions
  scaleLabels?: { min: string; max: string }; // Labels for scale endpoints
  required: boolean;
  conditionalOn?: ConditionalRule; // Show question only if condition met
  weights: QuestionWeights; // How this question affects scoring
}

/**
 * Question option (for choice questions)
 */
export interface QuestionOption {
  value: string | number;
  label: string;
  description?: string;
}

/**
 * Conditional rule for showing questions
 */
export interface ConditionalRule {
  questionId: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  value: string | number;
}

/**
 * Question weights for scoring
 */
export interface QuestionWeights {
  phase?: {
    [BusinessPhase.STABILIZE]?: number;
    [BusinessPhase.ORGANIZE]?: number;
    [BusinessPhase.BUILD]?: number;
    [BusinessPhase.GROW]?: number;
  };
  literacy?: {
    [FinancialLiteracyLevel.BEGINNER]?: number;
    [FinancialLiteracyLevel.INTERMEDIATE]?: number;
    [FinancialLiteracyLevel.ADVANCED]?: number;
  };
}

/**
 * Assessment sections
 */
export enum AssessmentSection {
  BUSINESS_INFO = 'BUSINESS_INFO', // Basic business details
  FINANCIAL_STATUS = 'FINANCIAL_STATUS', // Current financial situation
  BOOKKEEPING_EXPERIENCE = 'BOOKKEEPING_EXPERIENCE', // Experience level
  GOALS = 'GOALS', // What they want to achieve
  PAIN_POINTS = 'PAIN_POINTS', // Current struggles
}

/**
 * User's answer to a question
 */
export interface AssessmentAnswer {
  questionId: string;
  value: string | number | string[] | number[]; // Depends on question type
  answeredAt: number; // Unix timestamp
}

/**
 * Assessment session state
 */
export interface AssessmentSession {
  userId: string;
  answers: Map<string, AssessmentAnswer>; // questionId -> answer
  currentSection: AssessmentSection;
  startedAt: number; // Unix timestamp
  lastUpdatedAt: number; // Unix timestamp
  completedSections: AssessmentSection[];
  isComplete: boolean;
}

/**
 * Assessment progress information
 */
export interface AssessmentProgress {
  totalQuestions: number;
  answeredQuestions: number;
  percentComplete: number;
  currentSection: AssessmentSection;
  sectionsComplete: number;
  totalSections: number;
  canSubmit: boolean;
}

/**
 * Raw scoring results (before interpretation)
 */
export interface RawAssessmentScores {
  phaseScores: {
    [BusinessPhase.STABILIZE]: number;
    [BusinessPhase.ORGANIZE]: number;
    [BusinessPhase.BUILD]: number;
    [BusinessPhase.GROW]: number;
  };
  literacyScores: {
    [FinancialLiteracyLevel.BEGINNER]: number;
    [FinancialLiteracyLevel.INTERMEDIATE]: number;
    [FinancialLiteracyLevel.ADVANCED]: number;
  };
}

/**
 * Complete assessment results
 */
export interface AssessmentResults {
  phase: BusinessPhase;
  phaseConfidence: number; // 0-100
  literacyLevel: FinancialLiteracyLevel;
  literacyConfidence: number; // 0-100
  businessType: BusinessType;
  revenueRange: RevenueRange;
  hasEmployees: boolean;
  hasSalesTax: boolean;
  hasInventory: boolean;
  rawScores: RawAssessmentScores;
  recommendedFeatures: string[]; // Feature IDs to show
  recommendedChecklists: string[]; // Checklist IDs to generate
}

/**
 * Saved assessment result entity (for database)
 */
export interface AssessmentResultEntity {
  id: string;
  userId: string;
  results: AssessmentResults; // ENCRYPTED
  answers: AssessmentAnswer[]; // ENCRYPTED
  completedAt: number; // Unix timestamp
  version: string; // Assessment version (e.g., "1.0")
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

/**
 * Assessment validation error
 */
export interface ValidationError {
  questionId: string;
  message: string;
}

/**
 * Section completion status
 */
export interface SectionStatus {
  section: AssessmentSection;
  questionsTotal: number;
  questionsAnswered: number;
  isComplete: boolean;
}
