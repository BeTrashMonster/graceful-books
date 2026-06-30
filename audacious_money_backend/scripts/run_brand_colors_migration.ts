/**
 * Direct SQL execution for brand colors migration
 * Run this if migration system is having connectivity issues
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔗 Connected to database');
    console.log('🚀 Running brand colors migration...\n');

    // Run the migration SQL
    await client.query(`
      ALTER TABLE charities
      ADD COLUMN IF NOT EXISTS "brandColorBackground" TEXT,
      ADD COLUMN IF NOT EXISTS "brandColorTitle" TEXT,
      ADD COLUMN IF NOT EXISTS "brandColorDescription" TEXT;
    `);

    console.log('✅ Added brand color columns to charities table');

    // Add comments
    await client.query(`
      COMMENT ON COLUMN charities."brandColorBackground" IS 'Hex color code for charity card background (e.g., #4BA9A0)';
      COMMENT ON COLUMN charities."brandColorTitle" IS 'Hex color code for charity title/name text (e.g., #FFFFFF)';
      COMMENT ON COLUMN charities."brandColorDescription" IS 'Hex color code for charity description text (e.g., #FFFFFF)';
    `);

    console.log('✅ Added column comments');
    console.log('\n🎉 Migration completed successfully!');
    console.log('\nYou can now save brand colors through the admin dashboard.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
