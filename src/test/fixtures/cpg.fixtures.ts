/**
 * Type-Safe Test Fixtures for CPG Entities
 *
 * These factories create COMPLETE, valid test objects that match production schemas.
 * Using these fixtures ensures tests validate real type safety, not partial objects.
 *
 * Security Note: These are test helpers only - never import in production code.
 */

import { nanoid } from 'nanoid';
import type { CPGCategory, CPGInvoice, CPGVendor, CPGFinishedProduct } from '../../db/schema/cpg.schema';

/**
 * Creates a complete, valid CPGCategory for testing
 */
export const createTestCPGCategory = (overrides?: Partial<CPGCategory>): CPGCategory => {
  const now = Date.now();
  const deviceId = 'test-device-fixture';

  return {
    id: nanoid(),
    company_id: 'test-company-id',
    name: 'Test Category',
    description: null,
    variants: null,
    unit_of_measure: 'each',
    sort_order: 0,
    is_distribution_category: false,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
    ...overrides,
  };
};

/**
 * Creates a complete, valid CPGInvoice for testing
 */
export const createTestCPGInvoice = (overrides?: Partial<CPGInvoice>): CPGInvoice => {
  const now = Date.now();
  const deviceId = 'test-device-fixture';

  return {
    id: nanoid(),
    company_id: 'test-company-id',
    invoice_number: null,
    invoice_date: now,
    vendor_name: null,
    payment_method: null,
    notes: null,
    cost_attribution: {},
    additional_costs: null,
    total_paid: '0.00',
    calculated_cpus: null,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
    ...overrides,
  };
};

/**
 * Creates a complete, valid CPGVendor for testing
 */
export const createTestCPGVendor = (overrides?: Partial<CPGVendor>): CPGVendor => {
  const now = Date.now();
  const deviceId = 'test-device-fixture';

  return {
    id: nanoid(),
    company_id: 'test-company-id',
    name: 'Test Vendor',
    notes: null,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
    ...overrides,
  };
};

/**
 * Creates a complete, valid CPGFinishedProduct for testing
 */
export const createTestCPGFinishedProduct = (overrides?: Partial<CPGFinishedProduct>): CPGFinishedProduct => {
  const now = Date.now();
  const deviceId = 'test-device-fixture';

  return {
    id: nanoid(),
    company_id: 'test-company-id',
    name: 'Test Product',
    sku: null,
    description: null,
    msrp: null,
    unit_of_measure: 'each',
    pieces_per_unit: 1,
    is_bundle: false,
    bundle_items: [],
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
    ...overrides,
  };
};

/**
 * Preset: Oil category with common variants
 */
export const createOilCategory = (companyId: string = 'test-company-id'): CPGCategory => {
  return createTestCPGCategory({
    company_id: companyId,
    name: 'Oil',
    description: 'Bulk oil purchase',
    variants: ['1oz', '5oz', '8oz', 'Bulk'],
    unit_of_measure: 'oz',
    sort_order: 1,
  });
};

/**
 * Preset: Bottle category with size variants
 */
export const createBottleCategory = (companyId: string = 'test-company-id'): CPGCategory => {
  return createTestCPGCategory({
    company_id: companyId,
    name: 'Bottle',
    description: 'Glass bottles',
    variants: ['1oz', '5oz'],
    unit_of_measure: 'each',
    sort_order: 2,
  });
};

/**
 * Preset: Shipping + Handling distribution category
 */
export const createShippingCategory = (companyId: string = 'test-company-id'): CPGCategory => {
  return createTestCPGCategory({
    company_id: companyId,
    name: 'Shipping + Handling',
    description: 'Shipping and handling costs distributed to line items',
    variants: null,
    unit_of_measure: 'total',
    sort_order: 999,
    is_distribution_category: true,
  });
};

/**
 * Preset: Invoice with oil purchase
 */
export const createOilInvoice = (companyId: string = 'test-company-id'): CPGInvoice => {
  const categoryId = nanoid();

  return createTestCPGInvoice({
    company_id: companyId,
    invoice_number: 'INV-001',
    invoice_date: Date.now(),
    vendor_name: 'Oil Supplier Inc',
    payment_method: 'Credit Card',
    notes: 'Bulk oil purchase',
    cost_attribution: {
      [`${categoryId}_bulk`]: {
        category_id: categoryId,
        variant: 'bulk',
        description: 'Bulk oil',
        units_purchased: '100',
        unit_price: '5.00',
        units_received: '100',
      },
    },
    total_paid: '500.00',
  });
};

/**
 * Security validation helper - ensures test data doesn't leak sensitive info
 */
export const validateTestData = <T extends Record<string, unknown>>(obj: T): void => {
  const sensitiveKeys = ['password', 'passphrase', 'secret', 'key', 'token'];

  for (const key of Object.keys(obj)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      throw new Error(`Test fixture contains sensitive key: ${key}. Use mock values only.`);
    }
  }
};
