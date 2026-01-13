/**
 * Recurring Transactions Store
 *
 * Data access layer for recurring transactions with:
 * - CRUD operations for recurring transactions
 * - Encryption/decryption of sensitive fields
 * - CRDT version vector management
 * - Automatic next occurrence calculation
 *
 * Requirements:
 * - E2: Recurring Transactions [MVP]
 * - All recurrence rules and templates are stored encrypted
 */

import { nanoid } from 'nanoid';
import { db } from '../db/database';
import { calculateNextOccurrence } from '../services/recurrence.service';
import type {
  RecurringTransaction,
  GeneratedTransaction,
  RecurrenceRule,
  TransactionTemplate,
  RecurringTransactionSummary,
  AutoCreationMode,
  TimeSavingsMetrics,
} from '../types/recurring.types';
import type { VersionVector } from '../types/database.types';

/**
 * Get device ID from localStorage
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = nanoid();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

/**
 * Initialize version vector for a new entity
 */
function initVersionVector(): VersionVector {
  const deviceId = getDeviceId();
  return { [deviceId]: 1 };
}

/**
 * Increment version vector for an update
 */
function incrementVersionVector(current: VersionVector): VersionVector {
  const deviceId = getDeviceId();
  return {
    ...current,
    [deviceId]: (current[deviceId] || 0) + 1,
  };
}

/**
 * Encryption service interface (to be provided by caller)
 */
export interface EncryptionService {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

export interface EncryptionContext {
  encryptionService?: EncryptionService;
}

/**
 * Create a new recurring transaction
 */
export async function createRecurringTransaction(
  companyId: string,
  name: string,
  recurrenceRule: RecurrenceRule,
  transactionTemplate: TransactionTemplate,
  autoCreationMode: AutoCreationMode,
  context?: EncryptionContext
): Promise<RecurringTransaction> {
  const now = Date.now();
  const deviceId = getDeviceId();

  // Calculate next occurrence
  const nextOccurrence = recurrenceRule.startDate;

  // Serialize rule and template
  const ruleJson = JSON.stringify(recurrenceRule);
  const templateJson = JSON.stringify(transactionTemplate);

  // Encrypt sensitive fields if service provided
  let encryptedName = name;
  let encryptedRule = ruleJson;
  let encryptedTemplate = templateJson;

  if (context?.encryptionService) {
    encryptedName = await context.encryptionService.encrypt(name);
    encryptedRule = await context.encryptionService.encrypt(ruleJson);
    encryptedTemplate = await context.encryptionService.encrypt(templateJson);
  }

  const recurringTransaction: RecurringTransaction = {
    id: nanoid(),
    company_id: companyId,
    name: encryptedName,
    recurrence_rule: encryptedRule,
    transaction_template: encryptedTemplate,
    auto_creation_mode: autoCreationMode,
    active: true,
    next_occurrence: nextOccurrence,
    last_created: null,
    created_count: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: initVersionVector(),
  };

  await db.recurringTransactions.add(recurringTransaction);
  return recurringTransaction;
}

/**
 * Get recurring transaction by ID (with decryption)
 */
export async function getRecurringTransaction(
  id: string,
  context?: EncryptionContext
): Promise<RecurringTransactionSummary | null> {
  const entity = await db.recurringTransactions.get(id);

  if (!entity || entity.deleted_at !== null) {
    return null;
  }

  return decryptRecurringTransaction(entity, context);
}

/**
 * Get all active recurring transactions for a company
 */
export async function getActiveRecurringTransactions(
  companyId: string,
  context?: EncryptionContext
): Promise<RecurringTransactionSummary[]> {
  const entities = await db.recurringTransactions
    .where('[company_id+active]')
    .equals([companyId, true])
    .and((rt) => rt.deleted_at === null)
    .toArray();

  return Promise.all(entities.map((e) => decryptRecurringTransaction(e, context)));
}

/**
 * Get all recurring transactions for a company (including inactive)
 */
export async function getAllRecurringTransactions(
  companyId: string,
  context?: EncryptionContext
): Promise<RecurringTransactionSummary[]> {
  const entities = await db.recurringTransactions
    .where('company_id')
    .equals(companyId)
    .and((rt) => rt.deleted_at === null)
    .toArray();

  return Promise.all(entities.map((e) => decryptRecurringTransaction(e, context)));
}

/**
 * Update a recurring transaction
 */
export async function updateRecurringTransaction(
  id: string,
  updates: {
    name?: string;
    recurrenceRule?: RecurrenceRule;
    transactionTemplate?: TransactionTemplate;
    autoCreationMode?: AutoCreationMode;
    active?: boolean;
  },
  context?: EncryptionContext
): Promise<RecurringTransaction> {
  const existing = await db.recurringTransactions.get(id);

  if (!existing) {
    throw new Error(`Recurring transaction not found: ${id}`);
  }

  if (existing.deleted_at !== null) {
    throw new Error(`Recurring transaction has been deleted: ${id}`);
  }

  const now = Date.now();
  const updateData: Partial<RecurringTransaction> = {
    updated_at: now,
    version_vector: incrementVersionVector(existing.version_vector),
  };

  // Encrypt and update name if provided
  if (updates.name !== undefined) {
    updateData.name = context?.encryptionService
      ? await context.encryptionService.encrypt(updates.name)
      : updates.name;
  }

  // Encrypt and update recurrence rule if provided
  if (updates.recurrenceRule !== undefined) {
    const ruleJson = JSON.stringify(updates.recurrenceRule);
    updateData.recurrence_rule = context?.encryptionService
      ? await context.encryptionService.encrypt(ruleJson)
      : ruleJson;

    // Recalculate next occurrence
    updateData.next_occurrence = calculateNextOccurrence(
      updates.recurrenceRule,
      existing.last_created
    );
  }

  // Encrypt and update template if provided
  if (updates.transactionTemplate !== undefined) {
    const templateJson = JSON.stringify(updates.transactionTemplate);
    updateData.transaction_template = context?.encryptionService
      ? await context.encryptionService.encrypt(templateJson)
      : templateJson;
  }

  // Update auto-creation mode if provided
  if (updates.autoCreationMode !== undefined) {
    updateData.auto_creation_mode = updates.autoCreationMode;
  }

  // Update active status if provided
  if (updates.active !== undefined) {
    updateData.active = updates.active;
  }

  await db.recurringTransactions.update(id, updateData);

  const updated = await db.recurringTransactions.get(id);
  if (!updated) {
    throw new Error('Failed to retrieve updated recurring transaction');
  }

  return updated;
}

/**
 * Delete a recurring transaction (soft delete)
 */
export async function deleteRecurringTransaction(id: string): Promise<void> {
  const existing = await db.recurringTransactions.get(id);

  if (!existing) {
    throw new Error(`Recurring transaction not found: ${id}`);
  }

  const now = Date.now();
  await db.recurringTransactions.update(id, {
    deleted_at: now,
    updated_at: now,
    version_vector: incrementVersionVector(existing.version_vector),
  });
}

/**
 * Update next occurrence and last created time
 */
export async function updateOccurrenceTimes(
  id: string,
  lastCreated: number,
  nextOccurrence: number | null
): Promise<void> {
  const existing = await db.recurringTransactions.get(id);

  if (!existing) {
    throw new Error(`Recurring transaction not found: ${id}`);
  }

  await db.recurringTransactions.update(id, {
    last_created: lastCreated,
    next_occurrence: nextOccurrence,
    created_count: existing.created_count + 1,
    updated_at: Date.now(),
    version_vector: incrementVersionVector(existing.version_vector),
  });
}

/**
 * Get recurring transactions due for creation
 */
export async function getDueRecurringTransactions(
  companyId: string,
  currentTime: number = Date.now(),
  context?: EncryptionContext
): Promise<RecurringTransactionSummary[]> {
  const entities = await db.recurringTransactions
    .where('[company_id+active]')
    .equals([companyId, true])
    .and((rt) => rt.deleted_at === null && rt.next_occurrence !== null && rt.next_occurrence <= currentTime)
    .toArray();

  return Promise.all(entities.map((e) => decryptRecurringTransaction(e, context)));
}

/**
 * Record a generated transaction
 */
export async function recordGeneratedTransaction(
  recurringTransactionId: string,
  transactionId: string,
  scheduledDate: number,
  occurrenceNumber: number
): Promise<GeneratedTransaction> {
  const now = Date.now();
  const deviceId = getDeviceId();

  const generated: GeneratedTransaction = {
    id: nanoid(),
    recurring_transaction_id: recurringTransactionId,
    transaction_id: transactionId,
    scheduled_date: scheduledDate,
    created_date: now,
    occurrence_number: occurrenceNumber,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: initVersionVector(),
  };

  await db.generatedTransactions.add(generated);
  return generated;
}

/**
 * Get generated transactions for a recurring transaction
 */
export async function getGeneratedTransactions(
  recurringTransactionId: string
): Promise<GeneratedTransaction[]> {
  return db.generatedTransactions
    .where('recurring_transaction_id')
    .equals(recurringTransactionId)
    .and((gt) => gt.deleted_at === null)
    .sortBy('scheduled_date');
}

/**
 * Get time savings metrics for a company
 */
export async function getTimeSavingsMetrics(
  companyId: string,
  context?: EncryptionContext
): Promise<TimeSavingsMetrics> {
  // Get all recurring transactions
  const recurringTransactions = await getAllRecurringTransactions(companyId, context);

  // Get total count of generated transactions
  const generatedCounts = await Promise.all(
    recurringTransactions.map(async (rt) => {
      const generated = await getGeneratedTransactions(rt.id);
      return generated.length;
    })
  );

  const totalAutoCreated = generatedCounts.reduce((sum, count) => sum + count, 0);

  // Assumes 5 minutes per transaction
  const estimatedTimeSaved = totalAutoCreated * 5;

  // Get next scheduled occurrences
  const nextScheduled = recurringTransactions
    .filter((rt) => rt.active && rt.next_occurrence !== null)
    .map((rt) => ({
      recurring_transaction_id: rt.id,
      recurring_transaction_name: rt.name,
      next_occurrence: rt.next_occurrence!,
    }))
    .sort((a, b) => a.next_occurrence - b.next_occurrence);

  return {
    total_recurring_transactions: recurringTransactions.length,
    total_auto_created_transactions: totalAutoCreated,
    estimated_time_saved_minutes: estimatedTimeSaved,
    next_scheduled_occurrences: nextScheduled,
  };
}

/**
 * Helper: Decrypt recurring transaction
 */
async function decryptRecurringTransaction(
  entity: RecurringTransaction,
  context?: EncryptionContext
): Promise<RecurringTransactionSummary> {
  let name = entity.name;
  let ruleJson = entity.recurrence_rule;
  let templateJson = entity.transaction_template;

  if (context?.encryptionService) {
    name = await context.encryptionService.decrypt(entity.name);
    ruleJson = await context.encryptionService.decrypt(entity.recurrence_rule);
    templateJson = await context.encryptionService.decrypt(entity.transaction_template);
  }

  const recurrenceRule = JSON.parse(ruleJson) as RecurrenceRule;
  const transactionTemplate = JSON.parse(templateJson) as TransactionTemplate;

  return {
    id: entity.id,
    company_id: entity.company_id,
    name,
    recurrence_rule: recurrenceRule,
    transaction_template: transactionTemplate,
    auto_creation_mode: entity.auto_creation_mode,
    active: entity.active,
    next_occurrence: entity.next_occurrence,
    last_created: entity.last_created,
    created_count: entity.created_count,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  };
}
