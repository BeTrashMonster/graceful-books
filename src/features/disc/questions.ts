/**
 * DISC Assessment Questions
 *
 * 16 questions with 4-point scale to assess DISC personality type.
 * Each question is designed to measure tendencies across all four DISC dimensions.
 */

import { DISCType } from '../../db/schema/discProfile.schema';

/**
 * Answer option for a DISC question
 */
export interface DISCAnswerOption {
  text: string;
  value: number; // 0-3 (Strongly Disagree to Strongly Agree)
}

/**
 * Weight mapping for each answer to DISC dimensions
 */
export interface DISCWeights {
  [DISCType.DOMINANCE]: number;
  [DISCType.INFLUENCE]: number;
  [DISCType.STEADINESS]: number;
  [DISCType.CONSCIENTIOUSNESS]: number;
}

/**
 * A single DISC assessment question
 */
export interface DISCQuestion {
  id: number;
  text: string;
  category: 'work_style' | 'communication' | 'decision_making' | 'relationships';
  weights: DISCWeights; // How much each dimension is weighted for this question
}

/**
 * Answer scale options (4-point scale)
 */
export const ANSWER_OPTIONS: DISCAnswerOption[] = [
  { text: 'Strongly Disagree', value: 0 },
  { text: 'Disagree', value: 1 },
  { text: 'Agree', value: 2 },
  { text: 'Strongly Agree', value: 3 },
];

/**
 * DISC Assessment Questions (16 questions)
 */
export const DISC_QUESTIONS: DISCQuestion[] = [
  // Work Style Questions
  {
    id: 1,
    text: 'I prefer to make quick decisions and take immediate action.',
    category: 'work_style',
    weights: {
      [DISCType.DOMINANCE]: 1.0,
      [DISCType.INFLUENCE]: 0.2,
      [DISCType.STEADINESS]: -0.5,
      [DISCType.CONSCIENTIOUSNESS]: -0.3,
    },
  },
  {
    id: 2,
    text: 'I enjoy working in a team and collaborating with others.',
    category: 'work_style',
    weights: {
      [DISCType.DOMINANCE]: -0.2,
      [DISCType.INFLUENCE]: 1.0,
      [DISCType.STEADINESS]: 0.5,
      [DISCType.CONSCIENTIOUSNESS]: 0.0,
    },
  },
  {
    id: 3,
    text: 'I value consistency and prefer a stable, predictable routine.',
    category: 'work_style',
    weights: {
      [DISCType.DOMINANCE]: -0.4,
      [DISCType.INFLUENCE]: -0.2,
      [DISCType.STEADINESS]: 1.0,
      [DISCType.CONSCIENTIOUSNESS]: 0.5,
    },
  },
  {
    id: 4,
    text: 'I focus on accuracy and making sure everything is done correctly.',
    category: 'work_style',
    weights: {
      [DISCType.DOMINANCE]: -0.2,
      [DISCType.INFLUENCE]: -0.3,
      [DISCType.STEADINESS]: 0.2,
      [DISCType.CONSCIENTIOUSNESS]: 1.0,
    },
  },

  // Communication Questions
  {
    id: 5,
    text: 'I communicate in a direct, straightforward manner.',
    category: 'communication',
    weights: {
      [DISCType.DOMINANCE]: 1.0,
      [DISCType.INFLUENCE]: 0.1,
      [DISCType.STEADINESS]: -0.2,
      [DISCType.CONSCIENTIOUSNESS]: 0.3,
    },
  },
  {
    id: 6,
    text: 'I express enthusiasm and optimism when talking to others.',
    category: 'communication',
    weights: {
      [DISCType.DOMINANCE]: 0.0,
      [DISCType.INFLUENCE]: 1.0,
      [DISCType.STEADINESS]: 0.1,
      [DISCType.CONSCIENTIOUSNESS]: -0.4,
    },
  },
  {
    id: 7,
    text: 'I listen carefully and respond thoughtfully to others.',
    category: 'communication',
    weights: {
      [DISCType.DOMINANCE]: -0.3,
      [DISCType.INFLUENCE]: 0.2,
      [DISCType.STEADINESS]: 1.0,
      [DISCType.CONSCIENTIOUSNESS]: 0.4,
    },
  },
  {
    id: 8,
    text: 'I prefer written communication that includes all the details.',
    category: 'communication',
    weights: {
      [DISCType.DOMINANCE]: -0.5,
      [DISCType.INFLUENCE]: -0.6,
      [DISCType.STEADINESS]: 0.2,
      [DISCType.CONSCIENTIOUSNESS]: 1.0,
    },
  },

  // Decision Making Questions
  {
    id: 9,
    text: 'I make decisions based on results and bottom-line impact.',
    category: 'decision_making',
    weights: {
      [DISCType.DOMINANCE]: 1.0,
      [DISCType.INFLUENCE]: 0.0,
      [DISCType.STEADINESS]: -0.2,
      [DISCType.CONSCIENTIOUSNESS]: 0.4,
    },
  },
  {
    id: 10,
    text: 'I consider how decisions will affect people and relationships.',
    category: 'decision_making',
    weights: {
      [DISCType.DOMINANCE]: -0.3,
      [DISCType.INFLUENCE]: 0.8,
      [DISCType.STEADINESS]: 1.0,
      [DISCType.CONSCIENTIOUSNESS]: 0.0,
    },
  },
  {
    id: 11,
    text: 'I need time to think through all aspects before deciding.',
    category: 'decision_making',
    weights: {
      [DISCType.DOMINANCE]: -0.7,
      [DISCType.INFLUENCE]: -0.4,
      [DISCType.STEADINESS]: 0.6,
      [DISCType.CONSCIENTIOUSNESS]: 1.0,
    },
  },
  {
    id: 12,
    text: 'I like to explore new possibilities and take calculated risks.',
    category: 'decision_making',
    weights: {
      [DISCType.DOMINANCE]: 0.8,
      [DISCType.INFLUENCE]: 0.7,
      [DISCType.STEADINESS]: -0.5,
      [DISCType.CONSCIENTIOUSNESS]: -0.3,
    },
  },

  // Relationships Questions
  {
    id: 13,
    text: 'I prefer to lead and take charge in group situations.',
    category: 'relationships',
    weights: {
      [DISCType.DOMINANCE]: 1.0,
      [DISCType.INFLUENCE]: 0.4,
      [DISCType.STEADINESS]: -0.4,
      [DISCType.CONSCIENTIOUSNESS]: 0.0,
    },
  },
  {
    id: 14,
    text: 'I enjoy meeting new people and building relationships.',
    category: 'relationships',
    weights: {
      [DISCType.DOMINANCE]: 0.1,
      [DISCType.INFLUENCE]: 1.0,
      [DISCType.STEADINESS]: 0.2,
      [DISCType.CONSCIENTIOUSNESS]: -0.3,
    },
  },
  {
    id: 15,
    text: 'I value loyalty and prefer long-term, stable relationships.',
    category: 'relationships',
    weights: {
      [DISCType.DOMINANCE]: -0.1,
      [DISCType.INFLUENCE]: 0.1,
      [DISCType.STEADINESS]: 1.0,
      [DISCType.CONSCIENTIOUSNESS]: 0.3,
    },
  },
  {
    id: 16,
    text: 'I prefer to work independently and focus on my own tasks.',
    category: 'relationships',
    weights: {
      [DISCType.DOMINANCE]: 0.2,
      [DISCType.INFLUENCE]: -0.8,
      [DISCType.STEADINESS]: 0.0,
      [DISCType.CONSCIENTIOUSNESS]: 0.9,
    },
  },
];

/**
 * Get questions by category
 */
export function getQuestionsByCategory(
  category: DISCQuestion['category']
): DISCQuestion[] {
  return DISC_QUESTIONS.filter((q) => q.category === category);
}

/**
 * Get total number of questions
 */
export function getTotalQuestions(): number {
  return DISC_QUESTIONS.length;
}

/**
 * Validate answer array length
 */
export function validateAnswers(answers: number[]): boolean {
  return answers.length === DISC_QUESTIONS.length;
}

/**
 * Validate individual answer value
 */
export function validateAnswerValue(value: number): boolean {
  return value >= 0 && value <= 3;
}
