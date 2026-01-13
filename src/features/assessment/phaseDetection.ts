/**
 * Phase Detection Logic
 *
 * Determines user's business phase and financial literacy level
 * from assessment scores and specific answers.
 *
 * Per ONB-003
 */

import {
  BusinessPhase,
  FinancialLiteracyLevel,
  BusinessType,
  RevenueRange,
} from './types';
import type {
  AssessmentAnswer,
  AssessmentResults,
  RawAssessmentScores,
} from './types';
import { calculateConfidence } from './scoring';

/**
 * Determine business phase from scores
 */
export function determinePhase(scores: RawAssessmentScores): BusinessPhase {
  const { phaseScores } = scores;

  // Find the highest scoring phase
  const phases = Object.entries(phaseScores) as Array<[string, number]>;
  phases.sort((a, b) => b[1] - a[1]);

  return phases[0]![0] as BusinessPhase;
}

/**
 * Determine financial literacy level from scores
 */
export function determineLiteracyLevel(scores: RawAssessmentScores): FinancialLiteracyLevel {
  const { literacyScores } = scores;

  // Find the highest scoring level
  const levels = Object.entries(literacyScores) as Array<[string, number]>;
  levels.sort((a, b) => b[1] - a[1]);

  return levels[0]![0] as FinancialLiteracyLevel;
}

/**
 * Extract business metadata from answers
 */
export function extractBusinessMetadata(answers: Map<string, AssessmentAnswer>): {
  businessType: BusinessType;
  revenueRange: RevenueRange;
  hasEmployees: boolean;
  hasSalesTax: boolean;
  hasInventory: boolean;
} {
  const businessStructure = answers.get('business_structure')?.value as BusinessType || BusinessType.SOLE_PROPRIETOR;
  const revenue = answers.get('revenue_range')?.value as RevenueRange || RevenueRange.ZERO_TO_25K;
  const employees = answers.get('has_employees')?.value === 'yes';
  const salesTax = answers.get('has_sales_tax')?.value === 'yes';
  const inventory = answers.get('has_inventory')?.value === 'yes' || answers.get('has_inventory')?.value === 'both';

  return {
    businessType: businessStructure,
    revenueRange: revenue,
    hasEmployees: employees,
    hasSalesTax: salesTax,
    hasInventory: inventory,
  };
}

/**
 * Determine recommended features based on results
 */
export function determineRecommendedFeatures(
  phase: BusinessPhase,
  literacyLevel: FinancialLiteracyLevel,
  metadata: ReturnType<typeof extractBusinessMetadata>
): string[] {
  const features: string[] = [];

  // Core features for everyone
  features.push('chart_of_accounts', 'transactions', 'dashboard');

  // Phase-based features
  switch (phase) {
    case BusinessPhase.STABILIZE:
      features.push(
        'guided_setup',
        'expense_tracking',
        'basic_reports',
        'checklist'
      );
      break;
    case BusinessPhase.ORGANIZE:
      features.push(
        'bank_reconciliation',
        'invoicing',
        'receipt_capture',
        'categories',
        'checklist'
      );
      break;
    case BusinessPhase.BUILD:
      features.push(
        'bank_reconciliation',
        'invoicing',
        'receipt_capture',
        'categories',
        'tags',
        'advanced_reports',
        'recurring_transactions'
      );
      break;
    case BusinessPhase.GROW:
      features.push(
        'bank_reconciliation',
        'invoicing',
        'receipt_capture',
        'categories',
        'tags',
        'advanced_reports',
        'recurring_transactions',
        'classes',
        'custom_reports',
        'multi_user'
      );
      break;
  }

  // Literacy-based features
  if (literacyLevel === FinancialLiteracyLevel.BEGINNER) {
    features.push('tutorials', 'tooltips', 'guided_workflows');
  } else if (literacyLevel === FinancialLiteracyLevel.ADVANCED) {
    features.push('journal_entries', 'bulk_operations', 'keyboard_shortcuts');
  }

  // Business-specific features
  if (metadata.hasEmployees) {
    features.push('payroll_tracking', 'employee_expenses');
  }

  if (metadata.hasSalesTax) {
    features.push('sales_tax_tracking', 'tax_reports');
  }

  if (metadata.hasInventory) {
    features.push('inventory_management', 'cogs_tracking', 'product_catalog');
  }

  if (
    metadata.businessType === BusinessType.S_CORP ||
    metadata.businessType === BusinessType.C_CORP
  ) {
    features.push('corporate_reporting', 'shareholder_equity');
  }

  if (metadata.businessType === BusinessType.NONPROFIT) {
    features.push('fund_accounting', 'donation_tracking', 'grant_management');
  }

  // Remove duplicates
  return Array.from(new Set(features));
}

/**
 * Determine recommended checklists based on results
 */
export function determineRecommendedChecklists(
  phase: BusinessPhase,
  literacyLevel: FinancialLiteracyLevel,
  metadata: ReturnType<typeof extractBusinessMetadata>,
  answers: Map<string, AssessmentAnswer>
): string[] {
  const checklists: string[] = [];

  // Core onboarding checklist
  checklists.push('onboarding_basics');

  // Phase-based checklists
  switch (phase) {
    case BusinessPhase.STABILIZE:
      checklists.push('stabilize_finances', 'separate_accounts', 'basic_tracking');
      break;
    case BusinessPhase.ORGANIZE:
      checklists.push('setup_systems', 'monthly_routine', 'tax_preparation');
      break;
    case BusinessPhase.BUILD:
      checklists.push('scale_operations', 'advanced_tracking', 'quarterly_review');
      break;
    case BusinessPhase.GROW:
      checklists.push('strategic_planning', 'advanced_reporting', 'team_onboarding');
      break;
  }

  // Literacy-based checklists
  if (literacyLevel === FinancialLiteracyLevel.BEGINNER) {
    checklists.push('accounting_basics', 'learn_terminology');
  }

  // Goal-based checklists
  const primaryGoal = answers.get('primary_goal')?.value;
  if (primaryGoal === 'tax_ready') {
    checklists.push('tax_readiness', 'deduction_tracking');
  } else if (primaryGoal === 'save_time') {
    checklists.push('automation_setup', 'recurring_setup');
  } else if (primaryGoal === 'grow_business') {
    checklists.push('growth_metrics', 'profitability_analysis');
  }

  // Timeline-based checklists
  const timeline = answers.get('timeline')?.value;
  if (timeline === 'urgent') {
    checklists.push('quick_start', 'catch_up_guide');
  }

  // Business-specific checklists
  if (metadata.hasEmployees) {
    checklists.push('payroll_setup');
  }

  if (metadata.hasSalesTax) {
    checklists.push('sales_tax_setup');
  }

  if (metadata.hasInventory) {
    checklists.push('inventory_setup');
  }

  // Pain point-based checklists
  const challenges = answers.get('biggest_challenge')?.value;
  if (Array.isArray(challenges)) {
    const challengesList = challenges as string[];
    if (challengesList.includes('catching_up')) {
      checklists.push('catch_up_guide', 'backlog_cleanup');
    }
    if (challengesList.includes('staying_organized')) {
      checklists.push('organization_system', 'filing_workflow');
    }
    if (challengesList.includes('accuracy')) {
      checklists.push('accuracy_checklist', 'reconciliation_routine');
    }
  }

  // Remove duplicates
  return Array.from(new Set(checklists));
}

/**
 * Generate complete assessment results
 */
export function generateAssessmentResults(
  rawScores: RawAssessmentScores,
  normalizedScores: RawAssessmentScores,
  answers: Map<string, AssessmentAnswer>
): AssessmentResults {
  // Determine phase and literacy
  const phase = determinePhase(normalizedScores);
  const literacyLevel = determineLiteracyLevel(normalizedScores);

  // Calculate confidence scores
  const phaseConfidence = calculateConfidence(normalizedScores.phaseScores, answers);
  const literacyConfidence = calculateConfidence(normalizedScores.literacyScores, answers);

  // Extract business metadata
  const metadata = extractBusinessMetadata(answers);

  // Determine recommendations
  const recommendedFeatures = determineRecommendedFeatures(phase, literacyLevel, metadata);
  const recommendedChecklists = determineRecommendedChecklists(
    phase,
    literacyLevel,
    metadata,
    answers
  );

  return {
    phase,
    phaseConfidence,
    literacyLevel,
    literacyConfidence,
    businessType: metadata.businessType,
    revenueRange: metadata.revenueRange,
    hasEmployees: metadata.hasEmployees,
    hasSalesTax: metadata.hasSalesTax,
    hasInventory: metadata.hasInventory,
    rawScores,
    recommendedFeatures,
    recommendedChecklists,
  };
}

/**
 * Get phase transition suggestions
 * Helps users understand what they need to move to next phase
 */
export function getPhaseTransitionSuggestions(
  currentPhase: BusinessPhase,
  _scores: RawAssessmentScores
): string[] {
  const suggestions: string[] = [];

  switch (currentPhase) {
    case BusinessPhase.STABILIZE:
      suggestions.push(
        'Set up separate business and personal bank accounts',
        'Start tracking all income and expenses',
        'Reconcile your bank account monthly',
        'Create a basic chart of accounts'
      );
      break;
    case BusinessPhase.ORGANIZE:
      suggestions.push(
        'Set up recurring transactions for regular income/expenses',
        'Create invoice templates and start invoicing promptly',
        'Establish a weekly bookkeeping routine',
        'Learn to read your Profit & Loss statement'
      );
      break;
    case BusinessPhase.BUILD:
      suggestions.push(
        'Implement class tracking for different revenue streams',
        'Set up custom reports for key business metrics',
        'Consider multi-user access for team members',
        'Automate routine bookkeeping tasks'
      );
      break;
    case BusinessPhase.GROW:
      // Already at highest phase
      suggestions.push(
        'Continue refining your financial processes',
        'Consider working with a financial advisor',
        'Explore strategic planning tools',
        'Share your knowledge with other business owners'
      );
      break;
  }

  return suggestions;
}

/**
 * Get literacy improvement suggestions
 */
export function getLiteracyImprovementSuggestions(
  currentLevel: FinancialLiteracyLevel
): string[] {
  const suggestions: string[] = [];

  switch (currentLevel) {
    case FinancialLiteracyLevel.BEGINNER:
      suggestions.push(
        'Complete the "Accounting Basics" tutorial',
        'Read our guide: "Understanding Your Chart of Accounts"',
        'Practice reconciling your bank account',
        'Learn about debits and credits with our interactive guide'
      );
      break;
    case FinancialLiteracyLevel.INTERMEDIATE:
      suggestions.push(
        'Learn about accrual vs. cash basis accounting',
        'Understand how to read a Balance Sheet',
        'Explore class and location tracking',
        'Study cash flow management techniques'
      );
      break;
    case FinancialLiteracyLevel.ADVANCED:
      suggestions.push(
        'Master journal entries for complex transactions',
        'Learn about GAAP compliance',
        'Explore multi-currency accounting',
        'Consider certification in bookkeeping or accounting'
      );
      break;
  }

  return suggestions;
}
