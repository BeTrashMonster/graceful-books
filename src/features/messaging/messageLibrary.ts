/**
 * Message Library - DISC-Adapted Messages
 *
 * This file contains message variants adapted for each DISC personality type:
 * - D (Dominance): Direct, results-focused
 * - I (Influence): Enthusiastic, social
 * - S (Steadiness): Supportive, step-by-step
 * - C (Conscientiousness): Detailed, accurate
 */

export type DISCType = 'D' | 'I' | 'S' | 'C';

export interface MessageVariants {
  D: string; // Dominance
  I: string; // Influence
  S: string; // Steadiness (default)
  C: string; // Conscientiousness
}

export interface Message {
  id: string;
  category: 'success' | 'error' | 'empty_state' | 'onboarding' | 'help' | 'confirmation' | 'notification';
  context: string;
  variants: MessageVariants;
  fallback: string;
  placeholders?: string[];
}

export type MessageLibrary = Record<string, Message>;

/**
 * Complete message library with DISC-adapted variants
 */
export const messageLibrary: MessageLibrary = {
  // ============================================================================
  // Success Messages
  // ============================================================================

  'welcome.after_signup': {
    id: 'welcome.after_signup',
    category: 'success',
    context: 'Dashboard - after signup',
    variants: {
      D: "Welcome to Graceful Books. Let's get your accounts set up.",
      I: "Welcome to Graceful Books! We're so excited to have you here! Let's get started on your financial journey together!",
      S: "Welcome to Graceful Books! We're here to help you understand and manage your business finances. Take your time - we'll guide you through everything step by step.",
      C: "Welcome to Graceful Books. This system provides comprehensive accounting functionality with zero-knowledge encryption. Begin by completing the onboarding assessment to customize your experience.",
    },
    fallback: "Welcome to Graceful Books!",
  },

  'transaction.save.success': {
    id: 'transaction.save.success',
    category: 'success',
    context: 'Transaction entry form - after save',
    variants: {
      D: "Done. Transaction recorded. What's next?",
      I: "Woohoo! Transaction saved! You're on a roll!",
      S: "Transaction saved successfully. Great work! We'll guide you through each step as you continue.",
      C: "Transaction successfully recorded. All fields validated and saved to local database.",
    },
    fallback: "Transaction saved successfully.",
  },

  'transaction.save.first': {
    id: 'transaction.save.first',
    category: 'success',
    context: 'Transaction entry form - first transaction saved',
    variants: {
      D: "First transaction recorded. Save 2 hours/week with proper tracking.",
      I: "Amazing! You just recorded your first transaction! You're doing great!",
      S: "You just recorded your first transaction! You're officially doing bookkeeping. (And you didn't even need an accounting degree!)",
      C: "First transaction successfully recorded. Entry validated against double-entry accounting principles. Balance verified.",
    },
    fallback: "Your first transaction has been saved!",
  },

  'account.create.success': {
    id: 'account.create.success',
    category: 'success',
    context: 'Chart of accounts - after creating account',
    variants: {
      D: "Account created. Add another?",
      I: "Amazing! Your first account is created! This is so exciting!",
      S: "Your first account! This is where the magic of organization begins.",
      C: "Account created successfully. Type: {type}. Number: {number}. Status: Active.",
    },
    fallback: "Account created successfully.",
    placeholders: ['type', 'number'],
  },

  'sync.complete': {
    id: 'sync.complete',
    category: 'success',
    context: 'Background sync - completion notification',
    variants: {
      D: "Synced.",
      I: "All synced up! Your data is safe and sound!",
      S: "Your data has been synced successfully. Everything is backed up and secure.",
      C: "Synchronization complete. Last sync: {timestamp}. {count} records synchronized.",
    },
    fallback: "Sync complete.",
    placeholders: ['timestamp', 'count'],
  },

  // ============================================================================
  // Error Messages
  // ============================================================================

  'transaction.validation.unbalanced': {
    id: 'transaction.validation.unbalanced',
    category: 'error',
    context: 'Transaction entry - validation error',
    variants: {
      D: "Transaction doesn't balance. Fix debits/credits and retry.",
      I: "Oops! This one's a bit off-balance. Let's adjust those numbers!",
      S: "Don't worry - your data is safe. The debits and credits don't quite match up. Let's adjust the amounts and try again.",
      C: "Validation error: Transaction not balanced. Debits: {debits}. Credits: {credits}. Difference: {difference}. Please adjust entries.",
    },
    fallback: "Transaction must balance. Debits must equal credits.",
    placeholders: ['debits', 'credits', 'difference'],
  },

  'sync.error.network': {
    id: 'sync.error.network',
    category: 'error',
    context: 'Sync - network unavailable',
    variants: {
      D: "Sync failed. No connection. Will retry when online.",
      I: "Oh no! We lost the connection. No worries - we'll sync up as soon as you're back online!",
      S: "We can't reach our servers right now. Don't worry - all your changes are saved on this device. We'll sync them automatically when your connection is back.",
      C: "Sync operation failed. Error: ERR_NETWORK. Network unavailable. Local changes queued. Automatic retry scheduled.",
    },
    fallback: "Network connection unavailable. Changes saved locally.",
  },

  'form.validation.required': {
    id: 'form.validation.required',
    category: 'error',
    context: 'Form validation - required field',
    variants: {
      D: "Required field. Fill it in.",
      I: "Oops! We need this information to continue. Can you fill it in?",
      S: "This field is required. No rush - just add the information when you're ready.",
      C: "Validation error: Required field. Field name: {field}. Please provide a value to continue.",
    },
    fallback: "This field is required.",
    placeholders: ['field'],
  },

  'error.generic': {
    id: 'error.generic',
    category: 'error',
    context: 'Generic error fallback',
    variants: {
      D: "Error occurred. Try again.",
      I: "Oops! Something unexpected happened. Let's try that again!",
      S: "Oops! Something unexpected happened. Don't worry - your data is safe. Let's try that again.",
      C: "An unexpected error occurred. Error code: {code}. Your data remains secure. Please retry the operation.",
    },
    fallback: "An unexpected error occurred. Please try again.",
    placeholders: ['code'],
  },

  // ============================================================================
  // Empty States
  // ============================================================================

  'transactions.empty_state': {
    id: 'transactions.empty_state',
    category: 'empty_state',
    context: 'Transaction list - no transactions',
    variants: {
      D: "No transactions. Record your first one now.",
      I: "No transactions yet! Ready to record your first one? It's easy and kind of fun!",
      S: "No transactions yet. Your first one is just a click away! Don't worry - we'll walk you through it.",
      C: "Transaction count: 0. The transaction list is currently empty. Click 'New Transaction' to create your first entry.",
    },
    fallback: "No transactions to display.",
  },

  'accounts.empty_state': {
    id: 'accounts.empty_state',
    category: 'empty_state',
    context: 'Chart of accounts - no accounts',
    variants: {
      D: "No accounts. Set up your chart of accounts.",
      I: "Let's create your first account! This is where the fun begins!",
      S: "No accounts yet. Creating your chart of accounts is easier than it sounds. We'll help you every step of the way.",
      C: "Account count: 0. Chart of Accounts not yet configured. Begin by creating your first account or importing a template.",
    },
    fallback: "No accounts to display.",
  },

  // ============================================================================
  // Feature Introduction / Help Messages
  // ============================================================================

  'help.chart_of_accounts': {
    id: 'help.chart_of_accounts',
    category: 'help',
    context: 'Chart of accounts - help tooltip',
    variants: {
      D: "Chart of Accounts: Categories for all your money. Assets, income, expenses.",
      I: "Your Chart of Accounts is like a filing system for your money! Everything has its perfect place!",
      S: "The Chart of Accounts is a list of all the places money can go in your business. Think of it as organizing your finances into categories like 'Income,' 'Expenses,' and 'Assets.' Don't worry - it's simpler than it sounds!",
      C: "Chart of Accounts: A systematic classification of all accounts used in the general ledger, organized by account type (Assets, Liabilities, Equity, Income, Expenses) following GAAP principles.",
    },
    fallback: "Chart of Accounts organizes your financial accounts by category.",
  },

  'help.double_entry': {
    id: 'help.double_entry',
    category: 'help',
    context: 'Transaction entry - double-entry explanation',
    variants: {
      D: "Double-entry: Every transaction has two sides. Money in = money out.",
      I: "Double-entry bookkeeping is like a buddy system for your money! Every transaction needs a partner!",
      S: "Double-entry bookkeeping means every transaction affects at least two accounts. For example, when you make a sale, you increase both your income and your cash. It helps keep everything balanced and accurate.",
      C: "Double-entry bookkeeping: A method where each transaction creates equal debits and credits across accounts, maintaining the accounting equation (Assets = Liabilities + Equity). This ensures mathematical accuracy and provides a complete audit trail.",
    },
    fallback: "Double-entry bookkeeping ensures transactions are balanced.",
  },

  'help.reconciliation': {
    id: 'help.reconciliation',
    category: 'help',
    context: 'Bank reconciliation - explanation',
    variants: {
      D: "Reconciliation: Match your records to your bank statement. Catch errors.",
      I: "Reconciliation is like matching up dance partners! We'll help you match your records with your bank statement - it's easier than it sounds!",
      S: "Reconciliation is just a fancy word for 'making sure your records match the bank.' Let's do this together, step by step.",
      C: "Bank reconciliation: The process of comparing your internal transaction records against your bank statement to identify discrepancies, verify accuracy, and ensure all transactions are properly recorded. Recommended frequency: monthly.",
    },
    fallback: "Reconciliation ensures your records match your bank statement.",
  },

  // ============================================================================
  // Confirmation Messages
  // ============================================================================

  'confirm.delete_transaction': {
    id: 'confirm.delete_transaction',
    category: 'confirmation',
    context: 'Transaction delete - confirmation dialog',
    variants: {
      D: "Delete this transaction? This can't be undone.",
      I: "Are you sure you want to delete this? Once it's gone, it's gone!",
      S: "Are you sure you want to delete this transaction? Don't worry - we just want to make sure this is what you want. This action can't be undone.",
      C: "Confirm deletion: This will permanently delete transaction {id}. This action cannot be reversed. An audit log entry will be created.",
    },
    fallback: "Are you sure you want to delete this transaction?",
    placeholders: ['id'],
  },

  'confirm.void_transaction': {
    id: 'confirm.void_transaction',
    category: 'confirmation',
    context: 'Transaction void - confirmation dialog',
    variants: {
      D: "Void this transaction?",
      I: "Ready to void this transaction? Let's make sure this is what you want!",
      S: "Are you sure you want to void this transaction? Voiding keeps the record but marks it as cancelled. This is safer than deleting.",
      C: "Confirm void operation: This will mark transaction {id} as VOID. Original entry will be preserved for audit purposes. A reversing entry will be created.",
    },
    fallback: "Are you sure you want to void this transaction?",
    placeholders: ['id'],
  },

  // ============================================================================
  // Notification Messages
  // ============================================================================

  'notification.checklist_reminder': {
    id: 'notification.checklist_reminder',
    category: 'notification',
    context: 'Weekly email - checklist reminder',
    variants: {
      D: "{count} tasks need attention. Complete them.",
      I: "You've got {count} tasks waiting for you! Let's tackle them together - you're doing great!",
      S: "You have {count} items on your checklist. Take your time - we'll work through them together at your own pace.",
      C: "Checklist status: {count} pending items. Recommended action: Review and complete tasks in priority order.",
    },
    fallback: "You have {count} items on your checklist.",
    placeholders: ['count'],
  },

  'notification.feature_unlocked': {
    id: 'notification.feature_unlocked',
    category: 'notification',
    context: 'Progressive disclosure - feature unlock',
    variants: {
      D: "New feature unlocked: {feature}. Use it now.",
      I: "New feature unlocked! {feature} is now available! This is so exciting!",
      S: "New feature unlocked! You're ready for {feature}. We'll help you learn how to use it whenever you're ready.",
      C: "Feature access granted: {feature}. Status: Unlocked based on usage milestone. Documentation available in help section.",
    },
    fallback: "New feature unlocked: {feature}",
    placeholders: ['feature'],
  },
};

/**
 * Get a message by ID
 */
export function getMessageById(messageId: string): Message | undefined {
  return messageLibrary[messageId];
}

/**
 * Get all message IDs
 */
export function getAllMessageIds(): string[] {
  return Object.keys(messageLibrary);
}

/**
 * Get all messages in a category
 */
export function getMessagesByCategory(category: Message['category']): Message[] {
  return Object.values(messageLibrary).filter(msg => msg.category === category);
}
