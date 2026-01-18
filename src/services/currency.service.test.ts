/**
 * Currency Service Tests
 *
 * Tests for currency configuration management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { CurrencyService, getSupportedCurrencies, isSupportedCurrency, getCurrencyName, getCurrencySymbol } from './currency.service';
import type { Currency } from '../types/currency.types';

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
  private currencyMap: Map<string, Currency> = new Map();

  get currencies() {
    return {
      add: async (currency: Currency) => {
        this.currencyMap.set(currency.id, currency);
        return currency.id;
      },
      get: async (id: string) => {
        return this.currencyMap.get(id);
      },
      put: async (currency: Currency) => {
        this.currencyMap.set(currency.id, currency);
        return currency.id;
      },
      update: async (id: string, changes: Partial<Currency>) => {
        const existing = this.currencyMap.get(id);
        if (existing) {
          this.currencyMap.set(id, { ...existing, ...changes });
        }
        return 1;
      },
      where: (field: string | string[]) => {
        return {
          equals: (value: any) => {
            return {
              first: async () => {
                const values = Array.from(this.currencyMap.values());
                if (Array.isArray(field)) {
                  const [field1, field2] = field;
                  const [value1, value2] = value;
                  return values.find((c: any) => c[field1 as keyof Currency] === value1 && c[field2 as keyof Currency] === value2);
                } else {
                  return values.find((c: any) => c[field as keyof Currency] === value);
                }
              },
              and: (filter: (c: Currency) => boolean) => {
                return {
                  first: async () => {
                    const values = Array.from(this.currencyMap.values());
                    const filtered = values.filter(filter);
                    if (Array.isArray(field)) {
                      const [field1, field2] = field;
                      const [value1, value2] = value;
                      return filtered.find((c: any) => c[field1 as keyof Currency] === value1 && c[field2 as keyof Currency] === value2);
                    } else {
                      return filtered.find((c: any) => c[field as keyof Currency] === value);
                    }
                  },
                  toArray: async () => {
                    const values = Array.from(this.currencyMap.values());
                    const filtered = values.filter(filter);
                    if (Array.isArray(field)) {
                      const [field1, field2] = field;
                      const [value1, value2] = value;
                      return filtered.filter((c: any) => c[field1 as keyof Currency] === value1 && c[field2 as keyof Currency] === value2);
                    } else {
                      return filtered.filter((c: any) => c[field as keyof Currency] === value);
                    }
                  },
                };
              },
            };
          },
        };
      },
    };
  }

  clear() {
    this.currencyMap.clear();
  }
}

describe('CurrencyService', () => {
  let service: CurrencyService;
  let mockDb: MockDatabase;
  let mockEncryption: MockEncryptionService;
  const companyId = 'test-company-id';

  beforeEach(() => {
    mockDb = new MockDatabase();
    mockEncryption = new MockEncryptionService();
    service = new CurrencyService(mockEncryption as any, mockDb as any);
  });

  describe('createCurrency', () => {
    it('should create a new currency with USD configuration', async () => {
      const currency = await service.createCurrency(companyId, 'USD', true);

      expect(currency).toBeDefined();
      expect(currency.code).toBe('USD');
      expect(currency.company_id).toBe(companyId);
      expect(currency.is_base_currency).toBe(true);
      expect(currency.is_active).toBe(true);
      expect(currency.symbol).toBe('$');
      expect(currency.decimal_places).toBe(2);
    });

    it('should create EUR currency with correct configuration', async () => {
      const currency = await service.createCurrency(companyId, 'EUR', false);

      expect(currency.code).toBe('EUR');
      expect(currency.symbol).toBe('€');
      expect(currency.decimal_places).toBe(2);
      expect(currency.decimal_separator).toBe(',');
      expect(currency.thousands_separator).toBe('.');
    });

    it('should create JPY currency with zero decimal places', async () => {
      const currency = await service.createCurrency(companyId, 'JPY', false);

      expect(currency.code).toBe('JPY');
      expect(currency.symbol).toBe('¥');
      expect(currency.decimal_places).toBe(0);
    });

    it('should throw error if currency already exists', async () => {
      await service.createCurrency(companyId, 'USD', true);

      await expect(
        service.createCurrency(companyId, 'USD', false)
      ).rejects.toThrow('Currency USD already exists');
    });

    it('should throw error if base currency already exists', async () => {
      await service.createCurrency(companyId, 'USD', true);

      await expect(
        service.createCurrency(companyId, 'EUR', true)
      ).rejects.toThrow('Base currency already exists');
    });
  });

  describe('getCurrency', () => {
    it('should retrieve currency by ID', async () => {
      const created = await service.createCurrency(companyId, 'USD', true);
      const retrieved = await service.getCurrency(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.code).toBe('USD');
    });

    it('should return null for non-existent currency', async () => {
      const result = await service.getCurrency('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return null for deleted currency', async () => {
      const created = await service.createCurrency(companyId, 'EUR', false);
      await service.updateCurrency(created.id, { deleted_at: Date.now() });

      const result = await service.getCurrency(created.id);
      expect(result).toBeNull();
    });
  });

  describe('getCurrencyByCode', () => {
    it('should retrieve currency by company and code', async () => {
      await service.createCurrency(companyId, 'USD', true);
      const retrieved = await service.getCurrencyByCode(companyId, 'USD');

      expect(retrieved).toBeDefined();
      expect(retrieved?.code).toBe('USD');
      expect(retrieved?.company_id).toBe(companyId);
    });

    it('should return null if currency not found', async () => {
      const result = await service.getCurrencyByCode(companyId, 'EUR');
      expect(result).toBeNull();
    });
  });

  describe('getActiveCurrencies', () => {
    it('should return all active currencies for company', async () => {
      await service.createCurrency(companyId, 'USD', true);
      await service.createCurrency(companyId, 'EUR', false);
      await service.createCurrency(companyId, 'GBP', false);

      const currencies = await service.getActiveCurrencies(companyId);

      expect(currencies).toHaveLength(3);
      expect(currencies.every(c => c.is_active)).toBe(true);
    });

    it('should exclude inactive currencies', async () => {
      await service.createCurrency(companyId, 'USD', true);
      const eur = await service.createCurrency(companyId, 'EUR', false);
      await service.updateCurrency(eur.id, { is_active: false });

      const currencies = await service.getActiveCurrencies(companyId);

      expect(currencies).toHaveLength(1);
      expect(currencies[0]?.code).toBe('USD');
    });
  });

  describe('getBaseCurrency', () => {
    it('should return the base currency', async () => {
      await service.createCurrency(companyId, 'USD', true);
      await service.createCurrency(companyId, 'EUR', false);

      const base = await service.getBaseCurrency(companyId);

      expect(base).toBeDefined();
      expect(base?.code).toBe('USD');
      expect(base?.is_base_currency).toBe(true);
    });

    it('should return null if no base currency exists', async () => {
      const base = await service.getBaseCurrency(companyId);
      expect(base).toBeNull();
    });
  });

  describe('updateCurrency', () => {
    it('should update currency fields', async () => {
      const currency = await service.createCurrency(companyId, 'USD', true);

      const updated = await service.updateCurrency(currency.id, {
        decimal_places: 4,
      });

      expect(updated.decimal_places).toBe(4);
      expect(updated.updated_at).toBeGreaterThan(currency.updated_at);
    });

    it('should throw error for non-existent currency', async () => {
      await expect(
        service.updateCurrency('non-existent', { decimal_places: 4 })
      ).rejects.toThrow('Currency not found');
    });

    it('should prevent changing immutable fields', async () => {
      const currency = await service.createCurrency(companyId, 'USD', true);

      await expect(
        service.updateCurrency(currency.id, { code: 'EUR' as any })
      ).rejects.toThrow('Cannot modify immutable currency fields');
    });
  });

  describe('deactivateCurrency', () => {
    it('should deactivate a non-base currency', async () => {
      await service.createCurrency(companyId, 'USD', true);
      const eur = await service.createCurrency(companyId, 'EUR', false);

      await service.deactivateCurrency(eur.id);

      const currencies = await service.getActiveCurrencies(companyId);
      expect(currencies).toHaveLength(1);
      expect(currencies[0]?.code).toBe('USD');
    });

    it('should throw error when deactivating base currency', async () => {
      const usd = await service.createCurrency(companyId, 'USD', true);

      await expect(
        service.deactivateCurrency(usd.id)
      ).rejects.toThrow('Cannot deactivate the base currency');
    });
  });

  describe('validateCurrency', () => {
    it('should validate a correct currency', async () => {
      const currency = await service.createCurrency(companyId, 'USD', true);
      const result = service.validateCurrency(currency);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch missing required fields', () => {
      const result = service.validateCurrency({});

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('formatAmount', () => {
    it('should format USD amount correctly', () => {
      const formatted = service.formatAmount('1234.56', {
        currency: 'USD',
      });

      expect(formatted).toBe('$1,234.56');
    });

    it('should format EUR amount with European separators', () => {
      const formatted = service.formatAmount('1234.56', {
        currency: 'EUR',
      });

      expect(formatted).toBe('€1.234,56');
    });

    it('should format JPY amount without decimals', () => {
      const formatted = service.formatAmount('1234', {
        currency: 'JPY',
      });

      expect(formatted).toBe('¥1,234');
    });

    it('should handle Decimal input', () => {
      const formatted = service.formatAmount(new Decimal('1234.56'), {
        currency: 'USD',
      });

      expect(formatted).toBe('$1,234.56');
    });

    it('should respect custom precision', () => {
      const formatted = service.formatAmount('1234.567890', {
        currency: 'USD',
        precision: 4,
      });

      expect(formatted).toBe('$1,234.5679');
    });

    it('should show currency code when requested', () => {
      const formatted = service.formatAmount('1234.56', {
        currency: 'USD',
        showCode: true,
      });

      expect(formatted).toContain('USD');
    });
  });

  describe('parseAmount', () => {
    it('should parse USD amount', () => {
      const result = service.parseAmount('$1,234.56', 'USD');

      expect(result).not.toBeNull();
      expect(result?.toString()).toBe('1234.56');
    });

    it('should parse EUR amount with European format', () => {
      const result = service.parseAmount('€1.234,56', 'EUR');

      expect(result).toBeInstanceOf(Decimal);
      expect(result?.toString()).toBe('1234.56');
    });

    it('should return null for invalid input', () => {
      const result = service.parseAmount('invalid', 'USD');
      expect(result).toBeNull();
    });
  });
});

describe('Helper Functions', () => {
  describe('getSupportedCurrencies', () => {
    it('should return array of currency codes', () => {
      const currencies = getSupportedCurrencies();

      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies.length).toBeGreaterThan(20);
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('GBP');
    });
  });

  describe('isSupportedCurrency', () => {
    it('should return true for supported currencies', () => {
      expect(isSupportedCurrency('USD')).toBe(true);
      expect(isSupportedCurrency('EUR')).toBe(true);
      expect(isSupportedCurrency('JPY')).toBe(true);
    });

    it('should return false for unsupported currencies', () => {
      expect(isSupportedCurrency('XXX')).toBe(false);
      expect(isSupportedCurrency('INVALID')).toBe(false);
    });
  });

  describe('getCurrencyName', () => {
    it('should return currency names', () => {
      expect(getCurrencyName('USD')).toBe('United States Dollar');
      expect(getCurrencyName('EUR')).toBe('Euro');
      expect(getCurrencyName('GBP')).toBe('British Pound Sterling');
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return currency symbols', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('EUR')).toBe('€');
      expect(getCurrencySymbol('GBP')).toBe('£');
      expect(getCurrencySymbol('JPY')).toBe('¥');
    });
  });
});
