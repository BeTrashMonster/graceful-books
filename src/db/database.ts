/**
 * Database Initialization
 *
 * TreasureChest - The central database for Graceful Books
 * Implements local-first storage using Dexie.js (IndexedDB wrapper)
 * with CRDT-compatible schema design for offline-first multi-device sync.
 *
 * IMPORTANT: DUAL-DATABASE ARCHITECTURE
 * ======================================
 * This codebase has TWO separate IndexedDB databases by design:
 *
 * 1. TreasureChest (THIS FILE: src/db/database.ts)
 *    - Product: CPG Tool (cpu-cpg-calculator)
 *    - Status: In beta with real users
 *    - Routes: /cpg/* (gated by requireProduct="cpu-cpg-calculator")
 *    - Backup: YES - exportAllData() and backupService.ts use this db
 *
 * 2. GracefulBooksDB (src/store/database.ts)
 *    - Product: Bookkeeping Suite (bookkeeping-suite)
 *    - Status: Unfinished, no users yet
 *    - Routes: /accounts, /vendors, etc. (gated by requireProduct="bookkeeping-suite")
 *    - Backup: NOT YET - must be built when bookkeeping ships
 *
 * No cross-database reads/writes exist. Routes enforce product separation.
 * See HANDOFF.md "Architecture Decisions" section 4 for details.
 *
 * Requirements:
 * - ARCH-003: Local-First Data Store
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import Dexie, { Table, type UpdateSpec } from 'dexie';
import type {
  Account,
  Transaction,
  TransactionLineItem,
  Contact,
  Product,
  User,
  Company,
  CompanyUser,
  AuditLog,
  Session,
  Device,
  BaseEntity,
  Receipt,
} from '../types/database.types';
import { logger } from '../utils/logger';

const dbLogger = logger.child('Database');

// Import schema definitions
import { accountsSchema } from './schema/accounts.schema';
import {
  transactionsSchema,
  transactionLineItemsSchema,
} from './schema/transactions.schema';
import { contactsSchema } from './schema/contacts.schema';
import { productsSchema } from './schema/products.schema';
import {
  usersSchema,
  companiesSchema,
  companyUsersSchema,
  sessionsSchema,
  devicesSchema,
} from './schema/users.schema';
import { auditLogsSchema } from './schema/audit.schema';
import { receiptsSchema } from './schema/receipts.schema';
import { categoriesSchema } from './schema/categories.schema';
import type { Category } from './schema/categories.schema';
import {
  emailPreferencesSchema,
  emailDeliverySchema,
} from './schema/emailPreferences.schema.index';
import type {
  EmailPreferencesEntity,
  EmailDeliveryEntity,
} from './schema/emailPreferences.schema';
import { invoicesSchema } from './schema/invoices.schema';
import type { Invoice } from './schema/invoices.schema';
import { invoiceTemplateCustomizationsSchema } from './schema/invoiceTemplates.schema';
import type { InvoiceTemplateCustomization } from './schema/invoiceTemplates.schema';
import {
  recurringTransactionsSchema,
  generatedTransactionsSchema,
} from './schema/recurring.schema';
import type {
  RecurringTransaction,
  GeneratedTransaction,
} from '../types/recurring.types';
import {
  categorizationModelsSchema,
  trainingDataSchema,
  suggestionHistorySchema,
  categorizationRulesSchema,
} from './schema/categorization.schema';
import type {
  CategorizationModel,
  TrainingDataPoint,
  SuggestionHistory,
  CategorizationRule,
} from '../types/categorization.types';
import {
  inventoryItemsSchema,
  inventoryLayersSchema,
  inventoryTransactionsSchema,
  stockTakesSchema,
  stockTakeItemsSchema,
  valuationMethodChangesSchema,
} from './schema/inventoryValuation.schema';
import type {
  InventoryItem,
  InventoryLayer,
  InventoryTransaction,
  StockTake,
  StockTakeItem,
  ValuationMethodChange,
} from './schema/inventoryValuation.schema';
import { portalTokensSchema } from './schema/portalTokens.schema';
import type { PortalToken } from './schema/portalTokens.schema';
import { paymentsSchema } from './schema/payments.schema';
import type { Payment } from './schema/payments.schema';
import {
  approvalRulesSchema,
  approvalRequestsSchema,
  approvalActionsSchema,
  approvalDelegationsSchema,
  approvalHistorySchema,
} from './schema/approvalWorkflows.schema';
import type {
  ApprovalRule,
  ApprovalRequest,
  ApprovalAction,
  ApprovalDelegation,
  ApprovalHistory,
} from './schema/approvalWorkflows.schema';
import {
  reportScheduleSchema,
  scheduledReportDeliverySchema,
} from './schema/scheduledReports.schema.index';
import type {
  ReportScheduleEntity,
  ScheduledReportDeliveryEntity,
} from './schema/scheduledReports.schema';
import { recentActivitySchema } from './schema/recentActivity.schema';
import type { RecentActivity } from '../types/recentActivity.types';
import {
  conflictHistorySchema,
  conflictNotificationsSchema,
} from './schema/conflicts.schema';
import type {
  ConflictHistoryEntry,
  ConflictNotification,
} from '../types/crdt.types';
import {
  commentsSchema,
  mentionsSchema,
} from './schema/comments.schema';
import type {
  Comment,
  Mention,
} from './schema/comments.schema';
import {
  subscriptionsSchema,
  advisorClientsSchema,
  advisorTeamMembersSchema,
  paymentMethodsSchema,
  billingInvoicesSchema,
  stripeWebhookEventsSchema,
  charityDistributionsSchema,
} from './schema/billing.schema';
import type {
  Subscription,
  AdvisorClient,
  AdvisorTeamMember,
  PaymentMethod,
  BillingInvoice,
  StripeWebhookEvent,
  CharityDistribution,
} from '../types/billing.types';
import {
  emailQueueSchema,
  emailLogsSchema,
  emailNotificationPreferencesSchema,
} from './schema/emailQueue.schema';
import type {
  EmailQueueEntity,
  EmailLogEntity,
  EmailNotificationPreferencesEntity,
} from './schema/emailQueue.schema';
import { charitiesSchema } from './schema/charity.schema';
import type { Charity } from '../types/database.types';
import {
  financialGoalsSchema,
  goalProgressSnapshotsSchema,
} from './schema/goals.schema';
import type {
  FinancialGoal,
  GoalProgressSnapshot,
} from '../types/goals.types';
import {
  taxDocumentsSchema,
  taxCategoryStatusSchema,
  taxPrepSessionsSchema,
  taxAdvisorAccessSchema,
  taxPackagesSchema,
} from './schema/tax.schema';
import type {
  TaxDocument,
  TaxCategoryStatus,
  TaxPrepSession,
  TaxAdvisorAccess,
  TaxPackage,
} from '../types/tax.types';
import {
  currenciesSchema,
  exchangeRatesSchema,
  type Currency,
  type ExchangeRate,
} from './schema/currency.schema';
import {
  cpgCategoriesSchema,
  cpgInvoicesSchema,
  cpgVendorsSchema,
  cpgDistributorsSchema,
  cpgDistributionCalculationsSchema,
  cpgSalesPromosSchema,
  cpgEventsSchema,
  cpgFinishedProductsSchema,
  cpgRecipesSchema,
  cpgSettingsSchema,
  cpgLaborRolesSchema,
  cpgProductLaborsSchema,
  cpgUnitConversionsSchema,
} from './schema/cpg.schema';
import type {
  CPGCategory,
  CPGInvoice,
  CPGVendor,
  CPGDistributor,
  CPGDistributionCalculation,
  CPGSalesPromo,
  CPGEvent,
  CPGFinishedProduct,
  CPGRecipe,
  CPGSettings,
  CPGLaborRole,
  CPGProductLabor,
  CPGUnitConversion,
} from './schema/cpg.schema';
import {
  standaloneFinancialsSchema,
  skuCountTrackersSchema,
} from './schema/standaloneFinancials.schema';
import type {
  StandaloneFinancials,
  SKUCountTracker,
} from './schema/standaloneFinancials.schema';
import { cpgProductLinksSchema } from './schema/cpgProductLinks.schema';
import type { CPGProductLink } from './schema/cpgProductLinks.schema';
import { userFeaturePreferencesSchema } from './schema/userFeaturePreferences.schema';
import type { UserFeaturePreference } from './schema/userFeaturePreferences.schema';
import { tabPreferencesSchema } from './schema/tabPreferences.schema';
import type { TabPreference } from './schema/tabPreferences.schema';
import { backupAuditLogsSchema } from './schema/backupAudit.schema';
import type { BackupAuditEvent } from './schema/backupAudit.schema';
import {
  adminChecklistsSchema,
  adminTasksSchema,
  adminTaskCompletionsSchema,
  adminTaskCommentsSchema,
  userChecklistPreferencesSchema,
  checklistWizardProgressSchema,
  procedureInstancesSchema,
  procedureTaskCompletionsSchema,
} from './schema/checklistCalendar.schema';
import {
  transactionGroupsSchema,
  transactionGroupAssignmentsSchema,
} from './schema/transactionGroups.schema';
import type {
  TransactionGroup,
  TransactionGroupAssignment,
} from './schema/transactionGroups.schema';
import type {
  AdminChecklist,
  AdminTask,
  AdminTaskCompletion,
  AdminTaskComment,
  UserChecklistPreferences,
  ChecklistWizardProgress,
  ProcedureInstance,
  ProcedureTaskCompletion,
} from './schema/checklistCalendar.schema';
import {
  backupPreferencesSchema,
  type BackupPreference,
} from './schema/backupPreferences.schema';

/**
 * TreasureChest Database Class
 *
 * The main database class for Graceful Books.
 * When developers work on this, they're "organizing the treasure."
 */
export class TreasureChestDB extends Dexie {
  // Table declarations
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  transactionLineItems!: Table<TransactionLineItem, string>;
  contacts!: Table<Contact, string>;
  products!: Table<Product, string>;
  users!: Table<User, string>;
  companies!: Table<Company, string>;
  companyUsers!: Table<CompanyUser, string>;
  auditLogs!: Table<AuditLog, string>;
  sessions!: Table<Session, string>;
  devices!: Table<Device, string>;
  receipts!: Table<Receipt, string>;
  categories!: Table<Category, string>;
  emailPreferences!: Table<EmailPreferencesEntity, string>;
  emailDelivery!: Table<EmailDeliveryEntity, string>;
  invoices!: Table<Invoice, string>;
  invoiceTemplateCustomizations!: Table<InvoiceTemplateCustomization, string>;
  recurringTransactions!: Table<RecurringTransaction, string>;
  generatedTransactions!: Table<GeneratedTransaction, string>;
  categorizationModels!: Table<CategorizationModel, string>;
  trainingData!: Table<TrainingDataPoint, string>;
  suggestionHistory!: Table<SuggestionHistory, string>;
  categorizationRules!: Table<CategorizationRule, string>;
  inventoryItems!: Table<InventoryItem, string>;
  inventoryLayers!: Table<InventoryLayer, string>;
  inventoryTransactions!: Table<InventoryTransaction, string>;
  stockTakes!: Table<StockTake, string>;
  stockTakeItems!: Table<StockTakeItem, string>;
  valuationMethodChanges!: Table<ValuationMethodChange, string>;
  portalTokens!: Table<PortalToken, string>;
  payments!: Table<Payment, string>;
  approvalRules!: Table<ApprovalRule, string>;
  approvalRequests!: Table<ApprovalRequest, string>;
  approvalActions!: Table<ApprovalAction, string>;
  approvalDelegations!: Table<ApprovalDelegation, string>;
  approvalHistory!: Table<ApprovalHistory, string>;
  reportSchedules!: Table<ReportScheduleEntity, string>;
  scheduledReportDeliveries!: Table<ScheduledReportDeliveryEntity, string>;
  recentActivity!: Table<RecentActivity, string>;
  conflict_history!: Table<ConflictHistoryEntry, string>;
  conflict_notifications!: Table<ConflictNotification, string>;
  comments!: Table<Comment, string>;
  mentions!: Table<Mention, string>;
  subscriptions!: Table<Subscription, string>;
  advisorClients!: Table<AdvisorClient, string>;
  advisorTeamMembers!: Table<AdvisorTeamMember, string>;
  paymentMethods!: Table<PaymentMethod, string>;
  billingInvoices!: Table<BillingInvoice, string>;
  stripeWebhookEvents!: Table<StripeWebhookEvent, string>;
  charityDistributions!: Table<CharityDistribution, string>;
  emailQueue!: Table<EmailQueueEntity, string>;
  emailLogs!: Table<EmailLogEntity, string>;
  emailNotificationPreferences!: Table<EmailNotificationPreferencesEntity, string>;
  charities!: Table<Charity, string>;
  financialGoals!: Table<FinancialGoal, string>;
  goalProgressSnapshots!: Table<GoalProgressSnapshot, string>;
  taxDocuments!: Table<TaxDocument, string>;
  taxCategoryStatus!: Table<TaxCategoryStatus, string>;
  taxPrepSessions!: Table<TaxPrepSession, string>;
  taxAdvisorAccess!: Table<TaxAdvisorAccess, string>;
  taxPackages!: Table<TaxPackage, string>;
  journalEntries!: Table<any, string>;
  scenario_notes!: Table<any, string>;
  currencies!: Table<Currency, string>;
  exchangeRates!: Table<ExchangeRate, string>;
  cpgCategories!: Table<CPGCategory, string>;
  cpgInvoices!: Table<CPGInvoice, string>;
  cpgVendors!: Table<CPGVendor, string>;
  cpgDistributors!: Table<CPGDistributor, string>;
  cpgDistributionCalculations!: Table<CPGDistributionCalculation, string>;
  cpgSalesPromos!: Table<CPGSalesPromo, string>;
  cpgEvents!: Table<CPGEvent, string>;
  cpgFinishedProducts!: Table<CPGFinishedProduct, string>;
  cpgRecipes!: Table<CPGRecipe, string>;
  cpgProductLinks!: Table<CPGProductLink, string>;
  cpgSettings!: Table<CPGSettings, string>;
  cpgLaborRoles!: Table<CPGLaborRole, string>;
  cpgProductLabors!: Table<CPGProductLabor, string>;
  cpgUnitConversions!: Table<CPGUnitConversion, string>;
  standaloneFinancials!: Table<StandaloneFinancials, string>;
  skuCountTrackers!: Table<SKUCountTracker, string>;
  userFeaturePreferences!: Table<UserFeaturePreference, string>;
  tabPreferences!: Table<TabPreference, string>;
  backupAuditLogs!: Table<BackupAuditEvent, string>;

  // Checklist Calendar tables (v27)
  adminChecklists!: Table<AdminChecklist, string>;
  adminTasks!: Table<AdminTask, string>;
  adminTaskCompletions!: Table<AdminTaskCompletion, string>;
  adminTaskComments!: Table<AdminTaskComment, string>;
  userChecklistPreferences!: Table<UserChecklistPreferences, string>;
  checklistWizardProgress!: Table<ChecklistWizardProgress, string>;

  // Procedure Instance tables (v30)
  procedureInstances!: Table<ProcedureInstance, string>;
  procedureTaskCompletions!: Table<ProcedureTaskCompletion, string>;

  // Transaction Groups (v32)
  transactionGroups!: Table<TransactionGroup, string>;
  transactionGroupAssignments!: Table<TransactionGroupAssignment, string>;

  // Backup Preferences (v33)
  backupPreferences!: Table<BackupPreference, string>;

  constructor() {
    super('TreasureChest');

    // Define database schema
    // Version 1: Initial schema
    this.version(1).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
    });

    // Version 2: Add email preferences and delivery tables
    this.version(2).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
    });

    // Version 3: Add hierarchical contacts infrastructure (G3)
    this.version(3)
      .stores({
        accounts: accountsSchema,
        transactions: transactionsSchema,
        transactionLineItems: transactionLineItemsSchema,
        contacts: contactsSchema, // Updated with parent_id, account_type, hierarchy_level indexes
        products: productsSchema,
        users: usersSchema,
        companies: companiesSchema,
        companyUsers: companyUsersSchema,
        auditLogs: auditLogsSchema,
        sessions: sessionsSchema,
        devices: devicesSchema,
        receipts: receiptsSchema,
        categories: categoriesSchema,
        emailPreferences: emailPreferencesSchema,
        emailDelivery: emailDeliverySchema,
      })
      .upgrade(async (tx) => {
        // Migrate existing contacts to have hierarchy fields with safe defaults
        dbLogger.info('Migrating contacts to version 3 (hierarchical accounts)');

        await tx.table('contacts').toCollection().modify((contact: any) => {
          // Add default hierarchy fields if they don't exist
          if (contact.parent_id === undefined) {
            contact.parent_id = null;
          }
          if (contact.account_type === undefined) {
            contact.account_type = 'standalone';
          }
          if (contact.hierarchy_level === undefined) {
            contact.hierarchy_level = 0;
          }
        });

        dbLogger.info('Contact migration complete - all contacts defaulted to standalone');
      });

    // Version 4: Add invoices and invoice template customizations (E3)
    this.version(4).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
    });

    // Version 5: Add recurring transactions and generated transactions (E2)
    this.version(5).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
    });

    // Version 6: Add expense categorization tables (E5)
    this.version(6).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
    });

    // Version 7: Add inventory valuation tables (H6)
    this.version(7).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
    });

    // Version 8: Add client portal tables (H4)
    this.version(8).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
    });

    // Version 9: Add approval workflow tables (H3: Approval Workflows)
    this.version(9).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
    });

    // Version 10: Add scheduled reports tables (I6: Scheduled Report Delivery)
    this.version(10).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
    });

    // Version 11: Add recent activity table (I3: UX Efficiency Shortcuts)
    this.version(11).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
    });

    // Version 12: Add CRDT conflict resolution tables (Group I, I1)
    this.version(12).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
    });

    // Version 13: Add Comments and Mentions tables (Group I, I2)
    this.version(13).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
    });

    // Version 15: Add Billing Infrastructure tables (IC2)
    this.version(15).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
    });

    // Version 16: Add J5 Financial Goals Tracking tables
    this.version(16).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
    });

    // Version 17: Add J8 Tax Preparation Mode tables
    this.version(17).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
    });

    // Version 18: Add H5 Multi-Currency tables
    this.version(18).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
    });

    // Version 20: Add Standalone Financials for CPG standalone mode
    this.version(20).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgVendors: cpgVendorsSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgProductLinks: cpgProductLinksSchema,
      standaloneFinancials: standaloneFinancialsSchema,
      skuCountTrackers: skuCountTrackersSchema,
    });

    // Version 21: Add BOM System tables (Finished Products + Recipes)
    this.version(21)
      .stores({
        accounts: accountsSchema,
        transactions: transactionsSchema,
        transactionLineItems: transactionLineItemsSchema,
        contacts: contactsSchema,
        products: productsSchema,
        users: usersSchema,
        companies: companiesSchema,
        companyUsers: companyUsersSchema,
        auditLogs: auditLogsSchema,
        sessions: sessionsSchema,
        devices: devicesSchema,
        receipts: receiptsSchema,
        categories: categoriesSchema,
        emailPreferences: emailPreferencesSchema,
        emailDelivery: emailDeliverySchema,
        invoices: invoicesSchema,
        invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
        recurringTransactions: recurringTransactionsSchema,
        generatedTransactions: generatedTransactionsSchema,
        categorizationModels: categorizationModelsSchema,
        trainingData: trainingDataSchema,
        suggestionHistory: suggestionHistorySchema,
        categorizationRules: categorizationRulesSchema,
        inventoryItems: inventoryItemsSchema,
        inventoryLayers: inventoryLayersSchema,
        inventoryTransactions: inventoryTransactionsSchema,
        stockTakes: stockTakesSchema,
        stockTakeItems: stockTakeItemsSchema,
        valuationMethodChanges: valuationMethodChangesSchema,
        portalTokens: portalTokensSchema,
        payments: paymentsSchema,
        approvalRules: approvalRulesSchema,
        approvalRequests: approvalRequestsSchema,
        approvalActions: approvalActionsSchema,
        approvalDelegations: approvalDelegationsSchema,
        approvalHistory: approvalHistorySchema,
        reportSchedules: reportScheduleSchema,
        scheduledReportDeliveries: scheduledReportDeliverySchema,
        recentActivity: recentActivitySchema,
        conflict_history: conflictHistorySchema,
        conflict_notifications: conflictNotificationsSchema,
        comments: commentsSchema,
        mentions: mentionsSchema,
        emailQueue: emailQueueSchema,
        emailLogs: emailLogsSchema,
        emailNotificationPreferences: emailNotificationPreferencesSchema,
        subscriptions: subscriptionsSchema,
        advisorClients: advisorClientsSchema,
        advisorTeamMembers: advisorTeamMembersSchema,
        paymentMethods: paymentMethodsSchema,
        billingInvoices: billingInvoicesSchema,
        stripeWebhookEvents: stripeWebhookEventsSchema,
        charityDistributions: charityDistributionsSchema,
        charities: charitiesSchema,
        financialGoals: financialGoalsSchema,
        goalProgressSnapshots: goalProgressSnapshotsSchema,
        taxDocuments: taxDocumentsSchema,
        taxCategoryStatus: taxCategoryStatusSchema,
        taxPrepSessions: taxPrepSessionsSchema,
        taxAdvisorAccess: taxAdvisorAccessSchema,
        taxPackages: taxPackagesSchema,
        currencies: currenciesSchema,
        exchangeRates: exchangeRatesSchema,
        cpgCategories: cpgCategoriesSchema,
        cpgInvoices: cpgInvoicesSchema,
        cpgDistributors: cpgDistributorsSchema,
        cpgDistributionCalculations: cpgDistributionCalculationsSchema,
        cpgSalesPromos: cpgSalesPromosSchema,
        cpgFinishedProducts: cpgFinishedProductsSchema,
        cpgRecipes: cpgRecipesSchema,
        cpgProductLinks: cpgProductLinksSchema,
        cpgSettings: cpgSettingsSchema,
        standaloneFinancials: standaloneFinancialsSchema,
        skuCountTrackers: skuCountTrackersSchema,
      })
      .upgrade(async (tx) => {
        // Migrate existing CPG categories to have unit_of_measure field
        dbLogger.info('Migrating CPG categories to version 21 (BOM system)');

        await tx.table('cpgCategories').toCollection().modify((category: any) => {
          // Add default unit_of_measure if it doesn't exist
          if (category.unit_of_measure === undefined) {
            // Default to "each" for most categories
            category.unit_of_measure = 'each';
          }
        });

        dbLogger.info('CPG category migration complete - all categories have unit_of_measure');
      });

    // Version 22: Expand CPG Settings with Financial, Reporting, Data Management, and Company Profile
    this.version(22)
      .stores({
        accounts: accountsSchema,
        transactions: transactionsSchema,
        transactionLineItems: transactionLineItemsSchema,
        contacts: contactsSchema,
        products: productsSchema,
        users: usersSchema,
        companies: companiesSchema,
        companyUsers: companyUsersSchema,
        auditLogs: auditLogsSchema,
        sessions: sessionsSchema,
        devices: devicesSchema,
        receipts: receiptsSchema,
        categories: categoriesSchema,
        emailPreferences: emailPreferencesSchema,
        emailDelivery: emailDeliverySchema,
        invoices: invoicesSchema,
        invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
        recurringTransactions: recurringTransactionsSchema,
        generatedTransactions: generatedTransactionsSchema,
        categorizationModels: categorizationModelsSchema,
        trainingData: trainingDataSchema,
        suggestionHistory: suggestionHistorySchema,
        categorizationRules: categorizationRulesSchema,
        inventoryItems: inventoryItemsSchema,
        inventoryLayers: inventoryLayersSchema,
        inventoryTransactions: inventoryTransactionsSchema,
        stockTakes: stockTakesSchema,
        stockTakeItems: stockTakeItemsSchema,
        valuationMethodChanges: valuationMethodChangesSchema,
        portalTokens: portalTokensSchema,
        payments: paymentsSchema,
        approvalRules: approvalRulesSchema,
        approvalRequests: approvalRequestsSchema,
        approvalActions: approvalActionsSchema,
        approvalDelegations: approvalDelegationsSchema,
        approvalHistory: approvalHistorySchema,
        reportSchedules: reportScheduleSchema,
        scheduledReportDeliveries: scheduledReportDeliverySchema,
        recentActivity: recentActivitySchema,
        conflict_history: conflictHistorySchema,
        conflict_notifications: conflictNotificationsSchema,
        comments: commentsSchema,
        mentions: mentionsSchema,
        emailQueue: emailQueueSchema,
        emailLogs: emailLogsSchema,
        emailNotificationPreferences: emailNotificationPreferencesSchema,
        subscriptions: subscriptionsSchema,
        advisorClients: advisorClientsSchema,
        advisorTeamMembers: advisorTeamMembersSchema,
        paymentMethods: paymentMethodsSchema,
        billingInvoices: billingInvoicesSchema,
        stripeWebhookEvents: stripeWebhookEventsSchema,
        charityDistributions: charityDistributionsSchema,
        charities: charitiesSchema,
        financialGoals: financialGoalsSchema,
        goalProgressSnapshots: goalProgressSnapshotsSchema,
        taxDocuments: taxDocumentsSchema,
        taxCategoryStatus: taxCategoryStatusSchema,
        taxPrepSessions: taxPrepSessionsSchema,
        taxAdvisorAccess: taxAdvisorAccessSchema,
        taxPackages: taxPackagesSchema,
        currencies: currenciesSchema,
        exchangeRates: exchangeRatesSchema,
        cpgCategories: cpgCategoriesSchema,
        cpgInvoices: cpgInvoicesSchema,
        cpgDistributors: cpgDistributorsSchema,
        cpgDistributionCalculations: cpgDistributionCalculationsSchema,
        cpgSalesPromos: cpgSalesPromosSchema,
        cpgFinishedProducts: cpgFinishedProductsSchema,
        cpgRecipes: cpgRecipesSchema,
        cpgProductLinks: cpgProductLinksSchema,
        cpgSettings: cpgSettingsSchema,
        standaloneFinancials: standaloneFinancialsSchema,
        skuCountTrackers: skuCountTrackersSchema,
      })
      .upgrade(async (tx) => {
        // Migrate existing CPG settings to have new fields
        dbLogger.info('Migrating CPG settings to version 22 (expanded settings)');

        await tx.table('cpgSettings').toCollection().modify((settings: any) => {
          // Financial Defaults
          if (settings.default_labor_rate === undefined) settings.default_labor_rate = '20.00';

          // Reporting Preferences
          if (settings.default_report_date_range === undefined) settings.default_report_date_range = 'last_30_days';
          if (settings.include_deleted_in_reports === undefined) settings.include_deleted_in_reports = false;

          // Display & Format Preferences
          if (settings.currency_format === undefined) settings.currency_format = 'USD';
          if (settings.date_format === undefined) settings.date_format = 'MM/DD/YYYY';
          if (settings.number_format === undefined) settings.number_format = 'en-US';
          if (settings.decimal_places_currency === undefined) settings.decimal_places_currency = 2;
          if (settings.decimal_places_numbers === undefined) settings.decimal_places_numbers = 2;
          if (settings.decimal_places_percentage === undefined) settings.decimal_places_percentage = 2;

          // Data Management
          if (settings.auto_save_interval === undefined) settings.auto_save_interval = 30;
          if (settings.deleted_record_retention_days === undefined) settings.deleted_record_retention_days = 90;

          // Company Profile
          if (settings.company_name === undefined) settings.company_name = '';
          if (settings.company_logo_url === undefined) settings.company_logo_url = null;
          if (settings.company_address_line1 === undefined) settings.company_address_line1 = '';
          if (settings.company_address_line2 === undefined) settings.company_address_line2 = null;
          if (settings.company_city === undefined) settings.company_city = '';
          if (settings.company_state === undefined) settings.company_state = '';
          if (settings.company_postal_code === undefined) settings.company_postal_code = '';
          if (settings.company_country === undefined) settings.company_country = 'US';
          if (settings.company_phone === undefined) settings.company_phone = null;
          if (settings.company_email === undefined) settings.company_email = null;
          if (settings.company_website === undefined) settings.company_website = null;
        });

        dbLogger.info('CPG settings migration complete - all settings have new fields');
      });

    // Version 23: Add compound index for standaloneFinancials queries
    this.version(23).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgFinishedProducts: cpgFinishedProductsSchema,
      cpgRecipes: cpgRecipesSchema,
      cpgProductLinks: cpgProductLinksSchema,
      cpgSettings: cpgSettingsSchema,
      standaloneFinancials: standaloneFinancialsSchema,
      skuCountTrackers: skuCountTrackersSchema,
    });

    // Version 24: Add CPG Events table for farmers market / event analysis
    this.version(24).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgVendors: cpgVendorsSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgEvents: cpgEventsSchema,
      cpgFinishedProducts: cpgFinishedProductsSchema,
      cpgRecipes: cpgRecipesSchema,
      cpgProductLinks: cpgProductLinksSchema,
      cpgSettings: cpgSettingsSchema,
      cpgLaborRoles: cpgLaborRolesSchema,
      cpgProductLabors: cpgProductLaborsSchema,
      standaloneFinancials: standaloneFinancialsSchema,
      skuCountTrackers: skuCountTrackersSchema,
    });

    // Version 25: Add User Feature Preferences for progressive disclosure
    this.version(25).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgVendors: cpgVendorsSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgEvents: cpgEventsSchema,
      cpgFinishedProducts: cpgFinishedProductsSchema,
      cpgRecipes: cpgRecipesSchema,
      cpgProductLinks: cpgProductLinksSchema,
      cpgSettings: cpgSettingsSchema,
      cpgLaborRoles: cpgLaborRolesSchema,
      cpgProductLabors: cpgProductLaborsSchema,
      standaloneFinancials: standaloneFinancialsSchema,
      skuCountTrackers: skuCountTrackersSchema,
      userFeaturePreferences: userFeaturePreferencesSchema,
    });

    // Version 26: Add Backup Audit Logs for blockchain-style backup/sync audit trail
    this.version(26).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgVendors: cpgVendorsSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgEvents: cpgEventsSchema,
      cpgFinishedProducts: cpgFinishedProductsSchema,
      cpgRecipes: cpgRecipesSchema,
      cpgProductLinks: cpgProductLinksSchema,
      cpgSettings: cpgSettingsSchema,
      cpgLaborRoles: cpgLaborRolesSchema,
      cpgProductLabors: cpgProductLaborsSchema,
      standaloneFinancials: standaloneFinancialsSchema,
      skuCountTrackers: skuCountTrackersSchema,
      userFeaturePreferences: userFeaturePreferencesSchema,
      backupAuditLogs: backupAuditLogsSchema,
    });

    // Version 19: Add CPG (Consumer Packaged Goods) tables
    this.version(19).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgVendors: cpgVendorsSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgProductLinks: cpgProductLinksSchema,
    });

    // Version 14: Add IC4 Email Queue and Logs tables
    this.version(14).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      charities: charitiesSchema,
    });

    // Version 15: Add tab preferences for pinning default tabs
    this.version(15).stores({
      tabPreferences: tabPreferencesSchema,
    });

    // Version 27: Add S+H distribution support to CPG categories (is_distribution_category index)
    this.version(27)
      .stores({
        cpgCategories: cpgCategoriesSchema,
      })
      .upgrade(async (tx) => {
        dbLogger.info('Migrating CPG categories to version 27 (S+H distribution support)');

        // Ensure all categories have is_distribution_category field
        await tx.table('cpgCategories').toCollection().modify((category: any) => {
          if (category.is_distribution_category === undefined) {
            category.is_distribution_category = false;
          }
        });

        dbLogger.info('CPG category migration complete - all categories have is_distribution_category field');
      });

    // Version 28: Fix database schema versioning issue and ensure all CPG tables exist properly
    this.version(28)
      .stores({
        accounts: accountsSchema,
        transactions: transactionsSchema,
        transactionLineItems: transactionLineItemsSchema,
        contacts: contactsSchema,
        products: productsSchema,
        users: usersSchema,
        companies: companiesSchema,
        companyUsers: companyUsersSchema,
        auditLogs: auditLogsSchema,
        sessions: sessionsSchema,
        devices: devicesSchema,
        receipts: receiptsSchema,
        categories: categoriesSchema,
        emailPreferences: emailPreferencesSchema,
        emailDelivery: emailDeliverySchema,
        invoices: invoicesSchema,
        invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
        recurringTransactions: recurringTransactionsSchema,
        generatedTransactions: generatedTransactionsSchema,
        categorizationModels: categorizationModelsSchema,
        trainingData: trainingDataSchema,
        suggestionHistory: suggestionHistorySchema,
        categorizationRules: categorizationRulesSchema,
        inventoryItems: inventoryItemsSchema,
        inventoryLayers: inventoryLayersSchema,
        inventoryTransactions: inventoryTransactionsSchema,
        stockTakes: stockTakesSchema,
        stockTakeItems: stockTakeItemsSchema,
        valuationMethodChanges: valuationMethodChangesSchema,
        portalTokens: portalTokensSchema,
        payments: paymentsSchema,
        approvalRules: approvalRulesSchema,
        approvalRequests: approvalRequestsSchema,
        approvalActions: approvalActionsSchema,
        approvalDelegations: approvalDelegationsSchema,
        approvalHistory: approvalHistorySchema,
        reportSchedules: reportScheduleSchema,
        scheduledReportDeliveries: scheduledReportDeliverySchema,
        recentActivity: recentActivitySchema,
        conflict_history: conflictHistorySchema,
        conflict_notifications: conflictNotificationsSchema,
        comments: commentsSchema,
        mentions: mentionsSchema,
        emailQueue: emailQueueSchema,
        emailLogs: emailLogsSchema,
        emailNotificationPreferences: emailNotificationPreferencesSchema,
        subscriptions: subscriptionsSchema,
        advisorClients: advisorClientsSchema,
        advisorTeamMembers: advisorTeamMembersSchema,
        paymentMethods: paymentMethodsSchema,
        billingInvoices: billingInvoicesSchema,
        stripeWebhookEvents: stripeWebhookEventsSchema,
        charityDistributions: charityDistributionsSchema,
        charities: charitiesSchema,
        financialGoals: financialGoalsSchema,
        goalProgressSnapshots: goalProgressSnapshotsSchema,
        taxDocuments: taxDocumentsSchema,
        taxCategoryStatus: taxCategoryStatusSchema,
        taxPrepSessions: taxPrepSessionsSchema,
        taxAdvisorAccess: taxAdvisorAccessSchema,
        taxPackages: taxPackagesSchema,
        currencies: currenciesSchema,
        exchangeRates: exchangeRatesSchema,
        cpgCategories: cpgCategoriesSchema,
        cpgInvoices: cpgInvoicesSchema,
        cpgVendors: cpgVendorsSchema,
        cpgDistributors: cpgDistributorsSchema,
        cpgDistributionCalculations: cpgDistributionCalculationsSchema,
        cpgSalesPromos: cpgSalesPromosSchema,
        cpgEvents: cpgEventsSchema,
        cpgFinishedProducts: cpgFinishedProductsSchema,
        cpgRecipes: cpgRecipesSchema,
        cpgProductLinks: cpgProductLinksSchema,
        cpgSettings: cpgSettingsSchema,
        cpgLaborRoles: cpgLaborRolesSchema,
        cpgProductLabors: cpgProductLaborsSchema,
        standaloneFinancials: standaloneFinancialsSchema,
        skuCountTrackers: skuCountTrackersSchema,
        userFeaturePreferences: userFeaturePreferencesSchema,
        tabPreferences: tabPreferencesSchema,
        backupAuditLogs: backupAuditLogsSchema,
      })
      .upgrade(async (tx) => {
        dbLogger.info('Migrating database to version 28 (fix schema versioning)');

        // Ensure all CPG categories have required fields
        await tx.table('cpgCategories').toCollection().modify((category: any) => {
          if (category.is_distribution_category === undefined) {
            category.is_distribution_category = false;
          }
          if (category.unit_of_measure === undefined) {
            category.unit_of_measure = 'each';
          }
        });

        dbLogger.info('Version 28 migration complete - all tables properly initialized');
      });

    // Version 29: Add Checklist Calendar tables
    this.version(29).stores({
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgVendors: cpgVendorsSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgEvents: cpgEventsSchema,
      cpgFinishedProducts: cpgFinishedProductsSchema,
      cpgRecipes: cpgRecipesSchema,
      cpgProductLinks: cpgProductLinksSchema,
      cpgSettings: cpgSettingsSchema,
      cpgLaborRoles: cpgLaborRolesSchema,
      cpgProductLabors: cpgProductLaborsSchema,
      standaloneFinancials: standaloneFinancialsSchema,
      skuCountTrackers: skuCountTrackersSchema,
      userFeaturePreferences: userFeaturePreferencesSchema,
      tabPreferences: tabPreferencesSchema,
      backupAuditLogs: backupAuditLogsSchema,
      // NEW: Checklist Calendar tables
      adminChecklists: adminChecklistsSchema,
      adminTasks: adminTasksSchema,
      adminTaskCompletions: adminTaskCompletionsSchema,
      adminTaskComments: adminTaskCommentsSchema,
      userChecklistPreferences: userChecklistPreferencesSchema,
      checklistWizardProgress: checklistWizardProgressSchema,
    });

    // Version 30: Add Procedure Instance tables for SOP management
    this.version(30).stores({
      // All existing tables remain unchanged
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgVendors: cpgVendorsSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgEvents: cpgEventsSchema,
      cpgFinishedProducts: cpgFinishedProductsSchema,
      cpgRecipes: cpgRecipesSchema,
      cpgProductLinks: cpgProductLinksSchema,
      cpgSettings: cpgSettingsSchema,
      cpgLaborRoles: cpgLaborRolesSchema,
      cpgProductLabors: cpgProductLaborsSchema,
      standaloneFinancials: standaloneFinancialsSchema,
      skuCountTrackers: skuCountTrackersSchema,
      userFeaturePreferences: userFeaturePreferencesSchema,
      tabPreferences: tabPreferencesSchema,
      backupAuditLogs: backupAuditLogsSchema,
      // Checklist Calendar tables (updated schema with checklist_type)
      adminChecklists: adminChecklistsSchema,
      adminTasks: adminTasksSchema,
      adminTaskCompletions: adminTaskCompletionsSchema,
      adminTaskComments: adminTaskCommentsSchema,
      userChecklistPreferences: userChecklistPreferencesSchema,
      checklistWizardProgress: checklistWizardProgressSchema,
      // NEW: Procedure Instance tables
      procedureInstances: procedureInstancesSchema,
      procedureTaskCompletions: procedureTaskCompletionsSchema,
    });

    // Version 31: Add cpgUnitConversions for weight↔volume conversions per category+variant
    this.version(31).stores({
      // All existing tables remain unchanged
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgVendors: cpgVendorsSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgEvents: cpgEventsSchema,
      cpgFinishedProducts: cpgFinishedProductsSchema,
      cpgRecipes: cpgRecipesSchema,
      cpgProductLinks: cpgProductLinksSchema,
      cpgSettings: cpgSettingsSchema,
      cpgLaborRoles: cpgLaborRolesSchema,
      cpgProductLabors: cpgProductLaborsSchema,
      cpgUnitConversions: cpgUnitConversionsSchema, // NEW: Weight↔volume conversions
      standaloneFinancials: standaloneFinancialsSchema,
      skuCountTrackers: skuCountTrackersSchema,
      userFeaturePreferences: userFeaturePreferencesSchema,
      tabPreferences: tabPreferencesSchema,
      backupAuditLogs: backupAuditLogsSchema,
      adminChecklists: adminChecklistsSchema,
      adminTasks: adminTasksSchema,
      adminTaskCompletions: adminTaskCompletionsSchema,
      adminTaskComments: adminTaskCommentsSchema,
      userChecklistPreferences: userChecklistPreferencesSchema,
      checklistWizardProgress: checklistWizardProgressSchema,
      procedureInstances: procedureInstancesSchema,
      procedureTaskCompletions: procedureTaskCompletionsSchema,
    });

    // Version 32: Add transaction groups for custom categorization
    this.version(32).stores({
      // All existing tables remain unchanged
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      charities: charitiesSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgVendors: cpgVendorsSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgEvents: cpgEventsSchema,
      cpgFinishedProducts: cpgFinishedProductsSchema,
      cpgRecipes: cpgRecipesSchema,
      cpgProductLinks: cpgProductLinksSchema,
      cpgSettings: cpgSettingsSchema,
      cpgLaborRoles: cpgLaborRolesSchema,
      cpgProductLabors: cpgProductLaborsSchema,
      cpgUnitConversions: cpgUnitConversionsSchema,
      standaloneFinancials: standaloneFinancialsSchema,
      skuCountTrackers: skuCountTrackersSchema,
      userFeaturePreferences: userFeaturePreferencesSchema,
      tabPreferences: tabPreferencesSchema,
      backupAuditLogs: backupAuditLogsSchema,
      adminChecklists: adminChecklistsSchema,
      adminTasks: adminTasksSchema,
      adminTaskCompletions: adminTaskCompletionsSchema,
      adminTaskComments: adminTaskCommentsSchema,
      userChecklistPreferences: userChecklistPreferencesSchema,
      checklistWizardProgress: checklistWizardProgressSchema,
      procedureInstances: procedureInstancesSchema,
      procedureTaskCompletions: procedureTaskCompletionsSchema,
      // NEW: Transaction groups for custom categorization
      transactionGroups: transactionGroupsSchema,
      transactionGroupAssignments: transactionGroupAssignmentsSchema,
    });

    // Version 33: Add Backup Preferences table for passphrase mode
    this.version(33).stores({
      // All existing tables remain unchanged
      accounts: accountsSchema,
      transactions: transactionsSchema,
      transactionLineItems: transactionLineItemsSchema,
      contacts: contactsSchema,
      products: productsSchema,
      users: usersSchema,
      companies: companiesSchema,
      companyUsers: companyUsersSchema,
      auditLogs: auditLogsSchema,
      sessions: sessionsSchema,
      devices: devicesSchema,
      receipts: receiptsSchema,
      categories: categoriesSchema,
      emailPreferences: emailPreferencesSchema,
      emailDelivery: emailDeliverySchema,
      invoices: invoicesSchema,
      invoiceTemplateCustomizations: invoiceTemplateCustomizationsSchema,
      recurringTransactions: recurringTransactionsSchema,
      generatedTransactions: generatedTransactionsSchema,
      categorizationModels: categorizationModelsSchema,
      trainingData: trainingDataSchema,
      suggestionHistory: suggestionHistorySchema,
      categorizationRules: categorizationRulesSchema,
      inventoryItems: inventoryItemsSchema,
      inventoryLayers: inventoryLayersSchema,
      inventoryTransactions: inventoryTransactionsSchema,
      stockTakes: stockTakesSchema,
      stockTakeItems: stockTakeItemsSchema,
      valuationMethodChanges: valuationMethodChangesSchema,
      portalTokens: portalTokensSchema,
      payments: paymentsSchema,
      approvalRules: approvalRulesSchema,
      approvalRequests: approvalRequestsSchema,
      approvalActions: approvalActionsSchema,
      approvalDelegations: approvalDelegationsSchema,
      approvalHistory: approvalHistorySchema,
      reportSchedules: reportScheduleSchema,
      scheduledReportDeliveries: scheduledReportDeliverySchema,
      recentActivity: recentActivitySchema,
      conflict_history: conflictHistorySchema,
      conflict_notifications: conflictNotificationsSchema,
      comments: commentsSchema,
      mentions: mentionsSchema,
      emailQueue: emailQueueSchema,
      emailLogs: emailLogsSchema,
      emailNotificationPreferences: emailNotificationPreferencesSchema,
      charities: charitiesSchema,
      subscriptions: subscriptionsSchema,
      advisorClients: advisorClientsSchema,
      advisorTeamMembers: advisorTeamMembersSchema,
      paymentMethods: paymentMethodsSchema,
      billingInvoices: billingInvoicesSchema,
      stripeWebhookEvents: stripeWebhookEventsSchema,
      charityDistributions: charityDistributionsSchema,
      financialGoals: financialGoalsSchema,
      goalProgressSnapshots: goalProgressSnapshotsSchema,
      taxDocuments: taxDocumentsSchema,
      taxCategoryStatus: taxCategoryStatusSchema,
      taxPrepSessions: taxPrepSessionsSchema,
      taxAdvisorAccess: taxAdvisorAccessSchema,
      taxPackages: taxPackagesSchema,
      currencies: currenciesSchema,
      exchangeRates: exchangeRatesSchema,
      cpgCategories: cpgCategoriesSchema,
      cpgInvoices: cpgInvoicesSchema,
      cpgVendors: cpgVendorsSchema,
      cpgDistributors: cpgDistributorsSchema,
      cpgDistributionCalculations: cpgDistributionCalculationsSchema,
      cpgSalesPromos: cpgSalesPromosSchema,
      cpgProductLinks: cpgProductLinksSchema,
      standaloneFinancials: standaloneFinancialsSchema,
      skuCountTrackers: skuCountTrackersSchema,
      cpgFinishedProducts: cpgFinishedProductsSchema,
      cpgRecipes: cpgRecipesSchema,
      cpgSettings: cpgSettingsSchema,
      cpgEvents: cpgEventsSchema,
      cpgLaborRoles: cpgLaborRolesSchema,
      cpgProductLabors: cpgProductLaborsSchema,
      cpgUnitConversions: cpgUnitConversionsSchema,
      userFeaturePreferences: userFeaturePreferencesSchema,
      tabPreferences: tabPreferencesSchema,
      backupAuditLogs: backupAuditLogsSchema,
      adminChecklists: adminChecklistsSchema,
      adminTasks: adminTasksSchema,
      adminTaskCompletions: adminTaskCompletionsSchema,
      adminTaskComments: adminTaskCommentsSchema,
      userChecklistPreferences: userChecklistPreferencesSchema,
      checklistWizardProgress: checklistWizardProgressSchema,
      procedureInstances: procedureInstancesSchema,
      procedureTaskCompletions: procedureTaskCompletionsSchema,
      transactionGroups: transactionGroupsSchema,
      transactionGroupAssignments: transactionGroupAssignmentsSchema,
      // NEW: Backup Preferences for passphrase mode
      backupPreferences: backupPreferencesSchema,
    });

    // Add hooks for automatic audit logging
    this.setupAuditHooks();

    // Add hooks for CRDT timestamp updates
    this.setupCRDTHooks();

    // DEV ONLY: Add guards for company_id mismatch (after db is ready)
    this.on('ready', () => {
      try {
        this.setupCompanyIdGuard();
      } catch (err) {
        console.warn('[DEV] Failed to setup company_id guards:', err);
      }
    });
  }

  /**
   * Setup audit logging hooks
   *
   * Note: Audit logging is handled at the service/store layer (src/services/audit.ts)
   * rather than in Dexie hooks because:
   *
   * 1. User context is required - We need userId, companyId for audit logs
   * 2. Hooks don't have access to application state
   * 3. We need control over what gets logged (e.g., not internal system operations)
   * 4. Some operations need before/after values which hooks don't easily provide
   *
   * See src/services/audit.ts for the audit service implementation.
   * Store modules (src/store/*.ts) call audit functions after successful operations.
   */
  private setupAuditHooks() {
    // No-op: Audit logging is handled at the service layer
    // See src/services/audit.ts for implementation
  }

  /**
   * Setup CRDT hooks
   * Automatically updates timestamps and version vectors
   */
  /**
   * DEV ONLY: Guard against writing records with company_id that doesn't match session.
   * This would have caught the cpg-demo vs demo-user-cpg split issue.
   *
   * SAFETY: This is wrapped in try/catch and checks table existence.
   * A dev diagnostic must never take down the app.
   */
  private setupCompanyIdGuard() {
    try {
      // Only in development mode
      if (typeof window === 'undefined' || !import.meta.env.DEV) {
        return;
      }

      // Get session company_id
      const getSessionCompanyId = (): string | null => {
        try {
          const session = sessionStorage.getItem('graceful_books_session');
          if (session) {
            const parsed = JSON.parse(session);
            // Handle both session formats
            return parsed.userId || parsed.user?.id || null;
          }
          // Fallback to localStorage
          const local = localStorage.getItem('graceful_books_user');
          if (local) {
            const parsed = JSON.parse(local);
            return parsed.companyId || null;
          }
        } catch {
          // Ignore parse errors
        }
        return null;
      };

      // Create a hook that validates company_id on insert
      const validateCompanyId = (tableName: string) => {
        return (primKey: unknown, obj: unknown) => {
          try {
            const record = obj as Record<string, unknown>;
            const recordCompanyId = record.company_id ?? record.companyId;

            const sessionCompanyId = getSessionCompanyId();

            // Check for null/undefined company_id - this creates orphaned records
            if (recordCompanyId === null || recordCompanyId === undefined) {
              const errorMsg = `[DEV GUARD] company_id is NULL/UNDEFINED in ${tableName}!\n` +
                `  This record will be orphaned and invisible to all sessions.\n` +
                `  Session company_id: "${sessionCompanyId || 'none'}"\n` +
                `  See HANDOFF.md "Known Architectural Constraints" for details.`;
              console.error(errorMsg);
              this.showCompanyIdWarning(tableName, 'NULL/UNDEFINED');
              return;
            }

            // Skip if no session (can't validate mismatch)
            if (!sessionCompanyId) return;

            // Check for mismatch
            if (recordCompanyId !== sessionCompanyId) {
              const errorMsg = `[DEV GUARD] company_id MISMATCH in ${tableName}!\n` +
                `  Record company_id: "${recordCompanyId}"\n` +
                `  Session company_id: "${sessionCompanyId}"\n` +
                `  This will cause data to become invisible to the current session.\n` +
                `  See HANDOFF.md "Known Architectural Constraints" for details.`;
              console.error(errorMsg);
              this.showCompanyIdWarning(tableName, 'MISMATCH');
            }
          } catch (err) {
            // Never let the guard crash a write operation
            console.warn(`[DEV GUARD] Error in validateCompanyId for ${tableName}:`, err);
          }
        };
      };

      // Helper to show visual warning (deduplicated)
      this.showCompanyIdWarning = (tableName: string, type: string) => {
        if (typeof document === 'undefined') return;
        const existing = document.getElementById('company-id-mismatch-warning');
        if (!existing) {
          const warning = document.createElement('div');
          warning.id = 'company-id-mismatch-warning';
          warning.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:12px;background:#7c2d12;color:white;font-family:monospace;font-size:12px;z-index:99999;text-align:center;';
          warning.innerHTML = `<strong>DEV WARNING:</strong> company_id ${type} in ${tableName}! Check console. <button onclick="this.parentElement.remove()" style="margin-left:10px;padding:2px 8px;">Dismiss</button>`;
          document.body.prepend(warning);
        }
      };

      // Safely add hook to a table (skip if table doesn't exist)
      const safeAddHook = (table: unknown, tableName: string) => {
        if (table && typeof (table as any).hook === 'function') {
          (table as any).hook('creating', validateCompanyId(tableName));
        }
      };

      // Apply to all CPG tables (safely)
      safeAddHook(this.cpgCategories, 'cpgCategories');
      safeAddHook(this.cpgInvoices, 'cpgInvoices');
      safeAddHook(this.cpgVendors, 'cpgVendors');
      safeAddHook(this.cpgDistributors, 'cpgDistributors');
      safeAddHook(this.cpgDistributionCalculations, 'cpgDistributionCalculations');
      safeAddHook(this.cpgSalesPromos, 'cpgSalesPromos');
      safeAddHook(this.cpgEvents, 'cpgEvents');
      safeAddHook(this.cpgFinishedProducts, 'cpgFinishedProducts');
      safeAddHook(this.cpgRecipes, 'cpgRecipes');
      safeAddHook(this.cpgProductLinks, 'cpgProductLinks');
      safeAddHook(this.cpgSettings, 'cpgSettings');
      safeAddHook(this.cpgLaborRoles, 'cpgLaborRoles');
      safeAddHook(this.cpgProductLabors, 'cpgProductLabors');
      safeAddHook(this.cpgUnitConversions, 'cpgUnitConversions');
      safeAddHook(this.cpgImpactScenarios, 'cpgImpactScenarios');
      safeAddHook(this.standaloneFinancials, 'standaloneFinancials');

      dbLogger.info('[DEV] company_id validation hooks installed on CPG tables');
    } catch (err) {
      // Never let guard setup crash the app
      console.warn('[DEV] Failed to setup company_id guards:', err);
    }
  }

  // Helper method for showing warnings (defined in setupCompanyIdGuard)
  private showCompanyIdWarning?: (tableName: string, type: string) => void;

  private setupCRDTHooks() {
    // Hook to update updated_at timestamp on modifications
    // Type-safe hook that works with any entity extending BaseEntity
    const updateTimestamp = <T extends BaseEntity>(
      modifications: UpdateSpec<T>
    ): UpdateSpec<T> => {
      return {
        ...modifications,
        updated_at: Date.now(),
      } as UpdateSpec<T>;
    };

    // Apply to all tables except audit logs (immutable)
    this.accounts.hook('updating', updateTimestamp);
    this.transactions.hook('updating', updateTimestamp);
    this.transactionLineItems.hook('updating', updateTimestamp);
    this.contacts.hook('updating', updateTimestamp);
    this.products.hook('updating', updateTimestamp);
    this.users.hook('updating', updateTimestamp);
    this.companies.hook('updating', updateTimestamp);
    this.companyUsers.hook('updating', updateTimestamp);
    this.sessions.hook('updating', updateTimestamp);
    this.devices.hook('updating', updateTimestamp);
    this.receipts.hook('updating', updateTimestamp);
    this.emailPreferences.hook('updating', updateTimestamp);
    this.emailDelivery.hook('updating', updateTimestamp);
    this.invoices.hook('updating', updateTimestamp);
    this.invoiceTemplateCustomizations.hook('updating', updateTimestamp);
    this.recurringTransactions.hook('updating', updateTimestamp);
    this.generatedTransactions.hook('updating', updateTimestamp);
    this.inventoryItems.hook('updating', updateTimestamp);
    this.inventoryLayers.hook('updating', updateTimestamp);
    this.inventoryTransactions.hook('updating', updateTimestamp);
    this.stockTakes.hook('updating', updateTimestamp);
    this.stockTakeItems.hook('updating', updateTimestamp);
    this.valuationMethodChanges.hook('updating', updateTimestamp);
    this.portalTokens.hook('updating', updateTimestamp);
    this.payments.hook('updating', updateTimestamp);
    this.currencies.hook('updating', updateTimestamp);
    this.exchangeRates.hook('updating', updateTimestamp);
    this.cpgCategories.hook('updating', updateTimestamp);
    this.cpgInvoices.hook('updating', updateTimestamp);
    this.cpgVendors.hook('updating', updateTimestamp);
    this.cpgDistributors.hook('updating', updateTimestamp);
    this.cpgDistributionCalculations.hook('updating', updateTimestamp);
    this.cpgSalesPromos.hook('updating', updateTimestamp);
    this.cpgEvents.hook('updating', updateTimestamp);
    this.cpgFinishedProducts.hook('updating', updateTimestamp);
    this.cpgRecipes.hook('updating', updateTimestamp);
    this.cpgProductLinks.hook('updating', updateTimestamp);
    this.cpgSettings.hook('updating', updateTimestamp);
    this.cpgLaborRoles.hook('updating', updateTimestamp);
    this.cpgProductLabors.hook('updating', updateTimestamp);
    this.cpgUnitConversions.hook('updating', updateTimestamp);
    this.standaloneFinancials.hook('updating', updateTimestamp);
    this.skuCountTrackers.hook('updating', updateTimestamp);
    // Checklist Calendar tables
    this.adminChecklists.hook('updating', updateTimestamp);
    this.adminTasks.hook('updating', updateTimestamp);
    this.adminTaskCompletions.hook('updating', updateTimestamp);
    this.adminTaskComments.hook('updating', updateTimestamp);
    this.userChecklistPreferences.hook('updating', updateTimestamp);
    this.checklistWizardProgress.hook('updating', updateTimestamp);
    // Procedure Instance tables
    this.procedureInstances.hook('updating', updateTimestamp);
    this.procedureTaskCompletions.hook('updating', updateTimestamp);
  }

  /**
   * Soft delete an entity by setting deleted_at timestamp
   */
  async softDelete<T extends { id: string; deleted_at: number | null }>(
    table: Table<T, string>,
    id: string
  ): Promise<void> {
    await table.update(id, {
      deleted_at: Date.now(),
    } as any);
  }

  /**
   * Restore a soft-deleted entity
   */
  async restore<T extends { id: string; deleted_at: number | null }>(
    table: Table<T, string>,
    id: string
  ): Promise<void> {
    await table.update(id, {
      deleted_at: null,
    } as any);
  }

  /**
   * Get all active (non-deleted) entities
   */
  async getActive<T extends { deleted_at: number | null }>(
    table: Table<T, string>
  ): Promise<T[]> {
    return table.filter((item) => item.deleted_at === null).toArray();
  }

  /**
   * Maximum allowed page size to prevent memory issues
   */
  static readonly MAX_PAGE_SIZE = 500;

  /**
   * Default page size
   */
  static readonly DEFAULT_PAGE_SIZE = 50;

  /**
   * Query with pagination
   *
   * @param collection - Dexie collection to paginate
   * @param page - Page number (1-indexed)
   * @param pageSize - Items per page (max 500)
   */
  async paginate<T>(
    collection: Dexie.Collection<T, string>,
    page: number = 1,
    pageSize: number = TreasureChestDB.DEFAULT_PAGE_SIZE
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // Enforce pagination limits
    const validPage = Math.max(1, Math.floor(page));
    const validPageSize = Math.min(
      Math.max(1, Math.floor(pageSize)),
      TreasureChestDB.MAX_PAGE_SIZE
    );

    const total = await collection.count();
    const offset = (validPage - 1) * validPageSize;
    const data = await collection.offset(offset).limit(validPageSize).toArray();

    return {
      data,
      total,
      page: validPage,
      pageSize: validPageSize,
      totalPages: Math.ceil(total / validPageSize),
    };
  }

  /**
   * Batch insert with transaction
   */
  async batchInsert<T>(table: Table<T, string>, items: T[]): Promise<void> {
    await this.transaction('rw', table, async () => {
      await table.bulkAdd(items);
    });
  }

  /**
   * Batch update with transaction
   */
  async batchUpdate<T extends { id: string }>(
    table: Table<T, string>,
    items: T[]
  ): Promise<void> {
    await this.transaction('rw', table, async () => {
      await table.bulkPut(items);
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    return await this.sessions
      .filter((session) => session.expires_at < now)
      .delete();
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanupOldAuditLogs(retentionPeriodDays: number): Promise<number> {
    const cutoffTime = Date.now() - retentionPeriodDays * 24 * 60 * 60 * 1000;
    return await this.auditLogs
      .filter((log) => log.timestamp < cutoffTime)
      .delete();
  }

  /**
   * Export all data for backup
   * Version 3: DYNAMIC - iterates db.tables at runtime
   *
   * Every table is included by default UNLESS it's in BACKUP_EXCLUDED_TABLES.
   * Adding a new table will automatically include it in backups.
   *
   * @param companyId - Company ID to filter records (REQUIRED for production backups).
   *   - Company-scoped tables (with company_id/companyId field) are filtered to match
   *   - User-scoped tables (in USER_SCOPED_TABLES) are exported without filtering
   *   - Pass null explicitly for tests that need to export ALL records
   *   - This ensures single-company backups without cross-contamination
   */
  async exportAllData(companyId: string | null): Promise<DatabaseExport> {
    dbLogger.info('Starting dynamic database export', { companyId: companyId || 'ALL' });

    const tables: Record<string, unknown[]> = {};
    const excludedTables: string[] = [];
    let totalRecords = 0;
    let filteredRecords = 0;

    // Get all table names from Dexie
    const allTableNames = this.tables.map((t) => t.name);
    dbLogger.debug('Found tables', { count: allTableNames.length, tables: allTableNames });

    // Export each table (unless excluded)
    for (const tableName of allTableNames) {
      // Check if table is excluded
      if (BACKUP_EXCLUDED_TABLES[tableName]) {
        excludedTables.push(tableName);
        dbLogger.debug(`Skipping excluded table: ${tableName}`, {
          reason: BACKUP_EXCLUDED_TABLES[tableName],
        });
        continue;
      }

      // Get the table and export its data
      try {
        const table = this.table(tableName);
        let data = await table.toArray();

        // Apply company_id filtering if companyId is a non-empty string
        // Skip filtering for user-scoped tables (they apply across all companies)
        // Pass null explicitly to skip filtering (for tests only)
        if (companyId && !USER_SCOPED_TABLES[tableName]) {
          const originalCount = data.length;
          data = data.filter((record: unknown) => {
            if (!record || typeof record !== 'object') return false;
            const rec = record as Record<string, unknown>;
            // Check both snake_case and camelCase variants
            return rec.company_id === companyId || rec.companyId === companyId;
          });
          filteredRecords += originalCount - data.length;

          if (originalCount !== data.length) {
            dbLogger.debug(`Filtered table: ${tableName}`, {
              original: originalCount,
              filtered: data.length,
              excluded: originalCount - data.length,
            });
          }
        }

        tables[tableName] = data;
        totalRecords += data.length;

        if (data.length > 0) {
          dbLogger.debug(`Exported table: ${tableName}`, { records: data.length });
        }
      } catch (err) {
        dbLogger.warn(`Failed to export table: ${tableName}`, { error: err });
        // Continue with other tables - don't fail entire export
      }
    }

    // Log summary
    const tablesWithData = Object.entries(tables).filter(([_, data]) => data.length > 0);
    dbLogger.info('Database export complete', {
      totalTables: allTableNames.length,
      exportedTables: Object.keys(tables).length,
      excludedTables: excludedTables.length,
      tablesWithData: tablesWithData.length,
      totalRecords,
      filteredRecords: companyId ? filteredRecords : 0,
      companyId: companyId || 'ALL',
    });

    return {
      version: 3, // Dynamic export version
      exported_at: Date.now(),
      tables,
      excludedTables,
      totalRecords,
    };
  }

  /**
   * Get list of all table names in the database
   * Useful for testing and validation
   */
  getAllTableNames(): string[] {
    return this.tables.map((t) => t.name);
  }

  /**
   * Get list of tables that would be exported (not excluded)
   */
  getExportedTableNames(): string[] {
    return this.tables
      .map((t) => t.name)
      .filter((name) => !BACKUP_EXCLUDED_TABLES[name]);
  }

  /**
   * Get list of excluded tables with reasons
   */
  getExcludedTablesWithReasons(): Record<string, string> {
    return { ...BACKUP_EXCLUDED_TABLES };
  }

  /**
   * Import data from backup
   * Supports all versions:
   * - Version 1: Core 11 tables only (legacy)
   * - Version 2: Core tables + extendedData object
   * - Version 3: Dynamic tables object
   *
   * Unknown tables in backup are skipped with a warning (partial restore).
   */
  async importAllData(backup: DatabaseExport): Promise<{
    importedTables: string[];
    skippedTables: string[];
    totalRecords: number;
  }> {
    // Version check - future versions should fail gracefully
    if (backup.version > 3) {
      throw new Error(
        `This backup was created with a newer version of the app (v${backup.version}). ` +
        `Please update to the latest version to restore this backup.`
      );
    }

    dbLogger.info('Starting database import', { version: backup.version });

    const importedTables: string[] = [];
    const skippedTables: string[] = [];
    let totalRecords = 0;

    // Build a unified tables map from any version
    const tablesToImport: Record<string, unknown[]> = {};

    if (backup.version === 3 && backup.tables) {
      // Version 3: Use tables directly
      Object.assign(tablesToImport, backup.tables);
    } else {
      // Version 1/2: Convert to unified format
      if (backup.data) {
        Object.entries(backup.data).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            tablesToImport[key] = value;
          }
        });
      }
      if (backup.extendedData) {
        Object.entries(backup.extendedData).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            tablesToImport[key] = value;
          }
        });
      }
    }

    // Get list of known tables in this database
    const knownTableNames = new Set(this.tables.map((t) => t.name));

    // First pass: Clear all tables that will receive data
    const tablesToClear: string[] = [];
    for (const tableName of Object.keys(tablesToImport)) {
      if (knownTableNames.has(tableName)) {
        tablesToClear.push(tableName);
      }
    }

    dbLogger.debug('Clearing tables for import', { tables: tablesToClear });
    for (const tableName of tablesToClear) {
      try {
        await this.table(tableName).clear();
      } catch (err) {
        dbLogger.warn(`Failed to clear table: ${tableName}`, { error: err });
      }
    }

    // Second pass: Import data into each table
    for (const [tableName, data] of Object.entries(tablesToImport)) {
      if (!Array.isArray(data) || data.length === 0) {
        continue; // Skip empty arrays
      }

      // Check if this table exists in current database
      if (!knownTableNames.has(tableName)) {
        dbLogger.warn(`Skipping unknown table from backup: ${tableName}`, {
          records: data.length,
        });
        skippedTables.push(tableName);
        continue;
      }

      // Import data
      try {
        const table = this.table(tableName);
        await table.bulkAdd(data as any[]);
        importedTables.push(tableName);
        totalRecords += data.length;
        dbLogger.debug(`Imported table: ${tableName}`, { records: data.length });
      } catch (err) {
        dbLogger.error(`Failed to import table: ${tableName}`, { error: err });
        skippedTables.push(tableName);
      }
    }

    // Log summary
    dbLogger.info('Database import complete', {
      importedTables: importedTables.length,
      skippedTables: skippedTables.length,
      totalRecords,
    });

    // Warn user if tables were skipped
    if (skippedTables.length > 0) {
      dbLogger.warn('Some tables from backup were skipped', {
        skippedTables,
        reason: 'Tables not recognized by current database version',
      });
    }

    return { importedTables, skippedTables, totalRecords };
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<DatabaseStatistics> {
    const [
      accountsCount,
      transactionsCount,
      contactsCount,
      productsCount,
      companiesCount,
      auditLogsCount,
    ] = await Promise.all([
      this.accounts.count(),
      this.transactions.count(),
      this.contacts.count(),
      this.products.count(),
      this.companies.count(),
      this.auditLogs.count(),
    ]);

    // Get database size estimate (IndexedDB doesn't provide exact size)
    let estimatedSize = 0;
    if (typeof navigator !== 'undefined' && navigator.storage && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      estimatedSize = estimate.usage || 0;
    }

    return {
      accounts: accountsCount,
      transactions: transactionsCount,
      contacts: contactsCount,
      products: productsCount,
      companies: companiesCount,
      auditLogs: auditLogsCount,
      estimatedSizeBytes: estimatedSize,
    };
  }

  /**
   * Get comprehensive statistics for ALL tables in the database.
   * Used for backup comparison to ensure no data is silently lost.
   * Returns per-table counts and total record count.
   */
  async getComprehensiveStatistics(): Promise<ComprehensiveStatistics> {
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    // Count all tables dynamically
    for (const table of this.tables) {
      try {
        const count = await table.count();
        tableCounts[table.name] = count;
        totalRecords += count;
      } catch (err) {
        dbLogger.warn(`Failed to count table: ${table.name}`, { error: err });
        tableCounts[table.name] = 0;
      }
    }

    return {
      tableCounts,
      totalRecords,
      tableCount: Object.keys(tableCounts).length,
    };
  }
}

/**
 * Tables that are USER-scoped (have user_id but NOT company_id).
 * These tables are exported WITHOUT company filtering because they
 * represent per-user settings that apply across all companies.
 *
 * Decision rationale: A user's UI preferences (pinned tabs, feature
 * activations) should travel with their backup regardless of which
 * company they're restoring. These are not financial data.
 */
export const USER_SCOPED_TABLES: Record<string, string> = {
  // Tab preferences - which tabs user has pinned per page
  tabPreferences: 'User preference: per-user UI state for tab pinning',

  // Feature preferences - which progressive features user has enabled
  userFeaturePreferences: 'User preference: per-user feature activation state',

  // Users table itself - user account data
  users: 'User account: user profile data (email, name, etc.)',
};

/**
 * Tables explicitly excluded from backup.
 * Every table MUST be either exported OR listed here with a reason.
 * Adding a table without making this decision will fail tests.
 */
export const BACKUP_EXCLUDED_TABLES: Record<string, string> = {
  // Sessions are ephemeral - they expire and user will re-authenticate
  sessions: 'Ephemeral: sessions expire and require re-authentication',

  // Devices can be re-registered on restore
  devices: 'Ephemeral: devices re-register on next use',

  // Email queue is transient - pending emails would be stale after restore
  emailQueue: 'Transient: pending emails would be stale after restore',

  // Email logs are operational history, not user data
  emailLogs: 'Operational: delivery logs are not user data',

  // Conflict history is sync-specific, not portable between databases
  conflict_history: 'Sync-specific: not portable between database instances',
  conflict_notifications: 'Sync-specific: notifications for resolved conflicts',

  // Recent activity is UI state (recent searches, views for quick-access menus)
  // NOT audit trail - auditLogs table IS backed up. Regenerates as user interacts.
  recentActivity: 'UI state: recent searches/views for quick-access, regenerates on use',

  // Portal tokens are auth tokens - would be invalid after restore
  portalTokens: 'Auth tokens: would be invalid in different context',

  // Stripe webhook events are operational logs
  stripeWebhookEvents: 'Operational: payment processor webhook history',

  // Billing invoices = OUR invoices TO the user for their Graceful Books subscription
  // Contains stripe_invoice_id references. Actual data lives in Stripe, resyncs via API.
  // NOT the user's business invoices (those are in `invoices` table, which IS backed up)
  billingInvoices: 'Platform billing: Stripe subscription invoices, resync via Stripe API',

  // Payment methods contain stripe_payment_method_id tokens, not actual card data
  // Real payment data lives in Stripe. Resyncs on next Stripe webhook/API call.
  paymentMethods: 'Platform billing: Stripe token references, resync via Stripe API',

  // Backup preferences contain stored passphrase/keys - must not be in backup!
  // Also contains file system handles which are device-specific
  backupPreferences: 'Security: contains local passphrase/key and device-specific file handles',
};

/**
 * Database export format
 * Version 3: Fully dynamic - exports all tables not in BACKUP_EXCLUDED_TABLES
 *
 * Backward compatibility:
 * - Version 1: Original 11-table format (accounts, transactions, etc.)
 * - Version 2: Added extendedData object with additional tables
 * - Version 3: Single `tables` object with all table data dynamically
 */
export interface DatabaseExport {
  version: number;
  exported_at: number;

  /**
   * Version 1/2 format: Fixed structure for backward compatibility
   * Only present in v1/v2 exports, not used in v3+
   */
  data?: {
    accounts: Account[];
    transactions: Transaction[];
    transactionLineItems: TransactionLineItem[];
    contacts: Contact[];
    products: Product[];
    users: User[];
    companies: Company[];
    companyUsers: CompanyUser[];
    auditLogs: AuditLog[];
    sessions: Session[];
    devices: Device[];
  };

  /**
   * Version 2 format: Extended data (deprecated in v3)
   */
  extendedData?: Record<string, unknown[]>;

  /**
   * Version 3+ format: All tables dynamically enumerated
   * Key is table name, value is array of records
   */
  tables?: Record<string, unknown[]>;

  /**
   * List of tables that were excluded from this export (with reasons)
   * Helps identify if a table was intentionally excluded vs missing
   */
  excludedTables?: string[];

  /**
   * Total record count across all exported tables
   */
  totalRecords?: number;
}

/**
 * Database statistics (legacy - limited tables)
 */
export interface DatabaseStatistics {
  accounts: number;
  transactions: number;
  contacts: number;
  products: number;
  companies: number;
  auditLogs: number;
  estimatedSizeBytes: number;
}

/**
 * Comprehensive statistics for ALL tables.
 * Used for backup comparison to prevent data loss.
 */
export interface ComprehensiveStatistics {
  /** Per-table record counts */
  tableCounts: Record<string, number>;
  /** Total records across all tables */
  totalRecords: number;
  /** Number of tables counted */
  tableCount: number;
}

/**
 * Singleton instance of the database
 */
export const db = new TreasureChestDB();

/**
 * Initialize database and perform any necessary migrations
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Open the database
    await db.open();
    dbLogger.info('TreasureChest database initialized successfully');

    // Clean up expired sessions on startup
    const cleanedSessions = await db.cleanupExpiredSessions();
    if (cleanedSessions > 0) {
      dbLogger.debug(`Cleaned up ${cleanedSessions} expired sessions`);
    }
  } catch (error) {
    dbLogger.error('Failed to initialize TreasureChest database', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  await db.close();
  dbLogger.info('TreasureChest database closed');
}

/**
 * Delete entire database (use with caution!)
 */
export async function deleteDatabase(): Promise<void> {
  await db.delete();
  dbLogger.warn('TreasureChest database deleted');
}

// Export the database instance as default
export default db;
