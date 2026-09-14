/**
 * Soft-Delete Query Selectivity Measurement
 *
 * Measures actual row counts at each stage:
 * 1. Rows returned by index
 * 2. Rows after .and((x) => !x.deletedAt) filter
 *
 * This tells us if a compound [companyId+deletedAt] index is worth the migration cost.
 */

import { test, expect } from '../fixtures';
import { generateTestData, type DatasetSize } from '../seed';

// Test with 10k dataset
const DATASET_SIZE: DatasetSize = '10k';

test.describe('Soft-Delete Query Selectivity', () => {
  test('measure-selectivity-10k', async ({ page, testCompanyId, testDeviceId }) => {
    // Navigate to app first
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Generate 10k dataset
    console.log('[Selectivity] Generating 10k dataset...');
    const data = generateTestData({
      size: DATASET_SIZE,
      companyId: testCompanyId,
      deviceId: testDeviceId,
    });

    // Seed database
    console.log('[Selectivity] Seeding database...');
    const seedResult = await page.evaluate(async ({ accounts, contacts, products, transactions }) => {
      const { db } = await import('/src/store/database');

      await db.transaction('rw', [db.accounts, db.contacts, db.products, db.transactions], async () => {
        if (accounts.length > 0) await db.accounts.bulkPut(accounts);
        if (contacts.length > 0) await db.contacts.bulkPut(contacts);
        if (products.length > 0) await db.products.bulkPut(products);
        if (transactions.length > 0) await db.transactions.bulkPut(transactions);
      });

      return {
        accounts: accounts.length,
        contacts: contacts.length,
        products: products.length,
        transactions: transactions.length,
      };
    }, data);

    console.log(`[Selectivity] Seeded: ${JSON.stringify(seedResult)}`);

    // Now measure selectivity for top 5 soft-delete queries
    const selectivityResults = await page.evaluate(async (companyId: string) => {
      const { db } = await import('/src/store/database');

      const results: Array<{
        query: string;
        indexRows: number;
        afterFilter: number;
        filterOverhead: string;
      }> = [];

      // Query 1: queryTransactions - companyId index then deletedAt filter
      {
        const indexRecords = await db.transactions.where('companyId').equals(companyId).toArray();
        const indexRows = indexRecords.length;
        const afterFilter = indexRecords.filter((txn: any) => !txn.deletedAt).length;
        results.push({
          query: 'transactions.where(companyId).and(!deletedAt)',
          indexRows,
          afterFilter,
          filterOverhead: indexRows > 0 ? `${((1 - afterFilter / indexRows) * 100).toFixed(1)}% filtered out` : 'N/A',
        });
      }

      // Query 2: queryTransactions with status - compound index then deletedAt filter
      {
        const indexRecords = await db.transactions.where('[companyId+status]').equals([companyId, 'posted']).toArray();
        const indexRows = indexRecords.length;
        const afterFilter = indexRecords.filter((txn: any) => !txn.deletedAt).length;
        results.push({
          query: 'transactions.where([companyId+status]).and(!deletedAt)',
          indexRows,
          afterFilter,
          filterOverhead: indexRows > 0 ? `${((1 - afterFilter / indexRows) * 100).toFixed(1)}% filtered out` : 'N/A',
        });
      }

      // Query 3: queryAccounts - companyId index then deletedAt filter
      {
        const indexRecords = await db.accounts.where('companyId').equals(companyId).toArray();
        const indexRows = indexRecords.length;
        const afterFilter = indexRecords.filter((acc: any) => !acc.deletedAt).length;
        results.push({
          query: 'accounts.where(companyId).and(!deletedAt)',
          indexRows,
          afterFilter,
          filterOverhead: indexRows > 0 ? `${((1 - afterFilter / indexRows) * 100).toFixed(1)}% filtered out` : 'N/A',
        });
      }

      // Query 4: queryAccounts with type - compound index then deletedAt filter
      {
        const indexRecords = await db.accounts.where('[companyId+type]').equals([companyId, 'expense']).toArray();
        const indexRows = indexRecords.length;
        const afterFilter = indexRecords.filter((acc: any) => !acc.deletedAt).length;
        results.push({
          query: 'accounts.where([companyId+type]).and(!deletedAt)',
          indexRows,
          afterFilter,
          filterOverhead: indexRows > 0 ? `${((1 - afterFilter / indexRows) * 100).toFixed(1)}% filtered out` : 'N/A',
        });
      }

      // Query 5: contacts - companyId index then deletedAt filter
      {
        const indexRecords = await db.contacts.where('companyId').equals(companyId).toArray();
        const indexRows = indexRecords.length;
        const afterFilter = indexRecords.filter((c: any) => !c.deletedAt).length;
        results.push({
          query: 'contacts.where(companyId).and(!deletedAt)',
          indexRows,
          afterFilter,
          filterOverhead: indexRows > 0 ? `${((1 - afterFilter / indexRows) * 100).toFixed(1)}% filtered out` : 'N/A',
        });
      }

      // Check if deletedAt index even contains any records (records with deletedAt set)
      const allTransactions = await db.transactions.toArray();
      const allAccounts = await db.accounts.toArray();
      const allContacts = await db.contacts.toArray();

      const deletedAtIndexCount = {
        transactions: allTransactions.filter((t: any) => t.deletedAt !== undefined).length,
        accounts: allAccounts.filter((a: any) => a.deletedAt !== undefined).length,
        contacts: allContacts.filter((c: any) => c.deletedAt !== undefined).length,
      };

      return { results, deletedAtIndexCount };
    }, testCompanyId);

    // Output results
    console.log('\n================================================================================');
    console.log('SOFT-DELETE QUERY SELECTIVITY RESULTS (10k dataset)');
    console.log('================================================================================');
    console.log('\nTop 5 Queries - Index Rows vs After .and(!deletedAt) Filter:');
    console.log('--------------------------------------------------------------------------------');

    for (const r of selectivityResults.results) {
      console.log(`\n${r.query}`);
      console.log(`  Index rows:    ${r.indexRows}`);
      console.log(`  After filter:  ${r.afterFilter}`);
      console.log(`  Overhead:      ${r.filterOverhead}`);
    }

    console.log('\n--------------------------------------------------------------------------------');
    console.log('deletedAt Index Contains (records with deletedAt set):');
    console.log(`  transactions: ${selectivityResults.deletedAtIndexCount.transactions}`);
    console.log(`  accounts:     ${selectivityResults.deletedAtIndexCount.accounts}`);
    console.log(`  contacts:     ${selectivityResults.deletedAtIndexCount.contacts}`);
    console.log('================================================================================\n');

    // Assertions - just verify we got results
    expect(selectivityResults.results.length).toBe(5);
  });
});
