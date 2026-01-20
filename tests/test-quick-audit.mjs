// Quick test to verify audit log conversion works
import { db } from './src/store/database.js';
import { nanoid } from 'nanoid';

console.log('Testing audit log conversion...');

// Create a test audit log with snake_case (as stored in DB)
const testLog = {
  id: nanoid(),
  company_id: 'test-company',
  user_id: 'test-user',
  entity_type: 'TRANSACTION',
  entity_id: nanoid(),
  action: 'CREATE',
  before_value: null,
  after_value: JSON.stringify({ amount: 100 }),
  changed_fields: ['amount'],
  ip_address: '192.168.1.1',
  device_id: 'test-device',
  user_agent: 'Test Browser',
  timestamp: Date.now(),
  _encrypted: { beforeValues: false, afterValues: false }
};

try {
  // Add to database
  await db.auditLogs.add(testLog);
  console.log('✓ Added test log to database');

  // Query it back
  const result = await db.auditLogs.where('company_id').equals('test-company').toArray();
  console.log('✓ Queried back from database');
  console.log('  Record fields:', Object.keys(result[0]));
  console.log('  company_id:', result[0].company_id);
  console.log('  user_id:', result[0].user_id);

  // Clean up
  await db.auditLogs.clear();
  console.log('✓ Cleaned up');

  console.log('\n✅ Basic database operations work correctly');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
