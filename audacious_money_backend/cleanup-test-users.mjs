/**
 * Cleanup Test Users Script
 *
 * Deletes all user accounts so emails can be reused for testing
 * Uses environment variables from .env file
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database configuration from .env
const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: false, // Required for DigitalOcean managed databases
  },
});

async function cleanupTestUsers() {
  console.log('🧹 Cleaning up test users...\n');

  try {
    // Get count of users before deletion
    const beforeCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Users before cleanup: ${beforeCount.rows[0].count}`);

    // Delete all users (CASCADE will handle related records)
    const result = await pool.query('DELETE FROM users RETURNING email');

    console.log(`\n✅ Deleted ${result.rowCount} user(s):`);
    result.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.email}`);
    });

    // Verify cleanup
    const afterCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`\n📊 Users after cleanup: ${afterCount.rows[0].count}`);

    console.log('\n✨ Cleanup complete! You can now reuse any email address for testing.\n');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanupTestUsers().catch(console.error);
