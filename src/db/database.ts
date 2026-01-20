/**
 * Database Initialization
 *
 * TreasureChest - The central database for Graceful Books
 * Implements local-first storage using Dexie.js (IndexedDB wrapper)
 * with CRDT-compatible schema design for offline-first multi-device sync.
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

    // Add hooks for automatic audit logging
    this.setupAuditHooks();

    // Add hooks for CRDT timestamp updates
    this.setupCRDTHooks();
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
   */
  async exportAllData(): Promise<DatabaseExport> {
    const [
      accounts,
      transactions,
      transactionLineItems,
      contacts,
      products,
      users,
      companies,
      companyUsers,
      auditLogs,
      sessions,
      devices,
    ] = await Promise.all([
      this.accounts.toArray(),
      this.transactions.toArray(),
      this.transactionLineItems.toArray(),
      this.contacts.toArray(),
      this.products.toArray(),
      this.users.toArray(),
      this.companies.toArray(),
      this.companyUsers.toArray(),
      this.auditLogs.toArray(),
      this.sessions.toArray(),
      this.devices.toArray(),
    ]);

    return {
      version: 1,
      exported_at: Date.now(),
      data: {
        accounts,
        transactions,
        transactionLineItems,
        contacts,
        products,
        users,
        companies,
        companyUsers,
        auditLogs,
        sessions,
        devices,
      },
    };
  }

  /**
   * Import data from backup
   */
  async importAllData(backup: DatabaseExport): Promise<void> {
    if (backup.version !== 1) {
      throw new Error(`Unsupported backup version: ${backup.version}`);
    }

    await this.transaction(
      'rw',
      [
        this.accounts,
        this.transactions,
        this.transactionLineItems,
        this.contacts,
        this.products,
        this.users,
        this.companies,
        this.companyUsers,
        this.auditLogs,
        this.sessions,
        this.devices,
      ],
      async () => {
        // Clear existing data
        await Promise.all([
          this.accounts.clear(),
          this.transactions.clear(),
          this.transactionLineItems.clear(),
          this.contacts.clear(),
          this.products.clear(),
          this.users.clear(),
          this.companies.clear(),
          this.companyUsers.clear(),
          this.auditLogs.clear(),
          this.sessions.clear(),
          this.devices.clear(),
        ]);

        // Import new data
        await Promise.all([
          this.accounts.bulkAdd(backup.data.accounts),
          this.transactions.bulkAdd(backup.data.transactions),
          this.transactionLineItems.bulkAdd(backup.data.transactionLineItems),
          this.contacts.bulkAdd(backup.data.contacts),
          this.products.bulkAdd(backup.data.products),
          this.users.bulkAdd(backup.data.users),
          this.companies.bulkAdd(backup.data.companies),
          this.companyUsers.bulkAdd(backup.data.companyUsers),
          this.auditLogs.bulkAdd(backup.data.auditLogs),
          this.sessions.bulkAdd(backup.data.sessions),
          this.devices.bulkAdd(backup.data.devices),
        ]);
      }
    );
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
    if ('estimate' in navigator.storage) {
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
}

/**
 * Database export format
 */
export interface DatabaseExport {
  version: number;
  exported_at: number;
  data: {
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
}

/**
 * Database statistics
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
