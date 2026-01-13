/**
 * Database Module Exports
 *
 * Central export point for all database-related functionality
 */

// Database instance and initialization
export {
  db,
  TreasureChestDB,
  initializeDatabase,
  closeDatabase,
  deleteDatabase,
} from './database';

export type {
  DatabaseExport,
  DatabaseStatistics,
} from './database';

// CRDT utilities
export {
  mergeVersionVectors,
  incrementVersionVector,
  compareVersionVectors,
  resolveConflict,
  mergeEntities,
  detectConflicts,
  resolveAllConflicts,
  isActive,
  createTombstone,
  restoreFromTombstone,
  updateEntity,
  generateDeviceId,
  getDeviceId,
  analyzeSyncOperation,
} from './crdt';

export type {
  SyncStatistics,
} from './crdt';

// Schema exports
export * from './schema/accounts.schema';
export * from './schema/transactions.schema';
export * from './schema/contacts.schema';
export * from './schema/products.schema';
export * from './schema/users.schema';
export * from './schema/audit.schema';

// Type exports
export * from '../types/database.types';
