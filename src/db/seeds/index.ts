/**
 * Database Seed Scripts
 *
 * Centralized export for all seed scripts.
 * Run these to populate the database with initial data.
 */

export { seedCharities, clearCharities, reseedCharities } from './charities.seed';

/**
 * Seed all tables with initial data
 */
export async function seedAll() {
  const { seedCharities } = await import('./charities.seed');
  await seedCharities();
  console.log('All seeds completed successfully.');
}

/**
 * Clear all seeded data
 */
export async function clearAll() {
  const { clearCharities } = await import('./charities.seed');
  await clearCharities();
  console.log('All data cleared successfully.');
}
