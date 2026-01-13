/**
 * Tutorial Definitions
 *
 * Contains all tutorial definitions with encouraging, judgment-free language.
 * Tutorials guide users through key features and workflows.
 *
 * Requirements:
 * - D4: Tutorial System Framework
 * - LEARN-001: Contextual Tutorial System
 */

import type { TutorialDefinition } from '../../types/tutorial.types';
import { TutorialTrigger, StepPosition } from '../../types/tutorial.types';

/**
 * First Invoice Tutorial
 * Guides users through creating their first invoice
 */
export const firstInvoiceTutorial: TutorialDefinition = {
  id: 'first-invoice',
  title: 'Create Your First Invoice',
  description: 'Let me show you how to create an invoice. It\'s easier than you might think!',
  category: 'feature',
  trigger: TutorialTrigger.FIRST_TIME,
  estimatedMinutes: 3,
  steps: [
    {
      id: 'welcome',
      title: 'Ready to create your first invoice?',
      description: 'Great choice! Invoices help you get paid faster and keep track of what customers owe you. Let\'s walk through this together.',
      element: null,
      position: StepPosition.CENTER,
    },
    {
      id: 'customer-select',
      title: 'Choose your customer',
      description: 'First, let\'s pick who you\'re invoicing. Don\'t worry if you haven\'t added customers yet - you can create one on the fly!',
      element: '[data-tutorial="invoice-customer-select"]',
      position: StepPosition.BOTTOM,
    },
    {
      id: 'add-items',
      title: 'Add what you\'re billing for',
      description: 'Now add the products or services you\'re charging for. You can add as many line items as you need - take your time!',
      element: '[data-tutorial="invoice-items"]',
      position: StepPosition.LEFT,
    },
    {
      id: 'review-total',
      title: 'Check your total',
      description: 'The total is calculated automatically. Make sure everything looks good before sending it out.',
      element: '[data-tutorial="invoice-total"]',
      position: StepPosition.TOP,
    },
    {
      id: 'save',
      title: 'Save your invoice',
      description: 'When you\'re happy with everything, click Save. You can always come back and edit it before you send it to your customer.',
      element: '[data-tutorial="invoice-save-button"]',
      position: StepPosition.TOP,
    },
  ],
};

/**
 * First Expense Tutorial
 * Guides users through recording their first expense
 */
export const firstExpenseTutorial: TutorialDefinition = {
  id: 'first-expense',
  title: 'Record Your First Expense',
  description: 'Tracking expenses helps you understand where your money goes. Let\'s record one together!',
  category: 'feature',
  trigger: TutorialTrigger.FIRST_TIME,
  estimatedMinutes: 2,
  steps: [
    {
      id: 'welcome',
      title: 'Let\'s record an expense',
      description: 'Every business has expenses - that\'s totally normal! Recording them helps you see the full picture of your finances.',
      element: null,
      position: StepPosition.CENTER,
    },
    {
      id: 'date',
      title: 'When did you spend this?',
      description: 'Enter the date of the expense. It\'s okay if it was a while ago - we can still track it!',
      element: '[data-tutorial="expense-date"]',
      position: StepPosition.BOTTOM,
    },
    {
      id: 'amount',
      title: 'How much was it?',
      description: 'Enter the amount you spent. Just the number - we\'ll handle the rest.',
      element: '[data-tutorial="expense-amount"]',
      position: StepPosition.BOTTOM,
    },
    {
      id: 'category',
      title: 'What category is this?',
      description: 'Choose a category that fits best. This helps you see patterns in your spending over time.',
      element: '[data-tutorial="expense-category"]',
      position: StepPosition.RIGHT,
    },
    {
      id: 'receipt',
      title: 'Got a receipt? (Optional)',
      description: 'You can attach a photo of the receipt if you have one. It\'s optional, but handy for record keeping!',
      element: '[data-tutorial="expense-receipt"]',
      position: StepPosition.TOP,
    },
  ],
};

/**
 * Chart of Accounts Tutorial
 * Helps users understand their chart of accounts
 */
export const chartOfAccountsTutorial: TutorialDefinition = {
  id: 'chart-of-accounts',
  title: 'Understanding Your Chart of Accounts',
  description: 'Your chart of accounts is like the filing system for your money. Let\'s explore it together!',
  category: 'feature',
  trigger: TutorialTrigger.FIRST_TIME,
  estimatedMinutes: 4,
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to your Chart of Accounts',
      description: 'Think of this as your financial filing cabinet. Each account is a folder where similar transactions are organized.',
      element: null,
      position: StepPosition.CENTER,
    },
    {
      id: 'account-types',
      title: 'Different types of accounts',
      description: 'You\'ll see Assets (what you own), Liabilities (what you owe), Income (money coming in), and Expenses (money going out).',
      element: '[data-tutorial="account-types"]',
      position: StepPosition.RIGHT,
    },
    {
      id: 'add-account',
      title: 'Adding a new account',
      description: 'Need a new category? Click here to add one. You can customize these to fit your business perfectly.',
      element: '[data-tutorial="add-account-button"]',
      position: StepPosition.LEFT,
    },
    {
      id: 'account-balance',
      title: 'Account balances',
      description: 'Each account shows its current balance. These update automatically as you add transactions - pretty neat!',
      element: '[data-tutorial="account-balance"]',
      position: StepPosition.TOP,
    },
  ],
};

/**
 * Dashboard Overview Tutorial
 * Introduces users to the dashboard
 */
export const dashboardOverviewTutorial: TutorialDefinition = {
  id: 'dashboard-overview',
  title: 'Your Dashboard Tour',
  description: 'Welcome! Let me show you around your dashboard - it\'s your home base.',
  category: 'onboarding',
  trigger: TutorialTrigger.ONBOARDING,
  estimatedMinutes: 3,
  required: true,
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Graceful Books!',
      description: 'This is your dashboard - your central hub for managing your business finances. Let\'s take a quick tour!',
      element: null,
      position: StepPosition.CENTER,
    },
    {
      id: 'metrics',
      title: 'Your financial snapshot',
      description: 'These cards show key metrics at a glance: income, expenses, and profit. They update in real-time as you work.',
      element: '[data-tutorial="dashboard-metrics"]',
      position: StepPosition.BOTTOM,
    },
    {
      id: 'recent-activity',
      title: 'Recent activity',
      description: 'Here you\'ll see your latest transactions and what needs attention. It\'s like a to-do list for your finances.',
      element: '[data-tutorial="recent-activity"]',
      position: StepPosition.LEFT,
    },
    {
      id: 'quick-actions',
      title: 'Quick actions',
      description: 'Use these buttons to jump right into common tasks. No need to dig through menus!',
      element: '[data-tutorial="quick-actions"]',
      position: StepPosition.TOP,
    },
    {
      id: 'navigation',
      title: 'Navigation menu',
      description: 'The sidebar gives you access to everything. Take your time exploring - you can\'t break anything!',
      element: '[data-tutorial="navigation-menu"]',
      position: StepPosition.RIGHT,
    },
  ],
};

/**
 * Reconciliation Tutorial
 * Guides users through their first bank reconciliation
 */
export const reconciliationTutorial: TutorialDefinition = {
  id: 'first-reconciliation',
  title: 'Your First Reconciliation',
  description: 'Reconciling ensures your records match your bank. Let\'s do this together!',
  category: 'workflow',
  trigger: TutorialTrigger.FIRST_TIME,
  estimatedMinutes: 5,
  steps: [
    {
      id: 'welcome',
      title: 'Let\'s reconcile your account',
      description: 'Reconciliation sounds fancy, but it just means making sure your records match your bank statement. We\'ll walk through it step by step.',
      element: null,
      position: StepPosition.CENTER,
    },
    {
      id: 'upload-statement',
      title: 'Upload your bank statement',
      description: 'You can upload a PDF or CSV file of your bank statement. We\'ll help match everything up automatically.',
      element: '[data-tutorial="reconcile-upload"]',
      position: StepPosition.BOTTOM,
    },
    {
      id: 'enter-balances',
      title: 'Enter starting and ending balances',
      description: 'These numbers come from your bank statement. Just copy them over - we\'ll do the math!',
      element: '[data-tutorial="reconcile-balances"]',
      position: StepPosition.RIGHT,
    },
    {
      id: 'match-transactions',
      title: 'Match your transactions',
      description: 'We\'ll show you transactions from your books and your bank. Check off the ones that match - it\'s that simple!',
      element: '[data-tutorial="reconcile-transactions"]',
      position: StepPosition.LEFT,
    },
    {
      id: 'review-differences',
      title: 'Review any differences',
      description: 'If something doesn\'t match, we\'ll help you figure out why. Common things: timing differences or missing entries.',
      element: '[data-tutorial="reconcile-differences"]',
      position: StepPosition.TOP,
    },
  ],
};

/**
 * All tutorial definitions
 * Registry of all available tutorials
 */
export const allTutorials: TutorialDefinition[] = [
  dashboardOverviewTutorial,
  firstInvoiceTutorial,
  firstExpenseTutorial,
  chartOfAccountsTutorial,
  reconciliationTutorial,
];

/**
 * Get tutorial by ID
 *
 * @param tutorialId - Tutorial ID
 * @returns Tutorial definition or undefined
 */
export function getTutorialById(tutorialId: string): TutorialDefinition | undefined {
  return allTutorials.find((t) => t.id === tutorialId);
}

/**
 * Get tutorials by category
 *
 * @param category - Tutorial category
 * @returns Array of tutorial definitions
 */
export function getTutorialsByCategory(
  category: 'onboarding' | 'feature' | 'workflow' | 'advanced'
): TutorialDefinition[] {
  return allTutorials.filter((t) => t.category === category);
}

/**
 * Get tutorials by trigger
 *
 * @param trigger - Tutorial trigger type
 * @returns Array of tutorial definitions
 */
export function getTutorialsByTrigger(trigger: TutorialTrigger): TutorialDefinition[] {
  return allTutorials.filter((t) => t.trigger === trigger);
}
