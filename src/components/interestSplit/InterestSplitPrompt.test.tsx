/**
 * Interest Split Prompt Component Tests
 *
 * Tests the UI component for loan payment splitting.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 * - WCAG 2.1 AA Compliance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterestSplitPrompt } from './InterestSplitPrompt';
import type { LiabilityPaymentDetection } from '../../types/loanAmortization.types';

describe('InterestSplitPrompt', () => {
  const mockDetection: LiabilityPaymentDetection = {
    transaction_id: 'txn-123',
    is_likely_loan_payment: true,
    confidence: 'HIGH',
    confidence_score: 85,
    factors: {
      account_is_liability: true,
      regular_payment_pattern: true,
      amount_matches_schedule: true,
      memo_contains_loan_keywords: true,
      payee_matches_lender: false,
      date_matches_schedule: false,
    },
    suggested_loan_account_id: 'loan-1',
    suggested_principal: '800.00',
    suggested_interest: '200.00',
    detection_timestamp: Date.now(),
  };

  const mockOnDecision = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnDecision.mockClear();
    mockOnClose.mockClear();
  });

  describe('rendering', () => {
    it('should render when open', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(
        <InterestSplitPrompt
          isOpen={false}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display suggested principal and interest amounts', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      // Amounts appear in both the message and the breakdown, use getAllByText
      expect(screen.getAllByText(/\$800\.00/)).toHaveLength(2); // Principal (in message and breakdown)
      expect(screen.getAllByText(/\$200\.00/)).toHaveLength(2); // Interest (in message and breakdown)
    });

    it('should display confidence level', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('(85%)')).toBeInTheDocument();
    });

    it('should display tax benefit note', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('note', { name: /tax benefit/i })).toBeInTheDocument();
    });
  });

  describe('DISC-adapted messaging', () => {
    it('should show Dominance-style messaging', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="D"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Split This Loan Payment/i)).toBeInTheDocument();
    });

    it('should show Influence-style messaging', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="I"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      // Text appears in title, so query specifically for the heading
      expect(screen.getByRole('heading', { name: /This Looks Like a Loan Payment/i })).toBeInTheDocument();
    });

    it('should show Steadiness-style messaging', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      // Text appears in both title and message, use getAllByText to verify it appears
      expect(screen.getAllByText(/We Noticed.*Loan Payment/i).length).toBeGreaterThan(0);
    });

    it('should show Conscientiousness-style messaging with details', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="C"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Loan Payment Detected/i)).toBeInTheDocument();
      // Should show detection factors for C type
      expect(screen.getByText(/Detection Factors/i)).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onDecision with SPLIT_NOW when split button clicked', async () => {
      const user = userEvent.setup();

      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      const splitButton = screen.getByRole('button', { name: /Yes, Please Split It/i });
      await user.click(splitButton);

      expect(mockOnDecision).toHaveBeenCalledWith(
        'SPLIT_NOW',
        expect.objectContaining({
          transaction_id: 'txn-123',
          principal_amount: '800.00',
          interest_amount: '200.00',
        })
      );
    });

    it('should call onDecision with DEFER_TO_CHECKLIST when defer button clicked', async () => {
      const user = userEvent.setup();

      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      const deferButton = screen.getByRole('button', { name: /Remind Me Later/i });
      await user.click(deferButton);

      expect(mockOnDecision).toHaveBeenCalledWith('DEFER_TO_CHECKLIST');
    });

    it('should call onDecision with SKIP when skip button clicked', async () => {
      const user = userEvent.setup();

      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      const skipButton = screen.getByRole('button', { name: /No, Thank You/i });
      await user.click(skipButton);

      expect(mockOnDecision).toHaveBeenCalledWith('SKIP');
    });

    it('should allow manual amount adjustment', async () => {
      const user = userEvent.setup();

      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      // Click adjust amounts button
      const adjustButton = screen.getByRole('button', { name: /Adjust amounts/i });
      await user.click(adjustButton);

      // Input fields should appear
      const principalInput = screen.getByLabelText(/Principal Amount/i);
      const interestInput = screen.getByLabelText(/Interest Amount/i);

      expect(principalInput).toBeInTheDocument();
      expect(interestInput).toBeInTheDocument();

      // Change values
      await user.clear(principalInput);
      await user.type(principalInput, '750.00');

      await user.clear(interestInput);
      await user.type(interestInput, '250.00');

      // Submit with new values
      const splitButton = screen.getByRole('button', { name: /Yes, Please Split It/i });
      await user.click(splitButton);

      expect(mockOnDecision).toHaveBeenCalledWith(
        'SPLIT_NOW',
        expect.objectContaining({
          principal_amount: '750.00',
          interest_amount: '250.00',
          user_specified_split: true,
        })
      );
    });

    it('should validate manual amounts before submission', async () => {
      const user = userEvent.setup();

      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      // Enter manual mode
      const adjustButton = screen.getByRole('button', { name: /Adjust amounts/i });
      await user.click(adjustButton);

      // Enter negative amount
      const principalInput = screen.getByLabelText(/Principal Amount/i);
      await user.clear(principalInput);
      await user.type(principalInput, '-100');

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument();
      });

      // Split button should be disabled
      const splitButton = screen.getByRole('button', { name: /Yes, Please Split It/i });
      expect(splitButton).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('note', { name: /tax benefit/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
        />
      );

      // Tab through footer buttons (skip modal close button and content buttons)
      const noThankYouButton = screen.getByRole('button', { name: /No, Thank You/i });
      noThankYouButton.focus(); // Set initial focus to first footer button
      expect(noThankYouButton).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /Remind Me Later/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /Yes, Please Split It/i })).toHaveFocus();
    });

    it('should disable all buttons when loading', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
          isLoading={true}
        />
      );

      expect(screen.getByRole('button', { name: /No, Thank You/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Remind Me Later/i })).toBeDisabled();
      // Split button shows loading indicator, check for loading state
      expect(screen.getByRole('button', { name: /Yes, Please Split It/i })).toBeDisabled();
    });
  });

  describe('error handling', () => {
    it('should display error message when provided', () => {
      render(
        <InterestSplitPrompt
          isOpen={true}
          detection={mockDetection}
          discType="S"
          onDecision={mockOnDecision}
          onClose={mockOnClose}
          error="Failed to split payment"
        />
      );

      expect(screen.getByText(/Failed to split payment/i)).toBeInTheDocument();
    });
  });
});
