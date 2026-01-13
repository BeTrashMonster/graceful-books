/**
 * Accounts Schema Definition
 *
 * Defines the Chart of Accounts structure for double-entry accounting.
 * Supports hierarchical accounts with parent/child relationships.
 *
 * Requirements:
 * - ACCT-001: Chart of Accounts Schema
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { Account, AccountType } from '../../types/database.types';

/**
 * Dexie.js schema definition for Accounts table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying accounts by company
 * - type: For querying accounts by type (for reports)
 * - active: For querying only active accounts
 * - [company_id+type]: Compound index for filtered queries
 * - [company_id+active]: Compound index for active account queries
 * - parent_id: For querying sub-accounts
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const accountsSchema = 'id, company_id, type, active, [company_id+type], [company_id+active], parent_id, updated_at, deleted_at';

/**
 * Table name constant
 */
export const ACCOUNTS_TABLE = 'accounts';

/**
 * Default values for new Account
 */
export const createDefaultAccount = (
  companyId: string,
  name: string,
  type: AccountType,
  deviceId: string
): Partial<Account> => {
  const now = Date.now();

  return {
    company_id: companyId,
    name,
    type,
    parent_id: null,
    account_number: null,
    balance: '0.00',
    description: null,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure sub-account type matches parent type
 */
export const validateAccountTypeMatchesParent = (
  account: Account,
  parentAccount: Account | null
): boolean => {
  if (!account.parent_id || !parentAccount) {
    return true; // No parent, no constraint
  }

  return account.type === parentAccount.type;
};

/**
 * Validation: Ensure account has required fields
 */
export const validateAccount = (account: Partial<Account>): string[] => {
  const errors: string[] = [];

  if (!account.company_id) {
    errors.push('company_id is required');
  }

  if (!account.name || account.name.trim() === '') {
    errors.push('name is required');
  }

  if (!account.type) {
    errors.push('type is required');
  }

  if (account.balance === undefined || account.balance === null) {
    errors.push('balance is required');
  }

  return errors;
};

/**
 * Calculate account balance from transactions
 * Note: This will be implemented in the transaction service
 * Included here for type safety
 */
export interface AccountBalance {
  account_id: string;
  debit_total: string;
  credit_total: string;
  balance: string;
}

/**
 * Query helper: Get all accounts for a company
 */
export interface GetAccountsQuery {
  company_id: string;
  type?: AccountType;
  active?: boolean;
  parent_id?: string | null;
}

/**
 * Account tree node for hierarchical display
 */
export interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  level: number;
  path: string[]; // Array of ancestor IDs from root to this node
}

/**
 * Standard account templates for quick setup
 * Based on common small business chart of accounts
 */
export const STANDARD_ACCOUNT_TEMPLATES: Omit<Account, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version_vector' | 'balance'>[] = [
  // Assets
  {
    account_number: '1000',
    name: 'Cash and Cash Equivalents',
    type: 'ASSET' as AccountType,
    parent_id: null,
    description: 'Bank accounts and cash on hand',
    active: true,
  },
  {
    account_number: '1200',
    name: 'Accounts Receivable',
    type: 'ASSET' as AccountType,
    parent_id: null,
    description: 'Money owed by customers',
    active: true,
  },
  {
    account_number: '1500',
    name: 'Fixed Assets',
    type: 'ASSET' as AccountType,
    parent_id: null,
    description: 'Property, equipment, and long-term assets',
    active: true,
  },

  // Liabilities
  {
    account_number: '2000',
    name: 'Accounts Payable',
    type: 'LIABILITY' as AccountType,
    parent_id: null,
    description: 'Money owed to vendors',
    active: true,
  },
  {
    account_number: '2100',
    name: 'Credit Cards',
    type: 'LIABILITY' as AccountType,
    parent_id: null,
    description: 'Credit card balances',
    active: true,
  },
  {
    account_number: '2500',
    name: 'Long-term Debt',
    type: 'LIABILITY' as AccountType,
    parent_id: null,
    description: 'Loans and long-term liabilities',
    active: true,
  },

  // Equity
  {
    account_number: '3000',
    name: 'Owner\'s Equity',
    type: 'EQUITY' as AccountType,
    parent_id: null,
    description: 'Owner\'s investment and retained earnings',
    active: true,
  },

  // Income
  {
    account_number: '4000',
    name: 'Sales Revenue',
    type: 'INCOME' as AccountType,
    parent_id: null,
    description: 'Revenue from sales',
    active: true,
  },
  {
    account_number: '4100',
    name: 'Service Revenue',
    type: 'INCOME' as AccountType,
    parent_id: null,
    description: 'Revenue from services',
    active: true,
  },

  // Cost of Goods Sold
  {
    account_number: '5000',
    name: 'Cost of Goods Sold',
    type: 'COGS' as AccountType,
    parent_id: null,
    description: 'Direct costs of products sold',
    active: true,
  },

  // Expenses
  {
    account_number: '6000',
    name: 'Operating Expenses',
    type: 'EXPENSE' as AccountType,
    parent_id: null,
    description: 'General business expenses',
    active: true,
  },
  {
    account_number: '6100',
    name: 'Salaries and Wages',
    type: 'EXPENSE' as AccountType,
    parent_id: null,
    description: 'Employee compensation',
    active: true,
  },
  {
    account_number: '6200',
    name: 'Rent',
    type: 'EXPENSE' as AccountType,
    parent_id: null,
    description: 'Office or facility rent',
    active: true,
  },
  {
    account_number: '6300',
    name: 'Utilities',
    type: 'EXPENSE' as AccountType,
    parent_id: null,
    description: 'Electricity, water, internet, etc.',
    active: true,
  },

  // Other Income
  {
    account_number: '8000',
    name: 'Other Income',
    type: 'OTHER_INCOME' as AccountType,
    parent_id: null,
    description: 'Non-operating income',
    active: true,
  },

  // Other Expenses
  {
    account_number: '9000',
    name: 'Other Expenses',
    type: 'OTHER_EXPENSE' as AccountType,
    parent_id: null,
    description: 'Non-operating expenses',
    active: true,
  },
];
