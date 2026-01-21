/**
 * Interest Split Messaging Service
 *
 * Provides DISC-adapted messages for interest split prompts and notifications.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 * - COMM-002: DISC-Adapted Communication
 */

import type {
  DISCType,
  InterestSplitMessages,
  LiabilityPaymentDetection,
} from '../../types/loanAmortization.types';

/**
 * Interest Split Messaging Service
 */
export class InterestSplitMessagingService {
  /**
   * Get all prompt messages for a detection
   */
  getPromptMessages(detection: LiabilityPaymentDetection): InterestSplitMessages {
    return {
      prompt_title: this.getPromptTitles(),
      prompt_message: this.getPromptMessageTexts(detection),
      tax_benefit_note: this.getTaxBenefitNotes(),
      split_now_button: this.getSplitNowButtons(),
      defer_button: this.getDeferButtons(),
      skip_button: this.getSkipButtons(),
      success_message: this.getSuccessMessages(),
      error_message: this.getErrorMessages(),
    };
  }

  /**
   * Get message for specific DISC type
   */
  getMessage(
    discType: DISCType,
    messageType: keyof InterestSplitMessages,
    detection?: LiabilityPaymentDetection
  ): string {
    const messages = detection
      ? this.getPromptMessageTexts(detection)
      : this.getPromptMessageTexts({} as LiabilityPaymentDetection);

    const messageSet =
      messageType === 'prompt_message'
        ? messages
        : (this as any)[`get${this.capitalize(messageType.replace(/_/g, ' '))}`]();

    return messageSet[discType];
  }

  // ============================================================================
  // Prompt Titles
  // ============================================================================

  private getPromptTitles(): Record<DISCType, string> {
    return {
      D: 'Split This Loan Payment?',
      I: 'Hey! This Looks Like a Loan Payment',
      S: 'We Noticed This Might Be a Loan Payment',
      C: 'Loan Payment Detected - Split Recommended',
    };
  }

  // ============================================================================
  // Prompt Messages
  // ============================================================================

  private getPromptMessageTexts(
    detection: LiabilityPaymentDetection
  ): Record<DISCType, string> {
    const confidence = detection.confidence || 'MEDIUM';
    const suggestedPrincipal = detection.suggested_principal || '0.00';
    const suggestedInterest = detection.suggested_interest || '0.00';

    return {
      D: `We detected a liability payment. Split it into principal ($${suggestedPrincipal}) and interest ($${suggestedInterest}) now? Increases accuracy.`,

      I: `This looks like a loan payment! Want to split it into principal ($${suggestedPrincipal}) and interest ($${suggestedInterest})? It'll help you track your progress!`,

      S: `We noticed this transaction might be a loan payment. Would you like us to help split it into principal ($${suggestedPrincipal}) and interest ($${suggestedInterest}) portions? This will help keep your records accurate.`,

      C: `Analysis indicates this is a liability payment (${confidence} confidence). Recommended split: Principal: $${suggestedPrincipal}, Interest: $${suggestedInterest}. Splitting ensures accurate categorization and tax reporting.`,
    };
  }

  // ============================================================================
  // Tax Benefit Notes
  // ============================================================================

  private getTaxBenefitNotes(): Record<DISCType, string> {
    return {
      D: 'Interest is tax-deductible.',

      I: 'Plus, the interest part is tax-deductible! Win-win!',

      S: 'Remember, the interest portion is typically tax-deductible for business loans, which can help reduce your tax burden.',

      C: 'Note: Interest expense on business loans is generally tax-deductible per IRS regulations (consult your tax professional).',
    };
  }

  // ============================================================================
  // Button Labels
  // ============================================================================

  private getSplitNowButtons(): Record<DISCType, string> {
    return {
      D: 'Split Now',
      I: "Yes, Let's Do It!",
      S: 'Yes, Please Split It',
      C: 'Proceed with Split',
    };
  }

  private getDeferButtons(): Record<DISCType, string> {
    return {
      D: 'Later',
      I: "I'll Come Back to This",
      S: 'Remind Me Later',
      C: 'Add to Checklist',
    };
  }

  private getSkipButtons(): Record<DISCType, string> {
    return {
      D: 'Skip',
      I: "Not This Time",
      S: 'No, Thank You',
      C: 'Dismiss',
    };
  }

  // ============================================================================
  // Success Messages
  // ============================================================================

  private getSuccessMessages(): Record<DISCType, string> {
    return {
      D: 'Payment split. Done.',

      I: "Great! We've split that payment for you. Your books are looking sharp!",

      S: "All done! We've split the payment into principal and interest. Your records are now up to date.",

      C: 'Payment successfully split into principal and interest components. Journal entry created and posted.',
    };
  }

  // ============================================================================
  // Error Messages
  // ============================================================================

  private getErrorMessages(): Record<DISCType, string> {
    return {
      D: 'Split failed. Check amounts.',

      I: "Oops! Something didn't work quite right. Let's try that again.",

      S: "We couldn't complete the split right now. Please check the amounts and try again, or contact support if you need help.",

      C: 'Error: Unable to complete split operation. Verify principal + interest equals total payment and all required accounts exist.',
    };
  }

  // ============================================================================
  // Deferred to Checklist Messages
  // ============================================================================

  getDeferredMessages(): Record<DISCType, string> {
    return {
      D: 'Added to checklist.',

      I: "No problem! We've added this to your checklist so you can tackle it when you're ready.",

      S: "That's perfectly fine. We've added this to your checklist as a reminder. You can complete it whenever you're ready.",

      C: 'Item added to checklist: Review and split loan payment. Due: End of month.',
    };
  }

  // ============================================================================
  // Skipped Messages
  // ============================================================================

  getSkippedMessages(): Record<DISCType, string> {
    return {
      D: 'Noted. Won\'t ask again for this transaction.',

      I: 'Got it! We won\'t bug you about this one again.',

      S: 'Understood. We won\'t prompt you about this transaction again.',

      C: 'Transaction marked as non-liability payment. Detection will not trigger for this transaction in the future.',
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private capitalize(str: string): string {
    return str
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  /**
   * Get appropriate message based on confidence level
   */
  getConfidenceQualifier(confidence: string, discType: DISCType): string {
    const qualifiers: Record<string, Record<DISCType, string>> = {
      HIGH: {
        D: 'Highly likely',
        I: 'Pretty sure',
        S: 'Very confident',
        C: 'High confidence (95%+)',
      },
      MEDIUM: {
        D: 'Likely',
        I: 'Looks like',
        S: 'It appears',
        C: 'Medium confidence (70-94%)',
      },
      LOW: {
        D: 'Possibly',
        I: 'Might be',
        S: 'Could be',
        C: 'Low confidence (50-69%)',
      },
    };

    return qualifiers[confidence]?.[discType] || qualifiers.MEDIUM![discType];
  }

  /**
   * Format currency for display in messages
   */
  formatCurrency(amount: string): string {
    const num = parseFloat(amount);
    return `$${num.toFixed(2)}`;
  }

  /**
   * Get help text for interest split
   */
  getHelpText(discType: DISCType): string {
    const helpTexts: Record<DISCType, string> = {
      D: 'Loan payments have two parts: principal (reduces balance) and interest (expense). Split them for accurate tracking.',

      I: 'When you pay a loan, part goes to the principal (paying down what you owe) and part goes to interest (the cost of borrowing). Splitting them helps you see exactly where your money goes!',

      S: 'Loan payments typically consist of two components: the principal portion reduces your loan balance, while the interest portion is an expense. Splitting these helps maintain accurate financial records and ensures you can properly track your loan payoff progress.',

      C: 'Per GAAP accounting principles, loan payments must be split into principal (liability reduction, balance sheet) and interest (expense, income statement). Proper categorization ensures accurate financial statements and tax reporting.',
    };

    return helpTexts[discType];
  }

  /**
   * Get tooltip text for why splitting is recommended
   */
  getWhySplitTooltip(discType: DISCType): string {
    const tooltips: Record<DISCType, string> = {
      D: 'Accurate books. Tax deduction. Better insights.',

      I: 'See your loan balance drop, track interest costs, and claim tax deductions!',

      S: 'Splitting helps you track how much you\'ve paid off, ensures accurate financial statements, and identifies tax-deductible interest.',

      C: 'Required for GAAP compliance. Enables accurate balance sheet presentation, P&L accuracy, and proper tax reporting of deductible interest expense.',
    };

    return tooltips[discType];
  }
}
