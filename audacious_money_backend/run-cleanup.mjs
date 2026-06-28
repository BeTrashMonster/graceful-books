import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanup() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking existing enrollments...\n');
    
    // Check what exists
    const checkResult = await client.query(`
      SELECT
        u.email,
        u.id as user_id,
        we.id as enrollment_id,
        w.workshop_name,
        we.enrolled_at
      FROM users u
      LEFT JOIN workshop_enrollments we ON we.user_id = u.id
      LEFT JOIN workshops w ON w.id = we.workshop_id
      WHERE u.email IN ('audrey@thegracefulpenny.com', 'audreyhutton614@gmail.com')
    `);
    
    console.table(checkResult.rows);
    
    console.log('\n🗑️  Clearing current_workshop_enrollment_id references...');
    const clearReferences = await client.query(`
      UPDATE users
      SET current_workshop_enrollment_id = NULL
      WHERE email IN ('audrey@thegracefulpenny.com', 'audreyhutton614@gmail.com')
    `);
    console.log(`   Cleared ${clearReferences.rowCount} reference(s)`);

    console.log('\n🗑️  Deleting workshop enrollments...');
    const deleteEnrollments = await client.query(`
      DELETE FROM workshop_enrollments
      WHERE user_id IN (
        SELECT id FROM users
        WHERE email IN ('audrey@thegracefulpenny.com', 'audreyhutton614@gmail.com')
      )
    `);
    console.log(`   Deleted ${deleteEnrollments.rowCount} enrollment(s)`);
    
    console.log('\n🗑️  Deleting charity selections...');
    const deleteCharity = await client.query(`
      DELETE FROM user_charity_selections
      WHERE user_id IN (
        SELECT id FROM users
        WHERE email IN ('audrey@thegracefulpenny.com', 'audreyhutton614@gmail.com')
      )
    `);
    console.log(`   Deleted ${deleteCharity.rowCount} charity selection(s)`);
    
    console.log('\n✅ Cleanup complete! You can now test signup again with these emails.\n');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
