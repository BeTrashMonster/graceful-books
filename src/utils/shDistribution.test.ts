import { describe, it, expect } from 'vitest';
import {
  calculateSHDistribution,
  formatDistributionPreview,
  Invoice,
  SHDistributionSettings
} from './shDistribution';

describe('S+H Distribution Calculator', () => {
  // Helper to create test invoices
  const createInvoice = (id: string, items: Array<{ category_id: string; line_total: string }>): Invoice => ({
    id,
    vendor_name: `Vendor ${id}`,
    items: items.map(item => ({
      category_id: item.category_id,
      line_total: item.line_total
    }))
  });

  describe('Weighted Distribution (by %)', () => {
    it('should distribute S+H proportionally to item totals', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '10.00' },
          { category_id: 'cat-b', line_total: '20.00' },
          { category_id: 'cat-c', line_total: '30.00' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 6.00,
        distribution_method: 'weighted',
        items_filter: 'all',
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      expect(result.totalAmount).toBe(6.00);
      expect(result.eligibleItemsCount).toBe(3);
      expect(result.eligibleItemsTotal).toBe(60.00);
      expect(result.method).toBe('weighted');

      // $10 is 16.67% of $60, so gets $1.00 of $6
      expect(result.distributions[0].distributedAmount).toBe(1.00);
      expect(result.distributions[0].percentage).toBeCloseTo(16.67, 1);

      // $20 is 33.33% of $60, so gets $2.00 of $6
      expect(result.distributions[1].distributedAmount).toBe(2.00);
      expect(result.distributions[1].percentage).toBeCloseTo(33.33, 1);

      // $30 is 50% of $60, so gets $3.00 of $6
      expect(result.distributions[2].distributedAmount).toBe(3.00);
      expect(result.distributions[2].percentage).toBe(50);
    });

    it('should handle uneven amounts with penny-perfect distribution', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '33.33' },
          { category_id: 'cat-b', line_total: '33.33' },
          { category_id: 'cat-c', line_total: '33.34' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 10.00,
        distribution_method: 'weighted',
        items_filter: 'all',
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      // Total distributed must equal EXACTLY $10.00 (penny-perfect)
      const totalDistributed = result.distributions.reduce((sum, d) => sum + d.distributedAmount, 0);
      expect(totalDistributed).toBe(10.00);

      // Percentages must sum to exactly 100%
      const totalPercentage = result.distributions.reduce((sum, d) => sum + d.percentage, 0);
      expect(totalPercentage).toBe(100);
    });
  });

  describe('Equal Distribution (evenly)', () => {
    it('should distribute S+H equally regardless of item totals', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '10.00' },
          { category_id: 'cat-b', line_total: '20.00' },
          { category_id: 'cat-c', line_total: '30.00' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 6.00,
        distribution_method: 'equal',
        items_filter: 'all',
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      expect(result.eligibleItemsCount).toBe(3);
      expect(result.method).toBe('equal');

      // Each item gets $2.00 regardless of their total
      expect(result.distributions[0].distributedAmount).toBe(2.00);
      expect(result.distributions[1].distributedAmount).toBe(2.00);
      expect(result.distributions[2].distributedAmount).toBe(2.00);

      // Percentages must sum to exactly 100% (33.4 + 33.3 + 33.3 = 100.0)
      const percentages = result.distributions.map(d => d.percentage).sort((a, b) => b - a);
      expect(percentages).toEqual([33.4, 33.3, 33.3]);
    });

    it('should handle odd numbers with penny-perfect distribution', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '100.00' },
          { category_id: 'cat-b', line_total: '100.00' },
          { category_id: 'cat-c', line_total: '100.00' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 10.00,
        distribution_method: 'equal',
        items_filter: 'all',
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      // $10 / 3 = $3.33, $3.33, $3.34 (one gets the extra penny)
      // Total must equal EXACTLY $10.00
      const totalDistributed = result.distributions.reduce((sum, d) => sum + d.distributedAmount, 0);
      expect(totalDistributed).toBe(10.00);

      // Percentages must sum to exactly 100% (account for JS floating point by rounding)
      const totalPercentage = result.distributions.reduce((sum, d) => sum + d.percentage, 0);
      expect(Math.round(totalPercentage * 10) / 10).toBe(100);

      // Each should be close to $3.33 but one will have $3.34
      const amounts = result.distributions.map(d => d.distributedAmount).sort();
      expect(amounts).toEqual([3.33, 3.33, 3.34]);
    });
  });

  describe('Category Filtering', () => {
    it('should only distribute to selected categories when filter is "categories"', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-flour', line_total: '20.00' },
          { category_id: 'cat-sugar', line_total: '20.00' },
          { category_id: 'cat-butter', line_total: '20.00' },
          { category_id: 'cat-eggs', line_total: '20.00' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 8.00,
        distribution_method: 'equal',
        items_filter: 'categories',
        selected_categories: ['cat-flour', 'cat-sugar'],
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      // Only 2 items should be eligible
      expect(result.eligibleItemsCount).toBe(2);
      expect(result.eligibleItemsTotal).toBe(40.00);

      // $8 / 2 = $4 each
      expect(result.distributions.length).toBe(2);
      expect(result.distributions[0].distributedAmount).toBe(4.00);
      expect(result.distributions[1].distributedAmount).toBe(4.00);

      // Verify correct categories
      expect(result.distributions[0].categoryId).toBe('cat-flour');
      expect(result.distributions[1].categoryId).toBe('cat-sugar');
    });

    it('should distribute weighted within filtered categories', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-flour', line_total: '10.00' },  // 25% of filtered
          { category_id: 'cat-sugar', line_total: '30.00' },  // 75% of filtered
          { category_id: 'cat-butter', line_total: '100.00' } // excluded
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 4.00,
        distribution_method: 'weighted',
        items_filter: 'categories',
        selected_categories: ['cat-flour', 'cat-sugar'],
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      expect(result.eligibleItemsCount).toBe(2);
      expect(result.eligibleItemsTotal).toBe(40.00);

      // $10 is 25% of $40, gets $1 of $4
      expect(result.distributions[0].distributedAmount).toBe(1.00);
      // $30 is 75% of $40, gets $3 of $4
      expect(result.distributions[1].distributedAmount).toBe(3.00);
    });
  });

  describe('Multi-Invoice Distribution', () => {
    it('should distribute across multiple invoices when target_invoices is set', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '50.00' }
        ]),
        createInvoice('inv-2', [
          { category_id: 'cat-b', line_total: '50.00' }
        ]),
        createInvoice('inv-3', [
          { category_id: 'cat-c', line_total: '100.00' } // not included
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 10.00,
        distribution_method: 'equal',
        items_filter: 'all',
        target_invoices: ['inv-2'], // Include inv-2 in addition to current
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      // Should include items from inv-1 and inv-2, but not inv-3
      expect(result.eligibleItemsCount).toBe(2);
      expect(result.distributions[0].invoiceId).toBe('inv-1');
      expect(result.distributions[1].invoiceId).toBe('inv-2');

      // $10 / 2 = $5 each
      expect(result.distributions[0].distributedAmount).toBe(5.00);
      expect(result.distributions[1].distributedAmount).toBe(5.00);
    });

    it('should distribute weighted across multiple invoices', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '25.00' }
        ]),
        createInvoice('inv-2', [
          { category_id: 'cat-b', line_total: '75.00' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 20.00,
        distribution_method: 'weighted',
        items_filter: 'all',
        target_invoices: ['inv-2'],
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      expect(result.eligibleItemsTotal).toBe(100.00);

      // $25 is 25% of $100, gets $5 of $20
      expect(result.distributions[0].distributedAmount).toBe(5.00);
      // $75 is 75% of $100, gets $15 of $20
      expect(result.distributions[1].distributedAmount).toBe(15.00);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero S+H amount', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '100.00' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 0,
        distribution_method: 'weighted',
        items_filter: 'all',
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      expect(result.totalAmount).toBe(0);
      expect(result.distributions[0].distributedAmount).toBe(0);
    });

    it('should handle no eligible items', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '100.00' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 10.00,
        distribution_method: 'weighted',
        items_filter: 'categories',
        selected_categories: ['cat-nonexistent'],
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      expect(result.eligibleItemsCount).toBe(0);
      expect(result.distributions.length).toBe(0);
    });

    it('should handle items with zero totals', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '0.00' },
          { category_id: 'cat-b', line_total: '100.00' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 10.00,
        distribution_method: 'weighted',
        items_filter: 'all',
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      // Zero total items should be excluded
      expect(result.eligibleItemsCount).toBe(1);
      expect(result.distributions[0].distributedAmount).toBe(10.00);
    });

    it('should exclude S+H and personal items from distribution', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '50.00' },
          { category_id: '__shipping__', line_total: '10.00' },
          { category_id: '__personal__', line_total: '20.00' },
          { category_id: 'cat-b', line_total: '50.00' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 10.00,
        distribution_method: 'equal',
        items_filter: 'all',
        current_invoice_id: 'inv-1'
      };

      const result = calculateSHDistribution(settings, invoices);

      // Should only include cat-a and cat-b
      expect(result.eligibleItemsCount).toBe(2);
      expect(result.distributions[0].distributedAmount).toBe(5.00);
      expect(result.distributions[1].distributedAmount).toBe(5.00);
    });

    it('should exclude categories via excluded_category_ids (for S+H distribution categories)', () => {
      const invoices: Invoice[] = [
        createInvoice('inv-1', [
          { category_id: 'cat-a', line_total: '50.00' },
          { category_id: 'cat-sh', line_total: '15.00' }, // This is an S+H category
          { category_id: 'cat-b', line_total: '50.00' }
        ])
      ];

      const settings: SHDistributionSettings = {
        amount: 10.00,
        distribution_method: 'equal',
        items_filter: 'all',
        current_invoice_id: 'inv-1',
        excluded_category_ids: ['cat-sh'] // Exclude the S+H category
      };

      const result = calculateSHDistribution(settings, invoices);

      // Should only include cat-a and cat-b, NOT cat-sh
      expect(result.eligibleItemsCount).toBe(2);
      expect(result.distributions[0].categoryId).toBe('cat-a');
      expect(result.distributions[1].categoryId).toBe('cat-b');
      expect(result.distributions[0].distributedAmount).toBe(5.00);
      expect(result.distributions[1].distributedAmount).toBe(5.00);
    });
  });

  describe('formatDistributionPreview', () => {
    it('should format weighted distribution with percentages', () => {
      const summary = {
        totalAmount: 6.00,
        eligibleItemsCount: 2,
        eligibleItemsTotal: 60.00,
        method: 'weighted' as const,
        distributions: [
          { invoiceId: 'inv-1', itemIndex: 0, categoryId: 'cat-flour', itemTotal: 20, distributedAmount: 2.00, percentage: 33.33 },
          { invoiceId: 'inv-1', itemIndex: 1, categoryId: 'cat-sugar', itemTotal: 40, distributedAmount: 4.00, percentage: 66.67 }
        ]
      };

      const getCategoryName = (id: string) => id === 'cat-flour' ? 'Flour' : 'Sugar';
      const result = formatDistributionPreview(summary, getCategoryName);

      expect(result).toEqual([
        'Flour: $2.00 (33.3%)',
        'Sugar: $4.00 (66.7%)'
      ]);
    });

    it('should format equal distribution without percentages', () => {
      const summary = {
        totalAmount: 6.00,
        eligibleItemsCount: 2,
        eligibleItemsTotal: 60.00,
        method: 'equal' as const,
        distributions: [
          { invoiceId: 'inv-1', itemIndex: 0, categoryId: 'cat-flour', itemTotal: 20, distributedAmount: 3.00, percentage: 50 },
          { invoiceId: 'inv-1', itemIndex: 1, categoryId: 'cat-sugar', itemTotal: 40, distributedAmount: 3.00, percentage: 50 }
        ]
      };

      const getCategoryName = (id: string) => id === 'cat-flour' ? 'Flour' : 'Sugar';
      const result = formatDistributionPreview(summary, getCategoryName);

      expect(result).toEqual([
        'Flour: $3.00',
        'Sugar: $3.00'
      ]);
    });

    it('should handle no eligible items', () => {
      const summary = {
        totalAmount: 10.00,
        eligibleItemsCount: 0,
        eligibleItemsTotal: 0,
        method: 'weighted' as const,
        distributions: []
      };

      const getCategoryName = () => '';
      const result = formatDistributionPreview(summary, getCategoryName);

      expect(result).toEqual(['No eligible items to distribute to']);
    });
  });
});
