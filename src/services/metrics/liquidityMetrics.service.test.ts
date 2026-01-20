/**
 * Liquidity Metrics Service Tests
 *
 * Tests for J4: Key Financial Metrics Reports (Nice)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { LiquidityMetricsService } from './liquidityMetrics.service';
import type { TreasureChestDB } from '../../db/database';
import { AccountType, TransactionStatus } from '../../types/database.types';

describe('LiquidityMetricsService', () => {
  let db: TreasureChestDB;
  let service: LiquidityMetricsService;

  beforeEach(async () => {
    // Create in-memory test database
    db = new Dexie('TestDB') as TreasureChestDB;
    db.version(1).stores({
      accounts: 'id, company_id, type, account_number',
      transactions: 'id, company_id, transaction_date, type, status',
      transactionLineItems: 'id, transaction_id, account_id',
    });

    service = new LiquidityMetricsService(db);

    // Seed test data
    const companyId = 'test-company-1';
    const now = Date.now();

    await db.accounts?.add({
      id: 'asset-cash',
      company_id: companyId,
      account_number: '1000',
      name: 'Cash',
      type: AccountType.ASSET,
      parent_id: null,
      balance: '10000.00',
      description: 'Cash account',
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { test: 1 },
    });

    await db.accounts?.add({
      id: 'liability-ap',
      company_id: companyId,
      account_number: '2000',
      name: 'Accounts Payable',
      type: AccountType.LIABILITY,
      parent_id: null,
      balance: '5000.00',
      description: 'AP account',
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { test: 1 },
    });
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should calculate current ratio', async () => {
    const result = await service.calculateLiquidityMetrics({
      company_id: 'test-company-1',
      as_of_date: Date.now(),
      include_history: false,
    });

    expect(result).toBeDefined();
    expect(result.current_ratio).toBeDefined();
    expect(result.current_ratio.value).toBeDefined();
  });

  it('should calculate quick ratio', async () => {
    const result = await service.calculateLiquidityMetrics({
      company_id: 'test-company-1',
      as_of_date: Date.now(),
      include_history: false,
    });

    expect(result.quick_ratio).toBeDefined();
    expect(result.quick_ratio.value).toBeDefined();
  });

  it('should calculate working capital', async () => {
    const result = await service.calculateLiquidityMetrics({
      company_id: 'test-company-1',
      as_of_date: Date.now(),
      include_history: false,
    });

    expect(result.working_capital).toBeDefined();
    expect(result.working_capital.plain_english_explanation).toContain('working capital');
  });

  it('should include historical data when requested', async () => {
    const result = await service.calculateLiquidityMetrics({
      company_id: 'test-company-1',
      as_of_date: Date.now(),
      include_history: true,
    });

    expect(result.history).toBeDefined();
    expect(result.history.current_ratio).toBeInstanceOf(Array);
  });

  it('should not include historical data when not requested', async () => {
    const result = await service.calculateLiquidityMetrics({
      company_id: 'test-company-1',
      as_of_date: Date.now(),
      include_history: false,
    });

    expect(result.history.current_ratio).toHaveLength(0);
  });
});
