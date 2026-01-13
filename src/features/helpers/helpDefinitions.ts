/**
 * Plain English definitions for accounting terms
 * Educational and judgment-free explanations
 */

export interface HelpDefinition {
  term: string;
  shortDescription: string;
  longDescription: string;
  example?: string;
  whyItMatters: string;
  relatedTerms?: string[];
  commonMisconception?: string;
}

export const helpDefinitions: Record<string, HelpDefinition> = {
  'double-entry': {
    term: 'Double-Entry Bookkeeping',
    shortDescription: 'Every transaction has two sides',
    longDescription: `Every transaction has two sides, like a seesaw. When money comes into your bank account (one side goes up), it had to come FROM somewhere (the other side goes down).

Think of it like this: If you buy a coffee for $5, two things happen:
1. Your bank account goes down by $5 (credit)
2. Your "coffee expenses" go up by $5 (debit)

The total always balances - that's the beauty of it!`,
    example: 'You sell a product for $100. Your bank account increases by $100 (debit), and your sales revenue increases by $100 (credit). Both sides balance.',
    whyItMatters: 'This helps catch mistakes - if the seesaw doesn\'t balance, something\'s wrong! It also gives you a complete picture of where your money is coming from and going to.',
    relatedTerms: ['debit-credit', 'accounts', 'transactions'],
    commonMisconception: 'Many people think they only need to track one side (like just expenses). But double-entry shows you the full story of every transaction.'
  },

  'debit-credit': {
    term: 'Debit & Credit',
    shortDescription: 'Money coming in vs going out (it\'s not intuitive!)',
    longDescription: `Here's the confusing part: debit and credit don't mean what you think they mean!

In everyday life, we think "debit = money out" and "credit = money in". But in accounting, it's different:

- DEBIT (left side): Increases assets and expenses, decreases liabilities and income
- CREDIT (right side): Decreases assets and expenses, increases liabilities and income

Don't worry if this seems backwards - it confuses everyone at first! Just remember: debits and credits are just the two sides of the seesaw that always need to balance.`,
    example: 'When you receive $1,000 from a customer: Debit your bank account (asset goes up), Credit your revenue (income goes up). Both increase, but one is a debit and one is a credit!',
    whyItMatters: 'Understanding debits and credits is key to tracking your finances accurately. Once you get past the confusing names, it becomes second nature.',
    relatedTerms: ['double-entry', 'accounts', 'balance'],
    commonMisconception: 'Most people think "debit = bad, credit = good" based on bank statements. In accounting, they\'re neutral - just two sides of every transaction.'
  },

  'chart-of-accounts': {
    term: 'Chart of Accounts',
    shortDescription: 'Your personal filing system for money',
    longDescription: `Think of your Chart of Accounts as a filing cabinet for your finances. Each drawer has a label (like "Office Supplies", "Sales", "Equipment") and every transaction gets filed in the right drawer.

Instead of one big pile of receipts, you organize everything into categories that make sense for YOUR business. Some businesses need dozens of categories, others only need a handful.

It's completely customizable to how you work!`,
    example: 'A freelance designer might have accounts for: "Design Revenue", "Client Expenses", "Software Subscriptions", "Computer Equipment", and "Business Bank Account". Each transaction goes into one (or more) of these categories.',
    whyItMatters: 'A good chart of accounts makes it easy to answer questions like "How much did I spend on marketing last year?" or "What are my biggest expenses?" without digging through every transaction.',
    relatedTerms: ['accounts', 'assets', 'liabilities', 'equity', 'revenue', 'expenses'],
    commonMisconception: 'People think they need to use a "standard" chart of accounts. While there are templates, you should customize it to match how you think about your business!'
  },

  'assets': {
    term: 'Assets',
    shortDescription: 'Things you own',
    longDescription: `Assets are anything valuable that you own or control. They can be:

- Physical: Cash, equipment, inventory, property
- Digital: Software, websites, domain names
- Owed to you: Money customers owe you (accounts receivable)

If you could sell it or it brings value to your business, it's probably an asset!`,
    example: 'Your laptop ($1,500), cash in your bank account ($5,000), a client who owes you $300, and your business inventory ($2,000) are all assets. Total assets: $8,800',
    whyItMatters: 'Assets show what your business owns and can use to operate. They\'re also important for understanding your net worth and ability to pay bills.',
    relatedTerms: ['liabilities', 'equity', 'balance-sheet', 'chart-of-accounts'],
    commonMisconception: 'Some people think only physical things are assets. But money owed to you, digital products, and even your brand can be valuable assets!'
  },

  'liabilities': {
    term: 'Liabilities',
    shortDescription: 'Things you owe',
    longDescription: `Liabilities are what you owe to others. Think of them as promises to pay:

- Loans: Business loan, credit card balance
- Bills: Unpaid expenses, supplier invoices
- Future obligations: Prepaid customer orders you haven't fulfilled yet

They're not necessarily bad - many successful businesses use debt strategically. It's just important to track what you owe.`,
    example: 'You have a business credit card with a $2,000 balance, and you owe your supplier $500. Your total liabilities are $2,500.',
    whyItMatters: 'Knowing what you owe helps you plan cash flow, avoid late payments, and understand your true financial position. Assets minus liabilities equals what you actually own (equity).',
    relatedTerms: ['assets', 'equity', 'balance-sheet', 'accounts-payable'],
    commonMisconception: 'People often fear liabilities, but they\'re a normal part of business. The key is ensuring your assets exceed your liabilities!'
  },

  'equity': {
    term: 'Equity',
    shortDescription: 'Your ownership stake',
    longDescription: `Equity is what's left over after you subtract what you owe from what you own. It's YOUR piece of the business.

Formula: Assets - Liabilities = Equity

Think of it like a house: If your house is worth $300,000 (asset) and you owe $200,000 on the mortgage (liability), your equity is $100,000.

In business, equity includes:
- Money you originally invested
- Profits you've kept in the business
- Losses that have reduced your stake`,
    example: 'Your business has $50,000 in assets and $15,000 in liabilities. Your equity is $35,000 - that\'s the real value of what you own!',
    whyItMatters: 'Equity tells you the true value of your ownership. Growing equity means you\'re building wealth. Shrinking equity means you need to look at profitability.',
    relatedTerms: ['assets', 'liabilities', 'balance-sheet', 'retained-earnings'],
    commonMisconception: 'Some people think revenue or profit is the same as equity. But equity is the accumulated value over time, not just this month\'s profit.'
  },

  'revenue': {
    term: 'Revenue',
    shortDescription: 'Money coming in',
    longDescription: `Revenue is all the money your business brings in from selling products or services. It's also called:
- Sales
- Income
- Turnover (in some countries)

Important: Revenue is NOT the same as profit! You still have to subtract expenses to find profit.

Revenue happens when you EARN it, which might be before you actually receive the cash (depending on your accounting method).`,
    example: 'You sell 10 widgets for $50 each. Your revenue is $500. Even if some customers haven\'t paid yet, you\'ve still earned that revenue.',
    whyItMatters: 'Revenue shows how much business activity you\'re doing. Growing revenue often (but not always!) leads to growing profit. It\'s a key metric for business health.',
    relatedTerms: ['expenses', 'profit-loss', 'income', 'sales'],
    commonMisconception: 'Revenue is NOT profit! If you made $100,000 in revenue but spent $110,000 on expenses, you actually lost money.'
  },

  'expenses': {
    term: 'Expenses',
    shortDescription: 'Money going out',
    longDescription: `Expenses are the costs of running your business:
- Regular: Rent, utilities, subscriptions
- Variable: Materials, shipping, transaction fees
- One-time: Equipment repairs, professional fees

Expenses reduce your profit. The goal isn't to have zero expenses (impossible!) but to ensure your revenue exceeds your expenses.

Like revenue, expenses are counted when they're INCURRED, which might be before you actually pay the bill.`,
    example: 'Your monthly expenses: $1,000 rent + $200 software + $300 supplies + $100 utilities = $1,600 total expenses.',
    whyItMatters: 'Tracking expenses helps you understand where your money goes, find ways to save, and calculate your actual profit. You can\'t manage what you don\'t measure!',
    relatedTerms: ['revenue', 'profit-loss', 'cost-of-goods-sold', 'overhead'],
    commonMisconception: 'Not all money leaving your account is an expense. Buying equipment is an asset purchase, and paying off a loan is a liability reduction - neither are expenses!'
  },

  'balance-sheet': {
    term: 'Balance Sheet',
    shortDescription: 'Snapshot of what you own and owe',
    longDescription: `The Balance Sheet is like a financial photograph taken at a specific moment in time. It shows:

LEFT SIDE - What you own:
- Assets (cash, equipment, what customers owe you)

RIGHT SIDE - Where it came from:
- Liabilities (what you owe others)
- Equity (what you own)

The two sides always balance: Assets = Liabilities + Equity

Think of it as: "What I have" = "What I owe" + "What's mine"`,
    example: 'On December 31st, your balance sheet shows: Assets ($50,000 cash + $10,000 equipment) = Liabilities ($20,000 loan) + Equity ($40,000). It balances: $60,000 = $20,000 + $40,000',
    whyItMatters: 'The balance sheet shows your financial position at a glance. Strong businesses have more assets than liabilities. Banks look at balance sheets to decide on loans.',
    relatedTerms: ['assets', 'liabilities', 'equity', 'profit-loss', 'financial-statements'],
    commonMisconception: 'People confuse the balance sheet with profit & loss. Balance sheet is a SNAPSHOT (what you have right now), while P&L is a MOVIE (what happened over time).'
  },

  'profit-loss': {
    term: 'Profit & Loss Statement',
    shortDescription: 'Did you make money this period?',
    longDescription: `The Profit & Loss (P&L) statement, also called an Income Statement, shows whether you made or lost money over a specific period (a month, quarter, or year).

The formula is simple:
Revenue (money in)
- Expenses (money out)
= Profit or Loss

If revenue > expenses: You made a PROFIT!
If expenses > revenue: You had a LOSS.

Unlike the balance sheet (a snapshot), the P&L is like a movie showing financial performance over time.`,
    example: 'For January: $10,000 revenue - $7,000 expenses = $3,000 profit. You made money this month!',
    whyItMatters: 'The P&L tells you if your business is profitable. You can track trends (are profits growing?), find problems (why did expenses spike?), and make better decisions.',
    relatedTerms: ['revenue', 'expenses', 'balance-sheet', 'net-income', 'gross-profit'],
    commonMisconception: 'Profit doesn\'t mean you have that much cash! You might have profit but low cash if customers haven\'t paid yet, or you bought equipment with the cash.'
  },

  'cash-flow': {
    term: 'Cash Flow',
    shortDescription: 'Money in and out over time',
    longDescription: `Cash flow tracks the actual movement of cash - not when you earned or owed it, but when it actually moved in or out of your bank account.

You can be profitable but have negative cash flow! Example: You made $10,000 in sales (profit), but customers haven't paid yet (no cash).

Three types:
1. Operating: Daily business activities
2. Investing: Buying/selling assets
3. Financing: Loans, investments, withdrawals

The goal: More cash coming in than going out!`,
    example: 'January: Received $8,000 from customers, paid $5,000 in expenses, bought $4,000 in equipment. Net cash flow: -$1,000 (you\'re down $1,000 in cash even though you might be profitable!)',
    whyItMatters: 'Cash is king! You can be profitable on paper but run out of cash and fail. Monitoring cash flow helps you avoid this trap and plan for lean periods.',
    relatedTerms: ['profit-loss', 'accounts-receivable', 'accounts-payable', 'accrual-vs-cash'],
    commonMisconception: 'Profit and cash flow are the same thing. They\'re not! You can be profitable but cash-poor, or unprofitable but cash-rich (temporarily).'
  },

  'accrual-vs-cash': {
    term: 'Accrual vs Cash Basis Accounting',
    shortDescription: 'When do you count the money?',
    longDescription: `These are two different ways to decide WHEN to count revenue and expenses:

CASH BASIS (simpler):
- Count revenue when cash arrives
- Count expenses when you pay
- Like tracking your bank account

ACCRUAL BASIS (more accurate):
- Count revenue when you EARN it (even if not paid yet)
- Count expenses when you INCUR them (even if not paid yet)
- Shows true business performance

Most small businesses start with cash basis, but accrual gives a better picture of business health.`,
    example: 'You invoice a client $1,000 in December, but they pay in January.\n\nCash basis: Revenue in January (when paid)\nAccrual basis: Revenue in December (when earned)\n\nWhich is "right"? Accrual shows you earned it in December, even though the cash came later.',
    whyItMatters: 'Cash basis is simpler but can be misleading (looks bad when you buy inventory, looks great when customers pay). Accrual matches revenue with related expenses for better insights.',
    relatedTerms: ['revenue', 'expenses', 'cash-flow', 'accounts-receivable', 'accounts-payable'],
    commonMisconception: 'You have to pick one forever. Actually, small businesses can switch (with some rules), and you can track both ways if you want different perspectives!'
  }
};

/**
 * Get all help terms
 */
export function getAllHelpTerms(): string[] {
  return Object.keys(helpDefinitions);
}

/**
 * Search help definitions by keyword
 */
export function searchHelpDefinitions(query: string): HelpDefinition[] {
  const searchTerm = query.toLowerCase();
  return Object.values(helpDefinitions).filter(def =>
    def.term.toLowerCase().includes(searchTerm) ||
    def.shortDescription.toLowerCase().includes(searchTerm) ||
    def.longDescription.toLowerCase().includes(searchTerm)
  );
}

/**
 * Get a specific help definition
 */
export function getHelpDefinition(termId: string): HelpDefinition | undefined {
  return helpDefinitions[termId];
}
