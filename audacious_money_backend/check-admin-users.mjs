/**
 * Check admin users in database
 * Uses environment variables for secure database connection
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

async function checkAdminUsers() {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, active, created_at, last_login_at
       FROM admin_users
       ORDER BY created_at DESC`
    );

    console.log('\n=== Admin Users ===');
    console.log(`Found ${result.rowCount} admin user(s)\n`);

    if (result.rowCount === 0) {
      console.log('No admin users found in database.');
    } else {
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.first_name} ${user.last_name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.active}`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Last Login: ${user.last_login_at || 'Never'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error checking admin users:', error);
  } finally {
    await pool.end();
  }
}

checkAdminUsers();
