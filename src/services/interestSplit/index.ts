/**
 * Interest Split Services
 *
 * Exports all interest split related services for loan payment detection,
 * amortization calculations, payment splitting, and checklist integration.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 */

export { LiabilityDetectionService } from './liabilityDetection.service';
export { AmortizationService } from './amortization.service';
export { PaymentSplitService } from './paymentSplit.service';
export { InterestSplitMessagingService } from './messaging.service';
export { ChecklistIntegrationService } from './checklistIntegration.service';

// Re-export types for convenience
export type {
  LiabilityPaymentDetection,
  DetectionFactors,
  DetectionConfidence,
  BatchDetectionRequest,
  BatchDetectionResponse,
  LoanAccount,
  AmortizationSchedule,
  AmortizationScheduleEntry,
  GenerateScheduleRequest,
  SplitPaymentRequest,
  SplitPaymentResult,
  SplitValidationResult,
  InterestSplitMessages,
  DeferredInterestSplitItem,
  InterestSplitPrompt,
  InterestSplitDecision,
  InterestSplitPreferences,
} from '../../types/loanAmortization.types';
