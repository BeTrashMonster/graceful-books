/**
 * Currency Gain/Loss Service Tests
 *
 * Comprehensive unit tests for currency gain/loss calculations.
 * Tests all GAAP-compliant gain/loss scenarios.
 *
 * Requirements:
 * - I4: Multi-Currency - Full
 * - 100% test coverage for gain/loss algorithms
 * - Test edge cases and extreme scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import { CurrencyGainLossService } from './currencyGainLoss.service';
import type { ICurrencyGainLossService } from './currencyGainLoss.service';
import type { IExchangeRateService } from './exchangeRate.service';
import type { CurrencyConversionMetadata, ExchangeRate } from '../types/currency.types';
import { GainLossType, ExchangeRateSource } from '../types/currency.types';

// Configure Decimal.js
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Mock Services
// ============================================================================

const createMockExchangeRateService = (): IExchangeRateService => {
  return {
    getExchangeRateForDate: vi.fn(),
  } as any;
};

const createMockDb = () => ({
  transactions: {
    where: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
  },
  accounts: {
    where: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
  },
});

// ============================================================================
// Test Suite
// ============================================================================

describe('CurrencyGainLossService', () => {
  let service: ICurrencyGainLossService;
  let mockExchangeRateService: IExchangeRateService;
  let mockDb: any;

  const companyId = 'test-company-123';

  beforeEach(() => {
    mockExchangeRateService = createMockExchangeRateService();
    mockDb = createMockDb();
    service = new CurrencyGainLossService(mockExchangeRateService, companyId, mockDb);
  });

  // ==========================================================================
  // Realized Gain/Loss Tests
  // ==========================================================================

  describe('calculateRealizedGainLoss', () => {
    it('should calculate realized gain when exchange rate increases', async () => {
      // Setup: Invoice recorded at EUR/USD = 1.10, paid at 1.15
      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '1000.0000000000000000000000000000',
        exchange_rate: '1.1000000000000000000000000000',
        conversion_date: Date.now() - 86400000, // Yesterday
        base_currency_amount: '1100.0000000000000000000000000000', // 1000 * 1.10
        exchange_rate_id: 'rate-1',
      };

      const settlementDate = Date.now();

      // Mock exchange rate at settlement
      vi.mocked(mockExchangeRateService.getExchangeRateForDate).mockResolvedValue({
        id: 'rate-2',
        company_id: companyId,
        from_currency: 'EUR',
        to_currency: 'USD',
        rate: 'encrypted_1.1500000000000000000000000000',
        effective_date: settlementDate,
        source: ExchangeRateSource.AUTOMATIC,
        notes: null,
        created_at: settlementDate,
        updated_at: settlementDate,
        deleted_at: null,
        version_vector: {},
      });

      const result = await service.calculateRealizedGainLoss(
        'txn-123',
        null,
        originalConversion,
        settlementDate,
        'USD'
      );

      expect(result.type).toBe(GainLossType.REALIZED);
      expect(result.currency).toBe('EUR');
      expect(result.original_amount).toBe('1000.0000000000000000000000000000');
      expect(result.original_rate).toBe('1.1000000000000000000000000000');
      expect(result.current_rate).toBe('1.1500000000000000000000000000');

      // Expected gain: (1000 * 1.15) - (1000 * 1.10) = 1150 - 1100 = 50
      const expectedGain = new Decimal('50.0000000000000000000000000000');
      const actualGain = new Decimal(result.gain_loss_amount);
      expect(actualGain.equals(expectedGain)).toBe(true);
    });

    it('should calculate realized loss when exchange rate decreases', async () => {
      // Setup: Invoice recorded at EUR/USD = 1.15, paid at 1.10
      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '1000.0000000000000000000000000000',
        exchange_rate: '1.1500000000000000000000000000',
        conversion_date: Date.now() - 86400000,
        base_currency_amount: '1150.0000000000000000000000000000',
        exchange_rate_id: 'rate-1',
      };

      const settlementDate = Date.now();

      vi.mocked(mockExchangeRateService.getExchangeRateForDate).mockResolvedValue({
        id: 'rate-2',
        company_id: companyId,
        from_currency: 'EUR',
        to_currency: 'USD',
        rate: 'encrypted_1.1000000000000000000000000000',
        effective_date: settlementDate,
        source: ExchangeRateSource.AUTOMATIC,
        notes: null,
        created_at: settlementDate,
        updated_at: settlementDate,
        deleted_at: null,
        version_vector: {},
      });

      const result = await service.calculateRealizedGainLoss(
        'txn-123',
        null,
        originalConversion,
        settlementDate,
        'USD'
      );

      // Expected loss: (1000 * 1.10) - (1000 * 1.15) = 1100 - 1150 = -50
      const expectedLoss = new Decimal('-50.0000000000000000000000000000');
      const actualLoss = new Decimal(result.gain_loss_amount);
      expect(actualLoss.equals(expectedLoss)).toBe(true);
    });

    it('should calculate zero gain/loss when rate unchanged', async () => {
      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '1000.0000000000000000000000000000',
        exchange_rate: '1.1000000000000000000000000000',
        conversion_date: Date.now() - 86400000,
        base_currency_amount: '1100.0000000000000000000000000000',
        exchange_rate_id: 'rate-1',
      };

      const settlementDate = Date.now();

      vi.mocked(mockExchangeRateService.getExchangeRateForDate).mockResolvedValue({
        id: 'rate-2',
        company_id: companyId,
        from_currency: 'EUR',
        to_currency: 'USD',
        rate: 'encrypted_1.1000000000000000000000000000',
        effective_date: settlementDate,
        source: ExchangeRateSource.AUTOMATIC,
        notes: null,
        created_at: settlementDate,
        updated_at: settlementDate,
        deleted_at: null,
        version_vector: {},
      });

      const result = await service.calculateRealizedGainLoss(
        'txn-123',
        null,
        originalConversion,
        settlementDate,
        'USD'
      );

      const gainLoss = new Decimal(result.gain_loss_amount);
      expect(gainLoss.isZero()).toBe(true);
    });
  });

  describe('calculateRealizedGainLossForPayment', () => {
    it('should calculate gain on invoice payment', async () => {
      const paymentDate = Date.now();

      vi.mocked(mockExchangeRateService.getExchangeRateForDate).mockResolvedValue({
        id: 'rate-2',
        company_id: companyId,
        from_currency: 'GBP',
        to_currency: 'USD',
        rate: 'encrypted_1.3000000000000000000000000000',
        effective_date: paymentDate,
        source: ExchangeRateSource.AUTOMATIC,
        notes: null,
        created_at: paymentDate,
        updated_at: paymentDate,
        deleted_at: null,
        version_vector: {},
      });

      const result = await service.calculateRealizedGainLossForPayment(
        'payment-123',
        'invoice-456',
        '1000.0000000000000000000000000000',
        'GBP',
        '1.2500000000000000000000000000',
        paymentDate,
        'USD'
      );

      // Expected gain: (1000 * 1.30) - (1000 * 1.25) = 1300 - 1250 = 50
      const expectedGain = new Decimal('50.0000000000000000000000000000');
      const actualGain = new Decimal(result.gain_loss_amount);
      expect(actualGain.equals(expectedGain)).toBe(true);
      expect(result.type).toBe(GainLossType.REALIZED);
      expect(result.line_item_id).toBe('invoice-456');
    });
  });

  // ==========================================================================
  // Unrealized Gain/Loss Tests
  // ==========================================================================

  describe('calculateUnrealizedGainLoss', () => {
    it('should calculate unrealized gain on outstanding balance', async () => {
      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'JPY',
        original_amount: '100000.0000000000000000000000000000',
        exchange_rate: '0.0070000000000000000000000000',
        conversion_date: Date.now() - 2592000000, // 30 days ago
        base_currency_amount: '700.0000000000000000000000000000',
        exchange_rate_id: 'rate-1',
      };

      const revaluationDate = Date.now();

      vi.mocked(mockExchangeRateService.getExchangeRateForDate).mockResolvedValue({
        id: 'rate-2',
        company_id: companyId,
        from_currency: 'JPY',
        to_currency: 'USD',
        rate: 'encrypted_0.0075000000000000000000000000',
        effective_date: revaluationDate,
        source: ExchangeRateSource.AUTOMATIC,
        notes: null,
        created_at: revaluationDate,
        updated_at: revaluationDate,
        deleted_at: null,
        version_vector: {},
      });

      const result = await service.calculateUnrealizedGainLoss(
        'account-123',
        originalConversion,
        revaluationDate,
        'USD'
      );

      expect(result.type).toBe(GainLossType.UNREALIZED);

      // Expected gain: (100000 * 0.0075) - (100000 * 0.0070) = 750 - 700 = 50
      const expectedGain = new Decimal('50.0000000000000000000000000000');
      const actualGain = new Decimal(result.gain_loss_amount);
      expect(actualGain.equals(expectedGain)).toBe(true);
    });

    it('should calculate unrealized loss on outstanding balance', async () => {
      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'CAD',
        original_amount: '1000.0000000000000000000000000000',
        exchange_rate: '0.7500000000000000000000000000',
        conversion_date: Date.now() - 2592000000,
        base_currency_amount: '750.0000000000000000000000000000',
        exchange_rate_id: 'rate-1',
      };

      const revaluationDate = Date.now();

      vi.mocked(mockExchangeRateService.getExchangeRateForDate).mockResolvedValue({
        id: 'rate-2',
        company_id: companyId,
        from_currency: 'CAD',
        to_currency: 'USD',
        rate: 'encrypted_0.7000000000000000000000000000',
        effective_date: revaluationDate,
        source: ExchangeRateSource.AUTOMATIC,
        notes: null,
        created_at: revaluationDate,
        updated_at: revaluationDate,
        deleted_at: null,
        version_vector: {},
      });

      const result = await service.calculateUnrealizedGainLoss(
        'account-123',
        originalConversion,
        revaluationDate,
        'USD'
      );

      // Expected loss: (1000 * 0.70) - (1000 * 0.75) = 700 - 750 = -50
      const expectedLoss = new Decimal('-50.0000000000000000000000000000');
      const actualLoss = new Decimal(result.gain_loss_amount);
      expect(actualLoss.equals(expectedLoss)).toBe(true);
    });
  });

  describe('calculateUnrealizedGainLossForBalance', () => {
    it('should calculate unrealized gain for account balance', async () => {
      const revaluationDate = Date.now();

      vi.mocked(mockExchangeRateService.getExchangeRateForDate).mockResolvedValue({
        id: 'rate-2',
        company_id: companyId,
        from_currency: 'EUR',
        to_currency: 'USD',
        rate: 'encrypted_1.1500000000000000000000000000',
        effective_date: revaluationDate,
        source: ExchangeRateSource.AUTOMATIC,
        notes: null,
        created_at: revaluationDate,
        updated_at: revaluationDate,
        deleted_at: null,
        version_vector: {},
      });

      const result = await service.calculateUnrealizedGainLossForBalance(
        'account-123',
        'EUR',
        '5000.0000000000000000000000000000',
        '1.1000000000000000000000000000',
        revaluationDate,
        'USD'
      );

      // Expected gain: (5000 * 1.15) - (5000 * 1.10) = 5750 - 5500 = 250
      const expectedGain = new Decimal('250.0000000000000000000000000000');
      const actualGain = new Decimal(result.gain_loss_amount);
      expect(actualGain.equals(expectedGain)).toBe(true);
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe('getTotalGainLoss', () => {
    it('should calculate total from multiple gain/loss entries', () => {
      const gainLosses = [
        createGainLoss('txn-1', '100.0000000000000000000000000000', GainLossType.REALIZED),
        createGainLoss('txn-2', '-50.0000000000000000000000000000', GainLossType.REALIZED),
        createGainLoss('txn-3', '75.0000000000000000000000000000', GainLossType.UNREALIZED),
      ];

      const total = service.getTotalGainLoss(gainLosses);

      // Expected: 100 - 50 + 75 = 125
      expect(total.toFixed(28)).toBe('125.0000000000000000000000000000');
    });

    it('should return zero for empty array', () => {
      const total = service.getTotalGainLoss([]);
      expect(total.isZero()).toBe(true);
    });
  });

  describe('separateByType', () => {
    it('should separate realized and unrealized gains/losses', () => {
      const gainLosses = [
        createGainLoss('txn-1', '100', GainLossType.REALIZED),
        createGainLoss('txn-2', '50', GainLossType.UNREALIZED),
        createGainLoss('txn-3', '-25', GainLossType.REALIZED),
        createGainLoss('txn-4', '75', GainLossType.UNREALIZED),
      ];

      const { realized, unrealized } = service.separateByType(gainLosses);

      expect(realized).toHaveLength(2);
      expect(unrealized).toHaveLength(2);
      expect(realized[0].type).toBe(GainLossType.REALIZED);
      expect(unrealized[0].type).toBe(GainLossType.UNREALIZED);
    });
  });

  describe('groupByCurrency', () => {
    it('should group gains/losses by currency', () => {
      const gainLosses = [
        createGainLoss('txn-1', '100', GainLossType.REALIZED, 'EUR'),
        createGainLoss('txn-2', '50', GainLossType.REALIZED, 'GBP'),
        createGainLoss('txn-3', '-25', GainLossType.REALIZED, 'EUR'),
        createGainLoss('txn-4', '75', GainLossType.REALIZED, 'GBP'),
      ];

      const grouped = service.groupByCurrency(gainLosses);

      expect(grouped.size).toBe(2);
      expect(grouped.get('EUR')).toHaveLength(2);
      expect(grouped.get('GBP')).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very large amounts', async () => {
      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '999999999.0000000000000000000000000000',
        exchange_rate: '1.1000000000000000000000000000',
        conversion_date: Date.now() - 86400000,
        base_currency_amount: '1099999998.9000000000000000000000000000',
        exchange_rate_id: 'rate-1',
      };

      const settlementDate = Date.now();

      vi.mocked(mockExchangeRateService.getExchangeRateForDate).mockResolvedValue({
        id: 'rate-2',
        company_id: companyId,
        from_currency: 'EUR',
        to_currency: 'USD',
        rate: 'encrypted_1.1500000000000000000000000000',
        effective_date: settlementDate,
        source: ExchangeRateSource.AUTOMATIC,
        notes: null,
        created_at: settlementDate,
        updated_at: settlementDate,
        deleted_at: null,
        version_vector: {},
      });

      const result = await service.calculateRealizedGainLoss(
        'txn-123',
        null,
        originalConversion,
        settlementDate,
        'USD'
      );

      const gainLoss = new Decimal(result.gain_loss_amount);
      expect(gainLoss.isFinite()).toBe(true);
      expect(gainLoss.gt(0)).toBe(true);
    });

    it('should handle very small amounts with precision', async () => {
      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '0.0000000100000000000000000000',
        exchange_rate: '1.1000000000000000000000000000',
        conversion_date: Date.now() - 86400000,
        base_currency_amount: '0.0000000110000000000000000000',
        exchange_rate_id: 'rate-1',
      };

      const settlementDate = Date.now();

      vi.mocked(mockExchangeRateService.getExchangeRateForDate).mockResolvedValue({
        id: 'rate-2',
        company_id: companyId,
        from_currency: 'EUR',
        to_currency: 'USD',
        rate: 'encrypted_1.1500000000000000000000000000',
        effective_date: settlementDate,
        source: ExchangeRateSource.AUTOMATIC,
        notes: null,
        created_at: settlementDate,
        updated_at: settlementDate,
        deleted_at: null,
        version_vector: {},
      });

      const result = await service.calculateRealizedGainLoss(
        'txn-123',
        null,
        originalConversion,
        settlementDate,
        'USD'
      );

      const gainLoss = new Decimal(result.gain_loss_amount);
      expect(gainLoss.isFinite()).toBe(true);
      // Very small gain should be calculated precisely
      expect(gainLoss.gt(0)).toBe(true);
    });

    it('should handle extreme exchange rate volatility', async () => {
      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'TRY',
        original_amount: '1000.0000000000000000000000000000',
        exchange_rate: '0.0500000000000000000000000000', // 1 TRY = 0.05 USD
        conversion_date: Date.now() - 86400000,
        base_currency_amount: '50.0000000000000000000000000000',
        exchange_rate_id: 'rate-1',
      };

      const settlementDate = Date.now();

      vi.mocked(mockExchangeRateService.getExchangeRateForDate).mockResolvedValue({
        id: 'rate-2',
        company_id: companyId,
        from_currency: 'TRY',
        to_currency: 'USD',
        rate: 'encrypted_0.0300000000000000000000000000', // 40% devaluation
        effective_date: settlementDate,
        source: ExchangeRateSource.AUTOMATIC,
        notes: null,
        created_at: settlementDate,
        updated_at: settlementDate,
        deleted_at: null,
        version_vector: {},
      });

      const result = await service.calculateRealizedGainLoss(
        'txn-123',
        null,
        originalConversion,
        settlementDate,
        'USD'
      );

      // Expected loss: (1000 * 0.03) - (1000 * 0.05) = 30 - 50 = -20
      const expectedLoss = new Decimal('-20.0000000000000000000000000000');
      const actualLoss = new Decimal(result.gain_loss_amount);
      expect(actualLoss.equals(expectedLoss)).toBe(true);
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function createGainLoss(
  txnId: string,
  amount: string,
  type: GainLossType,
  currency: 'EUR' | 'GBP' | 'USD' = 'EUR'
) {
  return {
    transaction_id: txnId,
    line_item_id: null,
    type,
    currency,
    original_amount: '1000.0000000000000000000000000000',
    original_rate: '1.1000000000000000000000000000',
    current_rate: '1.1500000000000000000000000000',
    gain_loss_amount: amount,
    calculation_date: Date.now(),
  };
}
