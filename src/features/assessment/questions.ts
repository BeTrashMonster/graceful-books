/**
 * Assessment Question Definitions
 *
 * Defines all questions for the onboarding assessment.
 * Questions are organized by section and use conversational language
 * following the Steadiness communication style.
 *
 * Per ONB-002
 */

import {
  QuestionType,
  AssessmentSection,
  BusinessPhase,
  FinancialLiteracyLevel,
  BusinessType,
  RevenueRange,
} from './types';
import type {
  AssessmentQuestion,
} from './types';

/**
 * All assessment questions in order
 */
export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // Section 1: Business Info
  {
    id: 'business_structure',
    section: AssessmentSection.BUSINESS_INFO,
    text: 'How is your business set up legally?',
    helpText: 'This helps us understand your tax and accounting requirements.',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: BusinessType.SOLE_PROPRIETOR, label: 'Sole Proprietor', description: 'Just me' },
      { value: BusinessType.LLC, label: 'LLC', description: 'Limited Liability Company' },
      { value: BusinessType.S_CORP, label: 'S-Corp', description: 'S Corporation' },
      { value: BusinessType.C_CORP, label: 'C-Corp', description: 'C Corporation' },
      { value: BusinessType.PARTNERSHIP, label: 'Partnership', description: 'Multiple owners' },
      { value: BusinessType.NONPROFIT, label: 'Nonprofit', description: '501(c)(3) or similar' },
      { value: BusinessType.OTHER, label: 'Other', description: 'Something else' },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 0,
        [BusinessPhase.ORGANIZE]: 0,
        [BusinessPhase.BUILD]: 0,
        [BusinessPhase.GROW]: 0,
      },
    },
  },
  {
    id: 'revenue_range',
    section: AssessmentSection.BUSINESS_INFO,
    text: 'What was your approximate revenue last year?',
    helpText: 'A rough estimate is fine. This helps us tailor the experience to your business size.',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: RevenueRange.ZERO_TO_25K, label: 'Under $25,000' },
      { value: RevenueRange.TWENTY_FIVE_TO_100K, label: '$25,000 - $100,000' },
      { value: RevenueRange.ONE_HUNDRED_TO_500K, label: '$100,000 - $500,000' },
      { value: RevenueRange.FIVE_HUNDRED_K_TO_1M, label: '$500,000 - $1,000,000' },
      { value: RevenueRange.OVER_1M, label: 'Over $1,000,000' },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 3,
        [BusinessPhase.ORGANIZE]: 2,
        [BusinessPhase.BUILD]: 1,
        [BusinessPhase.GROW]: 0,
      },
    },
  },
  {
    id: 'has_employees',
    section: AssessmentSection.BUSINESS_INFO,
    text: 'Do you have employees?',
    helpText: 'This includes part-time employees, but not contractors.',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'no', label: 'No, just me' },
      { value: 'yes', label: 'Yes, I have employees' },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 0,
        [BusinessPhase.ORGANIZE]: 1,
        [BusinessPhase.BUILD]: 2,
        [BusinessPhase.GROW]: 3,
      },
    },
  },
  {
    id: 'has_sales_tax',
    section: AssessmentSection.BUSINESS_INFO,
    text: 'Do you collect sales tax from customers?',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
      { value: 'not_sure', label: "I'm not sure" },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 0,
        [BusinessPhase.ORGANIZE]: 1,
        [BusinessPhase.BUILD]: 1,
        [BusinessPhase.GROW]: 1,
      },
    },
  },
  {
    id: 'has_inventory',
    section: AssessmentSection.BUSINESS_INFO,
    text: 'Do you track physical inventory?',
    helpText: 'Physical products you buy and sell, not services.',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'no', label: 'No, I provide services' },
      { value: 'yes', label: 'Yes, I sell products' },
      { value: 'both', label: 'Both products and services' },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 0,
        [BusinessPhase.ORGANIZE]: 1,
        [BusinessPhase.BUILD]: 2,
        [BusinessPhase.GROW]: 2,
      },
    },
  },

  // Section 2: Financial Status
  {
    id: 'knows_current_cash',
    section: AssessmentSection.FINANCIAL_STATUS,
    text: 'Can you quickly tell me how much cash your business has right now?',
    helpText: 'Not exact to the penny - just generally.',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'yes_exact', label: 'Yes, I know exactly' },
      { value: 'yes_roughly', label: 'Yes, roughly' },
      { value: 'no', label: 'Not really' },
      { value: 'no_idea', label: 'No idea' },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 3,
        [BusinessPhase.ORGANIZE]: 1,
        [BusinessPhase.BUILD]: 0,
        [BusinessPhase.GROW]: 0,
      },
      literacy: {
        [FinancialLiteracyLevel.BEGINNER]: 3,
        [FinancialLiteracyLevel.INTERMEDIATE]: 1,
        [FinancialLiteracyLevel.ADVANCED]: 0,
      },
    },
  },
  {
    id: 'tracks_expenses',
    section: AssessmentSection.FINANCIAL_STATUS,
    text: 'How do you currently track your business expenses?',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'none', label: "I don't really track them" },
      { value: 'shoebox', label: 'I keep receipts in a pile' },
      { value: 'spreadsheet', label: 'I use a spreadsheet' },
      { value: 'software', label: 'I use accounting software' },
      { value: 'accountant', label: 'My accountant handles it' },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 3,
        [BusinessPhase.ORGANIZE]: 2,
        [BusinessPhase.BUILD]: 1,
        [BusinessPhase.GROW]: 0,
      },
      literacy: {
        [FinancialLiteracyLevel.BEGINNER]: 3,
        [FinancialLiteracyLevel.INTERMEDIATE]: 1,
        [FinancialLiteracyLevel.ADVANCED]: 0,
      },
    },
  },
  {
    id: 'reconciles_bank',
    section: AssessmentSection.FINANCIAL_STATUS,
    text: 'How often do you reconcile your bank accounts?',
    helpText: 'Reconciling means matching your records to your bank statement.',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'never', label: "Never - I don't know what that means" },
      { value: 'rarely', label: 'Rarely, maybe once a year' },
      { value: 'quarterly', label: 'Every few months' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'weekly', label: 'Weekly or more often' },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 3,
        [BusinessPhase.ORGANIZE]: 2,
        [BusinessPhase.BUILD]: 0,
        [BusinessPhase.GROW]: 0,
      },
      literacy: {
        [FinancialLiteracyLevel.BEGINNER]: 3,
        [FinancialLiteracyLevel.INTERMEDIATE]: 1,
        [FinancialLiteracyLevel.ADVANCED]: 0,
      },
    },
  },
  {
    id: 'separates_accounts',
    section: AssessmentSection.FINANCIAL_STATUS,
    text: 'Do you have separate bank accounts for business and personal?',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'no', label: 'No, I use the same account' },
      { value: 'planning', label: "Not yet, but I'm planning to" },
      { value: 'yes', label: 'Yes, they are separate' },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 2,
        [BusinessPhase.ORGANIZE]: 1,
        [BusinessPhase.BUILD]: 0,
        [BusinessPhase.GROW]: 0,
      },
    },
  },

  // Section 3: Bookkeeping Experience
  {
    id: 'understands_debits_credits',
    section: AssessmentSection.BOOKKEEPING_EXPERIENCE,
    text: 'How comfortable are you with debits and credits?',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'no_idea', label: 'What are those?' },
      { value: 'heard', label: "I've heard of them" },
      { value: 'basic', label: 'I understand the basics' },
      { value: 'comfortable', label: "I'm pretty comfortable" },
      { value: 'expert', label: 'I could teach someone' },
    ],
    required: true,
    weights: {
      literacy: {
        [FinancialLiteracyLevel.BEGINNER]: 3,
        [FinancialLiteracyLevel.INTERMEDIATE]: 1,
        [FinancialLiteracyLevel.ADVANCED]: 0,
      },
    },
  },
  {
    id: 'reads_financial_reports',
    section: AssessmentSection.BOOKKEEPING_EXPERIENCE,
    text: 'Can you read a Profit & Loss statement?',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'never_seen', label: "I've never seen one" },
      { value: 'confused', label: 'I find them confusing' },
      { value: 'basics', label: 'I understand the basics' },
      { value: 'comfortable', label: 'Yes, pretty easily' },
      { value: 'expert', label: 'I analyze them regularly' },
    ],
    required: true,
    weights: {
      literacy: {
        [FinancialLiteracyLevel.BEGINNER]: 3,
        [FinancialLiteracyLevel.INTERMEDIATE]: 1,
        [FinancialLiteracyLevel.ADVANCED]: 0,
      },
    },
  },
  {
    id: 'bookkeeping_time',
    section: AssessmentSection.BOOKKEEPING_EXPERIENCE,
    text: 'How much time do you currently spend on bookkeeping each week?',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'none', label: 'Almost none - I avoid it' },
      { value: 'less_than_hour', label: 'Less than an hour' },
      { value: 'few_hours', label: 'A few hours' },
      { value: 'many_hours', label: 'Many hours' },
      { value: 'full_time', label: "It's practically a full-time job" },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 0,
        [BusinessPhase.ORGANIZE]: 1,
        [BusinessPhase.BUILD]: 2,
        [BusinessPhase.GROW]: 3,
      },
    },
  },
  {
    id: 'previous_software',
    section: AssessmentSection.BOOKKEEPING_EXPERIENCE,
    text: 'Have you used accounting software before?',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'never', label: 'Never' },
      { value: 'tried', label: 'I tried, but gave up' },
      { value: 'basic', label: 'Yes, for basic tasks' },
      { value: 'experienced', label: 'Yes, extensively' },
    ],
    required: true,
    weights: {
      literacy: {
        [FinancialLiteracyLevel.BEGINNER]: 2,
        [FinancialLiteracyLevel.INTERMEDIATE]: 1,
        [FinancialLiteracyLevel.ADVANCED]: 0,
      },
    },
  },

  // Section 4: Goals
  {
    id: 'primary_goal',
    section: AssessmentSection.GOALS,
    text: "What's your main goal with Graceful Books?",
    helpText: 'Choose the one that matters most right now.',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'tax_ready', label: 'Be ready for tax time' },
      { value: 'understand_finances', label: 'Understand where my money goes' },
      { value: 'save_time', label: 'Save time on bookkeeping' },
      { value: 'grow_business', label: 'Make better business decisions' },
      { value: 'peace_of_mind', label: 'Have peace of mind' },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 2,
        [BusinessPhase.ORGANIZE]: 2,
        [BusinessPhase.BUILD]: 1,
        [BusinessPhase.GROW]: 1,
      },
    },
  },
  {
    id: 'timeline',
    section: AssessmentSection.GOALS,
    text: 'How soon do you want to see results?',
    type: QuestionType.SINGLE_CHOICE,
    options: [
      { value: 'urgent', label: 'Urgently - tax deadline is coming!' },
      { value: 'soon', label: 'Within the next month' },
      { value: 'few_months', label: 'In the next few months' },
      { value: 'building', label: "I'm building good habits for the future" },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 2,
        [BusinessPhase.ORGANIZE]: 1,
        [BusinessPhase.BUILD]: 0,
        [BusinessPhase.GROW]: 0,
      },
    },
  },

  // Section 5: Pain Points
  {
    id: 'biggest_challenge',
    section: AssessmentSection.PAIN_POINTS,
    text: "What's your biggest bookkeeping challenge right now?",
    helpText: 'Select all that apply.',
    type: QuestionType.MULTIPLE_CHOICE,
    options: [
      { value: 'finding_time', label: 'Finding time to do it' },
      { value: 'understanding', label: 'Understanding accounting concepts' },
      { value: 'staying_organized', label: 'Staying organized' },
      { value: 'catching_up', label: 'Catching up on past months' },
      { value: 'accuracy', label: 'Making sure everything is accurate' },
      { value: 'tax_compliance', label: 'Tax compliance and reporting' },
    ],
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 1,
        [BusinessPhase.ORGANIZE]: 1,
        [BusinessPhase.BUILD]: 1,
        [BusinessPhase.GROW]: 1,
      },
    },
  },
  {
    id: 'stress_level',
    section: AssessmentSection.PAIN_POINTS,
    text: 'How stressed do you feel about your business finances?',
    helpText: 'Be honest - this helps us support you better.',
    type: QuestionType.SCALE,
    scaleMin: 1,
    scaleMax: 5,
    scaleLabels: { min: 'Not stressed', max: 'Very stressed' },
    required: true,
    weights: {
      phase: {
        [BusinessPhase.STABILIZE]: 2,
        [BusinessPhase.ORGANIZE]: 1,
        [BusinessPhase.BUILD]: 0,
        [BusinessPhase.GROW]: 0,
      },
    },
  },
];

/**
 * Get questions for a specific section
 */
export function getQuestionsBySection(section: AssessmentSection): AssessmentQuestion[] {
  return ASSESSMENT_QUESTIONS.filter((q) => q.section === section);
}

/**
 * Get question by ID
 */
export function getQuestionById(id: string): AssessmentQuestion | undefined {
  return ASSESSMENT_QUESTIONS.find((q) => q.id === id);
}

/**
 * Get all sections in order
 */
export function getSections(): AssessmentSection[] {
  return [
    AssessmentSection.BUSINESS_INFO,
    AssessmentSection.FINANCIAL_STATUS,
    AssessmentSection.BOOKKEEPING_EXPERIENCE,
    AssessmentSection.GOALS,
    AssessmentSection.PAIN_POINTS,
  ];
}

/**
 * Get section display name
 */
export function getSectionDisplayName(section: AssessmentSection): string {
  const names: Record<AssessmentSection, string> = {
    [AssessmentSection.BUSINESS_INFO]: 'About Your Business',
    [AssessmentSection.FINANCIAL_STATUS]: 'Your Financial Situation',
    [AssessmentSection.BOOKKEEPING_EXPERIENCE]: 'Your Experience',
    [AssessmentSection.GOALS]: 'Your Goals',
    [AssessmentSection.PAIN_POINTS]: 'Your Challenges',
  };
  return names[section];
}

/**
 * Get section description
 */
export function getSectionDescription(section: AssessmentSection): string {
  const descriptions: Record<AssessmentSection, string> = {
    [AssessmentSection.BUSINESS_INFO]:
      "Let's start with the basics about your business.",
    [AssessmentSection.FINANCIAL_STATUS]:
      'Help us understand where you are right now.',
    [AssessmentSection.BOOKKEEPING_EXPERIENCE]:
      "We'd like to know your comfort level with accounting.",
    [AssessmentSection.GOALS]:
      'What are you hoping to achieve?',
    [AssessmentSection.PAIN_POINTS]:
      "Let's talk about what's been challenging.",
  };
  return descriptions[section];
}

/**
 * Validate answer value for a question
 */
export function validateAnswer(
  question: AssessmentQuestion,
  value: string | number | string[] | number[]
): boolean {
  // Check required
  if (question.required && (value === null || value === undefined || value === '')) {
    return false;
  }

  // Type-specific validation
  switch (question.type) {
    case QuestionType.SINGLE_CHOICE:
      if (typeof value !== 'string' && typeof value !== 'number') {
        return false;
      }
      // Check if value is in options
      if (question.options) {
        return question.options.some((opt) => opt.value === value);
      }
      return true;

    case QuestionType.MULTIPLE_CHOICE:
      if (!Array.isArray(value)) {
        return false;
      }
      // Check all values are in options
      if (question.options) {
        const validValues = question.options.map((opt) => opt.value);
        return (value as (string | number)[]).every((v) => validValues.includes(v));
      }
      return true;

    case QuestionType.SCALE:
      if (typeof value !== 'number') {
        return false;
      }
      // Check in range
      if (question.scaleMin !== undefined && value < question.scaleMin) {
        return false;
      }
      if (question.scaleMax !== undefined && value > question.scaleMax) {
        return false;
      }
      return true;

    case QuestionType.TEXT:
      return typeof value === 'string';

    default:
      return false;
  }
}

/**
 * Check if a question should be shown based on conditional rules
 */
export function shouldShowQuestion(
  question: AssessmentQuestion,
  answers: Map<string, { value: string | number | string[] | number[] }>
): boolean {
  if (!question.conditionalOn) {
    return true;
  }

  const { questionId, operator, value: condValue } = question.conditionalOn;
  const answer = answers.get(questionId);

  if (!answer) {
    return false; // Conditional question not answered yet
  }

  const answerValue = answer.value;

  switch (operator) {
    case 'equals':
      return answerValue === condValue;
    case 'notEquals':
      return answerValue !== condValue;
    case 'contains':
      return Array.isArray(answerValue) && (answerValue as Array<string | number>).includes(condValue);
    case 'greaterThan':
      return typeof answerValue === 'number' && answerValue > (condValue as number);
    case 'lessThan':
      return typeof answerValue === 'number' && answerValue < (condValue as number);
    default:
      return true;
  }
}

/**
 * Get total question count (excluding conditional questions not shown)
 */
export function getVisibleQuestionCount(
  answers: Map<string, { value: string | number | string[] | number[] }>
): number {
  return ASSESSMENT_QUESTIONS.filter((q) => shouldShowQuestion(q, answers)).length;
}
