/**
 * Industry Templates for Chart of Accounts Setup
 *
 * Per ACCT-001 and D1: Friendly, educational templates for different
 * business types. Each template includes plain English explanations.
 *
 * Joy Opportunities:
 * - Templates have friendly names like "The Freelancer's Friend"
 * - Explanations use accessible language: "Assets are things your business owns"
 */

import type { AccountType } from '../types'
import type { IndustryTemplate, TemplateAccount } from '../types/wizard.types'

/**
 * Plain English explanations for account types
 * Used throughout the wizard to educate users
 */
export const ACCOUNT_TYPE_EXPLANATIONS: Record<AccountType, { title: string; description: string; examples: string[] }> = {
  asset: {
    title: 'Assets',
    description: "Things your business owns. Think of them as your business's treasure chest.",
    examples: ['Bank accounts', 'Money owed to you', 'Equipment', 'Inventory'],
  },
  liability: {
    title: 'Liabilities',
    description: "Money your business owes. These are debts you'll need to pay back.",
    examples: ['Credit cards', 'Loans', 'Bills you owe', 'Taxes payable'],
  },
  equity: {
    title: 'Equity',
    description: "The owner's stake in the business. It's what you'd have left if you sold everything and paid all debts.",
    examples: ["Owner's investment", 'Retained earnings', 'Draws/distributions'],
  },
  income: {
    title: 'Income',
    description: 'Money flowing into your business from your main work. This is how you earn!',
    examples: ['Sales', 'Service fees', 'Project revenue', 'Subscription income'],
  },
  expense: {
    title: 'Expenses',
    description: 'Money spent to run your business. Every business has expenses - they help you make money.',
    examples: ['Rent', 'Utilities', 'Marketing', 'Office supplies'],
  },
  'cost-of-goods-sold': {
    title: 'Cost of Goods Sold (COGS)',
    description: "The direct cost of creating what you sell. If you don't have physical products, you might not need this.",
    examples: ['Materials', 'Manufacturing costs', 'Inventory purchases'],
  },
  'other-income': {
    title: 'Other Income',
    description: "Money that comes in from outside your main business activities. It's still income, just not your primary revenue.",
    examples: ['Interest earned', 'Investment gains', 'Refunds received'],
  },
  'other-expense': {
    title: 'Other Expenses',
    description: 'Expenses that don\'t fit in regular categories. These are usually one-time or unusual costs.',
    examples: ['Bank fees', 'Interest paid', 'Losses'],
  },
}

/**
 * The Freelancer's Friend
 * Perfect for consultants, designers, writers, and independent professionals
 */
const FREELANCER_TEMPLATE: IndustryTemplate = {
  id: 'freelancer',
  name: 'Freelancer / Consultant',
  friendlyName: "The Freelancer's Friend",
  description: 'Perfect for consultants, designers, writers, and independent professionals who sell their time and expertise.',
  category: 'service',
  icon: '💼',
  accounts: [
    // Assets
    {
      name: 'Business Checking',
      accountNumber: '1000',
      type: 'asset',
      description: 'Your main business bank account',
      explanation: 'This is where client payments arrive and where you pay expenses from. Keep it separate from personal!',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Cash on Hand',
      accountNumber: '1005',
      type: 'asset',
      description: 'Physical cash your business holds',
      explanation: 'Do you accept or pay with cash? Track it here. If you\'re all digital payments, you can skip this account.',
      isRequired: false,
      isDefault: false,
    },
    {
      name: 'Savings',
      accountNumber: '1010',
      type: 'asset',
      description: 'Business savings or emergency fund',
      explanation: 'A safety net for slow months. Many freelancers keep 3-6 months of expenses here.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Accounts Receivable',
      accountNumber: '1200',
      type: 'asset',
      description: 'Money clients owe you',
      explanation: "When you invoice a client, it shows here until they pay. It's money you've earned but haven't received yet.",
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Equipment',
      accountNumber: '1500',
      type: 'asset',
      description: 'Computers, cameras, tools',
      explanation: 'Big purchases that last multiple years. Your laptop, camera, or specialized tools go here.',
      isRequired: false,
      isDefault: true,
    },

    // Liabilities
    {
      name: 'Credit Card',
      accountNumber: '2000',
      type: 'liability',
      description: 'Business credit card balance',
      explanation: 'What you owe on your business credit card. Track it here to see your true financial picture.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Taxes Payable',
      accountNumber: '2100',
      type: 'liability',
      description: 'Estimated taxes owed',
      explanation: 'This tracks what you owe in taxes - not where money is set aside. Consider keeping a separate savings account where you set aside 25-30% of income conservatively for tax payments.',
      isRequired: true,
      isDefault: true,
    },

    // Equity
    {
      name: 'Owner Investment',
      accountNumber: '3000',
      type: 'equity',
      description: 'Money you put into the business',
      explanation: 'This tracks capital you\'ve invested from personal funds into the business. Some business owners prefer to get reimbursed for expenses instead - both approaches work, choose what fits your situation.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Owner Draw',
      accountNumber: '3100',
      type: 'equity',
      description: 'Money you take out for personal use',
      explanation: "When you pay yourself, it's recorded here. This isn't an expense - it's your share of the profits.",
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Retained Earnings',
      accountNumber: '3900',
      type: 'equity',
      description: 'Profits kept in the business',
      explanation: 'Automatically calculated - never manually adjust this account! It shows accumulated profits left in the business. The system updates this for you at year-end.',
      isRequired: true,
      isDefault: true,
    },

    // Income
    {
      name: 'Service Income',
      accountNumber: '4000',
      type: 'income',
      description: 'Fees from clients',
      explanation: 'All the money you earn from your work! Consulting, design, writing - it all goes here.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Project Income',
      accountNumber: '4100',
      type: 'income',
      description: 'Fixed-price project revenue',
      explanation: 'If you charge per project instead of hourly, track it separately here.',
      isRequired: false,
      isDefault: false,
    },

    // Expenses (alphabetically ordered)
    {
      name: 'Advertising & Marketing',
      accountNumber: '6000',
      type: 'expense',
      description: 'Promoting your services',
      explanation: 'Website costs, ads, business cards - anything that helps people find you.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Bank Fees',
      accountNumber: '6100',
      type: 'expense',
      description: 'Account fees and charges',
      explanation: 'Monthly fees, transaction fees. Not fun, but trackable!',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Insurance',
      accountNumber: '6200',
      type: 'expense',
      description: 'Business insurance',
      explanation: 'Liability insurance, professional insurance - protection for your business.',
      isRequired: false,
      isDefault: false,
    },
    {
      name: 'Office Supplies',
      accountNumber: '6300',
      type: 'expense',
      description: 'Pens, paper, supplies',
      explanation: 'Small purchases that keep your office running. Nothing glamorous, but necessary!',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Phone & Internet',
      accountNumber: '6400',
      type: 'expense',
      description: 'Communication costs',
      explanation: 'Your business phone and internet. Essential for staying connected to clients.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Professional Development',
      accountNumber: '6500',
      type: 'expense',
      description: 'Learning and training',
      explanation: 'Courses, books, conferences. Investing in your skills is investing in your business.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Software & Subscriptions',
      accountNumber: '6600',
      type: 'expense',
      description: 'Tools and apps',
      explanation: 'Software that keeps your business running and operating - like this one! Project management tools, design software, and other digital tools you subscribe to.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Travel & Meals',
      accountNumber: '6700',
      type: 'expense',
      description: 'Business travel and entertainment',
      explanation: 'Client meetings, conferences, business meals. Keep good records - some are tax deductible!',
      isRequired: false,
      isDefault: true,
    },
  ],
}

/**
 * The Creative's Canvas
 * For designers, artists, photographers, and creative professionals
 */
const CREATIVE_TEMPLATE: IndustryTemplate = {
  id: 'creative',
  name: 'Creative Professional',
  friendlyName: "The Creative's Canvas",
  description: 'Perfect for designers, artists, photographers, and other creative professionals.',
  category: 'creative',
  icon: '🎨',
  accounts: [
    // Assets
    {
      name: 'Business Checking',
      accountNumber: '1000',
      type: 'asset',
      description: 'Main business bank account',
      explanation: 'Your creative work deserves a dedicated account. Keep business and personal separate!',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Cash on Hand',
      accountNumber: '1005',
      type: 'asset',
      description: 'Physical cash your business holds',
      explanation: 'Do you accept or pay with cash? Track it here. If you\'re all digital payments, you can skip this account.',
      isRequired: false,
      isDefault: false,
    },
    {
      name: 'Accounts Receivable',
      accountNumber: '1200',
      type: 'asset',
      description: 'Client invoices outstanding',
      explanation: 'Finished a project but waiting for payment? It lives here until the check clears.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Equipment',
      accountNumber: '1500',
      type: 'asset',
      description: 'Cameras, computers, tools',
      explanation: 'Your creative tools are valuable! Cameras, computers, drawing tablets - track them here.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Inventory',
      accountNumber: '1400',
      type: 'asset',
      description: 'Prints, products for sale',
      explanation: 'If you sell prints, merchandise, or physical goods, this tracks what you have in stock.',
      isRequired: false,
      isDefault: false,
    },

    // Liabilities
    {
      name: 'Credit Card',
      accountNumber: '2000',
      type: 'liability',
      description: 'Business credit card',
      explanation: 'Equipment purchases add up fast. Track what you owe to stay in control.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Taxes Payable',
      accountNumber: '2100',
      type: 'liability',
      description: 'Taxes set aside',
      explanation: 'Creative work is profitable! Set aside taxes so you can focus on your art.',
      isRequired: true,
      isDefault: true,
    },

    // Equity
    {
      name: 'Owner Investment',
      accountNumber: '3000',
      type: 'equity',
      description: 'Your investment',
      explanation: 'Every artist invests in themselves. This is yours.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Owner Draw',
      accountNumber: '3100',
      type: 'equity',
      description: 'Payments to yourself',
      explanation: 'Your art pays you! Track what you take home.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Retained Earnings',
      accountNumber: '3900',
      type: 'equity',
      description: 'Accumulated profits',
      explanation: 'Profits you keep in the business. Watch it grow!',
      isRequired: true,
      isDefault: true,
    },

    // Income
    {
      name: 'Design Services',
      accountNumber: '4000',
      type: 'income',
      description: 'Client design work',
      explanation: 'Money from your creative services - logo design, branding, illustrations.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Product Sales',
      accountNumber: '4100',
      type: 'income',
      description: 'Prints, merchandise',
      explanation: 'Selling prints, t-shirts, or other creative products? Track it here.',
      isRequired: false,
      isDefault: false,
    },
    {
      name: 'Licensing & Royalties',
      accountNumber: '4200',
      type: 'income',
      description: 'Passive income',
      explanation: 'When others use your work and pay you for it. Sweet passive income!',
      isRequired: false,
      isDefault: false,
    },

    // Cost of Goods Sold
    {
      name: 'Materials & Supplies',
      accountNumber: '5000',
      type: 'cost-of-goods-sold',
      description: 'Direct costs for products',
      explanation: 'Canvas, ink, printing costs - what it costs to create what you sell.',
      isRequired: false,
      isDefault: false,
    },

    // Expenses
    {
      name: 'Software & Tools',
      accountNumber: '6000',
      type: 'expense',
      description: 'Adobe, design tools',
      explanation: 'Creative Cloud, Procreate, Figma - the tools that bring your vision to life.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Marketing & Portfolio',
      accountNumber: '6100',
      type: 'expense',
      description: 'Promoting your work',
      explanation: 'Website hosting, portfolio platforms, ads to showcase your talent.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Equipment Repairs',
      accountNumber: '6200',
      type: 'expense',
      description: 'Fixing gear',
      explanation: 'Camera broke? Computer needs repair? These costs go here.',
      isRequired: false,
      isDefault: false,
    },
    {
      name: 'Studio Rent',
      accountNumber: '6300',
      type: 'expense',
      description: 'Workspace costs',
      explanation: 'Renting studio space, co-working membership, dedicated creative space.',
      isRequired: false,
      isDefault: false,
    },
    {
      name: 'Professional Development',
      accountNumber: '6400',
      type: 'expense',
      description: 'Learning & growth',
      explanation: 'Workshops, online courses, art books - invest in your creative evolution.',
      isRequired: false,
      isDefault: true,
    },
  ],
}

/**
 * The Shopkeeper's Starter
 * For retail and e-commerce businesses
 */
const RETAIL_TEMPLATE: IndustryTemplate = {
  id: 'retail',
  name: 'Retail / E-commerce',
  friendlyName: "The Shopkeeper's Starter",
  description: 'Perfect for retail stores, online shops, and e-commerce businesses.',
  category: 'retail',
  icon: '🛍️',
  accounts: [
    // Assets
    {
      name: 'Business Checking',
      accountNumber: '1000',
      type: 'asset',
      description: 'Main bank account',
      explanation: 'Where sales revenue lands and expenses get paid. Your cash register, digitally.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Cash on Hand',
      accountNumber: '1005',
      type: 'asset',
      description: 'Physical cash your business holds',
      explanation: 'Do you accept or pay with cash? Track it here. If you\'re all digital payments, you can skip this account.',
      isRequired: false,
      isDefault: false,
    },
    {
      name: 'Accounts Receivable',
      accountNumber: '1200',
      type: 'asset',
      description: 'Pending payments',
      explanation: 'For B2B sales or payment plans. Track who owes you what.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Inventory',
      accountNumber: '1400',
      type: 'asset',
      description: 'Products in stock',
      explanation: 'The value of products waiting to be sold. This is your stock on hand.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Equipment',
      accountNumber: '1500',
      type: 'asset',
      description: 'Fixtures, POS systems',
      explanation: 'Shelving, cash registers, computers - the tools that run your store.',
      isRequired: false,
      isDefault: true,
    },

    // Liabilities
    {
      name: 'Accounts Payable',
      accountNumber: '2000',
      type: 'liability',
      description: 'Bills to suppliers',
      explanation: 'What you owe to vendors and suppliers. Keep track to maintain good relationships.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Credit Card',
      accountNumber: '2100',
      type: 'liability',
      description: 'Business credit card',
      explanation: 'Inventory purchases can be large. Track credit card debt carefully.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Sales Tax Payable',
      accountNumber: '2200',
      type: 'liability',
      description: 'Sales tax collected',
      explanation: "You collect it from customers, then pay it to the government. It's not your money, so track it!",
      isRequired: true,
      isDefault: true,
    },

    // Equity
    {
      name: 'Owner Investment',
      accountNumber: '3000',
      type: 'equity',
      description: 'Initial investment',
      explanation: 'What you put in to start your shop. Every retail empire starts somewhere!',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Owner Draw',
      accountNumber: '3100',
      type: 'equity',
      description: 'Owner withdrawals',
      explanation: 'When profits allow, you take some home. This tracks it.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Retained Earnings',
      accountNumber: '3900',
      type: 'equity',
      description: 'Accumulated profits',
      explanation: 'Profits you keep to grow the business. Reinvest wisely!',
      isRequired: true,
      isDefault: true,
    },

    // Income
    {
      name: 'Product Sales',
      accountNumber: '4000',
      type: 'income',
      description: 'Revenue from sales',
      explanation: 'Every sale rings up here. This is your main revenue stream!',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Shipping Income',
      accountNumber: '4100',
      type: 'income',
      description: 'Shipping fees charged',
      explanation: 'What you charge customers for shipping. Track separately from product sales.',
      isRequired: false,
      isDefault: false,
    },

    // Cost of Goods Sold
    {
      name: 'Cost of Goods Sold',
      accountNumber: '5000',
      type: 'cost-of-goods-sold',
      description: 'Wholesale product costs',
      explanation: 'What you paid for inventory that sold. Critical for knowing real profit!',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Freight & Shipping In',
      accountNumber: '5100',
      type: 'cost-of-goods-sold',
      description: 'Shipping costs for inventory',
      explanation: 'What you paid to get inventory to your store. Part of the true cost.',
      isRequired: false,
      isDefault: true,
    },

    // Expenses
    {
      name: 'Rent',
      accountNumber: '6000',
      type: 'expense',
      description: 'Store or warehouse rent',
      explanation: 'Location, location, location! Track what you pay for your space.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Marketing & Advertising',
      accountNumber: '6100',
      type: 'expense',
      description: 'Promotions and ads',
      explanation: 'Social media ads, flyers, promotions - getting customers through the door.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Payment Processing Fees',
      accountNumber: '6200',
      type: 'expense',
      description: 'Credit card fees',
      explanation: 'Stripe, Square, PayPal fees. Cost of doing business in the digital age.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Utilities',
      accountNumber: '6300',
      type: 'expense',
      description: 'Power, water, internet',
      explanation: 'Keeping the lights on, literally. Essential operating costs.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Packaging & Supplies',
      accountNumber: '6400',
      type: 'expense',
      description: 'Boxes, bags, tape',
      explanation: 'The materials needed to package and ship products beautifully.',
      isRequired: false,
      isDefault: true,
    },
  ],
}

/**
 * The Service Pro
 * For service-based businesses like cleaning, repair, etc.
 */
const SERVICE_TEMPLATE: IndustryTemplate = {
  id: 'service',
  name: 'Service Business',
  friendlyName: 'The Service Pro',
  description: 'For service businesses like cleaning, landscaping, repair, and maintenance.',
  category: 'service',
  icon: '🔧',
  accounts: [
    // Assets
    {
      name: 'Business Checking',
      accountNumber: '1000',
      type: 'asset',
      description: 'Main bank account',
      explanation: 'Your business hub. Service payments in, supplies out.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Cash on Hand',
      accountNumber: '1005',
      type: 'asset',
      description: 'Physical cash your business holds',
      explanation: 'Do you accept or pay with cash? Track it here. If you\'re all digital payments, you can skip this account.',
      isRequired: false,
      isDefault: false,
    },
    {
      name: 'Accounts Receivable',
      accountNumber: '1200',
      type: 'asset',
      description: 'Unpaid invoices',
      explanation: 'Completed jobs waiting for payment. Follow up regularly!',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Equipment',
      accountNumber: '1500',
      type: 'asset',
      description: 'Tools and vehicles',
      explanation: 'Trucks, mowers, tools - the gear that gets the job done.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Supplies Inventory',
      accountNumber: '1400',
      type: 'asset',
      description: 'Materials on hand',
      explanation: 'Cleaning supplies, parts, materials - what you keep in stock.',
      isRequired: false,
      isDefault: false,
    },

    // Liabilities
    {
      name: 'Credit Card',
      accountNumber: '2000',
      type: 'liability',
      description: 'Business credit card',
      explanation: 'For purchasing supplies and equipment. Track carefully.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Equipment Loans',
      accountNumber: '2100',
      type: 'liability',
      description: 'Vehicle or equipment financing',
      explanation: 'Financed that truck or expensive equipment? Track the loan here.',
      isRequired: false,
      isDefault: false,
    },
    {
      name: 'Taxes Payable',
      accountNumber: '2200',
      type: 'liability',
      description: 'Tax obligations',
      explanation: 'Quarterly taxes, payroll taxes - set money aside so tax time is smooth.',
      isRequired: true,
      isDefault: true,
    },

    // Equity
    {
      name: 'Owner Investment',
      accountNumber: '3000',
      type: 'equity',
      description: 'Your investment',
      explanation: 'What you put in to start. Your sweat equity counts too!',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Owner Draw',
      accountNumber: '3100',
      type: 'equity',
      description: 'Your take-home',
      explanation: 'Hard work pays off. This tracks what you take home.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Retained Earnings',
      accountNumber: '3900',
      type: 'equity',
      description: 'Profits retained',
      explanation: 'Profits kept in business for growth and stability.',
      isRequired: true,
      isDefault: true,
    },

    // Income
    {
      name: 'Service Revenue',
      accountNumber: '4000',
      type: 'income',
      description: 'Service income',
      explanation: 'Every job completed! Your main revenue source.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Materials Markup',
      accountNumber: '4100',
      type: 'income',
      description: 'Profit on materials',
      explanation: 'If you charge customers for materials, track the markup here.',
      isRequired: false,
      isDefault: false,
    },

    // Cost of Goods Sold
    {
      name: 'Materials & Supplies Used',
      accountNumber: '5000',
      type: 'cost-of-goods-sold',
      description: 'Direct job costs',
      explanation: 'Materials used on customer jobs. Part of your cost to deliver service.',
      isRequired: false,
      isDefault: true,
    },

    // Expenses
    {
      name: 'Fuel',
      accountNumber: '6000',
      type: 'expense',
      description: 'Vehicle fuel costs',
      explanation: 'Getting to jobs costs gas! Major expense for mobile businesses.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Vehicle Maintenance',
      accountNumber: '6100',
      type: 'expense',
      description: 'Vehicle repairs',
      explanation: 'Oil changes, repairs, keeping vehicles running. Essential!',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Equipment Maintenance',
      accountNumber: '6200',
      type: 'expense',
      description: 'Tool and equipment repairs',
      explanation: 'Keeping your tools in top shape. Regular maintenance saves money.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Marketing',
      accountNumber: '6300',
      type: 'expense',
      description: 'Advertising costs',
      explanation: 'Flyers, online ads, referral programs - finding new customers.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Insurance',
      accountNumber: '6400',
      type: 'expense',
      description: 'Business insurance',
      explanation: 'Liability, vehicle, equipment - protecting your business.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Licensing & Permits',
      accountNumber: '6500',
      type: 'expense',
      description: 'Required licenses',
      explanation: 'Business licenses, trade permits - staying legal and professional.',
      isRequired: false,
      isDefault: false,
    },
  ],
}

/**
 * The Generalist
 * Simple, minimal template for any business type
 */
const GENERAL_TEMPLATE: IndustryTemplate = {
  id: 'general',
  name: 'General Business',
  friendlyName: 'The Essential Start',
  description: 'A simple, minimal setup that works for any type of business. Great starting point!',
  category: 'general',
  icon: '⭐',
  accounts: [
    // Assets
    {
      name: 'Business Checking',
      accountNumber: '1000',
      type: 'asset',
      description: 'Main bank account',
      explanation: 'Every business needs a bank account. This is yours!',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Cash on Hand',
      accountNumber: '1005',
      type: 'asset',
      description: 'Physical cash your business holds',
      explanation: 'Do you accept or pay with cash? Track it here. If you\'re all digital payments, you can skip this account.',
      isRequired: false,
      isDefault: false,
    },
    {
      name: 'Accounts Receivable',
      accountNumber: '1200',
      type: 'asset',
      description: 'Money owed to you',
      explanation: 'When you send an invoice, it shows here until paid.',
      isRequired: true,
      isDefault: true,
    },

    // Liabilities
    {
      name: 'Credit Card',
      accountNumber: '2000',
      type: 'liability',
      description: 'Business credit card',
      explanation: 'Track what you owe on business credit cards.',
      isRequired: false,
      isDefault: true,
    },

    // Equity
    {
      name: 'Owner Equity',
      accountNumber: '3000',
      type: 'equity',
      description: 'Owner investment',
      explanation: "What you've invested in your business.",
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Retained Earnings',
      accountNumber: '3900',
      type: 'equity',
      description: 'Accumulated profits',
      explanation: 'Profits kept in the business.',
      isRequired: true,
      isDefault: true,
    },

    // Income
    {
      name: 'Revenue',
      accountNumber: '4000',
      type: 'income',
      description: 'Business income',
      explanation: 'All money coming in from your business!',
      isRequired: true,
      isDefault: true,
    },

    // Expenses
    {
      name: 'Operating Expenses',
      accountNumber: '6000',
      type: 'expense',
      description: 'General business expenses',
      explanation: 'Costs of running your business. You can add more specific categories later.',
      isRequired: true,
      isDefault: true,
    },
    {
      name: 'Office Expenses',
      accountNumber: '6100',
      type: 'expense',
      description: 'Office costs',
      explanation: 'Rent, supplies, utilities - keeping operations running.',
      isRequired: false,
      isDefault: true,
    },
    {
      name: 'Marketing',
      accountNumber: '6200',
      type: 'expense',
      description: 'Advertising and promotion',
      explanation: 'Getting the word out about your business.',
      isRequired: false,
      isDefault: true,
    },
  ],
}

/**
 * All available templates
 */
export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  FREELANCER_TEMPLATE,
  CREATIVE_TEMPLATE,
  SERVICE_TEMPLATE,
  RETAIL_TEMPLATE,
  GENERAL_TEMPLATE,
]

/**
 * Get template by ID
 */
export function getTemplateById(id: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find((t) => t.id === id)
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): IndustryTemplate[] {
  return INDUSTRY_TEMPLATES.filter((t) => t.category === category)
}

/**
 * Get default accounts from a template
 */
export function getDefaultAccounts(templateId: string): typeof FREELANCER_TEMPLATE.accounts {
  const template = getTemplateById(templateId)
  if (!template) return []
  return template.accounts.filter((account: TemplateAccount) => account.isDefault)
}

/**
 * Get required accounts from a template
 */
export function getRequiredAccounts(templateId: string): typeof FREELANCER_TEMPLATE.accounts {
  const template = getTemplateById(templateId)
  if (!template) return []
  return template.accounts.filter((account: TemplateAccount) => account.isRequired)
}
