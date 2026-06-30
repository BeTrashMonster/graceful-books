/**
 * Tag beta users with is_beta flag
 */
import { config } from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function tagBetaUsers() {
  try {
    console.log('🔍 Finding all users...');
    const usersResult = await pool.query(
      'SELECT id, email, first_name, is_beta FROM users ORDER BY created_at ASC'
    );
    
    console.log(`📊 Total users: ${usersResult.rows.length}`);
    console.log(`🎯 Tagging first 17 users as beta...\n`);

    const betaUsers = usersResult.rows.slice(0, 17);
    
    for (const user of betaUsers) {
      await pool.query(
        'UPDATE users SET is_beta = true WHERE id = $1',
        [user.id]
      );
      console.log(`✅ ${user.email} (${user.first_name}) - Tagged as beta`);
    }

    console.log(`\n🎉 Successfully tagged ${betaUsers.length} beta users!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

tagBetaUsers();
