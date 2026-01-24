/**
 * CPG Reporting Service Tests
 *
 * Tests for CPG-specific reporting functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db';
import {
  generateCPGProfitLoss,
  getGrossMarginByProduct,
  compareDistributors,
  getTradeSpendSummary,
  exportToCSV,
} from './cpgReporting.service';
import type { CPGInvoice, CPGDistributor, CPGSalesPromo } from '../../db/schema/cpg.schema';

describe('CPG Reporting Service', () => {
  const testCompanyId = 'test-company-cpg-reports';
  const testDeviceId = 'test-device-reports';

  beforeEach(async () => {
    // Clear test data
    await db.cpgInvoices.where('company_id').equals(testCompanyId).delete();
    await db.cpgCategories.where('company_id').equals(testCompanyId).delete();
    await db.cpgDistributors.where('company_id').equals(testCompanyId).delete();
    await db.cpgDistributionCalculations.where('company_id').equals(testCompanyId).delete();
    await db.cpgSalesPromos.where('company_id').equals(testCompanyId).delete();
  });

  afterEach(async () => {
    // Clean up
    await db.cpgInvoices.where('company_id').equals(testCompanyId).delete();
    await db.cpgCategories.where('company_id').equals(testCompanyId).delete();
    await db.cpgDistributors.where('company_id').equals(testCompanyId).delete();
    await db.cpgDistributionCalculations.where('company_id').equals(testCompanyId).delete();
    await db.cpgSalesPromos.where('company_id').equals(testCompanyId).delete();
  });

  describe('generateCPGProfitLoss', () => {
    it('should generate P&L report with CPG data', async () => {
      // Create category
      const categoryId = await db.cpgCategories.add({
        id: 'cat-oil-1',
        company_id: testCompanyId,
        name: 'Oil',
        description: null,
        variants: ['8oz', '16oz'],
        sort_order: 1,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      // Create invoice
      await db.cpgInvoices.add({
        id: 'inv-1',
        company_id: testCompanyId,
        invoice_number: 'INV-001',
        invoice_date: Date.now(),
        vendor_name: 'Test Vendor',
        notes: null,
        cost_attribution: {
          Oil_8oz: {
            category_id: categoryId as string,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '100',
          },
        },
        additional_costs: null,
        total_paid: '500.00',
        calculated_cpus: {
          '8oz': '5.00',
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      const startDate = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
      const endDate = Date.now();

      const report = await generateCPGProfitLoss(testCompanyId, startDate, endDate);

      expect(report).toBeDefined();
      expect(report.companyId).toBe(testCompanyId);
      expect(report.cogs).toBe(500);
      expect(report.cpuBreakdown).toHaveLength(1);
      expect(report.cpuBreakdown[0].cpu).toBe(5);
    });

    it('should handle empty data gracefully', async () => {
      const startDate = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const endDate = Date.now();

      const report = await generateCPGProfitLoss(testCompanyId, startDate, endDate);

      expect(report).toBeDefined();
      expect(report.cogs).toBe(0);
      expect(report.cpuBreakdown).toHaveLength(0);
      expect(report.distributionCosts).toHaveLength(0);
    });
  });

  describe('getGrossMarginByProduct', () => {
    it('should calculate gross margins for products', async () => {
      // Create category
      const categoryId = await db.cpgCategories.add({
        id: 'cat-oil-2',
        company_id: testCompanyId,
        name: 'Oil',
        description: null,
        variants: ['8oz'],
        sort_order: 1,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      // Create invoice with calculated CPU
      await db.cpgInvoices.add({
        id: 'inv-2',
        company_id: testCompanyId,
        invoice_number: 'INV-002',
        invoice_date: Date.now(),
        vendor_name: 'Test Vendor',
        notes: null,
        cost_attribution: {
          Oil_8oz: {
            category_id: categoryId as string,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '100',
          },
        },
        additional_costs: null,
        total_paid: '500.00',
        calculated_cpus: {
          '8oz': '5.00',
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      const margins = await getGrossMarginByProduct(testCompanyId);

      expect(margins).toHaveLength(1);
      expect(margins[0].categoryName).toBe('Oil');
      expect(margins[0].variant).toBe('8oz');
      expect(margins[0].cpu).toBe(5);
      expect(margins[0].grossMarginPercentage).toBeGreaterThan(0);
    });

    it('should filter by margin quality', async () => {
      const categoryId = await db.cpgCategories.add({
        id: 'cat-oil-3',
        company_id: testCompanyId,
        name: 'Oil',
        description: null,
        variants: ['8oz'],
        sort_order: 1,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      await db.cpgInvoices.add({
        id: 'inv-3',
        company_id: testCompanyId,
        invoice_number: 'INV-003',
        invoice_date: Date.now(),
        vendor_name: 'Test Vendor',
        notes: null,
        cost_attribution: {
          Oil_8oz: {
            category_id: categoryId as string,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '5.00',
            units_received: '100',
          },
        },
        additional_costs: null,
        total_paid: '500.00',
        calculated_cpus: {
          '8oz': '5.00',
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      // Filter for 'best' margins (70%+)
      const margins = await getGrossMarginByProduct(testCompanyId, {
        marginQuality: 'best',
      });

      // With 3x markup, margin should be 66.67%, which is 'better' not 'best'
      expect(margins).toHaveLength(0);
    });
  });

  describe('compareDistributors', () => {
    it('should compare distributors and identify most cost-effective', async () => {
      // Create two distributors
      const dist1Id = await db.cpgDistributors.add({
        id: 'dist-1',
        company_id: testCompanyId,
        name: 'Distributor A',
        description: null,
        contact_info: null,
        fee_structure: {
          pallet_cost: '50.00',
          warehouse_services: '25.00',
          pallet_build: null,
          floor_space_full_day: null,
          floor_space_half_day: null,
          truck_transfer_zone1: null,
          truck_transfer_zone2: null,
          custom_fees: null,
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      const dist2Id = await db.cpgDistributors.add({
        id: 'dist-2',
        company_id: testCompanyId,
        name: 'Distributor B',
        description: null,
        contact_info: null,
        fee_structure: {
          pallet_cost: '100.00',
          warehouse_services: '50.00',
          pallet_build: null,
          floor_space_full_day: null,
          floor_space_half_day: null,
          truck_transfer_zone1: null,
          truck_transfer_zone2: null,
          custom_fees: null,
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      // Create calculations for both
      await db.cpgDistributionCalculations.add({
        id: 'calc-1',
        company_id: testCompanyId,
        distributor_id: dist1Id as string,
        calculation_name: 'Test Calc 1',
        calculation_date: Date.now(),
        num_pallets: '1.00',
        units_per_pallet: '100',
        variant_data: {
          '8oz': {
            price_per_unit: '10.00',
            base_cpu: '5.00',
          },
        },
        applied_fees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: false,
          floor_space: 'none',
          floor_space_days: null,
          truck_transfer_zone: 'none',
          custom_fees: null,
        },
        total_distribution_cost: '75.00',
        distribution_cost_per_unit: '0.75',
        variant_results: {
          '8oz': {
            total_cpu: '5.75',
            net_profit_margin: '42.5',
            margin_quality: 'poor',
            msrp: null,
          },
        },
        msrp_markup_percentage: null,
        notes: null,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      await db.cpgDistributionCalculations.add({
        id: 'calc-2',
        company_id: testCompanyId,
        distributor_id: dist2Id as string,
        calculation_name: 'Test Calc 2',
        calculation_date: Date.now(),
        num_pallets: '1.00',
        units_per_pallet: '100',
        variant_data: {
          '8oz': {
            price_per_unit: '10.00',
            base_cpu: '5.00',
          },
        },
        applied_fees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: false,
          floor_space: 'none',
          floor_space_days: null,
          truck_transfer_zone: 'none',
          custom_fees: null,
        },
        total_distribution_cost: '150.00',
        distribution_cost_per_unit: '1.50',
        variant_results: {
          '8oz': {
            total_cpu: '6.50',
            net_profit_margin: '35.0',
            margin_quality: 'poor',
            msrp: null,
          },
        },
        msrp_markup_percentage: null,
        notes: null,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      const comparison = await compareDistributors(testCompanyId, [
        dist1Id as string,
        dist2Id as string,
      ]);

      expect(comparison.distributors).toHaveLength(2);
      expect(comparison.mostCostEffective).toBe(dist1Id);
      expect(comparison.leastCostEffective).toBe(dist2Id);

      const dist1 = comparison.distributors.find((d) => d.distributorId === dist1Id);
      expect(dist1?.costPerUnit).toBe(0.75);
      expect(dist1?.feeBreakdown).toHaveLength(2); // Pallet cost + warehouse services
    });
  });

  describe('getTradeSpendSummary', () => {
    it('should summarize trade spend and recommendations', async () => {
      // Create sales promos
      await db.cpgSalesPromos.add({
        id: 'promo-1',
        company_id: testCompanyId,
        promo_name: 'Summer Sale',
        retailer_name: 'Big Box Store',
        promo_start_date: Date.now(),
        promo_end_date: Date.now() + 7 * 24 * 60 * 60 * 1000,
        store_sale_percentage: '20',
        producer_payback_percentage: '10',
        variant_promo_data: {
          '8oz': {
            retail_price: '10.00',
            units_available: '100',
            base_cpu: '5.00',
          },
        },
        variant_promo_results: {
          '8oz': {
            sales_promo_cost_per_unit: '1.00',
            cpu_with_promo: '6.00',
            net_profit_margin_with_promo: '40.0',
            net_profit_margin_without_promo: '50.0',
            margin_quality_with_promo: 'poor',
          },
        },
        total_promo_cost: '100.00',
        recommendation: 'decline',
        notes: null,
        status: 'submitted',
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      await db.cpgSalesPromos.add({
        id: 'promo-2',
        company_id: testCompanyId,
        promo_name: 'Fall Promo',
        retailer_name: 'Grocery Chain',
        promo_start_date: Date.now(),
        promo_end_date: Date.now() + 14 * 24 * 60 * 60 * 1000,
        store_sale_percentage: '15',
        producer_payback_percentage: '5',
        variant_promo_data: {
          '8oz': {
            retail_price: '10.00',
            units_available: '200',
            base_cpu: '5.00',
          },
        },
        variant_promo_results: {
          '8oz': {
            sales_promo_cost_per_unit: '0.50',
            cpu_with_promo: '5.50',
            net_profit_margin_with_promo: '45.0',
            net_profit_margin_without_promo: '50.0',
            margin_quality_with_promo: 'neutral',
          },
        },
        total_promo_cost: '100.00',
        recommendation: 'participate',
        notes: null,
        status: 'approved',
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { [testDeviceId]: 1 },
      });

      const startDate = Date.now() - 1;
      const endDate = Date.now() + 30 * 24 * 60 * 60 * 1000;

      const summary = await getTradeSpendSummary(testCompanyId, startDate, endDate);

      expect(summary.totalTradeSpend).toBe(200);
      expect(summary.promoCount).toBe(2);
      expect(summary.approvedCount).toBe(1);
      expect(summary.participateRecommendations).toBe(1);
      expect(summary.declineRecommendations).toBe(1);
      expect(summary.promos).toHaveLength(2);
    });
  });

  describe('exportToCSV', () => {
    it('should export data to CSV format', async () => {
      const data = [
        { product: 'Oil 8oz', cpu: 5.0, margin: 66.67 },
        { product: 'Oil 16oz', cpu: 4.5, margin: 70.0 },
      ];

      const csv = await exportToCSV(data, 'gross-margin');

      expect(csv).toContain('product,cpu,margin');
      expect(csv).toContain('Oil 8oz,5,66.67');
      expect(csv).toContain('Oil 16oz,4.5,70');
    });

    it('should handle empty data', async () => {
      const csv = await exportToCSV([], 'empty-report');
      expect(csv).toBe('');
    });

    it('should escape special characters', async () => {
      const data = [
        { product: 'Oil, Extra Virgin', note: 'Contains "quotes"' },
      ];

      const csv = await exportToCSV(data, 'special-chars');

      expect(csv).toContain('"Oil, Extra Virgin"');
      expect(csv).toContain('"Contains ""quotes"""');
    });
  });
});
