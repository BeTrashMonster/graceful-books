/**
 * Currency Conversion Service Tests
 *
 * Tests for currency conversion, gain/loss calculations, and revaluations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  CurrencyConversionService,
  roundToCurrencyPrecision,
  calculatePercentageDifference,
  formatGainLoss,
  isGain,
  isLoss,
  calculateTotalGainLoss,
  separateGainLossByType,
  groupGainLossByCurrency,
  calculateTotalGainLossByCurrency,
  validateConversionMetadata,
  recalculateBaseCurrencyAmount,
  needsRevaluation
} from './currencyConversion.service';
import { GainLossType, ExchangeRateSource } from '../types/currency.types';
import type {
  CurrencyConversionRequest,
  CurrencyConversionMetadata,
  CurrencyGainLoss,
  ExchangeRate,
} from '../types/currency.types';
import type { IExchangeRateService } from './exchangeRate.service';

// Mock exchange rate service
class MockExchangeRateService implements Partial<IExchangeRateService> {
  private rates: Map<string, ExchangeRate> = new Map();

  addRate(fromCurrency: string, toCurrency: string, rate: string, date: number) {
    const key = `${fromCurrency}-${toCurrency}-${date}`;
    this.rates.set(key, {
      id: key,
      company_id: 'test-company',
      from_currency: fromCurrency as any,
      to_currency: toCurrency as any,
      rate,
      effective_date: date,
      source: ExchangeRateSource.MANUAL,
      notes: null,
      created_at: date,
      updated_at: date,
      deleted_at: null,
      version_vector: {},
    });
  }

  async getExchangeRateForDate(
    _companyId: string,
    fromCurrency: any,
    toCurrency: any,
    date: number
  ): Promise<ExchangeRate | null> {
    // Find the most recent rate on or before the date
    const matchingRates = Array.from(this.rates.values()).filter(
      r => r.from_currency === fromCurrency &&
           r.to_currency === toCurrency &&
           r.effective_date <= date
    );

    if (matchingRates.length === 0) return null;

    const sorted = matchingRates.sort((a, b) => b.effective_date - a.effective_date);
    return sorted[0] || null;
  }
}

describe('CurrencyConversionService', () => {
  let service: CurrencyConversionService;
  let mockExchangeRateService: MockExchangeRateService;
  const companyId = 'test-company-id';

  beforeEach(() => {
    mockExchangeRateService = new MockExchangeRateService();
    service = new CurrencyConversionService(
      mockExchangeRateService as any,
      companyId
    );
  });

  describe('convertAmount', () => {
    it('should convert USD to EUR correctly', async () => {
      const date = Date.now();
      mockExchangeRateService.addRate('USD', 'EUR', '0.85', date);

      const result = await service.convertAmount('100', 'USD', 'EUR', date);

      expect(result.original_amount).toBe('100.0000000000000000000000000000');
      expect(result.original_currency).toBe('USD');
      expect(result.converted_currency).toBe('EUR');
      expect(new Decimal(result.converted_amount).toNumber()).toBeCloseTo(85, 2);
      expect(result.exchange_rate).toBe('0.8500000000000000000000000000');
    });

    it('should handle same currency conversion', async () => {
      const result = await service.convertAmount('100', 'USD', 'USD', Date.now());

      expect(result.original_amount).toBe(result.converted_amount);
      expect(result.exchange_rate).toBe('1.0000000000000000000000000000');
      expect(result.rate_source).toBe(ExchangeRateSource.SYSTEM);
    });

    it('should maintain 28 decimal precision', async () => {
      const date = Date.now();
      mockExchangeRateService.addRate('USD', 'EUR', '0.8512345678901234567890123456', date);

      const result = await service.convertAmount('100', 'USD', 'EUR', date);

      expect(result.exchange_rate.length).toBeGreaterThanOrEqual(28);
    });

    it('should handle Decimal input', async () => {
      const date = Date.now();
      mockExchangeRateService.addRate('USD', 'EUR', '0.85', date);

      const result = await service.convertAmount(new Decimal('100'), 'USD', 'EUR', date);

      expect(new Decimal(result.converted_amount).toNumber()).toBeCloseTo(85, 2);
    });

    it('should throw error if no exchange rate found', async () => {
      await expect(
        service.convertAmount('100', 'USD', 'EUR', Date.now())
      ).rejects.toThrow('No exchange rate found');
    });
  });

  describe('convert', () => {
    it('should convert based on request object', async () => {
      const date = Date.now();
      mockExchangeRateService.addRate('USD', 'EUR', '0.85', date);

      const request: CurrencyConversionRequest = {
        amount: '100',
        from_currency: 'USD',
        to_currency: 'EUR',
        conversion_date: date,
      };

      const result = await service.convert(request);

      expect(result.original_currency).toBe('USD');
      expect(result.converted_currency).toBe('EUR');
    });
  });

  describe('convertBatch', () => {
    it('should convert multiple amounts', async () => {
      const date = Date.now();
      mockExchangeRateService.addRate('USD', 'EUR', '0.85', date);
      mockExchangeRateService.addRate('GBP', 'EUR', '1.15', date);

      const result = await service.convertBatch({
        conversions: [
          { amount: '100', from_currency: 'USD', to_currency: 'EUR', conversion_date: date },
          { amount: '50', from_currency: 'GBP', to_currency: 'EUR', conversion_date: date },
        ],
        to_currency: 'EUR',
      });

      expect(result.conversions).toHaveLength(2);
      expect(result.target_currency).toBe('EUR');
      // 100 * 0.85 + 50 * 1.15 = 85 + 57.5 = 142.5
      expect(new Decimal(result.total_converted_amount).toNumber()).toBeCloseTo(142.5, 2);
    });
  });

  describe('createConversionMetadata', () => {
    it('should create metadata from conversion result', async () => {
      const date = Date.now();
      mockExchangeRateService.addRate('USD', 'EUR', '0.85', date);

      const result = await service.convertAmount('100', 'USD', 'EUR', date);
      const metadata = service.createConversionMetadata(result);

      expect(metadata.original_currency).toBe('USD');
      expect(metadata.original_amount).toBe(result.original_amount);
      expect(metadata.exchange_rate).toBe(result.exchange_rate);
      expect(metadata.base_currency_amount).toBe(result.converted_amount);
    });
  });

  describe('calculateRealizedGainLoss', () => {
    it('should calculate realized gain when rate increases', async () => {
      const originalDate = Date.now();
      const settlementDate = originalDate + 86400000;

      mockExchangeRateService.addRate('EUR', 'USD', '1.10', originalDate);
      mockExchangeRateService.addRate('EUR', 'USD', '1.15', settlementDate);

      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '100.0000000000000000000000000000',
        exchange_rate: '1.10',
        conversion_date: originalDate,
        base_currency_amount: '110.0000000000000000000000000000',
        exchange_rate_id: null,
      };

      const gainLoss = await service.calculateRealizedGainLoss(
        'transaction-id',
        originalConversion,
        settlementDate
      );

      expect(gainLoss.type).toBe(GainLossType.REALIZED);
      expect(gainLoss.currency).toBe('EUR');
      // Gain should be 115 - 110 = 5
      expect(new Decimal(gainLoss.gain_loss_amount).toNumber()).toBeCloseTo(5, 2);
    });

    it('should calculate realized loss when rate decreases', async () => {
      const originalDate = Date.now();
      const settlementDate = originalDate + 86400000;

      mockExchangeRateService.addRate('EUR', 'USD', '1.10', originalDate);
      mockExchangeRateService.addRate('EUR', 'USD', '1.05', settlementDate);

      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '100.0000000000000000000000000000',
        exchange_rate: '1.10',
        conversion_date: originalDate,
        base_currency_amount: '110.0000000000000000000000000000',
        exchange_rate_id: null,
      };

      const gainLoss = await service.calculateRealizedGainLoss(
        'transaction-id',
        originalConversion,
        settlementDate
      );

      // Loss should be 105 - 110 = -5
      expect(new Decimal(gainLoss.gain_loss_amount).toNumber()).toBeCloseTo(-5, 2);
    });
  });

  describe('calculateUnrealizedGainLoss', () => {
    it('should calculate unrealized gain/loss', async () => {
      const originalDate = Date.now();
      const revaluationDate = originalDate + 86400000;

      mockExchangeRateService.addRate('EUR', 'USD', '1.10', originalDate);
      mockExchangeRateService.addRate('EUR', 'USD', '1.12', revaluationDate);

      const originalConversion: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '100.0000000000000000000000000000',
        exchange_rate: '1.10',
        conversion_date: originalDate,
        base_currency_amount: '110.0000000000000000000000000000',
        exchange_rate_id: null,
      };

      const gainLoss = await service.calculateUnrealizedGainLoss(
        'account-id',
        originalConversion,
        revaluationDate
      );

      expect(gainLoss.type).toBe(GainLossType.UNREALIZED);
      expect(new Decimal(gainLoss.gain_loss_amount).toNumber()).toBeCloseTo(2, 2);
    });
  });

  describe('revaluateAccounts', () => {
    it('should return empty results (placeholder)', async () => {
      const results = await service.revaluateAccounts({
        account_ids: ['account-1', 'account-2'],
        revaluation_date: Date.now(),
        target_currency: 'USD',
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });
  });
});

describe('Helper Functions', () => {
  describe('roundToCurrencyPrecision', () => {
    it('should round to 2 decimal places for standard currencies', () => {
      const rounded = roundToCurrencyPrecision('123.456789', 2);

      expect(rounded.toString()).toBe('123.46');
    });

    it('should round to 0 decimal places for JPY', () => {
      const rounded = roundToCurrencyPrecision('123.456', 0);

      expect(rounded.toString()).toBe('123');
    });

    it('should handle Decimal input', () => {
      const rounded = roundToCurrencyPrecision(new Decimal('123.456'), 2);

      expect(rounded.toString()).toBe('123.46');
    });
  });

  describe('calculatePercentageDifference', () => {
    it('should calculate positive percentage difference', () => {
      const diff = calculatePercentageDifference('100', '110');

      expect(diff.toNumber()).toBeCloseTo(10, 2);
    });

    it('should calculate negative percentage difference', () => {
      const diff = calculatePercentageDifference('100', '90');

      expect(diff.toNumber()).toBeCloseTo(-10, 2);
    });

    it('should throw error for zero original', () => {
      expect(() => calculatePercentageDifference('0', '100'))
        .toThrow('Cannot calculate percentage difference from zero');
    });
  });

  describe('formatGainLoss', () => {
    it('should format gain with plus sign', () => {
      const formatted = formatGainLoss('5.50', 2);

      expect(formatted).toBe('+5.50');
    });

    it('should format loss without plus sign', () => {
      const formatted = formatGainLoss('-5.50', 2);

      expect(formatted).toBe('-5.50');
    });

    it('should handle Decimal input', () => {
      const formatted = formatGainLoss(new Decimal('5.50'), 2);

      expect(formatted).toBe('+5.50');
    });
  });

  describe('isGain', () => {
    it('should return true for positive amounts', () => {
      expect(isGain('5.50')).toBe(true);
      expect(isGain(new Decimal('5.50'))).toBe(true);
    });

    it('should return false for negative amounts', () => {
      expect(isGain('-5.50')).toBe(false);
    });

    it('should return false for zero', () => {
      expect(isGain('0')).toBe(false);
    });
  });

  describe('isLoss', () => {
    it('should return true for negative amounts', () => {
      expect(isLoss('-5.50')).toBe(true);
      expect(isLoss(new Decimal('-5.50'))).toBe(true);
    });

    it('should return false for positive amounts', () => {
      expect(isLoss('5.50')).toBe(false);
    });
  });

  describe('calculateTotalGainLoss', () => {
    it('should sum multiple gains and losses', () => {
      const gainLosses: CurrencyGainLoss[] = [
        { gain_loss_amount: '5.00' } as CurrencyGainLoss,
        { gain_loss_amount: '-3.00' } as CurrencyGainLoss,
        { gain_loss_amount: '2.50' } as CurrencyGainLoss,
      ];

      const total = calculateTotalGainLoss(gainLosses);

      expect(total.toNumber()).toBeCloseTo(4.50, 2);
    });
  });

  describe('separateGainLossByType', () => {
    it('should separate realized and unrealized gains/losses', () => {
      const gainLosses: CurrencyGainLoss[] = [
        { type: GainLossType.REALIZED, gain_loss_amount: '5.00' } as CurrencyGainLoss,
        { type: GainLossType.UNREALIZED, gain_loss_amount: '3.00' } as CurrencyGainLoss,
        { type: GainLossType.REALIZED, gain_loss_amount: '2.00' } as CurrencyGainLoss,
      ];

      const { realized, unrealized } = separateGainLossByType(gainLosses);

      expect(realized).toHaveLength(2);
      expect(unrealized).toHaveLength(1);
    });
  });

  describe('groupGainLossByCurrency', () => {
    it('should group gains/losses by currency', () => {
      const gainLosses: CurrencyGainLoss[] = [
        { currency: 'EUR', gain_loss_amount: '5.00' } as CurrencyGainLoss,
        { currency: 'GBP', gain_loss_amount: '3.00' } as CurrencyGainLoss,
        { currency: 'EUR', gain_loss_amount: '2.00' } as CurrencyGainLoss,
      ];

      const grouped = groupGainLossByCurrency(gainLosses);

      expect(grouped.get('EUR')).toHaveLength(2);
      expect(grouped.get('GBP')).toHaveLength(1);
    });
  });

  describe('calculateTotalGainLossByCurrency', () => {
    it('should calculate totals by currency', () => {
      const gainLosses: CurrencyGainLoss[] = [
        { currency: 'EUR', gain_loss_amount: '5.00' } as CurrencyGainLoss,
        { currency: 'EUR', gain_loss_amount: '3.00' } as CurrencyGainLoss,
        { currency: 'GBP', gain_loss_amount: '2.00' } as CurrencyGainLoss,
      ];

      const totals = calculateTotalGainLossByCurrency(gainLosses);

      expect(totals.get('EUR')?.toNumber()).toBeCloseTo(8.00, 2);
      expect(totals.get('GBP')?.toNumber()).toBeCloseTo(2.00, 2);
    });
  });

  describe('validateConversionMetadata', () => {
    it('should validate correct metadata', () => {
      const metadata: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '100.00',
        exchange_rate: '1.10',
        conversion_date: Date.now(),
        base_currency_amount: '110.00',
        exchange_rate_id: null,
      };

      const result = validateConversionMetadata(metadata);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch missing required fields', () => {
      const result = validateConversionMetadata({} as any);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate exchange rate is positive', () => {
      const metadata: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '100.00',
        exchange_rate: '-1.10',
        conversion_date: Date.now(),
        base_currency_amount: '110.00',
        exchange_rate_id: null,
      };

      const result = validateConversionMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: any) => e.includes('positive'))).toBe(true);
    });
  });

  describe('recalculateBaseCurrencyAmount', () => {
    it('should recalculate base currency amount', () => {
      const metadata: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '100.00',
        exchange_rate: '1.10',
        conversion_date: Date.now(),
        base_currency_amount: '0', // Incorrect value
        exchange_rate_id: null,
      };

      const recalculated = recalculateBaseCurrencyAmount(metadata);

      expect(recalculated.toNumber()).toBeCloseTo(110, 2);
    });
  });

  describe('needsRevaluation', () => {
    it('should return true if conversion is old enough', () => {
      const oldDate = Date.now() - (31 * 24 * 60 * 60 * 1000); // 31 days ago

      const metadata: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '100.00',
        exchange_rate: '1.10',
        conversion_date: oldDate,
        base_currency_amount: '110.00',
        exchange_rate_id: null,
      };

      const needs = needsRevaluation(metadata, Date.now(), 30);

      expect(needs).toBe(true);
    });

    it('should return false if conversion is recent', () => {
      const recentDate = Date.now() - (20 * 24 * 60 * 60 * 1000); // 20 days ago

      const metadata: CurrencyConversionMetadata = {
        original_currency: 'EUR',
        original_amount: '100.00',
        exchange_rate: '1.10',
        conversion_date: recentDate,
        base_currency_amount: '110.00',
        exchange_rate_id: null,
      };

      const needs = needsRevaluation(metadata, Date.now(), 30);

      expect(needs).toBe(false);
    });
  });
});
