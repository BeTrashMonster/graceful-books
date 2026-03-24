/**
 * Database Migration System for Audacious Money Backend
 *
 * This module provides a production-ready migration system with:
 * - Version tracking in schema_migrations table
 * - Transaction-based execution (atomic migrations)
 * - Automatic rollback on failures
 * - Audit logging for all migration operations
 * - Protection against running same migration twice
 *
 * Usage:
 *   bun run migrate:up     - Run all pending migrations
 *   bun run migrate:down   - Rollback last migration
 *   bun run migrate:status - Show migration status
 */

// Load environment variables first
import 'dotenv/config';

import { Client } from 'pg';
import { readdir, readFile } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Migration record structure
 */
interface Migration {
  id?: number;
  version: string;
  name: string;
  executedAt?: Date;
  success?: boolean;
  errorMessage?: string | null;
}

/**
 * Migration file structure
 */
interface MigrationFile {
  version: string;
  name: string;
  filename: string;
  path: string;
}

/**
 * Database client wrapper with connection management
 */
class MigrationClient {
  private client: Client;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.client = new Client({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false, // Accept self-signed certs from managed databases
      },
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  getClient(): Client {
    return this.client;
  }
}

/**
 * Migration System
 */
class MigrationSystem {
  private dbClient: MigrationClient;
  private migrationsDir: string;

  constructor(migrationsDir: string) {
    this.dbClient = new MigrationClient();
    this.migrationsDir = migrationsDir;
  }

  /**
   * Initialize the migration system by creating schema_migrations table
   */
  async initialize(): Promise<void> {
    await this.dbClient.connect();
    const client = this.dbClient.getClient();

    // Create schema_migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version
        ON schema_migrations(version);

      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at
        ON schema_migrations(executed_at DESC);
    `);

    console.log('✅ Migration system initialized');
  }

  /**
   * Get all migration files from the migrations directory
   */
  async getMigrationFiles(): Promise<MigrationFile[]> {
    try {
      const files = await readdir(this.migrationsDir);

      // Filter for .sql files and sort by version number
      const migrationFiles = files
        .filter(f => f.endsWith('.sql'))
        .map(filename => {
          // Expected format: 001_initial_schema.sql
          const match = filename.match(/^(\d+)_(.+)\.sql$/);
          if (!match) {
            throw new Error(`Invalid migration filename format: ${filename}. Expected format: 001_description.sql`);
          }

          const [, version, name] = match;
          return {
            version: version.padStart(3, '0'),
            name,
            filename,
            path: join(this.migrationsDir, filename),
          };
        })
        .sort((a, b) => a.version.localeCompare(b.version));

      return migrationFiles;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`⚠️  Migrations directory not found: ${this.migrationsDir}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Get executed migrations from database
   */
  async getExecutedMigrations(): Promise<Migration[]> {
    const client = this.dbClient.getClient();
    const result = await client.query<Migration>(
      'SELECT id, version, name, executed_at, success, error_message FROM schema_migrations ORDER BY version ASC'
    );
    return result.rows;
  }

  /**
   * Get pending migrations (files that haven't been executed)
   */
  async getPendingMigrations(): Promise<MigrationFile[]> {
    const allFiles = await this.getMigrationFiles();
    const executed = await this.getExecutedMigrations();
    const executedVersions = new Set(executed.map(m => m.version));

    return allFiles.filter(f => !executedVersions.has(f.version));
  }

  /**
   * Execute a single migration within a transaction
   */
  async executeMigration(migration: MigrationFile): Promise<void> {
    const client = this.dbClient.getClient();

    console.log(`\n🔄 Running migration ${migration.version}: ${migration.name}`);

    try {
      // Read migration SQL file
      const sql = await readFile(migration.path, 'utf-8');

      // Begin transaction
      await client.query('BEGIN');

      // Execute migration SQL
      await client.query(sql);

      // Record successful migration
      await client.query(
        `INSERT INTO schema_migrations (version, name, success)
         VALUES ($1, $2, $3)`,
        [migration.version, migration.name, true]
      );

      // Commit transaction
      await client.query('COMMIT');

      console.log(`✅ Migration ${migration.version} completed successfully`);
    } catch (error) {
      // Rollback on any error
      await client.query('ROLLBACK');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed migration
      try {
        await client.query(
          `INSERT INTO schema_migrations (version, name, success, error_message)
           VALUES ($1, $2, $3, $4)`,
          [migration.version, migration.name, false, errorMessage]
        );
      } catch (logError) {
        console.error('Failed to log migration error:', logError);
      }

      console.error(`❌ Migration ${migration.version} failed:`, errorMessage);
      throw new Error(`Migration ${migration.version} failed: ${errorMessage}`);
    }
  }

  /**
   * Run all pending migrations
   */
  async up(): Promise<void> {
    await this.initialize();

    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('\n✨ No pending migrations');
      return;
    }

    console.log(`\n📋 Found ${pending.length} pending migration(s):`);
    pending.forEach(m => console.log(`   - ${m.version}: ${m.name}`));

    for (const migration of pending) {
      await this.executeMigration(migration);
    }

    console.log(`\n✨ All migrations completed successfully!\n`);
  }

  /**
   * Rollback the last executed migration
   * Note: This requires migration files to have corresponding down scripts
   */
  async down(): Promise<void> {
    await this.initialize();

    const executed = await this.getExecutedMigrations();
    const successfulMigrations = executed.filter(m => m.success);

    if (successfulMigrations.length === 0) {
      console.log('\n⚠️  No migrations to rollback');
      return;
    }

    const lastMigration = successfulMigrations[successfulMigrations.length - 1];

    console.log(`\n⚠️  Warning: Rollback is a destructive operation!`);
    console.log(`   This will rollback: ${lastMigration.version} - ${lastMigration.name}`);
    console.log(`\n   Note: Manual rollback required. Create a new migration to reverse changes.`);
    console.log(`   Automatic rollback is not implemented to prevent data loss.\n`);

    // For production safety, we don't auto-rollback
    // Users should create new "down" migrations instead
  }

  /**
   * Show status of all migrations
   */
  async status(): Promise<void> {
    await this.initialize();

    const allFiles = await this.getMigrationFiles();
    const executed = await this.getExecutedMigrations();
    const executedMap = new Map(executed.map(m => [m.version, m]));

    console.log('\n📊 Migration Status:\n');
    console.log('Version | Status    | Name                          | Executed At');
    console.log('--------|-----------|-------------------------------|---------------------------');

    for (const file of allFiles) {
      const exec = executedMap.get(file.version);
      const status = exec
        ? (exec.success ? '✅ Done  ' : '❌ Failed')
        : '⏳ Pending';
      const executedAt = exec?.executedAt
        ? new Date(exec.executedAt).toISOString()
        : '-';

      console.log(
        `${file.version.padEnd(7)} | ${status} | ${file.name.padEnd(29)} | ${executedAt}`
      );
    }

    // Show failed migrations if any
    const failed = executed.filter(m => !m.success);
    if (failed.length > 0) {
      console.log('\n⚠️  Failed Migrations:\n');
      failed.forEach(m => {
        console.log(`   ${m.version}: ${m.name}`);
        console.log(`   Error: ${m.errorMessage}\n`);
      });
    }

    const pending = allFiles.length - executed.filter(m => m.success).length;
    console.log(`\n📈 Summary: ${executed.filter(m => m.success).length} completed, ${pending} pending, ${failed.length} failed\n`);
  }

  /**
   * Clean up and close connections
   */
  async cleanup(): Promise<void> {
    await this.dbClient.disconnect();
  }
}

/**
 * Main CLI handler
 */
async function main() {
  const command = process.argv[2];

  // Migrations directory is relative to this file
  // Node.js ESM: convert import.meta.url to directory path
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const migrationsDir = join(__dirname, 'migrations');

  const system = new MigrationSystem(migrationsDir);

  try {
    switch (command) {
      case 'up':
        await system.up();
        break;

      case 'down':
        await system.down();
        break;

      case 'status':
        await system.status();
        break;

      default:
        console.log(`
Database Migration System

Usage:
  bun run migrate:up     - Run all pending migrations
  bun run migrate:down   - Show rollback instructions
  bun run migrate:status - Show migration status

Environment Variables:
  DATABASE_URL - PostgreSQL connection string (required)

Example:
  DATABASE_URL="postgresql://user:pass@localhost:5432/audacious_money" bun run src/db/migrate.ts up
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await system.cleanup();
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { MigrationSystem, MigrationClient };
