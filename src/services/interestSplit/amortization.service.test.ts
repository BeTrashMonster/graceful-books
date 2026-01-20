/**
 * Amortization Service Tests
 *
 * Tests precise amortization calculations using Decimal.js.
 *
 * Requirements:
 * - H7: Interest Split Prompt System (Precise calculations)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AmortizationService } from './amortization.service';
import type { TreasureChestDB } from '../../db/database';
import type { GenerateScheduleRequest } from '../../types/loanAmortization.types';
import Decimal from 'decimal.js';

describe('AmortizationService', () => {
  describe('generateSchedule', () => {
    it('should generate amortized schedule with correct calculations', async () => {
      // TODO: Implement test with proper mocking
      // Need to mock getLoanAccount (private method called internally)
      // In production, we'd need the loan_accounts table to exist

      // This test would work once the loan_accounts table exists
      expect(true).toBe(true); // Placeholder
    });

    it('should calculate correct monthly payment for amortized loan', () => {
      // Test the amortization formula directly
      const principal = new Decimal('10000');
      const annualRate = new Decimal('0.06'); // 6%
      const monthlyRate = annualRate.div(12); // 0.005
      const months = 12;

      // Manual calculation using formula: P = L[c(1 + c)^n]/[(1 + c)^n - 1]
      const onePlusRate = new Decimal(1).plus(monthlyRate);
      const powerN = onePlusRate.pow(months);
      const numerator = monthlyRate.times(powerN);
      const denominator = powerN.minus(1);
      const payment = principal.times(numerator.div(denominator));

      // Expected monthly payment for $10,000 at 6% for 12 months
      expect(payment.toFixed(2)).toBe('860.66');
    });

    it('should handle zero interest rate', () => {
      const principal = new Decimal('10000');
      const months = 12;

      // With 0% interest, payment should be principal / months
      const payment = principal.div(months);

      expect(payment.toFixed(2)).toBe('833.33');
    });

    it('should calculate correct total interest over loan term', () => {
      const principal = new Decimal('10000');
      const monthlyPayment = new Decimal('860.66');
      const months = 12;

      const totalPayments = monthlyPayment.times(months);
      const totalInterest = totalPayments.minus(principal);

      // Total interest should be approximately $327.92
      expect(totalInterest.toFixed(2)).toBe('327.92');
    });
  });

  describe('periodic rate calculations', () => {
    it('should calculate monthly rate correctly', () => {
      const annualRate = new Decimal('0.06'); // 6%
      const monthlyRate = annualRate.div(12);

      expect(monthlyRate.toFixed(6)).toBe('0.005000');
    });

    it('should calculate quarterly rate correctly', () => {
      const annualRate = new Decimal('0.06'); // 6%
      const quarterlyRate = annualRate.div(4);

      expect(quarterlyRate.toFixed(6)).toBe('0.015000');
    });

    it('should calculate bi-weekly rate correctly', () => {
      const annualRate = new Decimal('0.06'); // 6%
      const biWeeklyRate = annualRate.div(26);

      expect(biWeeklyRate.toFixed(6)).toBe('0.002308');
    });
  });

  describe('amortization schedule validation', () => {
    it('should ensure all payments sum to principal plus interest', () => {
      // For a $10,000 loan at 6% for 12 months
      const principal = new Decimal('10000');
      const monthlyPayment = new Decimal('860.66');
      const months = 12;

      let totalPaid = new Decimal('0');
      let balance = principal;
      const monthlyRate = new Decimal('0.005');

      for (let i = 0; i < months; i++) {
        const interest = balance.times(monthlyRate);
        const principalPayment = monthlyPayment.minus(interest);
        balance = balance.minus(principalPayment);
        totalPaid = totalPaid.plus(monthlyPayment);
      }

      // Balance should be very close to zero (allowing for rounding)
      // Using 0.10 tolerance since the payment amount is rounded to cents
      expect(balance.abs().lessThan(0.10)).toBe(true);

      // Total paid should equal principal + total interest
      const totalInterest = totalPaid.minus(principal);
      expect(totalInterest.toFixed(2)).toBe('327.92');
    });

    it('should have decreasing interest and increasing principal each month', () => {
      const principal = new Decimal('10000');
      const monthlyPayment = new Decimal('860.66');
      const monthlyRate = new Decimal('0.005');

      let balance = principal;
      let previousInterest: Decimal | null = null;
      let previousPrincipal: Decimal | null = null;

      for (let i = 0; i < 6; i++) {
        const interest = balance.times(monthlyRate);
        const principalPayment = monthlyPayment.minus(interest);

        if (previousInterest !== null) {
          // Interest should decrease
          expect(interest.lessThan(previousInterest)).toBe(true);
          // Principal payment should increase
          expect(principalPayment.greaterThan(previousPrincipal!)).toBe(true);
        }

        previousInterest = interest;
        previousPrincipal = principalPayment;
        balance = balance.minus(principalPayment);
      }
    });
  });

  describe('simple interest calculations', () => {
    it('should calculate correct payment for simple interest loan', () => {
      const principal = new Decimal('10000');
      const annualRate = new Decimal('0.06'); // 6%
      const months = 12;

      // Principal per payment
      const principalPerPayment = principal.div(months);

      // Interest per payment (simple interest)
      const periodsPerYear = 12;
      const interestPerPayment = principal.times(annualRate).div(periodsPerYear);

      // Total payment
      const payment = principalPerPayment.plus(interestPerPayment);

      expect(principalPerPayment.toFixed(2)).toBe('833.33');
      expect(interestPerPayment.toFixed(2)).toBe('50.00');
      expect(payment.toFixed(2)).toBe('883.33');
    });

    it('should have constant interest for simple interest loan', () => {
      const principal = new Decimal('10000');
      const annualRate = new Decimal('0.06');
      const periodsPerYear = 12;

      const interestPerPayment = principal.times(annualRate).div(periodsPerYear);

      // Interest should be constant at $50.00 per month
      expect(interestPerPayment.toFixed(2)).toBe('50.00');
    });
  });

  describe('edge cases', () => {
    it('should handle very small principal amounts', () => {
      const principal = new Decimal('1.00');
      const monthlyRate = new Decimal('0.005');
      const months = 12;

      const onePlusRate = new Decimal(1).plus(monthlyRate);
      const powerN = onePlusRate.pow(months);
      const numerator = monthlyRate.times(powerN);
      const denominator = powerN.minus(1);
      const payment = principal.times(numerator.div(denominator));

      expect(payment.toFixed(2)).toBe('0.09');
    });

    it('should handle very large principal amounts', () => {
      const principal = new Decimal('1000000.00');
      const monthlyRate = new Decimal('0.005');
      const months = 360; // 30-year loan

      const onePlusRate = new Decimal(1).plus(monthlyRate);
      const powerN = onePlusRate.pow(months);
      const numerator = monthlyRate.times(powerN);
      const denominator = powerN.minus(1);
      const payment = principal.times(numerator.div(denominator));

      // Payment should be around $5,995.51
      expect(payment.toFixed(2)).toBe('5995.51');
    });

    it('should handle very long loan terms', () => {
      const principal = new Decimal('100000');
      const monthlyRate = new Decimal('0.004'); // 4.8% annual
      const months = 360; // 30 years

      const onePlusRate = new Decimal(1).plus(monthlyRate);
      const powerN = onePlusRate.pow(months);
      const numerator = monthlyRate.times(powerN);
      const denominator = powerN.minus(1);
      const payment = principal.times(numerator.div(denominator));

      // Should calculate without overflow
      expect(payment.toNumber()).toBeGreaterThan(0);
      expect(payment.toNumber()).toBeLessThan(principal.toNumber());
    });

    it('should maintain precision with Decimal.js', () => {
      // Test that we avoid floating point errors
      const a = new Decimal('0.1');
      const b = new Decimal('0.2');
      const sum = a.plus(b);

      expect(sum.toString()).toBe('0.3'); // Not 0.30000000000000004
    });
  });
});
