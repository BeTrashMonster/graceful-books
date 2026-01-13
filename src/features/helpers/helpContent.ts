/**
 * Contextual help content for specific UI areas
 * Provides quick tooltips and hints
 */

export interface HelpContent {
  id: string;
  title: string;
  content: string;
  learnMoreLink?: string;
}

/**
 * Help content organized by feature area
 */
export const helpContent: Record<string, HelpContent> = {
  // Transaction entry
  'transaction-debit-credit': {
    id: 'transaction-debit-credit',
    title: 'Debit & Credit',
    content: 'Every transaction needs at least one debit and one credit entry that balance out. Think of it like a seesaw - both sides need to be equal!',
    learnMoreLink: 'debit-credit'
  },

  'transaction-date': {
    id: 'transaction-date',
    title: 'Transaction Date',
    content: 'Use the date when the transaction actually happened, not when you\'re entering it. This keeps your reports accurate!',
  },

  'transaction-description': {
    id: 'transaction-description',
    title: 'Description',
    content: 'Write a description that your future self will understand. "Coffee" is vague, but "Client meeting at Starbucks with Sarah" is helpful!',
  },

  // Chart of Accounts
  'account-type': {
    id: 'account-type',
    title: 'Account Types',
    content: 'Pick the category that best fits: Assets (what you own), Liabilities (what you owe), Equity (your stake), Revenue (money in), or Expenses (money out).',
    learnMoreLink: 'chart-of-accounts'
  },

  'account-code': {
    id: 'account-code',
    title: 'Account Code',
    content: 'A short number to organize your accounts. Common practice: 1000s for assets, 2000s for liabilities, 3000s for equity, 4000s for revenue, 5000s for expenses.',
  },

  'account-balance': {
    id: 'account-balance',
    title: 'Account Balance',
    content: 'The current total in this account. For bank accounts, this should match your actual bank balance!',
  },

  // Reports
  'balance-sheet-date': {
    id: 'balance-sheet-date',
    title: 'Balance Sheet Date',
    content: 'The balance sheet shows your financial position at a specific point in time, like taking a photograph. Pick any date to see what you owned and owed then.',
    learnMoreLink: 'balance-sheet'
  },

  'profit-loss-period': {
    id: 'profit-loss-period',
    title: 'Profit & Loss Period',
    content: 'Choose a date range to see if you made money during that time. Monthly reports are common, but you can pick any range!',
    learnMoreLink: 'profit-loss'
  },

  'cash-flow-period': {
    id: 'cash-flow-period',
    title: 'Cash Flow Period',
    content: 'See how cash moved in and out during this time. This is different from profit - you can be profitable but low on cash!',
    learnMoreLink: 'cash-flow'
  },

  // Settings
  'accounting-method': {
    id: 'accounting-method',
    title: 'Accounting Method',
    content: 'Cash basis is simpler (count money when it moves). Accrual is more accurate (count money when earned/owed). Most small businesses start with cash basis.',
    learnMoreLink: 'accrual-vs-cash'
  },

  'fiscal-year': {
    id: 'fiscal-year',
    title: 'Fiscal Year',
    content: 'Your business year for financial reporting. Many businesses use January-December, but you can pick any 12-month period that makes sense for you.',
  },

  // Double-entry concepts
  'double-entry-explained': {
    id: 'double-entry-explained',
    title: 'Why Two Entries?',
    content: 'Every transaction affects at least two accounts because money always moves FROM somewhere TO somewhere. This helps catch errors and gives you the full picture.',
    learnMoreLink: 'double-entry'
  },

  'balanced-transaction': {
    id: 'balanced-transaction',
    title: 'Balanced Transaction',
    content: 'Total debits must equal total credits. If they don\'t match, something is missing or wrong. The system will help you catch this!',
    learnMoreLink: 'double-entry'
  },

  // Account types explained
  'assets-explained': {
    id: 'assets-explained',
    title: 'Assets',
    content: 'Things you own or that owe you money. Examples: cash, equipment, inventory, money customers owe you.',
    learnMoreLink: 'assets'
  },

  'liabilities-explained': {
    id: 'liabilities-explained',
    title: 'Liabilities',
    content: 'What you owe to others. Examples: loans, credit card balances, unpaid bills. Not necessarily bad - just important to track!',
    learnMoreLink: 'liabilities'
  },

  'equity-explained': {
    id: 'equity-explained',
    title: 'Equity',
    content: 'Your ownership stake. Calculated as: Assets minus Liabilities. This is what you truly own!',
    learnMoreLink: 'equity'
  },

  'revenue-explained': {
    id: 'revenue-explained',
    title: 'Revenue',
    content: 'Money your business earns from sales and services. This is before expenses - so it\'s not the same as profit!',
    learnMoreLink: 'revenue'
  },

  'expenses-explained': {
    id: 'expenses-explained',
    title: 'Expenses',
    content: 'Costs of running your business. Subtract these from revenue to get your profit. Track them carefully to find savings!',
    learnMoreLink: 'expenses'
  },
};

/**
 * Get help content by ID
 */
export function getHelpContent(id: string): HelpContent | undefined {
  return helpContent[id];
}

/**
 * Get help content by feature area
 */
export function getHelpContentByArea(area: string): HelpContent[] {
  return Object.values(helpContent).filter(content =>
    content.id.startsWith(area)
  );
}

/**
 * Search help content
 */
export function searchHelpContent(query: string): HelpContent[] {
  const searchTerm = query.toLowerCase();
  return Object.values(helpContent).filter(content =>
    content.title.toLowerCase().includes(searchTerm) ||
    content.content.toLowerCase().includes(searchTerm)
  );
}
