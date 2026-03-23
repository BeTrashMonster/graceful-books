/**
 * Run database migrations using TypeScript
 * No psql required - uses pg library directly
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

console.log('🚀 Running database migrations...');
console.log('');

// Check environment variables (must be set in .env file)
const host = process.env.PGHOST;
const port = process.env.PGPORT ? parseInt(process.env.PGPORT) : undefined;
const database = process.env.PGDATABASE;
const user = process.env.PGUSER;
const password = process.env.PGPASSWORD;

if (!host || !port || !database || !user || !password) {
  console.error('❌ Missing required environment variables');
  console.error('   Required: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD');
  console.error('   Make sure .env file exists with these variables');
  process.exit(1);
}

console.log(`Connecting to: ${host}:${port}/${database} as ${user}`);
console.log('');

// Read CA certificate
const caCert = fs.readFileSync('certs/ca-certificate.crt', 'utf8');

const pool = new Pool({
  host,
  port,
  database,
  user,
  password,
  ssl: {
    rejectUnauthorized: true,
    ca: caCert,
  },
});

async function runMigrations() {
  try {
    console.log('📡 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected');
    console.log('');

    // Get all migration files in order
    const migrationFiles = [
      'src/db/migrations/001_initial_schema.sql',
      'src/db/migrations/002_password_reset_tokens.sql',
    ];

    for (const file of migrationFiles) {
      console.log(`📝 Running ${path.basename(file)}...`);
      const sql = fs.readFileSync(file, 'utf8');

      try {
        await pool.query(sql);
        console.log(`   ✅ ${path.basename(file)} completed`);
      } catch (err: any) {
        if (err.message.includes('already exists')) {
          console.log(`   ℹ️  ${path.basename(file)} - tables already exist (skipping)`);
        } else {
          throw err;
        }
      }
    }

    console.log('');

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`✅ Database has ${result.rows.length} tables:`);
    result.rows.forEach((row: any) => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('');
    console.log('🎉 Phase A Complete! Database is ready!');
    console.log('');
    console.log('Next: Phase B - Deploy Backend API');
    console.log('Guide: docs\\DIGITAL_OCEAN_APP_DEPLOYMENT.md');

    await pool.end();
    process.exit(0);

  } catch (err: any) {
    console.error('❌ Migration failed');
    console.error('');
    console.error('Error:', err.message || 'Unknown error');
    console.error('');
    console.error('Full error details:');
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
