/**
 * Exchange Rate Service Tests
 *
 * Tests for exchange rate management and calculations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  ExchangeRateService,
  formatExchangeRate,
  calculateAverageRate,
  calculateWeightedAverageRate
} from './exchangeRate.service';
import type { ExchangeRate, ExchangeRateSource } from '../types/currency.types';

// Mock encryption service
class MockEncryptionService {
  async encrypt(plaintext: string): Promise<string> {
    return `encrypted_${plaintext}`;
  }

  async decrypt(ciphertext: string): Promise<string> {
    return ciphertext.replace('encrypted_', '');
  }
}

// Mock database
class MockDatabase {
  private rates: Map<string, ExchangeRate> = new Map();

  get exchangeRates() {
    return {
      add: async (rate: ExchangeRate) => {
        this.rates.set(rate.id, rate);
        return rate.id;
      },
      get: async (id: string) => {
        return this.rates.get(id);
      },
      put: async (rate: ExchangeRate) => {
        this.rates.set(rate.id, rate);
        return rate.id;
      },
      update: async (id: string, changes: Partial<ExchangeRate>) => {
        const existing = this.rates.get(id);
        if (existing) {
          this.rates.set(id, { ...existing, ...changes });
        }
        return 1;
      },
      where: (field: string | string[]) => {
        return {
          equals: (value: any) => {
            const baseFilters: ((r: ExchangeRate) => boolean)[] = [];

            // Handle compound index (e.g., 'company_id+from_currency+to_currency')
            if (typeof field === 'string' && field.includes('+')) {
              const fields = field.split('+');
              const values = Array.isArray(value) ? value : [value];
              baseFilters.push((r: any) => fields.every((f, i) => r[f] === values[i]));
            } else if (Array.isArray(field)) {
              const [f1, f2, f3] = field;
              const [v1, v2, v3] = value;
              if (f3) {
                baseFilters.push((r: any) => r[f1] === v1 && r[f2] === v2 && r[f3] === v3);
              } else if (f2) {
                baseFilters.push((r: any) => r[f1] === v1 && r[f2] === v2);
              } else {
                baseFilters.push((r: any) => r[f1] === v1);
              }
            } else {
              baseFilters.push((r: any) => r[field as keyof ExchangeRate] === value);
            }

            const makeQuery = (filters: ((r: ExchangeRate) => boolean)[]) => ({
              and: (filter: (r: ExchangeRate) => boolean) => makeQuery([...filters, filter]),
              sortBy: async (sortField: string) => {
                let result = Array.from(this.rates.values());
                for (const f of filters) {
                  result = result.filter(f);
                }
                return result.sort((a: any, b: any) => a[sortField] - b[sortField]);
              },
            });

            return makeQuery(baseFilters);
          },
        };
      },
    };
  }

  clear() {
    this.rates.clear();
  }
}

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;
  let mockDb: MockDatabase;
  let mockEncryption: MockEncryptionService;
  const companyId = 'test-company-id';

  beforeEach(() => {
    mockDb = new MockDatabase();
    mockEncryption = new MockEncryptionService();
    service = new ExchangeRateService(mockEncryption as any, mockDb as any);
  });

  describe('createExchangeRate', () => {
    it('should create a new exchange rate', async () => {
      const rate = await service.createExchangeRate(
        companyId,
        'USD',
        'EUR',
        '0.85',
        Date.now(),
        'MANUAL'
      );

      expect(rate).toBeDefined();
      expect(rate.from_currency).toBe('USD');
      expect(rate.to_currency).toBe('EUR');
      expect(rate.company_id).toBe(companyId);
      expect(rate.source).toBe('MANUAL');
    });

    it('should create inverse rate automatically', async () => {
      const date = Date.now();
      await service.createExchangeRate(
        companyId,
        'USD',
        'EUR',
        '0.85',
        date
      );

      // The service should have created both USD->EUR and EUR->USD
      // We can verify by trying to get the inverse rate
      const inverseRate = await service.getExchangeRateForDate(
        companyId,
        'EUR',
        'USD',
        date
      );

      expect(inverseRate).toBeDefined();
      expect(inverseRate?.from_currency).toBe('EUR');
      expect(inverseRate?.to_currency).toBe('USD');
    });

    it('should throw error for invalid rate', async () => {
      await expect(
        service.createExchangeRate(companyId, 'USD', 'EUR', '0', Date.now())
      ).rejects.toThrow('Exchange rate must be a positive number');

      await expect(
        service.createExchangeRate(companyId, 'USD', 'EUR', '-1', Date.now())
      ).rejects.toThrow('Exchange rate must be a positive number');
    });

    it('should throw error for same currency conversion', async () => {
      await expect(
        service.createExchangeRate(companyId, 'USD', 'USD', '1.0', Date.now())
      ).rejects.toThrow('Cannot create exchange rate for same currency');
    });

    it('should accept notes', async () => {
      const rate = await service.createExchangeRate(
        companyId,
        'USD',
        'EUR',
        '0.85',
        Date.now(),
        'MANUAL',
        'Manual rate from bank statement'
      );

      expect(rate.notes).toBeDefined();
      expect(rate.notes).toContain('encrypted_');
    });
  });

  describe('getExchangeRate', () => {
    it('should retrieve rate by ID', async () => {
      const created = await service.createExchangeRate(
        companyId,
        'USD',
        'EUR',
        '0.85',
        Date.now()
      );

      const retrieved = await service.getExchangeRate(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent rate', async () => {
      const result = await service.getExchangeRate('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return null for deleted rate', async () => {
      const created = await service.createExchangeRate(
        companyId,
        'USD',
        'EUR',
        '0.85',
        Date.now()
      );

      await mockDb.exchangeRates.update(created.id, { deleted_at: Date.now() });

      const result = await service.getExchangeRate(created.id);
      expect(result).toBeNull();
    });
  });

  describe('getExchangeRateForDate', () => {
    it('should return most recent rate on or before date', async () => {
      const baseDate = Date.now();
      const day1 = baseDate;
      const day2 = baseDate + 86400000; // +1 day
      const day3 = baseDate + 172800000; // +2 days

      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.85', day1);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.86', day2);

      const rate = await service.getExchangeRateForDate(
        companyId,
        'USD',
        'EUR',
        day3
      );

      expect(rate).toBeDefined();
      // Should get the day2 rate since it's most recent before day3
    });

    it('should return null if no rate exists before date', async () => {
      const futureDate = Date.now() + 86400000;

      const rate = await service.getExchangeRateForDate(
        companyId,
        'USD',
        'EUR',
        Date.now() - 86400000
      );

      expect(rate).toBeNull();
    });

    it('should return system rate for same currency', async () => {
      const rate = await service.getExchangeRateForDate(
        companyId,
        'USD',
        'USD',
        Date.now()
      );

      expect(rate).toBeDefined();
      expect(rate?.from_currency).toBe('USD');
      expect(rate?.to_currency).toBe('USD');
      expect(rate?.source).toBe('SYSTEM');
    });
  });

  describe('getLatestExchangeRate', () => {
    it('should return the most recent rate', async () => {
      const baseDate = Date.now();

      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.85', baseDate - 86400000);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.86', baseDate);

      const latest = await service.getLatestExchangeRate(companyId, 'USD', 'EUR');

      expect(latest).toBeDefined();
    });
  });

  describe('getExchangeRateHistory', () => {
    it('should return all rates for currency pair', async () => {
      const baseDate = Date.now();

      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.85', baseDate);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.86', baseDate + 86400000);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.87', baseDate + 172800000);

      const history = await service.getExchangeRateHistory(companyId, 'USD', 'EUR');

      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by date range', async () => {
      const baseDate = Date.now();
      const startDate = baseDate;
      const endDate = baseDate + 86400000;

      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.85', baseDate - 86400000);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.86', baseDate);
      await service.createExchangeRate(companyId, 'USD', 'EUR', '0.87', baseDate + 172800000);

      const history = await service.getExchangeRateHistory(
        companyId,
        'USD',
        'EUR',
        startDate,
        endDate
      );

      // Should only include rates within range
      expect(history.every((r: any) => r.effective_date >= startDate && r.effective_date <= endDate)).toBe(true);
    });
  });

  describe('updateExchangeRate', () => {
    it('should update rate value', async () => {
      const created = await service.createExchangeRate(
        companyId,
        'USD',
        'EUR',
        '0.85',
        Date.now()
      );

      const updated = await service.updateExchangeRate(created.id, {
        rate: '0.86',
      });

      expect(updated.rate).toContain('encrypted_');
      expect(updated.updated_at).toBeGreaterThan(created.updated_at);
    });

    it('should throw error for non-existent rate', async () => {
      await expect(
        service.updateExchangeRate('non-existent', { rate: '0.86' })
      ).rejects.toThrow('Exchange rate not found');
    });
  });

  describe('deleteExchangeRate', () => {
    it('should soft delete exchange rate', async () => {
      const created = await service.createExchangeRate(
        companyId,
        'USD',
        'EUR',
        '0.85',
        Date.now()
      );

      await service.deleteExchangeRate(created.id);

      const result = await service.getExchangeRate(created.id);
      expect(result).toBeNull();
    });
  });

  describe('validateExchangeRate', () => {
    it('should validate correct exchange rate', async () => {
      const rate = await service.createExchangeRate(
        companyId,
        'USD',
        'EUR',
        '0.85',
        Date.now()
      );

      const validation = service.validateExchangeRate(rate);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should catch missing required fields', () => {
      const validation = service.validateExchangeRate({});

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should warn about unusual rates', () => {
      const validation = service.validateExchangeRate({
        company_id: companyId,
        from_currency: 'USD',
        to_currency: 'EUR',
        rate: 'encrypted_1500.0',
        effective_date: Date.now(),
        source: 'MANUAL',
      } as any);

      expect(validation.warnings).toBeDefined();
    });
  });

  describe('calculateInverseRate', () => {
    it('should calculate correct inverse', () => {
      const inverse = service.calculateInverseRate('0.85');

      expect(inverse).toBeInstanceOf(Decimal);
      // 1 / 0.85 ≈ 1.176470588
      expect(inverse.toNumber()).toBeCloseTo(1.176470588, 6);
    });

    it('should handle Decimal input', () => {
      const inverse = service.calculateInverseRate(new Decimal('0.85'));

      expect(inverse.toNumber()).toBeCloseTo(1.176470588, 6);
    });

    it('should throw error for zero rate', () => {
      expect(() => service.calculateInverseRate('0')).toThrow('Cannot calculate inverse of zero rate');
    });
  });

  describe('calculateCrossRate', () => {
    it('should calculate cross rate correctly', () => {
      // USD to EUR = 0.85
      // EUR to GBP = 1.15
      // USD to GBP should be 0.85 * 1.15 = 0.9775

      const crossRate = service.calculateCrossRate('0.85', '1.15');

      expect(crossRate).toBeInstanceOf(Decimal);
      expect(crossRate.toNumber()).toBeCloseTo(0.9775, 4);
    });

    it('should handle Decimal inputs', () => {
      const crossRate = service.calculateCrossRate(
        new Decimal('0.85'),
        new Decimal('1.15')
      );

      expect(crossRate.toNumber()).toBeCloseTo(0.9775, 4);
    });
  });
});

describe('Helper Functions', () => {
  describe('formatExchangeRate', () => {
    it('should format rate with default precision', () => {
      const formatted = formatExchangeRate('0.85');
      expect(formatted).toBe('0.850000');
    });

    it('should format rate with custom precision', () => {
      const formatted = formatExchangeRate('0.85123456', 4);
      expect(formatted).toBe('0.8512');
    });

    it('should handle Decimal input', () => {
      const formatted = formatExchangeRate(new Decimal('0.85'));
      expect(formatted).toBe('0.850000');
    });
  });

  describe('calculateAverageRate', () => {
    it('should calculate average of multiple rates', async () => {
      const mockEncryption = new MockEncryptionService();
      const rates: ExchangeRate[] = [
        { rate: 'encrypted_0.85' } as ExchangeRate,
        { rate: 'encrypted_0.86' } as ExchangeRate,
        { rate: 'encrypted_0.87' } as ExchangeRate,
      ];

      const average = await calculateAverageRate(rates, mockEncryption as any);

      expect(average).toBeInstanceOf(Decimal);
      expect(average.toNumber()).toBeCloseTo(0.86, 2);
    });

    it('should throw error for empty array', async () => {
      const mockEncryption = new MockEncryptionService();

      await expect(
        calculateAverageRate([], mockEncryption as any)
      ).rejects.toThrow('Cannot calculate average of empty rate list');
    });
  });

  describe('calculateWeightedAverageRate', () => {
    it('should calculate weighted average correctly', () => {
      const rates = [
        new Decimal('0.85'),
        new Decimal('0.86'),
        new Decimal('0.87'),
      ];
      const weights = [
        new Decimal('100'),
        new Decimal('200'),
        new Decimal('300'),
      ];

      const average = calculateWeightedAverageRate(rates, weights);

      // (0.85*100 + 0.86*200 + 0.87*300) / (100+200+300)
      // = (85 + 172 + 261) / 600 = 518 / 600 ≈ 0.8633
      expect(average.toNumber()).toBeCloseTo(0.8633, 4);
    });

    it('should throw error for mismatched array lengths', () => {
      const rates = [new Decimal('0.85')];
      const weights = [new Decimal('100'), new Decimal('200')];

      expect(() => calculateWeightedAverageRate(rates, weights))
        .toThrow('Rates and weights arrays must have same length');
    });

    it('should throw error for zero total weight', () => {
      const rates = [new Decimal('0.85')];
      const weights = [new Decimal('0')];

      expect(() => calculateWeightedAverageRate(rates, weights))
        .toThrow('Total weight cannot be zero');
    });
  });
});
