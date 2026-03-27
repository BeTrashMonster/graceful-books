/**
 * Database connection module
 *
 * Provides PostgreSQL connection pool and health check functionality
 */

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export interface DatabaseConfig {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Initialize database connection pool
 */
export function initializeDatabase(config?: DatabaseConfig): pg.Pool {
  if (pool) {
    return pool;
  }

  const connectionString = config?.connectionString || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  pool = new Pool({
    connectionString,
    max: config?.max || 20,
    idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config?.connectionTimeoutMillis || 10000,
  });

  // Error handler for the pool
  pool.on('error', (err) => {
    console.error('[Database] Unexpected error on idle client', err);
  });

  console.log('[Database] Connection pool initialized');

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
