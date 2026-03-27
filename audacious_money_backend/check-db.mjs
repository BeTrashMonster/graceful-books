import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

// Check tables
const tablesResult = await client.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema='public'
  ORDER BY table_name
`);

console.log('\n📋 Tables in database:');
tablesResult.rows.forEach(r => console.log(`   - ${r.table_name}`));

// Check migrations table
try {
  const migrationsResult = await client.query('SELECT version, name, executed_at, success FROM schema_migrations ORDER BY version');
  console.log('\n📊 Completed migrations:');
  migrationsResult.rows.forEach(m => console.log(`   - ${m.version}: ${m.name} (${m.success ? '✅' : '❌'})`));
} catch (e) {
  console.log('\n⚠️  No schema_migrations table found');
}

await client.end();
