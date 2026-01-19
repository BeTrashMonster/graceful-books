/**
 * Amortization Calculation Service
 *
 * Implements precise amortization schedule calculations using Decimal.js
 * to avoid floating-point errors in financial calculations.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 * - ACCT-009: Precise Amortization Calculations
 */

import Decimal from 'decimal.js';
import type { TreasureChestDB } from '../../db/database';
import type {
  LoanAccount,
  AmortizationSchedule,
  AmortizationScheduleEntry,
  GenerateScheduleRequest,
  LoanPaymentFrequency,
  InterestCalculationMethod,
  UpdateLoanBalanceRequest,
} from '../../types/loanAmortization.types';
import type { VersionVector } from '../../types/database.types';
import { nanoid } from 'nanoid';

/**
 * Amortization Service
 */
export class AmortizationService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Generate complete amortization schedule for a loan
   */
  async generateSchedule(
    request: GenerateScheduleRequest,
    deviceId: string
  ): Promise<AmortizationSchedule> {
    const {
      loan_account_id,
      principal_amount,
      interest_rate,
      term_months,
      payment_frequency,
      first_payment_date,
      calculation_method,
    } = request;

    // Get loan account to find company_id
    const loanAccount = await this.getLoanAccount(loan_account_id);
    if (!loanAccount) {
      throw new Error(`Loan account ${loan_account_id} not found`);
    }

    // Convert to Decimal for precision
    const principal = new Decimal(principal_amount);
    const annualRate = new Decimal(interest_rate).div(100); // Convert percentage to decimal

    // Calculate number of payments based on frequency
    const totalPayments = this.calculateTotalPayments(term_months, payment_frequency);
    const periodicRate = this.calculatePeriodicRate(annualRate, payment_frequency);

    let entries: AmortizationScheduleEntry[] = [];

    if (calculation_method === 'AMORTIZED') {
      entries = await this.generateAmortizedSchedule(
        loanAccount.company_id,
        loan_account_id,
        principal,
        periodicRate,
        totalPayments,
        first_payment_date,
        payment_frequency,
        deviceId
      );
    } else if (calculation_method === 'SIMPLE') {
      entries = await this.generateSimpleInterestSchedule(
        loanAccount.company_id,
        loan_account_id,
        principal,
        annualRate,
        totalPayments,
        first_payment_date,
        payment_frequency,
        deviceId
      );
    } else {
      throw new Error(`Unsupported calculation method: ${calculation_method}`);
    }

    // Calculate totals
    const totalInterest = entries.reduce(
      (sum, entry) => sum.plus(new Decimal(entry.interest_amount)),
      new Decimal(0)
    );
    const totalScheduledPayments = entries.reduce(
      (sum, entry) => sum.plus(new Decimal(entry.scheduled_payment)),
      new Decimal(0)
    );

    return {
      loan_account_id,
      entries,
      total_interest: totalInterest.toFixed(2),
      total_payments: totalScheduledPayments.toFixed(2),
      generated_at: Date.now(),
    };
  }

  /**
   * Generate amortized loan schedule (fixed payment amount)
   * Uses standard amortization formula: P = L[c(1 + c)^n]/[(1 + c)^n - 1]
   */
  private async generateAmortizedSchedule(
    companyId: string,
    loanAccountId: string,
    principal: Decimal,
    periodicRate: Decimal,
    totalPayments: number,
    firstPaymentDate: number,
    frequency: LoanPaymentFrequency,
    deviceId: string
  ): Promise<AmortizationScheduleEntry[]> {
    const entries: AmortizationScheduleEntry[] = [];

    // Calculate fixed payment amount using amortization formula
    const paymentAmount = this.calculateAmortizedPayment(
      principal,
      periodicRate,
      totalPayments
    );

    let remainingBalance = principal;
    let currentDate = firstPaymentDate;

    for (let paymentNum = 1; paymentNum <= totalPayments; paymentNum++) {
      // Interest for this period = remaining balance * periodic rate
      const interestAmount = remainingBalance.times(periodicRate);

      // Principal = payment - interest
      let principalAmount = paymentAmount.minus(interestAmount);

      // Last payment adjustment (might be slightly different due to rounding)
      if (paymentNum === totalPayments) {
        principalAmount = remainingBalance;
      }

      // Update remaining balance
      remainingBalance = remainingBalance.minus(principalAmount);

      // Ensure balance doesn't go negative due to rounding
      if (remainingBalance.lessThan(0)) {
        remainingBalance = new Decimal(0);
      }

      const now = Date.now();
      const entry: AmortizationScheduleEntry = {
        id: nanoid(),
        company_id: companyId,
        loan_account_id: loanAccountId,
        payment_number: paymentNum,
        payment_date: currentDate,
        scheduled_payment: paymentAmount.toFixed(2),
        principal_amount: principalAmount.toFixed(2),
        interest_amount: interestAmount.toFixed(2),
        remaining_balance: remainingBalance.toFixed(2),
        is_paid: false,
        actual_payment_date: null,
        actual_payment_amount: null,
        transaction_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: { [deviceId]: 1 },
      };

      entries.push(entry);

      // Calculate next payment date
      currentDate = this.addPaymentPeriod(currentDate, frequency);
    }

    return entries;
  }

  /**
   * Generate simple interest schedule
   */
  private async generateSimpleInterestSchedule(
    companyId: string,
    loanAccountId: string,
    principal: Decimal,
    annualRate: Decimal,
    totalPayments: number,
    firstPaymentDate: number,
    frequency: LoanPaymentFrequency,
    deviceId: string
  ): Promise<AmortizationScheduleEntry[]> {
    const entries: AmortizationScheduleEntry[] = [];

    // Simple interest: Principal divided equally, interest calculated on original principal
    const principalPerPayment = principal.div(totalPayments);

    let remainingBalance = principal;
    let currentDate = firstPaymentDate;

    // Calculate interest per payment period
    const periodsPerYear = this.getPeriodsPerYear(frequency);
    const interestPerPeriod = principal.times(annualRate).div(periodsPerYear);

    for (let paymentNum = 1; paymentNum <= totalPayments; paymentNum++) {
      const paymentAmount = principalPerPayment.plus(interestPerPeriod);

      remainingBalance = remainingBalance.minus(principalPerPayment);

      // Ensure balance doesn't go negative
      if (remainingBalance.lessThan(0)) {
        remainingBalance = new Decimal(0);
      }

      const now = Date.now();
      const entry: AmortizationScheduleEntry = {
        id: nanoid(),
        company_id: companyId,
        loan_account_id: loanAccountId,
        payment_number: paymentNum,
        payment_date: currentDate,
        scheduled_payment: paymentAmount.toFixed(2),
        principal_amount: principalPerPayment.toFixed(2),
        interest_amount: interestPerPeriod.toFixed(2),
        remaining_balance: remainingBalance.toFixed(2),
        is_paid: false,
        actual_payment_date: null,
        actual_payment_amount: null,
        transaction_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: { [deviceId]: 1 },
      };

      entries.push(entry);

      // Calculate next payment date
      currentDate = this.addPaymentPeriod(currentDate, frequency);
    }

    return entries;
  }

  /**
   * Calculate fixed payment amount for amortized loan
   * Formula: P = L[c(1 + c)^n]/[(1 + c)^n - 1]
   * Where: P = payment, L = loan amount, c = periodic rate, n = number of payments
   */
  private calculateAmortizedPayment(
    principal: Decimal,
    periodicRate: Decimal,
    totalPayments: number
  ): Decimal {
    if (periodicRate.equals(0)) {
      // No interest, just divide principal
      return principal.div(totalPayments);
    }

    // (1 + c)^n
    const onePlusRatePowerN = new Decimal(1).plus(periodicRate).pow(totalPayments);

    // c(1 + c)^n
    const numerator = periodicRate.times(onePlusRatePowerN);

    // (1 + c)^n - 1
    const denominator = onePlusRatePowerN.minus(1);

    // P = L * [numerator / denominator]
    return principal.times(numerator.div(denominator));
  }

  /**
   * Calculate periodic interest rate from annual rate
   */
  private calculatePeriodicRate(
    annualRate: Decimal,
    frequency: LoanPaymentFrequency
  ): Decimal {
    const periodsPerYear = this.getPeriodsPerYear(frequency);
    return annualRate.div(periodsPerYear);
  }

  /**
   * Get number of payment periods per year
   */
  private getPeriodsPerYear(frequency: LoanPaymentFrequency): number {
    switch (frequency) {
      case 'MONTHLY':
        return 12;
      case 'QUARTERLY':
        return 4;
      case 'SEMI_ANNUAL':
        return 2;
      case 'ANNUAL':
        return 1;
      case 'BI_WEEKLY':
        return 26;
      case 'WEEKLY':
        return 52;
      default:
        return 12;
    }
  }

  /**
   * Calculate total number of payments
   */
  private calculateTotalPayments(
    termMonths: number,
    frequency: LoanPaymentFrequency
  ): number {
    switch (frequency) {
      case 'MONTHLY':
        return termMonths;
      case 'QUARTERLY':
        return Math.ceil(termMonths / 3);
      case 'SEMI_ANNUAL':
        return Math.ceil(termMonths / 6);
      case 'ANNUAL':
        return Math.ceil(termMonths / 12);
      case 'BI_WEEKLY':
        return Math.ceil((termMonths * 26) / 12);
      case 'WEEKLY':
        return Math.ceil((termMonths * 52) / 12);
      default:
        return termMonths;
    }
  }

  /**
   * Add one payment period to a date
   */
  private addPaymentPeriod(
    currentDate: number,
    frequency: LoanPaymentFrequency
  ): number {
    const date = new Date(currentDate);

    switch (frequency) {
      case 'MONTHLY':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'QUARTERLY':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'SEMI_ANNUAL':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'ANNUAL':
        date.setFullYear(date.getFullYear() + 1);
        break;
      case 'BI_WEEKLY':
        date.setDate(date.getDate() + 14);
        break;
      case 'WEEKLY':
        date.setDate(date.getDate() + 7);
        break;
    }

    return date.getTime();
  }

  /**
   * Update loan balance after a payment
   */
  async updateLoanBalance(
    request: UpdateLoanBalanceRequest,
    deviceId: string
  ): Promise<void> {
    const loanAccount = await this.getLoanAccount(request.loan_account_id);
    if (!loanAccount) {
      throw new Error(`Loan account ${request.loan_account_id} not found`);
    }

    // Update current balance
    const currentBalance = new Decimal(loanAccount.current_balance);
    const principalPaid = new Decimal(request.principal_amount);
    const newBalance = currentBalance.minus(principalPaid);

    // Update totals
    const totalPrincipal = new Decimal(loanAccount.total_paid_principal).plus(
      principalPaid
    );
    const totalInterest = new Decimal(loanAccount.total_paid_interest).plus(
      new Decimal(request.interest_amount)
    );

    // TODO: Update loan account in database when loan_accounts table exists
    // For now, this is a placeholder
  }

  /**
   * Get loan account (placeholder for when table exists)
   */
  private async getLoanAccount(loanAccountId: string): Promise<LoanAccount | null> {
    // TODO: Implement when loan_accounts table exists
    // For now, return mock data
    return null;
  }
}
