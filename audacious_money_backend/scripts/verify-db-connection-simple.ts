/**
 * Simplified Database Connection Verification
 * Works with Digital Ocean's default SSL configuration
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  console.error('   Create a .env file with: DATABASE_URL=postgresql://...');
  process.exit(1);
}

console.log('🔍 Testing database connection...');
console.log('');

// Parse connection URL to show details (without password)
const urlObj = new URL(DATABASE_URL);
console.log(`📍 Host: ${urlObj.hostname}`);
console.log(`📍 Port: ${urlObj.port}`);
console.log(`📍 Database: ${urlObj.pathname.substring(1).split('?')[0]}`);
console.log(`📍 Username: ${urlObj.username}`);
console.log('');

async function testConnection() {
  // Check if CA certificate exists
  const caCertPath = path.join(process.cwd(), 'certs', 'ca-certificate.crt');
  const hasCaCert = fs.existsSync(caCertPath);

  let sslConfig: any;

  if (hasCaCert) {
    console.log('✅ Using CA certificate for SSL verification');
    sslConfig = {
      rejectUnauthorized: true,
      ca: fs.readFileSync(caCertPath).toString(),
    };
  } else {
    console.log('⚠️  No CA certificate found - using permissive SSL mode');
    console.log('   For production, download CA cert from Digital Ocean dashboard');
    console.log('   and save to: certs/ca-certificate.crt');
    console.log('');
    sslConfig = {
      rejectUnauthorized: false, // Accept self-signed for now
    };
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: sslConfig,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('🔄 Connecting to database...');
    const result = await pool.query('SELECT version(), current_database(), current_user');

    console.log('✅ Connection successful!');
    console.log('');
    console.log(`📊 PostgreSQL Version: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
    console.log(`📊 Database: ${result.rows[0].current_database}`);
    console.log(`📊 User: ${result.rows[0].current_user}`);
    console.log('');

    // Check if tables exist
    console.log('🔍 Checking for tables...');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tables.rows.length > 0) {
      console.log(`✅ Found ${tables.rows.length} tables:`);
      tables.rows.forEach((row: any) => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('⚠️  No tables found - migrations need to be run');
      console.log('   Run: .\\run-migrations.ps1');
    }

    console.log('');
    console.log('🎉 Database connection verified!');

    if (!hasCaCert) {
      console.log('');
      console.log('⚠️  NEXT STEP: Download CA certificate for production SSL');
      console.log('   1. Go to Digital Ocean dashboard → your database');
      console.log('   2. Download CA certificate');
      console.log('   3. Save to: certs/ca-certificate.crt');
      console.log('   4. Run this script again to verify SSL works properly');
    }

    await pool.end();
    process.exit(0);

  } catch (err: any) {
    console.error('❌ Connection failed!');
    console.error('');
    console.error('Error:', err.message);
    console.error('');
    console.error('Common fixes:');
    console.error('- Verify database is running in Digital Ocean dashboard');
    console.error('- Check firewall allows your IP (Settings → Trusted Sources)');
    console.error('- Verify connection string is correct');
    await pool.end();
    process.exit(1);
  }
}

testConnection();
