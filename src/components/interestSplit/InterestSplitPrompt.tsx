/**
 * Interest Split Prompt Component
 *
 * Modal prompt for splitting loan payments into principal and interest.
 * Adapts messaging based on DISC personality type.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 * - COMM-002: DISC-Adapted Communication
 * - WCAG 2.1 AA Compliance
 */

import { useState, useEffect } from 'react';
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { Loading } from '../feedback/Loading';
import { ErrorMessage } from '../feedback/ErrorMessage';
import type {
  LiabilityPaymentDetection,
  SplitPaymentRequest,
  SplitPaymentResult,
  DISCType,
  InterestSplitDecision,
} from '../../types/loanAmortization.types';
import { InterestSplitMessagingService } from '../../services/interestSplit/messaging.service';
import Decimal from 'decimal.js';

export interface InterestSplitPromptProps {
  /**
   * Whether the prompt is open
   */
  isOpen: boolean;

  /**
   * Detection result that triggered the prompt
   */
  detection: LiabilityPaymentDetection;

  /**
   * User's DISC personality type
   */
  discType: DISCType;

  /**
   * Callback when user makes a decision
   */
  onDecision: (decision: InterestSplitDecision, splitRequest?: SplitPaymentRequest) => void;

  /**
   * Callback when prompt is closed
   */
  onClose: () => void;

  /**
   * Whether a split operation is in progress
   */
  isLoading?: boolean;

  /**
   * Error message from split operation
   */
  error?: string | null;
}

/**
 * Interest Split Prompt Component
 */
export const InterestSplitPrompt = ({
  isOpen,
  detection,
  discType,
  onDecision,
  onClose,
  isLoading = false,
  error = null,
}: InterestSplitPromptProps) => {
  const messagingService = new InterestSplitMessagingService();
  const messages = messagingService.getPromptMessages(detection);

  // State for manual entry
  const [manualMode, setManualMode] = useState(false);
  const [principalAmount, setPrincipalAmount] = useState(
    detection.suggested_principal || '0.00'
  );
  const [interestAmount, setInterestAmount] = useState(
    detection.suggested_interest || '0.00'
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset state when detection changes
  useEffect(() => {
    setPrincipalAmount(detection.suggested_principal || '0.00');
    setInterestAmount(detection.suggested_interest || '0.00');
    setManualMode(false);
    setValidationError(null);
  }, [detection]);

  // Validate amounts when they change
  useEffect(() => {
    if (manualMode) {
      validateAmounts();
    }
  }, [principalAmount, interestAmount, manualMode]);

  /**
   * Validate that principal + interest equals total payment
   */
  const validateAmounts = (): boolean => {
    try {
      const principal = new Decimal(principalAmount);
      const interest = new Decimal(interestAmount);
      const total = principal.plus(interest);

      // Get total from detection (would need to calculate from transaction)
      // For now, just validate that both are positive
      if (principal.lessThan(0) || interest.lessThan(0)) {
        setValidationError('Amounts cannot be negative');
        return false;
      }

      setValidationError(null);
      return true;
    } catch (err) {
      setValidationError('Please enter valid numbers');
      return false;
    }
  };

  /**
   * Handle split now action
   */
  const handleSplitNow = () => {
    if (manualMode && !validateAmounts()) {
      return;
    }

    const splitRequest: SplitPaymentRequest = {
      transaction_id: detection.transaction_id,
      loan_account_id: detection.suggested_loan_account_id || '',
      total_payment_amount: new Decimal(principalAmount)
        .plus(new Decimal(interestAmount))
        .toFixed(2),
      principal_amount: principalAmount,
      interest_amount: interestAmount,
      payment_date: Date.now(),
      schedule_entry_id: null,
      user_specified_split: manualMode,
      notes: null,
    };

    onDecision('SPLIT_NOW', splitRequest);
  };

  /**
   * Handle defer to checklist action
   */
  const handleDefer = () => {
    onDecision('DEFER_TO_CHECKLIST');
  };

  /**
   * Handle skip action
   */
  const handleSkip = () => {
    onDecision('SKIP');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={messages.prompt_title[discType]}
      size="md"
      footer={
        <div className="modal-footer">
          <Button variant="secondary" onClick={handleSkip} disabled={isLoading}>
            {messages.skip_button[discType]}
          </Button>
          <Button variant="secondary" onClick={handleDefer} disabled={isLoading}>
            {messages.defer_button[discType]}
          </Button>
          <Button
            variant="primary"
            onClick={handleSplitNow}
            disabled={isLoading || (manualMode && !!validationError)}
          >
            {isLoading ? <Loading size="sm" /> : messages.split_now_button[discType]}
          </Button>
        </div>
      }
    >
      <div className="interest-split-prompt">
        {/* Main message */}
        <p className="prompt-message">{messages.prompt_message[discType]}</p>

        {/* Tax benefit note */}
        <div className="tax-benefit-note" role="note" aria-label="Tax benefit information">
          <span className="icon" aria-hidden="true">
            💡
          </span>
          <span>{messages.tax_benefit_note[discType]}</span>
        </div>

        {/* Confidence indicator */}
        <div className="confidence-indicator">
          <span className="label">Confidence:</span>
          <span className={`badge confidence-${detection.confidence.toLowerCase()}`}>
            {detection.confidence}
          </span>
          <span className="score">({detection.confidence_score}%)</span>
        </div>

        {/* Amount display/edit */}
        {!manualMode ? (
          <div className="suggested-amounts">
            <div className="amount-row">
              <span className="label">Principal:</span>
              <span className="amount">${principalAmount}</span>
            </div>
            <div className="amount-row">
              <span className="label">Interest:</span>
              <span className="amount">${interestAmount}</span>
            </div>
            <div className="amount-row total">
              <span className="label">Total:</span>
              <span className="amount">
                ${new Decimal(principalAmount).plus(new Decimal(interestAmount)).toFixed(2)}
              </span>
            </div>

            <Button
              variant="link"
              size="sm"
              onClick={() => setManualMode(true)}
              disabled={isLoading}
            >
              Adjust amounts
            </Button>
          </div>
        ) : (
          <div className="manual-amounts">
            <Input
              id="principal-amount"
              name="principalAmount"
              label="Principal Amount"
              type="number"
              step="0.01"
              min="0"
              value={principalAmount}
              onChange={(e) => setPrincipalAmount(e.target.value)}
              disabled={isLoading}
              required
            />

            <Input
              id="interest-amount"
              name="interestAmount"
              label="Interest Amount"
              type="number"
              step="0.01"
              min="0"
              value={interestAmount}
              onChange={(e) => setInterestAmount(e.target.value)}
              disabled={isLoading}
              required
            />

            {validationError && (
              <ErrorMessage message={validationError} />
            )}

            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setManualMode(false);
                setPrincipalAmount(detection.suggested_principal || '0.00');
                setInterestAmount(detection.suggested_interest || '0.00');
              }}
              disabled={isLoading}
            >
              Use suggested amounts
            </Button>
          </div>
        )}

        {/* Detection factors (for debugging/transparency) */}
        {discType === 'C' && (
          <details className="detection-factors">
            <summary>Detection Factors</summary>
            <ul>
              <li>
                <input
                  type="checkbox"
                  checked={detection.factors.account_is_liability}
                  disabled
                  readOnly
                />
                Account is LIABILITY type
              </li>
              <li>
                <input
                  type="checkbox"
                  checked={detection.factors.regular_payment_pattern}
                  disabled
                  readOnly
                />
                Regular payment pattern detected
              </li>
              <li>
                <input
                  type="checkbox"
                  checked={detection.factors.amount_matches_schedule}
                  disabled
                  readOnly
                />
                Amount matches amortization schedule
              </li>
              <li>
                <input
                  type="checkbox"
                  checked={detection.factors.memo_contains_loan_keywords}
                  disabled
                  readOnly
                />
                Memo contains loan keywords
              </li>
              <li>
                <input
                  type="checkbox"
                  checked={detection.factors.payee_matches_lender}
                  disabled
                  readOnly
                />
                Payee matches lender
              </li>
              <li>
                <input
                  type="checkbox"
                  checked={detection.factors.date_matches_schedule}
                  disabled
                  readOnly
                />
                Date matches schedule
              </li>
            </ul>
          </details>
        )}

        {/* Error display */}
        {error && <ErrorMessage message={error} />}

        {/* Help text */}
        <div className="help-text" role="complementary">
          <p>{messagingService.getHelpText(discType)}</p>
        </div>
      </div>

      <style jsx>{`
        .interest-split-prompt {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .prompt-message {
          font-size: 1rem;
          line-height: 1.5;
          margin: 0;
        }

        .tax-benefit-note {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background-color: #f0f9ff;
          border-left: 3px solid #0ea5e9;
          border-radius: 0.25rem;
          font-size: 0.875rem;
        }

        .confidence-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .badge {
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.75rem;
        }

        .confidence-high {
          background-color: #d1fae5;
          color: #065f46;
        }

        .confidence-medium {
          background-color: #fef3c7;
          color: #92400e;
        }

        .confidence-low {
          background-color: #fee2e2;
          color: #991b1b;
        }

        .suggested-amounts,
        .manual-amounts {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background-color: #f9fafb;
          border-radius: 0.25rem;
        }

        .amount-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
        }

        .amount-row.total {
          font-weight: 600;
          padding-top: 0.5rem;
          border-top: 1px solid #e5e7eb;
        }

        .detection-factors {
          margin-top: 1rem;
          font-size: 0.875rem;
        }

        .detection-factors ul {
          margin: 0.5rem 0 0 1rem;
          padding: 0;
        }

        .detection-factors li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .help-text {
          font-size: 0.875rem;
          color: #6b7280;
          padding: 0.75rem;
          background-color: #f9fafb;
          border-radius: 0.25rem;
        }

        .help-text p {
          margin: 0;
        }

        .modal-footer {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }
      `}</style>
    </Modal>
  );
};
