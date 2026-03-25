/**
 * Create Admin User Script
 *
 * Creates a super admin user account
 * Uses environment variables from .env file
 */

import pg from 'pg';
import { hash } from '@node-rs/argon2';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

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

async function createAdminUser(email, password, firstName, lastName) {
  console.log('👤 Creating admin user...\n');

  try {
    // Check if admin already exists
    const existing = await pool.query(
      'SELECT id FROM admin_users WHERE email = $1',
      [email]
    );

    if (existing.rowCount > 0) {
      console.log('❌ Admin user with this email already exists\n');
      return;
    }

    // Hash password using Argon2id
    console.log('🔒 Hashing password...');
    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    // Create admin user
    const result = await pool.query(
      `INSERT INTO admin_users (email, password_hash, first_name, last_name, role, active)
       VALUES ($1, $2, $3, $4, 'super_admin', true)
       RETURNING id, email, role`,
      [email, passwordHash, firstName, lastName]
    );

    const admin = result.rows[0];

    console.log('\n✅ Admin user created successfully!\n');
    console.log('📧 Email:', admin.email);
    console.log('👑 Role:', admin.role);
    console.log('🆔 ID:', admin.id);
    console.log('\n🔐 You can now log in at /admin/login\n');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Get command line arguments
const email = process.argv[2];
const password = process.argv[3];
const firstName = process.argv[4] || 'Admin';
const lastName = process.argv[5] || 'User';

if (!email || !password) {
  console.log('Usage: node create-admin-user.mjs <email> <password> [firstName] [lastName]');
  console.log('Example: node create-admin-user.mjs admin@example.com MySecurePassword123! Audrey Heesch\n');
  process.exit(1);
}

createAdminUser(email, password, firstName, lastName).catch(console.error);
