/**
 * Verify admin password hash
 * Tests if a given password matches the stored hash
 */

import pkg from 'pg';
import { hash, verify } from '@node-rs/argon2';
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

async function verifyPassword(email, passwordToTest) {
  try {
    // Get the stored password hash
    const result = await pool.query(
      `SELECT id, email, password_hash FROM admin_users WHERE email = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      console.log(`No admin user found with email: ${email}`);
      return;
    }

    const user = result.rows[0];
    console.log('\n=== Password Verification ===');
    console.log(`Email: ${user.email}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Testing password: "${passwordToTest}"`);
    console.log(`Stored hash: ${user.password_hash.substring(0, 50)}...`);

    // Verify the password
    const isValid = await verify(user.password_hash, passwordToTest);

    console.log(`\nPassword match: ${isValid ? '✓ YES' : '✗ NO'}`);

    if (!isValid) {
      console.log('\n⚠️  Password does not match!');
      console.log('The password you entered does not match the stored hash.');
    } else {
      console.log('\n✓ Password is correct!');
    }
  } catch (error) {
    console.error('Error verifying password:', error);
  } finally {
    await pool.end();
  }
}

// Get email and password from command line arguments
const email = process.argv[2] || 'audrey@thegracefulpenny.com';
const password = process.argv[3] || 'MyPassword123!';

console.log('Usage: node verify-admin-password.mjs [email] [password]');
console.log(`Testing with email: ${email}\n`);

verifyPassword(email, password);
