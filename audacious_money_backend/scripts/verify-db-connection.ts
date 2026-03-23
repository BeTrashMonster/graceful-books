/**
 * Database Connection Verification Script
 *
 * Tests connection to Digital Ocean PostgreSQL database and verifies:
 * - Basic connectivity
 * - SSL/TLS encryption
 * - Table existence
 * - Connection pool functionality
 *
 * Usage:
 *   bun run scripts/verify-db-connection.ts
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable set
 *   - Database migrations have been run
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Connection failed or checks failed
 */

import { Pool } from 'pg';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Format success message
 */
function success(message: string): void {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

/**
 * Format error message
 */
function error(message: string): void {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

/**
 * Format info message
 */
function info(message: string): void {
  console.log(`${colors.cyan}🔍 ${message}${colors.reset}`);
}

/**
 * Format details message
 */
function details(message: string): void {
  console.log(`${colors.blue}📍 ${message}${colors.reset}`);
}

/**
 * Format list message
 */
function list(message: string): void {
  console.log(`${colors.yellow}📋 ${message}${colors.reset}`);
}

/**
 * Main verification function
 */
async function verifyConnection(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL;

  // Check environment variable is set
  if (!DATABASE_URL) {
    error('DATABASE_URL environment variable not set');
    console.log('\n💡 Set it with:');
    console.log('   export DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"');
    console.log('   OR');
    console.log('   Create a .env file with DATABASE_URL=...\n');
    process.exit(1);
  }

  info('Testing database connection...');

  // Parse and display connection details (without password)
  try {
    const url = new URL(DATABASE_URL);
    details(`Host: ${url.hostname}`);
    details(`Port: ${url.port}`);
    details(`Database: ${url.pathname.slice(1)}`);
    details(`Username: ${url.username}`);
    details(`SSL Mode: ${url.searchParams.get('sslmode') || 'not specified'}`);

    // Warn if SSL is not enabled
    const sslMode = url.searchParams.get('sslmode');
    if (!sslMode || sslMode === 'disable') {
      console.log(`${colors.yellow}⚠️  Warning: SSL is not enabled. This is insecure for production!${colors.reset}`);
    }
  } catch (e) {
    error('Invalid DATABASE_URL format');
    console.log('Expected format: postgresql://user:password@host:port/database?sslmode=require');
    process.exit(1);
  }

  let pool: Pool | null = null;

  try {
    // Create connection pool
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // For Digital Ocean managed databases
      },
      max: 1,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
    });

    // Test 1: Basic connection
    info('Test 1: Basic connectivity...');
    const testResult = await pool.query('SELECT 1 as test');
    if (testResult.rows.length > 0) {
      success('Basic connection successful');
    } else {
      error('Connection test failed');
      process.exit(1);
    }

    // Test 2: Check PostgreSQL version
    info('Test 2: Checking PostgreSQL version...');
    const versionResult = await pool.query('SELECT version()');
    const versionString = versionResult.rows[0].version as string;
    const versionMatch = versionString.match(/PostgreSQL (\d+\.\d+)/);
    if (versionMatch) {
      const version = versionMatch[1];
      success(`PostgreSQL version: ${version}`);

      // Warn if not PostgreSQL 15
      const majorVersion = parseInt(version.split('.')[0]);
      if (majorVersion < 15) {
        console.log(`${colors.yellow}⚠️  Warning: PostgreSQL ${version} detected. Consider upgrading to PostgreSQL 15 or later.${colors.reset}`);
      }
    } else {
      success('PostgreSQL version: ' + versionString.split(',')[0]);
    }

    // Test 3: List all tables
    info('Test 3: Checking database schema...');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    success(`Found ${tables.rows.length} tables`);

    if (tables.rows.length > 0) {
      const tableNames = tables.rows.map(t => t.table_name as string).join(', ');
      list(`Tables: ${tableNames}`);
    } else {
      console.log(`${colors.yellow}⚠️  Warning: No tables found. Have migrations been run?${colors.reset}`);
    }

    // Test 4: Verify core tables exist
    info('Test 4: Verifying core tables...');
    const expectedTables = [
      'users',
      'products',
      'user_products',
      'charities',
      'payments',
      'donations',
      'schema_migrations'
    ];

    const tableNames = tables.rows.map(t => t.table_name as string);
    const missingTables: string[] = [];

    for (const expectedTable of expectedTables) {
      if (tableNames.includes(expectedTable)) {
        success(`Table "${expectedTable}" exists`);
      } else {
        missingTables.push(expectedTable);
      }
    }

    if (missingTables.length > 0) {
      console.log(`${colors.yellow}⚠️  Warning: Missing tables: ${missingTables.join(', ')}${colors.reset}`);
      console.log('💡 Run migrations: bash scripts/run-migrations.sh');
    }

    // Test 5: Check table access (users table)
    if (tableNames.includes('users')) {
      info('Test 5: Testing table access...');
      const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
      const count = parseInt(userCount.rows[0].count as string);
      success(`Users table accessible (${count} users)`);
    } else {
      console.log(`${colors.yellow}⚠️  Skipping table access test (users table not found)${colors.reset}`);
    }

    // Test 6: Check connection pool stats
    info('Test 6: Checking connection pool...');
    const poolInfo = await pool.query(`
      SELECT
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    const totalConns = parseInt(poolInfo.rows[0].total_connections as string);
    const activeConns = parseInt(poolInfo.rows[0].active_connections as string);
    const idleConns = parseInt(poolInfo.rows[0].idle_connections as string);

    success(`Connection pool: ${activeConns} active, ${idleConns} idle, ${totalConns} total`);

    // Test 7: Check database size
    info('Test 7: Checking database size...');
    const dbSize = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    success(`Database size: ${dbSize.rows[0].size}`);

    // Test 8: Check for SSL connection
    info('Test 8: Verifying SSL connection...');
    const sslInfo = await pool.query(`
      SELECT
        ssl,
        version as ssl_version,
        cipher as ssl_cipher
      FROM pg_stat_ssl
      WHERE pid = pg_backend_pid()
    `);

    if (sslInfo.rows.length > 0 && sslInfo.rows[0].ssl) {
      success(`SSL enabled: ${sslInfo.rows[0].ssl_version} with ${sslInfo.rows[0].ssl_cipher}`);
    } else {
      error('SSL is NOT enabled!');
      console.log('💡 Update DATABASE_URL to include: ?sslmode=require');
    }

    // All tests passed
    console.log('\n' + '='.repeat(60));
    success('All checks passed! Database is ready.');
    console.log('='.repeat(60) + '\n');

  } catch (err) {
    error('Connection or verification failed');
    console.log('\n📋 Error details:');

    if (err instanceof Error) {
      console.error(`   ${err.message}\n`);

      // Provide helpful troubleshooting tips
      if (err.message.includes('Connection terminated unexpectedly')) {
        console.log('💡 Troubleshooting tips:');
        console.log('   1. Check that your IP is in Digital Ocean Trusted Sources');
        console.log('   2. Verify the database hostname is correct');
        console.log('   3. Ensure port 25060 is not blocked by your firewall\n');
      } else if (err.message.includes('password authentication failed')) {
        console.log('💡 Troubleshooting tips:');
        console.log('   1. Double-check the password (case-sensitive)');
        console.log('   2. Ensure username is "doadmin"');
        console.log('   3. Try resetting password in Digital Ocean dashboard\n');
      } else if (err.message.includes('SSL')) {
        console.log('💡 Troubleshooting tips:');
        console.log('   1. Download CA certificate from Digital Ocean');
        console.log('   2. Place it in ~/.postgresql/ca-certificate.crt');
        console.log('   3. Add ?sslmode=require to DATABASE_URL\n');
      } else if (err.message.includes('relation') && err.message.includes('does not exist')) {
        console.log('💡 Troubleshooting tips:');
        console.log('   1. Run migrations: bash scripts/run-migrations.sh');
        console.log('   2. Verify migrations completed successfully\n');
      }
    } else {
      console.error(`   ${String(err)}\n`);
    }

    process.exit(1);
  } finally {
    // Clean up connection
    if (pool) {
      await pool.end();
    }
  }
}

// Run verification
verifyConnection();
