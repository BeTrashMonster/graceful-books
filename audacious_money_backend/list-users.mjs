/**
 * List all users in database
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

// Load environment variables
dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function listUsers() {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, account_status, email_verified, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 10`
    );

    console.log('\n=== Recent Users ===');
    console.log(`Found ${result.rowCount} user(s)\n`);

    if (result.rowCount === 0) {
      console.log('No users found in database.');
    } else {
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.first_name} ${user.last_name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Status: ${user.account_status}`);
        console.log(`   Email Verified: ${user.email_verified}`);
        console.log(`   Created: ${user.created_at}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    await pool.end();
  }
}

listUsers();
