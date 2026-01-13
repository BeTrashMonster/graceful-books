/**
 * Checklist Item Templates
 *
 * Comprehensive templates for checklist items organized by phase and category.
 * Templates include selection rules and customization options for personalization.
 *
 * Requirements:
 * - C3: Checklist Generation Engine
 * - CHECK-001: Personalized Checklist System
 * - Plain English descriptions with helpful guidance
 */

import { ChecklistPhase, ChecklistCategory } from '../../db/schema/checklistItems.schema';
import type { ChecklistItemTemplate } from './types';
import { BusinessType } from './types';

/**
 * STABILIZE PHASE TEMPLATES
 * "Getting basic systems in place"
 */
const STABILIZE_TEMPLATES: ChecklistItemTemplate[] = [
  // Setup Tasks
  {
    id: 'stabilize-setup-bank-account',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.SETUP,
    title: 'Set up a separate business bank account',
    description:
      'Keep your business and personal finances separate. This makes bookkeeping easier and protects you legally. Most banks offer free business checking accounts for small businesses.',
    order: 1,
    linkedFeature: null,
    selectionRules: {},
  },
  {
    id: 'stabilize-setup-chart-of-accounts',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.SETUP,
    title: 'Set up your Chart of Accounts',
    description:
      'Your Chart of Accounts is like the filing system for your money. We\'ll help you set it up with categories that make sense for your business.',
    order: 2,
    linkedFeature: '/accounts',
    selectionRules: {},
  },
  {
    id: 'stabilize-setup-invoice-template',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.SETUP,
    title: 'Create your first invoice template',
    description:
      'Having a professional invoice template ready means you can bill clients quickly and consistently. We\'ve got templates ready to customize with your branding.',
    order: 3,
    linkedFeature: '/invoices/templates',
    selectionRules: {
      requiresInvoicing: true,
    },
  },
  {
    id: 'stabilize-setup-expense-categories',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.SETUP,
    title: 'Set up expense categories',
    description:
      'Categorizing your expenses helps you understand where your money goes and makes tax time much easier. We\'ll suggest categories based on your business type.',
    order: 4,
    linkedFeature: '/categories',
    selectionRules: {},
  },

  // Daily Tasks
  {
    id: 'stabilize-daily-check-balance',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.DAILY,
    title: 'Check your bank balance',
    description:
      'A quick daily check helps you spot any unexpected charges and avoid overdrafts. It takes less than a minute and gives you peace of mind.',
    order: 1,
    linkedFeature: '/dashboard',
    selectionRules: {
      maxLiteracyLevel: 2,
    },
    customization: {
      literacyLevelDescriptions: {
        1: 'Look at your bank balance each morning. Just knowing what you have available helps you make better spending decisions throughout the day.',
        2: 'Check your bank balance daily. Make note of any unexpected transactions or charges that don\'t look familiar.',
      },
    },
  },

  // Weekly Tasks
  {
    id: 'stabilize-weekly-record-income',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.WEEKLY,
    title: 'Record income from the past week',
    description:
      'Set aside 15 minutes to record any money that came in this week. This helps you see if your income is growing and ensures nothing falls through the cracks.',
    order: 1,
    linkedFeature: '/transactions/new',
    selectionRules: {},
  },
  {
    id: 'stabilize-weekly-record-expenses',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.WEEKLY,
    title: 'Record expenses from the past week',
    description:
      'Gather your receipts and record what you spent this week. Categorizing as you go makes tax time much less stressful. Pro tip: snap photos of receipts with your phone.',
    order: 2,
    linkedFeature: '/transactions/new',
    selectionRules: {},
  },
  {
    id: 'stabilize-weekly-review-unpaid-invoices',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.WEEKLY,
    title: 'Review unpaid invoices',
    description:
      'Check which invoices are still outstanding. Following up on payments early and politely keeps your cash flow healthy. We\'ll show you who owes what.',
    order: 3,
    linkedFeature: '/invoices',
    selectionRules: {
      requiresInvoicing: true,
    },
  },

  // Monthly Tasks
  {
    id: 'stabilize-monthly-reconcile-bank',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.MONTHLY,
    title: 'Reconcile your bank statement',
    description:
      'Match your records with your bank statement. This is like balancing a checkbook - it helps you catch errors and ensures your books are accurate. We\'ll walk you through it step-by-step.',
    order: 1,
    linkedFeature: '/reconciliation',
    selectionRules: {},
    customization: {
      literacyLevelDescriptions: {
        1: 'Bank reconciliation means checking that what your bank says you have matches what you think you have. We\'ll guide you through it - it\'s easier than it sounds!',
        2: 'Compare your bank statement to your records. Look for any transactions you might have missed recording. Don\'t worry, we\'ll help you find and fix any differences.',
      },
    },
  },
  {
    id: 'stabilize-monthly-review-spending',
    phase: ChecklistPhase.STABILIZE,
    category: ChecklistCategory.MONTHLY,
    title: 'Review where your money went this month',
    description:
      'Look at your spending categories. Are there any surprises? Understanding your spending patterns helps you make better decisions going forward.',
    order: 2,
    linkedFeature: '/reports/expenses',
    selectionRules: {},
  },
];

/**
 * ORGANIZE PHASE TEMPLATES
 * "Building consistent habits"
 */
const ORGANIZE_TEMPLATES: ChecklistItemTemplate[] = [
  // Setup Tasks
  {
    id: 'organize-setup-recurring-transactions',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.SETUP,
    title: 'Set up recurring transactions',
    description:
      'Do you have regular bills or subscriptions? Set them up as recurring transactions so they record automatically. Set it and forget it!',
    order: 1,
    linkedFeature: '/transactions/recurring',
    selectionRules: {},
  },
  {
    id: 'organize-setup-customer-database',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.SETUP,
    title: 'Build your customer database',
    description:
      'Import or enter your customer information. Having all your client details in one place makes invoicing faster and helps you track your client relationships.',
    order: 2,
    linkedFeature: '/customers',
    selectionRules: {
      requiresInvoicing: true,
    },
  },
  {
    id: 'organize-setup-vendor-list',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.SETUP,
    title: 'Create your vendor list',
    description:
      'List the vendors you regularly buy from. This speeds up expense entry and helps you track spending with each vendor.',
    order: 3,
    linkedFeature: '/vendors',
    selectionRules: {},
  },
  {
    id: 'organize-setup-product-catalog',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.SETUP,
    title: 'Set up your product/service catalog',
    description:
      'Create entries for what you sell. This makes invoicing much faster - just pick from your catalog instead of typing everything each time.',
    order: 4,
    linkedFeature: '/products',
    selectionRules: {
      requiresProducts: true,
    },
    customization: {
      titleVariants: {
        [BusinessType.SERVICE_PROVIDER]: 'Set up your service catalog',
        [BusinessType.CONSULTANT]: 'Create your service offerings list',
      },
    },
  },

  // Daily Tasks
  {
    id: 'organize-daily-record-transactions',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.DAILY,
    title: 'Record today\'s transactions',
    description:
      'Got paid today? Buy something? Record it now while it\'s fresh in your mind. Daily recording takes less time than weekly catch-up.',
    order: 1,
    linkedFeature: '/transactions/new',
    selectionRules: {},
  },

  // Weekly Tasks
  {
    id: 'organize-weekly-send-invoices',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.WEEKLY,
    title: 'Send invoices for completed work',
    description:
      'Finished work this week? Send those invoices! The faster you invoice, the faster you get paid. Aim to invoice within 24 hours of completing work.',
    order: 1,
    linkedFeature: '/invoices/new',
    selectionRules: {
      requiresInvoicing: true,
    },
  },
  {
    id: 'organize-weekly-follow-up-payments',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.WEEKLY,
    title: 'Follow up on overdue payments',
    description:
      'Check your aging receivables report. Send friendly payment reminders for invoices over 7 days old. Most people just forgot - a gentle nudge usually works.',
    order: 2,
    linkedFeature: '/reports/ar-aging',
    selectionRules: {
      requiresInvoicing: true,
    },
  },
  {
    id: 'organize-weekly-review-cash-flow',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.WEEKLY,
    title: 'Review cash position',
    description:
      'Quick check: how much cash do you have available? Are any big bills coming due? This 5-minute check prevents surprises.',
    order: 3,
    linkedFeature: '/dashboard',
    selectionRules: {},
  },
  {
    id: 'organize-weekly-categorize-expenses',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.WEEKLY,
    title: 'Categorize uncategorized expenses',
    description:
      'Review any expenses that haven\'t been categorized yet. Proper categorization helps with tax deductions and shows you where your money is really going.',
    order: 4,
    linkedFeature: '/transactions',
    selectionRules: {},
  },

  // Monthly Tasks
  {
    id: 'organize-monthly-reconcile-accounts',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.MONTHLY,
    title: 'Reconcile all accounts',
    description:
      'Match all your accounts (bank, credit card, etc.) with their statements. This catches errors and gives you confidence in your numbers.',
    order: 1,
    linkedFeature: '/reconciliation',
    selectionRules: {},
  },
  {
    id: 'organize-monthly-review-profit-loss',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.MONTHLY,
    title: 'Review Profit & Loss statement',
    description:
      'Look at your P&L (Profit & Loss) report. Did you make money this month? Where did it come from? Where did it go? Understanding these patterns is powerful.',
    order: 2,
    linkedFeature: '/reports/profit-loss',
    selectionRules: {},
    customization: {
      literacyLevelDescriptions: {
        1: 'Your Profit & Loss report shows: Money In (Revenue) minus Money Out (Expenses) = What\'s Left (Profit). Positive number? You made money! We\'ll explain each line.',
        2: 'Review your P&L statement. Look for trends - is revenue growing? Are expenses under control? Compare to last month to spot changes.',
        3: 'Analyze your P&L for insights. What\'s your profit margin? Which revenue streams are growing? Where can you reduce costs without hurting the business?',
      },
    },
  },
  {
    id: 'organize-monthly-pay-bills',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.MONTHLY,
    title: 'Review and pay bills',
    description:
      'Check what bills are due this month. Schedule payments to avoid late fees. Staying on top of payables keeps vendor relationships strong.',
    order: 3,
    linkedFeature: '/bills',
    selectionRules: {},
  },

  // Quarterly Tasks
  {
    id: 'organize-quarterly-review-goals',
    phase: ChecklistPhase.ORGANIZE,
    category: ChecklistCategory.QUARTERLY,
    title: 'Review financial goals',
    description:
      'Step back and look at the bigger picture. Are you on track with your revenue goals? Is your profit margin healthy? Adjust your strategy if needed.',
    order: 1,
    linkedFeature: '/dashboard',
    selectionRules: {},
  },
];

/**
 * BUILD PHASE TEMPLATES
 * "Growing revenue and capabilities"
 */
const BUILD_TEMPLATES: ChecklistItemTemplate[] = [
  // Setup Tasks
  {
    id: 'build-setup-sales-tax',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.SETUP,
    title: 'Set up sales tax tracking',
    description:
      'Configure sales tax rates for your locations. Proper sales tax tracking keeps you compliant and makes filing much easier.',
    order: 1,
    linkedFeature: '/settings/tax',
    selectionRules: {
      requiresProducts: true,
    },
  },
  {
    id: 'build-setup-inventory',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.SETUP,
    title: 'Set up inventory tracking',
    description:
      'Start tracking your inventory levels. Knowing what you have in stock prevents overselling and helps you reorder at the right time.',
    order: 2,
    linkedFeature: '/inventory',
    selectionRules: {
      requiresInventory: true,
    },
  },
  {
    id: 'build-setup-1099-tracking',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.SETUP,
    title: 'Set up 1099 contractor tracking',
    description:
      'Mark which vendors need 1099 forms. Track this all year so tax time is painless. You\'ll thank yourself in January!',
    order: 3,
    linkedFeature: '/vendors',
    selectionRules: {
      requiresEmployees: true,
    },
  },
  {
    id: 'build-setup-classes',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.SETUP,
    title: 'Set up classes or departments',
    description:
      'Classes let you track profitability by department, location, or project. This multi-dimensional view helps you see which parts of your business are thriving.',
    order: 4,
    linkedFeature: '/classes',
    selectionRules: {
      minLiteracyLevel: 3,
    },
  },

  // Daily Tasks
  {
    id: 'build-daily-review-cash',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.DAILY,
    title: 'Review cash position and upcoming obligations',
    description:
      'Quick morning check: current cash, bills due this week, expected payments coming in. This keeps you ahead of cash crunches.',
    order: 1,
    linkedFeature: '/dashboard',
    selectionRules: {},
  },

  // Weekly Tasks
  {
    id: 'build-weekly-review-metrics',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.WEEKLY,
    title: 'Review key business metrics',
    description:
      'Look at your KPIs: revenue, profit margin, cash runway, customer acquisition. Track trends over time. What\'s improving? What needs attention?',
    order: 1,
    linkedFeature: '/dashboard',
    selectionRules: {
      minLiteracyLevel: 3,
    },
  },
  {
    id: 'build-weekly-inventory-check',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.WEEKLY,
    title: 'Check inventory levels',
    description:
      'Review low stock alerts. Place reorders before you run out. Good inventory management prevents lost sales and keeps customers happy.',
    order: 2,
    linkedFeature: '/inventory',
    selectionRules: {
      requiresInventory: true,
    },
  },
  {
    id: 'build-weekly-forecast-cash',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.WEEKLY,
    title: 'Update cash flow forecast',
    description:
      'Look ahead 4-6 weeks. What money is coming in? What bills are due? Forecasting helps you plan for growth without cash flow problems.',
    order: 3,
    linkedFeature: '/reports/cash-flow',
    selectionRules: {
      minLiteracyLevel: 3,
    },
  },

  // Monthly Tasks
  {
    id: 'build-monthly-close-books',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.MONTHLY,
    title: 'Close the books for the month',
    description:
      'Full month-end close: reconcile all accounts, review P&L and Balance Sheet, make adjusting entries. Clean books give you confidence in your numbers.',
    order: 1,
    linkedFeature: '/dashboard',
    selectionRules: {},
  },
  {
    id: 'build-monthly-analyze-margins',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.MONTHLY,
    title: 'Analyze profit margins by product/service',
    description:
      'Which offerings are most profitable? Which are barely breaking even? This analysis helps you focus on what works and fix or drop what doesn\'t.',
    order: 2,
    linkedFeature: '/reports/products',
    selectionRules: {
      minLiteracyLevel: 3,
    },
  },
  {
    id: 'build-monthly-review-expenses',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.MONTHLY,
    title: 'Review and optimize expenses',
    description:
      'Look for subscriptions you don\'t use, vendors with better alternatives, or spending creep. Small savings add up to real money over time.',
    order: 3,
    linkedFeature: '/reports/expenses',
    selectionRules: {},
  },

  // Quarterly Tasks
  {
    id: 'build-quarterly-tax-planning',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.QUARTERLY,
    title: 'Review tax obligations and estimated payments',
    description:
      'Check your quarterly tax payments. Make sure you\'re setting aside enough for taxes. Meeting with your accountant now prevents April panic.',
    order: 1,
    linkedFeature: '/reports/tax-summary',
    selectionRules: {},
  },
  {
    id: 'build-quarterly-financial-review',
    phase: ChecklistPhase.BUILD,
    category: ChecklistCategory.QUARTERLY,
    title: 'Comprehensive financial review',
    description:
      'Deep dive: trends over 3 months, year-over-year comparison, progress toward annual goals. This is your quarterly business health checkup.',
    order: 2,
    linkedFeature: '/reports',
    selectionRules: {
      minLiteracyLevel: 3,
    },
  },
];

/**
 * GROW PHASE TEMPLATES
 * "Scaling and optimizing"
 */
const GROW_TEMPLATES: ChecklistItemTemplate[] = [
  // Setup Tasks
  {
    id: 'grow-setup-multi-currency',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.SETUP,
    title: 'Enable multi-currency support',
    description:
      'Working with international clients? Set up multiple currencies to handle foreign transactions and track exchange rates automatically.',
    order: 1,
    linkedFeature: '/settings/currencies',
    selectionRules: {
      requiresMultiCurrency: true,
    },
  },
  {
    id: 'grow-setup-approval-workflows',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.SETUP,
    title: 'Configure approval workflows',
    description:
      'Set up approval requirements for expenses over certain amounts. This adds financial controls as your team grows.',
    order: 2,
    linkedFeature: '/settings/approvals',
    selectionRules: {
      requiresEmployees: true,
      minLiteracyLevel: 4,
    },
  },
  {
    id: 'grow-setup-budget',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.SETUP,
    title: 'Create departmental budgets',
    description:
      'Set budgets by department or project. Monitor actual vs. budget to maintain financial discipline while scaling.',
    order: 3,
    linkedFeature: '/budgets',
    selectionRules: {
      minLiteracyLevel: 4,
    },
  },

  // Weekly Tasks
  {
    id: 'grow-weekly-review-kpis',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.WEEKLY,
    title: 'Review executive dashboard KPIs',
    description:
      'Monitor key metrics: revenue growth, burn rate, customer lifetime value, churn rate, cash runway. Stay data-driven as you scale.',
    order: 1,
    linkedFeature: '/dashboard/executive',
    selectionRules: {
      minLiteracyLevel: 4,
    },
  },
  {
    id: 'grow-weekly-review-runway',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.WEEKLY,
    title: 'Monitor cash runway',
    description:
      'How many months can you operate at current burn rate? Keep this top of mind. Runway awareness prevents crisis situations.',
    order: 2,
    linkedFeature: '/dashboard',
    selectionRules: {
      minLiteracyLevel: 4,
    },
  },

  // Monthly Tasks
  {
    id: 'grow-monthly-board-package',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.MONTHLY,
    title: 'Prepare monthly board/investor package',
    description:
      'Compile financial reports, metrics, and commentary for stakeholders. Clear communication builds trust and attracts investment.',
    order: 1,
    linkedFeature: '/reports/board-package',
    selectionRules: {
      minLiteracyLevel: 5,
    },
  },
  {
    id: 'grow-monthly-variance-analysis',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.MONTHLY,
    title: 'Analyze budget variances',
    description:
      'Compare actual vs. budget. Investigate significant variances. Understanding why numbers differ from plan helps you course-correct quickly.',
    order: 2,
    linkedFeature: '/reports/budget-variance',
    selectionRules: {
      minLiteracyLevel: 4,
    },
  },
  {
    id: 'grow-monthly-unit-economics',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.MONTHLY,
    title: 'Review unit economics',
    description:
      'Deep dive into customer acquisition cost, lifetime value, contribution margin. Healthy unit economics are essential for sustainable scaling.',
    order: 3,
    linkedFeature: '/reports/unit-economics',
    selectionRules: {
      minLiteracyLevel: 5,
    },
  },

  // Quarterly Tasks
  {
    id: 'grow-quarterly-strategic-review',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.QUARTERLY,
    title: 'Strategic financial planning session',
    description:
      'Review strategy: Are you hitting growth targets? Is burn rate sustainable? Do you need to raise capital? Make big decisions with confidence.',
    order: 1,
    linkedFeature: '/planning',
    selectionRules: {
      minLiteracyLevel: 5,
    },
  },
  {
    id: 'grow-quarterly-scenario-planning',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.QUARTERLY,
    title: 'Update financial scenarios and forecasts',
    description:
      'Model best-case, expected, and worst-case scenarios for the next 12-18 months. Scenario planning helps you be ready for anything.',
    order: 2,
    linkedFeature: '/planning/scenarios',
    selectionRules: {
      minLiteracyLevel: 5,
    },
  },

  // Yearly Tasks
  {
    id: 'grow-yearly-annual-planning',
    phase: ChecklistPhase.GROW,
    category: ChecklistCategory.YEARLY,
    title: 'Annual business planning and budgeting',
    description:
      'Create next year\'s budget, set financial goals, plan major investments. Strategic annual planning sets your business up for success.',
    order: 1,
    linkedFeature: '/planning/annual',
    selectionRules: {},
  },
];

/**
 * Combine all templates
 */
export const ALL_CHECKLIST_TEMPLATES: ChecklistItemTemplate[] = [
  ...STABILIZE_TEMPLATES,
  ...ORGANIZE_TEMPLATES,
  ...BUILD_TEMPLATES,
  ...GROW_TEMPLATES,
];

/**
 * Get templates by phase
 */
export function getTemplatesByPhase(phase: ChecklistPhase): ChecklistItemTemplate[] {
  return ALL_CHECKLIST_TEMPLATES.filter((t) => t.phase === phase);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: ChecklistCategory): ChecklistItemTemplate[] {
  return ALL_CHECKLIST_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): ChecklistItemTemplate | undefined {
  return ALL_CHECKLIST_TEMPLATES.find((t) => t.id === id);
}
