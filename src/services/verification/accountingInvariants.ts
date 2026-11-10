/**
 * Accounting Invariants Verification Service
 *
 * Encodes accounting rules as formally verifiable specifications.
 * These invariants MUST hold for all transactions - AI-generated or otherwise.
 *
 * Invariants are based on GAAP double-entry accounting principles:
 * 1. Debits must equal Credits (balanced entries)
 * 2. Account balances must be consistent
 * 3. Business rules (refunds, limits, etc.)
 *
 * @security Phase 3.1 - Formal Verification of Accounting Invariants
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

/**
 * Account types for balance sign conventions
 */
export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

/**
 * Entry side (debit or credit)
 */
export enum EntrySide {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

/**
 * A single journal entry line
 */
export interface JournalEntryLine {
  accountId: string;
  accountType: AccountType;
  amount: number; // In cents (integer)
  side: EntrySide;
  description?: string;
}

/**
 * A complete journal entry (transaction)
 */
export interface JournalEntry {
  id: string;
  date: string;
  lines: JournalEntryLine[];
  memo?: string;
  source: 'manual' | 'import' | 'ai' | 'system';
  aiGenerated?: boolean;
}

/**
 * Account with running balance
 */
export interface AccountBalance {
  accountId: string;
  accountType: AccountType;
  balance: number; // In cents
  debitTotal: number;
  creditTotal: number;
}

/**
 * Invariant violation details
 */
export interface InvariantViolation {
  invariant: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
  context: Record<string, unknown>;
}

/**
 * Result of proof gate validation
 */
export interface ProofGateResult {
  valid: boolean;
  violations: InvariantViolation[];
  invariants_checked: string[];
  validation_time_ms: number;
  proof_trace?: string;
}

/**
 * Business rule context for validation
 */
export interface BusinessRuleContext {
  originalTransaction?: JournalEntry;
  relatedTransactions?: JournalEntry[];
  accountBalances?: Map<string, AccountBalance>;
  companySettings?: {
    maxSingleTransactionAmount?: number;
    requireApprovalAbove?: number;
    allowNegativeBalances?: boolean;
  };
}

/**
 * Invariant check function type
 */
type InvariantCheck = (
  entry: JournalEntry,
  context?: BusinessRuleContext
) => InvariantViolation | null;

/**
 * All accounting invariants
 */
const ACCOUNTING_INVARIANTS: Record<string, InvariantCheck> = {
  /**
   * INVARIANT 1: Debits must equal Credits
   * This is the fundamental rule of double-entry accounting.
   */
  'ACCT-001-BALANCED': (entry: JournalEntry): InvariantViolation | null => {
    const totalDebits = entry.lines
      .filter((l) => l.side === EntrySide.DEBIT)
      .reduce((sum, l) => sum + l.amount, 0);

    const totalCredits = entry.lines
      .filter((l) => l.side === EntrySide.CREDIT)
      .reduce((sum, l) => sum + l.amount, 0);

    if (totalDebits !== totalCredits) {
      return {
        invariant: 'ACCT-001-BALANCED',
        code: 'UNBALANCED_ENTRY',
        message: `Entry is unbalanced: Debits (${totalDebits}) != Credits (${totalCredits})`,
        severity: 'error',
        context: {
          totalDebits,
          totalCredits,
          difference: totalDebits - totalCredits,
        },
      };
    }
    return null;
  },

  /**
   * INVARIANT 2: All amounts must be positive
   * Negative amounts are represented by switching debit/credit side.
   */
  'ACCT-002-POSITIVE-AMOUNTS': (entry: JournalEntry): InvariantViolation | null => {
    const negativeLines = entry.lines.filter((l) => l.amount < 0);

    if (negativeLines.length > 0) {
      return {
        invariant: 'ACCT-002-POSITIVE-AMOUNTS',
        code: 'NEGATIVE_AMOUNT',
        message: `Entry contains negative amounts. Use opposite side instead.`,
        severity: 'error',
        context: {
          negativeLines: negativeLines.map((l) => ({
            accountId: l.accountId,
            amount: l.amount,
          })),
        },
      };
    }
    return null;
  },

  /**
   * INVARIANT 3: Entry must have at least 2 lines
   * Single-sided entries are not valid double-entry accounting.
   */
  'ACCT-003-MIN-LINES': (entry: JournalEntry): InvariantViolation | null => {
    if (entry.lines.length < 2) {
      return {
        invariant: 'ACCT-003-MIN-LINES',
        code: 'INSUFFICIENT_LINES',
        message: `Entry must have at least 2 lines (has ${entry.lines.length})`,
        severity: 'error',
        context: {
          lineCount: entry.lines.length,
        },
      };
    }
    return null;
  },

  /**
   * INVARIANT 4: Entry must have both debit and credit sides
   */
  'ACCT-004-BOTH-SIDES': (entry: JournalEntry): InvariantViolation | null => {
    const hasDebit = entry.lines.some((l) => l.side === EntrySide.DEBIT);
    const hasCredit = entry.lines.some((l) => l.side === EntrySide.CREDIT);

    if (!hasDebit || !hasCredit) {
      return {
        invariant: 'ACCT-004-BOTH-SIDES',
        code: 'MISSING_SIDE',
        message: `Entry must have both debit and credit lines`,
        severity: 'error',
        context: {
          hasDebit,
          hasCredit,
        },
      };
    }
    return null;
  },

  /**
   * INVARIANT 5: Zero-amount lines are not allowed
   */
  'ACCT-005-NO-ZERO': (entry: JournalEntry): InvariantViolation | null => {
    const zeroLines = entry.lines.filter((l) => l.amount === 0);

    if (zeroLines.length > 0) {
      return {
        invariant: 'ACCT-005-NO-ZERO',
        code: 'ZERO_AMOUNT',
        message: `Entry contains zero-amount lines`,
        severity: 'error',
        context: {
          zeroLineCount: zeroLines.length,
        },
      };
    }
    return null;
  },

  /**
   * INVARIANT 6: Valid date format
   */
  'ACCT-006-VALID-DATE': (entry: JournalEntry): InvariantViolation | null => {
    const date = new Date(entry.date);
    if (isNaN(date.getTime())) {
      return {
        invariant: 'ACCT-006-VALID-DATE',
        code: 'INVALID_DATE',
        message: `Entry has invalid date: ${entry.date}`,
        severity: 'error',
        context: {
          providedDate: entry.date,
        },
      };
    }
    return null;
  },

  /**
   * INVARIANT 7: Date not in far future (prevents accidental errors)
   */
  'ACCT-007-REASONABLE-DATE': (entry: JournalEntry): InvariantViolation | null => {
    const date = new Date(entry.date);
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);

    if (date > maxFutureDate) {
      return {
        invariant: 'ACCT-007-REASONABLE-DATE',
        code: 'FUTURE_DATE',
        message: `Entry date is more than 1 year in the future`,
        severity: 'warning',
        context: {
          entryDate: entry.date,
          maxAllowed: maxFutureDate.toISOString(),
        },
      };
    }
    return null;
  },

  /**
   * INVARIANT 8: Unique account IDs (no duplicate accounts in same entry)
   * Note: This may be relaxed for split transactions
   */
  'ACCT-008-UNIQUE-ACCOUNTS': (entry: JournalEntry): InvariantViolation | null => {
    const accountSidePairs = entry.lines.map((l) => `${l.accountId}:${l.side}`);
    const uniquePairs = new Set(accountSidePairs);

    if (uniquePairs.size !== accountSidePairs.length) {
      // Find duplicates
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const pair of accountSidePairs) {
        if (seen.has(pair)) {
          duplicates.push(pair);
        }
        seen.add(pair);
      }

      return {
        invariant: 'ACCT-008-UNIQUE-ACCOUNTS',
        code: 'DUPLICATE_ACCOUNT_SIDE',
        message: `Entry has duplicate account/side combinations. Consider consolidating.`,
        severity: 'warning',
        context: {
          duplicates,
        },
      };
    }
    return null;
  },
};

/**
 * Business rule invariants (context-dependent)
 */
const BUSINESS_INVARIANTS: Record<string, InvariantCheck> = {
  /**
   * BUSINESS 1: Refund cannot exceed original charge
   */
  'BIZ-001-REFUND-LIMIT': (
    entry: JournalEntry,
    context?: BusinessRuleContext
  ): InvariantViolation | null => {
    if (!context?.originalTransaction) return null;

    // Check if this looks like a refund (reversing entry)
    const isRefund = entry.memo?.toLowerCase().includes('refund');
    if (!isRefund) return null;

    const originalTotal = context.originalTransaction.lines
      .filter((l) => l.side === EntrySide.DEBIT)
      .reduce((sum, l) => sum + l.amount, 0);

    const refundTotal = entry.lines
      .filter((l) => l.side === EntrySide.CREDIT)
      .reduce((sum, l) => sum + l.amount, 0);

    if (refundTotal > originalTotal) {
      return {
        invariant: 'BIZ-001-REFUND-LIMIT',
        code: 'REFUND_EXCEEDS_ORIGINAL',
        message: `Refund amount (${refundTotal}) exceeds original charge (${originalTotal})`,
        severity: 'error',
        context: {
          originalTotal,
          refundTotal,
          excess: refundTotal - originalTotal,
        },
      };
    }
    return null;
  },

  /**
   * BUSINESS 2: Single transaction amount limit
   */
  'BIZ-002-AMOUNT-LIMIT': (
    entry: JournalEntry,
    context?: BusinessRuleContext
  ): InvariantViolation | null => {
    const maxAmount = context?.companySettings?.maxSingleTransactionAmount;
    if (!maxAmount) return null;

    const totalAmount = entry.lines
      .filter((l) => l.side === EntrySide.DEBIT)
      .reduce((sum, l) => sum + l.amount, 0);

    if (totalAmount > maxAmount) {
      return {
        invariant: 'BIZ-002-AMOUNT-LIMIT',
        code: 'EXCEEDS_LIMIT',
        message: `Transaction amount (${totalAmount}) exceeds limit (${maxAmount})`,
        severity: 'error',
        context: {
          totalAmount,
          maxAmount,
        },
      };
    }
    return null;
  },

  /**
   * BUSINESS 3: Approval required above threshold
   */
  'BIZ-003-APPROVAL-REQUIRED': (
    entry: JournalEntry,
    context?: BusinessRuleContext
  ): InvariantViolation | null => {
    const threshold = context?.companySettings?.requireApprovalAbove;
    if (!threshold) return null;

    const totalAmount = entry.lines
      .filter((l) => l.side === EntrySide.DEBIT)
      .reduce((sum, l) => sum + l.amount, 0);

    if (totalAmount > threshold) {
      return {
        invariant: 'BIZ-003-APPROVAL-REQUIRED',
        code: 'REQUIRES_APPROVAL',
        message: `Transaction amount (${totalAmount}) exceeds approval threshold (${threshold})`,
        severity: 'warning',
        context: {
          totalAmount,
          threshold,
          requiresApproval: true,
        },
      };
    }
    return null;
  },

  /**
   * BUSINESS 4: Negative balance prevention (optional)
   */
  'BIZ-004-NO-NEGATIVE-BALANCE': (
    entry: JournalEntry,
    context?: BusinessRuleContext
  ): InvariantViolation | null => {
    if (context?.companySettings?.allowNegativeBalances !== false) return null;
    if (!context?.accountBalances) return null;

    const violations: Array<{ accountId: string; currentBalance: number; change: number }> = [];

    for (const line of entry.lines) {
      const account = context.accountBalances.get(line.accountId);
      if (!account) continue;

      // Calculate balance change
      let change = 0;
      if (line.side === EntrySide.DEBIT) {
        // Debits increase assets/expenses, decrease liabilities/equity/revenue
        change = [AccountType.ASSET, AccountType.EXPENSE].includes(line.accountType)
          ? line.amount
          : -line.amount;
      } else {
        // Credits decrease assets/expenses, increase liabilities/equity/revenue
        change = [AccountType.ASSET, AccountType.EXPENSE].includes(line.accountType)
          ? -line.amount
          : line.amount;
      }

      const newBalance = account.balance + change;
      if (newBalance < 0) {
        violations.push({
          accountId: line.accountId,
          currentBalance: account.balance,
          change,
        });
      }
    }

    if (violations.length > 0) {
      return {
        invariant: 'BIZ-004-NO-NEGATIVE-BALANCE',
        code: 'WOULD_CAUSE_NEGATIVE_BALANCE',
        message: `Transaction would cause negative balance in ${violations.length} account(s)`,
        severity: 'error',
        context: {
          affectedAccounts: violations,
        },
      };
    }
    return null;
  },
};

/**
 * AI-specific invariants (extra scrutiny for AI-generated entries)
 */
const AI_INVARIANTS: Record<string, InvariantCheck> = {
  /**
   * AI 1: AI entries must have clear source attribution
   */
  'AI-001-SOURCE-ATTRIBUTION': (entry: JournalEntry): InvariantViolation | null => {
    if (!entry.aiGenerated) return null;

    if (entry.source !== 'ai') {
      return {
        invariant: 'AI-001-SOURCE-ATTRIBUTION',
        code: 'MISSING_AI_ATTRIBUTION',
        message: 'AI-generated entry must have source="ai"',
        severity: 'error',
        context: {
          actualSource: entry.source,
        },
      };
    }
    return null;
  },

  /**
   * AI 2: AI entries should have memo/description
   */
  'AI-002-REQUIRES-MEMO': (entry: JournalEntry): InvariantViolation | null => {
    if (!entry.aiGenerated) return null;

    if (!entry.memo || entry.memo.trim().length === 0) {
      return {
        invariant: 'AI-002-REQUIRES-MEMO',
        code: 'MISSING_MEMO',
        message: 'AI-generated entry must include a memo explaining the entry',
        severity: 'warning',
        context: {},
      };
    }
    return null;
  },

  /**
   * AI 3: AI entries should have line descriptions
   */
  'AI-003-LINE-DESCRIPTIONS': (entry: JournalEntry): InvariantViolation | null => {
    if (!entry.aiGenerated) return null;

    const missingDescriptions = entry.lines.filter(
      (l) => !l.description || l.description.trim().length === 0
    );

    if (missingDescriptions.length > 0) {
      return {
        invariant: 'AI-003-LINE-DESCRIPTIONS',
        code: 'MISSING_LINE_DESCRIPTIONS',
        message: `AI-generated entry has ${missingDescriptions.length} lines without descriptions`,
        severity: 'warning',
        context: {
          missingCount: missingDescriptions.length,
          totalLines: entry.lines.length,
        },
      };
    }
    return null;
  },

  /**
   * AI 4: AI entries should not touch sensitive accounts without review
   */
  'AI-004-SENSITIVE-ACCOUNTS': (entry: JournalEntry): InvariantViolation | null => {
    if (!entry.aiGenerated) return null;

    // Accounts that require human review when AI touches them
    const sensitivePatterns = [
      /payroll/i,
      /tax/i,
      /loan/i,
      /equity/i,
      /owner/i,
      /dividend/i,
      /retained.?earnings/i,
    ];

    const sensitiveLines = entry.lines.filter((line) =>
      sensitivePatterns.some((pattern) => pattern.test(line.accountId))
    );

    if (sensitiveLines.length > 0) {
      return {
        invariant: 'AI-004-SENSITIVE-ACCOUNTS',
        code: 'SENSITIVE_ACCOUNT_ACCESS',
        message: `AI-generated entry affects sensitive accounts - requires manual review`,
        severity: 'warning',
        context: {
          sensitiveAccounts: sensitiveLines.map((l) => l.accountId),
        },
      };
    }
    return null;
  },
};

/**
 * Validate a journal entry against all invariants
 */
export function validateEntry(
  entry: JournalEntry,
  context?: BusinessRuleContext,
  options?: {
    includeWarnings?: boolean;
    skipAiChecks?: boolean;
    skipBusinessChecks?: boolean;
  }
): ProofGateResult {
  const startTime = performance.now();
  const violations: InvariantViolation[] = [];
  const invariantsChecked: string[] = [];

  // Check accounting invariants (always)
  for (const [name, check] of Object.entries(ACCOUNTING_INVARIANTS)) {
    invariantsChecked.push(name);
    const violation = check(entry, context);
    if (violation) {
      violations.push(violation);
    }
  }

  // Check business invariants (unless skipped)
  if (!options?.skipBusinessChecks) {
    for (const [name, check] of Object.entries(BUSINESS_INVARIANTS)) {
      invariantsChecked.push(name);
      const violation = check(entry, context);
      if (violation) {
        violations.push(violation);
      }
    }
  }

  // Check AI invariants (unless skipped)
  if (!options?.skipAiChecks && entry.aiGenerated) {
    for (const [name, check] of Object.entries(AI_INVARIANTS)) {
      invariantsChecked.push(name);
      const violation = check(entry, context);
      if (violation) {
        violations.push(violation);
      }
    }
  }

  // Filter warnings if not requested
  const finalViolations = options?.includeWarnings
    ? violations
    : violations.filter((v) => v.severity === 'error');

  const endTime = performance.now();

  return {
    valid: finalViolations.filter((v) => v.severity === 'error').length === 0,
    violations: finalViolations,
    invariants_checked: invariantsChecked,
    validation_time_ms: endTime - startTime,
    proof_trace: generateProofTrace(entry, finalViolations),
  };
}

/**
 * Generate a proof trace for debugging/audit
 */
function generateProofTrace(
  entry: JournalEntry,
  violations: InvariantViolation[]
): string {
  const lines: string[] = [
    `; Proof Gate Validation Trace`,
    `; Entry ID: ${entry.id}`,
    `; Date: ${entry.date}`,
    `; Source: ${entry.source}`,
    `; AI Generated: ${entry.aiGenerated || false}`,
    ``,
    `; Entry Lines:`,
  ];

  for (const line of entry.lines) {
    lines.push(
      `; ${line.side.toUpperCase()} ${line.accountId} ${line.amount} (${line.accountType})`
    );
  }

  lines.push(``);
  lines.push(`; Debit Total: ${entry.lines.filter((l) => l.side === EntrySide.DEBIT).reduce((s, l) => s + l.amount, 0)}`);
  lines.push(`; Credit Total: ${entry.lines.filter((l) => l.side === EntrySide.CREDIT).reduce((s, l) => s + l.amount, 0)}`);
  lines.push(``);

  if (violations.length === 0) {
    lines.push(`; RESULT: VALID`);
    lines.push(`; All invariants satisfied`);
  } else {
    lines.push(`; RESULT: INVALID`);
    lines.push(`; Violations (${violations.length}):`);
    for (const v of violations) {
      lines.push(`; - ${v.invariant}: ${v.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Quick balance check (commonly used)
 */
export function isBalanced(entry: JournalEntry): boolean {
  const totalDebits = entry.lines
    .filter((l) => l.side === EntrySide.DEBIT)
    .reduce((sum, l) => sum + l.amount, 0);

  const totalCredits = entry.lines
    .filter((l) => l.side === EntrySide.CREDIT)
    .reduce((sum, l) => sum + l.amount, 0);

  return totalDebits === totalCredits;
}

/**
 * Calculate totals for an entry
 */
export function getEntryTotals(entry: JournalEntry): {
  debits: number;
  credits: number;
  balanced: boolean;
} {
  const debits = entry.lines
    .filter((l) => l.side === EntrySide.DEBIT)
    .reduce((sum, l) => sum + l.amount, 0);

  const credits = entry.lines
    .filter((l) => l.side === EntrySide.CREDIT)
    .reduce((sum, l) => sum + l.amount, 0);

  return {
    debits,
    credits,
    balanced: debits === credits,
  };
}

/**
 * Get all invariant names
 */
export function getAllInvariantNames(): string[] {
  return [
    ...Object.keys(ACCOUNTING_INVARIANTS),
    ...Object.keys(BUSINESS_INVARIANTS),
    ...Object.keys(AI_INVARIANTS),
  ];
}

export default {
  validateEntry,
  isBalanced,
  getEntryTotals,
  getAllInvariantNames,
  AccountType,
  EntrySide,
};
