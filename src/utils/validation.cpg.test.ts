/**
 * CPG Calculation Validation Tests
 *
 * Tests for S6-4: CPG Calculation Validation
 * Ensures all CPG calculation inputs are properly validated
 * and suspicious patterns are detected.
 */

import { describe, it, expect } from 'vitest';
import {
  validateDistributionCalcParams,
  validatePromoAnalysisParams,
  validateCreatePromoParams,
  validateCPGInvoiceInput,
  detectSuspiciousCalculation,
} from './validation';

// ============================================================================
// Distribution Calculation Validation Tests
// ============================================================================

describe('validateDistributionCalcParams', () => {
  const validDistributionParams = {
    distributorId: '12345678-1234-1234-1234-123456789012',
    numPallets: '10',
    unitsPerPallet: '100',
    pallet_data: [],
    variantData: {
      '8oz': {
        price_per_unit: '3.50',
        base_cpu: '2.00',
        quantity: 500,
      },
    },
    selectedFees: [
      {
        feeId: '12345678-1234-1234-1234-123456789012',
        description: 'Pallet cost',
        amount: '45.00',
        unit: 'per_pallet' as const,
      },
    ],
  };

  it('should accept valid distribution parameters', () => {
    const result = validateDistributionCalcParams(validDistributionParams);
    expect(result.success).toBe(true);
  });

  it('should reject negative numPallets', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      numPallets: '-5',
    });
    expect(result.success).toBe(false);
  });

  it('should reject zero numPallets', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      numPallets: '0',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative price_per_unit', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      variantData: {
        '8oz': {
          price_per_unit: '-3.50',
          base_cpu: '2.00',
          quantity: 500,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative base_cpu', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      variantData: {
        '8oz': {
          price_per_unit: '3.50',
          base_cpu: '-2.00',
          quantity: 500,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty variantData', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      variantData: {},
    });
    expect(result.success).toBe(false);
  });

  it('should reject too many pallets (> 100)', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      numPallets: '101',
      pallet_data: Array(101)
        .fill(null)
        .map((_, i) => ({
          pallet_number: i + 1,
          units_per_pallet: 100,
          products: [
            {
              product_name: 'Test Product',
              quantity: 100,
              price_per_unit: '3.50',
              base_cpu: '2.00',
            },
          ],
        })),
    });
    expect(result.success).toBe(false);
  });

  it('should reject too many fees (> 100)', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      selectedFees: Array(101)
        .fill(null)
        .map((_, i) => ({
          feeId: `fee-${i}`,
          description: `Fee ${i}`,
          amount: '10.00',
          unit: 'flat_fee' as const,
        })),
    });
    expect(result.success).toBe(false);
  });

  it('should reject extremely large values (> 1,000,000)', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      variantData: {
        '8oz': {
          price_per_unit: '1000001',
          base_cpu: '2.00',
          quantity: 500,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid MSRP markup percentage', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      msrpMarkupPercentage: '50',
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative MSRP markup percentage', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      msrpMarkupPercentage: '-10',
    });
    expect(result.success).toBe(false);
  });

  it('should reject MSRP markup over 10,000%', () => {
    const result = validateDistributionCalcParams({
      ...validDistributionParams,
      msrpMarkupPercentage: '10001',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Promo Analysis Validation Tests
// ============================================================================

describe('validatePromoAnalysisParams', () => {
  const validPromoParams = {
    promoId: '12345678-1234-1234-1234-123456789012',
    variantPromoData: {
      '8oz': {
        retailPrice: '3.50',
        unitsAvailable: '1000',
        baseCPU: '2.00',
      },
    },
  };

  it('should accept valid promo analysis parameters', () => {
    const result = validatePromoAnalysisParams(validPromoParams);
    expect(result.success).toBe(true);
  });

  it('should reject negative retail price', () => {
    const result = validatePromoAnalysisParams({
      ...validPromoParams,
      variantPromoData: {
        '8oz': {
          retailPrice: '-3.50',
          unitsAvailable: '1000',
          baseCPU: '2.00',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject zero retail price', () => {
    const result = validatePromoAnalysisParams({
      ...validPromoParams,
      variantPromoData: {
        '8oz': {
          retailPrice: '0',
          unitsAvailable: '1000',
          baseCPU: '2.00',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative units available', () => {
    const result = validatePromoAnalysisParams({
      ...validPromoParams,
      variantPromoData: {
        '8oz': {
          retailPrice: '3.50',
          unitsAvailable: '-1000',
          baseCPU: '2.00',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty variant data', () => {
    const result = validatePromoAnalysisParams({
      ...validPromoParams,
      variantPromoData: {},
    });
    expect(result.success).toBe(false);
  });

  it('should reject too many variants (> 100)', () => {
    const manyVariants: Record<string, any> = {};
    for (let i = 0; i < 101; i++) {
      manyVariants[`variant-${i}`] = {
        retailPrice: '3.50',
        unitsAvailable: '1000',
        baseCPU: '2.00',
      };
    }
    const result = validatePromoAnalysisParams({
      ...validPromoParams,
      variantPromoData: manyVariants,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Promo Creation Validation Tests
// ============================================================================

describe('validateCreatePromoParams', () => {
  const validCreatePromo = {
    companyId: '12345678-1234-1234-1234-123456789012',
    promoName: 'Summer Sale',
    storeSalePercentage: '25',
    producerPaybackPercentage: '15',
  };

  it('should accept valid promo creation parameters', () => {
    const result = validateCreatePromoParams(validCreatePromo);
    if (!result.success) {
      console.log('CreatePromo validation errors:', result.error.issues);
    }
    expect(result.success).toBe(true);
  });

  it('should reject store sale percentage over 100', () => {
    const result = validateCreatePromoParams({
      ...validCreatePromo,
      storeSalePercentage: '101',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative producer payback percentage', () => {
    const result = validateCreatePromoParams({
      ...validCreatePromo,
      producerPaybackPercentage: '-10',
    });
    expect(result.success).toBe(false);
  });

  it('should accept demo hours entries', () => {
    const result = validateCreatePromoParams({
      ...validCreatePromo,
      demoHoursEntries: [
        {
          id: '12345678-1234-1234-1234-123456789012',
          description: 'Demo time',
          hours: '8',
          hourlyRate: '25.00',
          costType: 'actual' as const,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject excessive demo hours (> 1000)', () => {
    const result = validateCreatePromoParams({
      ...validCreatePromo,
      demoHoursEntries: [
        {
          id: '12345678-1234-1234-1234-123456789012',
          description: 'Demo time',
          hours: '1001',
          hourlyRate: '25.00',
          costType: 'actual' as const,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should reject excessive hourly rate (> $10,000)', () => {
    const result = validateCreatePromoParams({
      ...validCreatePromo,
      demoHoursEntries: [
        {
          id: '12345678-1234-1234-1234-123456789012',
          description: 'Demo time',
          hours: '8',
          hourlyRate: '10001',
          costType: 'actual' as const,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// CPG Invoice Validation Tests
// ============================================================================

describe('validateCPGInvoiceInput', () => {
  const validInvoice = {
    company_id: '12345678-1234-1234-1234-123456789012',
    invoice_date: Date.now(),
    cost_attribution: {
      line1: {
        category_id: '12345678-1234-1234-1234-123456789012',
        variant: '8oz',
        units_purchased: '100',
        unit_price: '2.50',
      },
    },
    device_id: 'device-123',
  };

  it('should accept valid invoice input', () => {
    const result = validateCPGInvoiceInput(validInvoice);
    expect(result.success).toBe(true);
  });

  it('should reject negative unit price', () => {
    const result = validateCPGInvoiceInput({
      ...validInvoice,
      cost_attribution: {
        line1: {
          category_id: '12345678-1234-1234-1234-123456789012',
          variant: '8oz',
          units_purchased: '100',
          unit_price: '-2.50',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject zero units purchased', () => {
    const result = validateCPGInvoiceInput({
      ...validInvoice,
      cost_attribution: {
        line1: {
          category_id: '12345678-1234-1234-1234-123456789012',
          variant: '8oz',
          units_purchased: '0',
          unit_price: '2.50',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty cost attribution', () => {
    const result = validateCPGInvoiceInput({
      ...validInvoice,
      cost_attribution: {},
    });
    expect(result.success).toBe(false);
  });

  it('should reject too many line items (> 500)', () => {
    const manyLines: Record<string, any> = {};
    for (let i = 0; i < 501; i++) {
      manyLines[`line${i}`] = {
        category_id: '12345678-1234-1234-1234-123456789012',
        variant: '8oz',
        units_purchased: '100',
        unit_price: '2.50',
      };
    }
    const result = validateCPGInvoiceInput({
      ...validInvoice,
      cost_attribution: manyLines,
    });
    expect(result.success).toBe(false);
  });

  it('should accept additional costs', () => {
    const result = validateCPGInvoiceInput({
      ...validInvoice,
      additional_costs: {
        Shipping: '50.00',
        Printing: '75.00',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative additional costs', () => {
    const result = validateCPGInvoiceInput({
      ...validInvoice,
      additional_costs: {
        Shipping: '-50.00',
      },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Suspicious Calculation Detection Tests
// ============================================================================

describe('detectSuspiciousCalculation', () => {
  describe('distribution calculations', () => {
    it('should detect unrealistic pallet counts', () => {
      const result = detectSuspiciousCalculation({
        type: 'distribution',
        values: {
          numPallets: 600,
          unitsPerPallet: 100,
          totalCPU: 5.0,
          price: 10.0,
        },
      });
      expect(result.suspicious).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should detect unrealistic units per pallet', () => {
      const result = detectSuspiciousCalculation({
        type: 'distribution',
        values: {
          numPallets: 10,
          unitsPerPallet: 15000,
          totalCPU: 5.0,
          price: 10.0,
        },
      });
      expect(result.suspicious).toBe(true);
    });

    it('should detect negative margins', () => {
      const result = detectSuspiciousCalculation({
        type: 'distribution',
        values: {
          numPallets: 10,
          unitsPerPallet: 100,
          totalCPU: 15.0,
          price: 10.0,
        },
      });
      expect(result.suspicious).toBe(true);
      expect(result.reasons.some((r) => r.includes('negative margin'))).toBe(true);
    });

    it('should not flag normal distribution calculations', () => {
      const result = detectSuspiciousCalculation({
        type: 'distribution',
        values: {
          numPallets: 10,
          unitsPerPallet: 100,
          totalCPU: 5.0,
          price: 10.0,
        },
      });
      expect(result.suspicious).toBe(false);
    });
  });

  describe('promo calculations', () => {
    it('should detect unrealistic promo costs', () => {
      const result = detectSuspiciousCalculation({
        type: 'promo',
        values: {
          totalPromoCost: 60000,
          margin: 55,
        },
      });
      expect(result.suspicious).toBe(true);
    });

    it('should detect very low margins', () => {
      const result = detectSuspiciousCalculation({
        type: 'promo',
        values: {
          totalPromoCost: 5000,
          margin: 5,
        },
      });
      expect(result.suspicious).toBe(true);
      expect(result.reasons.some((r) => r.includes('very low'))).toBe(true);
    });

    it('should not flag healthy promo margins', () => {
      const result = detectSuspiciousCalculation({
        type: 'promo',
        values: {
          totalPromoCost: 2000,
          margin: 60,
        },
      });
      expect(result.suspicious).toBe(false);
    });
  });

  describe('invoice calculations', () => {
    it('should detect unrealistic invoice totals', () => {
      const result = detectSuspiciousCalculation({
        type: 'invoice',
        values: {
          totalPaid: 150000,
        },
      });
      expect(result.suspicious).toBe(true);
    });

    it('should detect unrealistic line totals', () => {
      const result = detectSuspiciousCalculation({
        type: 'invoice',
        values: {
          totalPaid: 50000,
          unitPrice: 100,
          quantity: 1000,
        },
      });
      expect(result.suspicious).toBe(true);
    });

    it('should not flag normal invoices', () => {
      const result = detectSuspiciousCalculation({
        type: 'invoice',
        values: {
          totalPaid: 5000,
          unitPrice: 10,
          quantity: 100,
        },
      });
      expect(result.suspicious).toBe(false);
    });
  });

  describe('extremely large values', () => {
    it('should detect extremely large values across all types', () => {
      const result = detectSuspiciousCalculation({
        type: 'distribution',
        values: {
          numPallets: 10,
          totalCPU: 150000,
          price: 10.0,
        },
      });
      expect(result.suspicious).toBe(true);
      expect(result.reasons.some((r) => r.includes('unusually large'))).toBe(true);
    });
  });
});
