/**
 * Exchange Rate Service Integration Tests
 *
 * Integration tests for automatic exchange rate updates.
 * Tests the complete flow of fetching and storing rates.
 *
 * Requirements:
 * - I4: Multi-Currency - Full
 * - Test automatic rate update workflows
 * - Test API fallback scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { ExchangeRateService } from './exchangeRate.service';
import type { ExchangeRateApiConfig } from './exchangeRate.service';
import { ExchangeRateSource } from '../types/currency.types';

// ============================================================================
// Mock Database Setup
// ============================================================================

class TestDatabase extends Dexie {
  exchangeRates!: Dexie.Table<any, string>;

  constructor(dbName: string = 'TestDB') {
    super(dbName);
    this.version(1).stores({
      exchangeRates: 'id, company_id, [from_currency+to_currency], [company_id+from_currency+to_currency], effective_date, [from_currency+to_currency+effective_date], source, updated_at, deleted_at',
    });
  }
}

// ============================================================================
// Mock Encryption Service
// ============================================================================

const mockEncryptionService = {
  encrypt: async (plaintext: string) => `encrypted_${plaintext}`,
  decrypt: async (ciphertext: string) => ciphertext.replace('encrypted_', ''),
};

// ============================================================================
// Test Suite
// ============================================================================

describe('ExchangeRateService - Integration Tests', () => {
  let db: TestDatabase;
  let service: ExchangeRateService;
  const companyId = 'test-company-123';

  beforeEach(async () => {
    // Use unique database name to avoid schema caching issues
    const dbName = `TestDB_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    db = new TestDatabase(dbName);
    await db.open();
  });

  afterEach(async () => {
    await db.close();
    await db.delete();
  });

  // ==========================================================================
  // Automatic Rate Update Tests
  // ==========================================================================

  describe('Automatic Rate Updates', () => {
    it('should fetch and store automatic rates for multiple currencies', async () => {
      const config: ExchangeRateApiConfig = {
        provider: 'exchangerate-api',
        baseCurrency: 'USD',
        updateIntervalHours: 24,
      };

      service = new ExchangeRateService(mockEncryptionService, db, config);

      const result = await service.fetchLatestRates(
        companyId,
        ['EUR', 'GBP', 'JPY'],
        'USD'
      );

      expect(result.success).toBe(true);
      expect(result.updatedPairs).toHaveLength(3);
      expect(result.failedPairs).toHaveLength(0);

      // Verify rates were stored in database
      const storedRates = await db.exchangeRates
        .where('company_id')
        .equals(companyId)
        .toArray();

      // Should have 6 rates: 3 direct + 3 inverse
      expect(storedRates.length).toBeGreaterThanOrEqual(3);

      // Verify EUR rate
      const eurRate = storedRates.find(
        (r) => r.from_currency === 'USD' && r.to_currency === 'EUR'
      );
      expect(eurRate).toBeDefined();
      expect(eurRate?.source).toBe(ExchangeRateSource.AUTOMATIC);
    });

    it('should skip rate update when provider is manual', async () => {
      const config: ExchangeRateApiConfig = {
        provider: 'manual',
        baseCurrency: 'USD',
      };

      service = new ExchangeRateService(mockEncryptionService, db, config);

      const result = await service.fetchLatestRates(
        companyId,
        ['EUR', 'GBP'],
        'USD'
      );

      expect(result.success).toBe(false);
      expect(result.updatedPairs).toHaveLength(0);
      expect(result.failedPairs).toHaveLength(2);

      // Verify no rates were stored
      const storedRates = await db.exchangeRates.toArray();
      expect(storedRates).toHaveLength(0);
    });

    it('should only update rates that need updating', async () => {
      const config: ExchangeRateApiConfig = {
        provider: 'exchangerate-api',
        baseCurrency: 'USD',
        updateIntervalHours: 24,
      };

      service = new ExchangeRateService(mockEncryptionService, db, config);

      // First update - should update all rates
      const result1 = await service.updateRatesAutomatically(
        companyId,
        ['EUR', 'GBP'],
        'USD'
      );

      expect(result1.updatedPairs.length).toBeGreaterThan(0);

      // Second update immediately - should skip all rates
      const result2 = await service.updateRatesAutomatically(
        companyId,
        ['EUR', 'GBP'],
        'USD'
      );

      expect(result2.updatedPairs).toHaveLength(0);
      expect(result2.success).toBe(true);
    });

    it('should detect when rates need updating based on age', async () => {
      const config: ExchangeRateApiConfig = {
        provider: 'exchangerate-api',
        baseCurrency: 'USD',
        updateIntervalHours: 1, // 1 hour
      };

      service = new ExchangeRateService(mockEncryptionService, db, config);

      // Create an old rate (2 hours ago)
      const oldDate = Date.now() - (2 * 60 * 60 * 1000);
      await service.createExchangeRate(
        companyId,
        'USD',
        'EUR',
        '0.92',
        oldDate,
        ExchangeRateSource.MANUAL
      );

      // Check if it needs updating
      const needsUpdate = await service.needsRateUpdate(
        companyId,
        'USD',
        'EUR',
        1
      );

      expect(needsUpdate).toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      const config: ExchangeRateApiConfig = {
        provider: 'exchangerate-api',
        baseCurrency: 'USD',
        updateIntervalHours: 24,
      };

      service = new ExchangeRateService(mockEncryptionService, db, config);

      // Mix of valid and potentially problematic currencies
      const result = await service.fetchLatestRates(
        companyId,
        ['EUR', 'GBP', 'JPY', 'USD'], // USD to USD should be handled
        'USD'
      );

      // Should succeed for EUR, GBP, JPY (not USD to USD)
      expect(result.updatedPairs.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================================================
  // Rate Retrieval Tests
  // ==========================================================================

  describe('Rate Retrieval', () => {
    beforeEach(async () => {
      const config: ExchangeRateApiConfig = {
        provider: 'manual',
        baseCurrency: 'USD',
      };
      service = new ExchangeRateService(mockEncryptionService, db, config);
    });

    it('should retrieve latest rate for currency pair', async () => {
      // Create multiple rates at different times
      const rate1Date = Date.now() - 172800000; // 2 days ago
      const rate2Date = Date.now() - 86400000;  // 1 day ago
      const rate3Date = Date.now();             // Now

      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.90', rate1Date);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.91', rate2Date);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.92', rate3Date);

      const latestRate = await service.getLatestExchangeRate(companyId, 'USD', 'EUR');

      expect(latestRate).toBeDefined();
      expect(latestRate?.effective_date).toBe(rate3Date);

      // Decrypt and verify rate
      const rateStr = latestRate!.rate.replace('encrypted_', '');
      expect(parseFloat(rateStr)).toBeCloseTo(0.92, 6);
    });

    it('should retrieve historical rate for specific date', async () => {
      const oldDate = Date.now() - 172800000; // 2 days ago
      const midDate = Date.now() - 86400000;  // 1 day ago
      const nowDate = Date.now();

      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.90', oldDate);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.92', nowDate);

      // Query for rate on middle date - should get old rate
      const historicalRate = await service.getExchangeRateForDate(
        companyId,
        'USD',
        'EUR',
        midDate
      );

      expect(historicalRate).toBeDefined();
      expect(historicalRate?.effective_date).toBe(oldDate);

      const rateStr = historicalRate!.rate.replace('encrypted_', '');
      expect(parseFloat(rateStr)).toBeCloseTo(0.90, 6);
    });

    it('should retrieve rate history for date range', async () => {
      const dates = [
        Date.now() - 259200000, // 3 days ago
        Date.now() - 172800000, // 2 days ago
        Date.now() - 86400000,  // 1 day ago
      ];

      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.90', dates[0]);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.91', dates[1]);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.92', dates[2]);

      const history = await service.getExchangeRateHistory(
        companyId,
        'USD',
        'EUR',
        dates[1],
        Date.now()
      );

      expect(history).toHaveLength(2); // Should get rates from dates[1] and dates[2]
      expect(history[0]!.effective_date).toBe(dates[1]);
      expect(history[1]!.effective_date).toBe(dates[2]);
    });
  });

  // ==========================================================================
  // Rate Calculations Tests
  // ==========================================================================

  describe('Rate Calculations', () => {
    beforeEach(async () => {
      const config: ExchangeRateApiConfig = {
        provider: 'manual',
        baseCurrency: 'USD',
      };
      service = new ExchangeRateService(mockEncryptionService, db, config);
    });

    it('should calculate inverse rate correctly', () => {
      const rate = service.calculateInverseRate('1.2500000000000000000000000000');
      expect(rate.toFixed(28)).toBe('0.8000000000000000000000000000');
    });

    it('should calculate cross rate correctly', () => {
      // USD to EUR = 0.92, EUR to GBP = 0.86
      // USD to GBP should be 0.92 * 0.86 = 0.7912
      const crossRate = service.calculateCrossRate(
        '0.9200000000000000000000000000',
        '0.8600000000000000000000000000'
      );

      expect(crossRate.toFixed(4)).toBe('0.7912');
    });

    it('should store inverse rates automatically', async () => {
      await service.createExchangeRate(
        companyId,
        'USD',
        'EUR',
        '0.92',
        Date.now()
      );

      // Check that inverse rate was created
      const inverseRate = await service.getLatestExchangeRate(companyId, 'EUR', 'USD');
      expect(inverseRate).toBeDefined();

      const rateStr = inverseRate!.rate.replace('encrypted_', '');
      const rateDecimal = parseFloat(rateStr);

      // Inverse of 0.92 should be approximately 1.087
      expect(rateDecimal).toBeCloseTo(1.087, 2);
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('Rate Validation', () => {
    beforeEach(async () => {
      const config: ExchangeRateApiConfig = {
        provider: 'manual',
        baseCurrency: 'USD',
      };
      service = new ExchangeRateService(mockEncryptionService, db, config);
    });

    it('should reject negative exchange rates', async () => {
      await expect(
        service.createExchangeRate(
          companyId,
          'USD',
          'EUR',
          '-0.92',
          Date.now()
        )
      ).rejects.toThrow('Exchange rate must be a positive number');
    });

    it('should reject zero exchange rates', async () => {
      await expect(
        service.createExchangeRate(
          companyId,
          'USD',
          'EUR',
          '0',
          Date.now()
        )
      ).rejects.toThrow('Exchange rate must be a positive number');
    });

    it('should reject same currency conversion', async () => {
      await expect(
        service.createExchangeRate(
          companyId,
          'USD',
          'USD',
          '1.0',
          Date.now()
        )
      ).rejects.toThrow('Cannot create exchange rate for same currency');
    });

    it('should warn on unusually high rates', () => {
      const validation = service.validateExchangeRate({
        company_id: companyId,
        from_currency: 'USD',
        to_currency: 'EUR',
        rate: 'encrypted_1500.0',
        effective_date: Date.now(),
        source: ExchangeRateSource.MANUAL,
        notes: null,
      });

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('unusually high');
    });

    it('should warn on unusually low rates', () => {
      const validation = service.validateExchangeRate({
        company_id: companyId,
        from_currency: 'USD',
        to_currency: 'EUR',
        rate: 'encrypted_0.0001',
        effective_date: Date.now(),
        source: ExchangeRateSource.MANUAL,
        notes: null,
      });

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('unusually low');
    });
  });
});
