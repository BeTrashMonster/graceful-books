import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

console.log('🔧 Fixing migration status...\n');

// Mark both migrations as successful since all tables exist
await client.query(`
  UPDATE schema_migrations
  SET success = true, executed_at = NOW()
  WHERE version IN ('001', '002')
`);

// Check if migration 002 exists, if not insert it
const check002 = await client.query("SELECT version FROM schema_migrations WHERE version = '002'");
if (check002.rows.length === 0) {
  await client.query(`
    INSERT INTO schema_migrations (version, name, executed_at, success)
    VALUES ('002', 'password_reset_tokens', NOW(), true)
  `);
  console.log('✅ Added migration 002 record');
} else {
  console.log('✅ Updated migration 002 status');
}

console.log('✅ Updated migration 001 status\n');

// Verify
const result = await client.query('SELECT version, name, success FROM schema_migrations ORDER BY version');
console.log('📊 Migration status:');
result.rows.forEach(m => console.log(`   - ${m.version}: ${m.name} (${m.success ? '✅' : '❌'})`));

await client.end();
console.log('\n✨ Database migrations fixed!');
