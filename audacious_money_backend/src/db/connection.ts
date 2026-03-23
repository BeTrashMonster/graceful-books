/**
 * Database connection module
 *
 * Provides PostgreSQL connection pool with proper SSL configuration
 */

import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export interface DatabaseConfig {
  connectionString?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Get SSL configuration for database connection
 */
function getSSLConfig() {
  // Path to CA certificate
  const caCertPath = path.join(process.cwd(), 'certs', 'ca-certificate.crt');

  // Check if CA certificate exists
  if (fs.existsSync(caCertPath)) {
    // Production: Use proper SSL with CA certificate verification
    return {
      rejectUnauthorized: true,
      ca: fs.readFileSync(caCertPath, 'utf8'),
    };
  } else {
    // Development: Allow connections without CA cert (but still use SSL)
    console.warn('[Database] CA certificate not found - using permissive SSL mode');
    console.warn('[Database] For production, ensure certs/ca-certificate.crt exists');
    return {
      rejectUnauthorized: false,
    };
  }
}

/**
 * Initialize database connection pool
 */
export function initializeDatabase(config?: DatabaseConfig): pg.Pool {
  if (pool) {
    return pool;
  }

  // Support both connection string and individual env vars
  const connectionString = config?.connectionString || process.env.DATABASE_URL;
  
  // Check for PostgreSQL environment variables
  const hasEnvVars = process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE;

  if (!connectionString && !hasEnvVars) {
    throw new Error('Database configuration missing. Set DATABASE_URL or PG* environment variables');
  }

  const sslConfig = getSSLConfig();

  // Create pool configuration
  const poolConfig: pg.PoolConfig = {
    max: config?.max || 20,
    idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config?.connectionTimeoutMillis || 10000,
    ssl: sslConfig,
  };

  // Add connection string or individual parameters
  if (connectionString) {
    poolConfig.connectionString = connectionString;
  } else {
    poolConfig.host = process.env.PGHOST;
    poolConfig.port = parseInt(process.env.PGPORT || '5432');
    poolConfig.database = process.env.PGDATABASE;
    poolConfig.user = process.env.PGUSER;
    poolConfig.password = process.env.PGPASSWORD;
  }

  pool = new Pool(poolConfig);

  // Error handler for the pool
  pool.on('error', (err) => {
    console.error('[Database] Unexpected error on idle client', err);
  });

  console.log('[Database] Connection pool initialized with SSL');

  return pool;
}

/**
 * Get database connection pool
 */
export function getDatabase(): pg.Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Health check - verify database connection is working
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  error?: string;
  responseTime?: number;
}> {
  if (!pool) {
    return {
      healthy: false,
      error: 'Database pool not initialized',
    };
  }

  const startTime = Date.now();

  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      return {
        healthy: true,
        responseTime,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime,
    };
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    console.log('[Database] Closing connection pool...');
    await pool.end();
    pool = null;
    console.log('[Database] Connection pool closed');
  }
}

/**
 * Execute a query with the connection pool
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const db = getDatabase();
  return db.query<T>(text, params);
}
