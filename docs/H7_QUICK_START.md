# Interest Split Prompt System - Quick Start Guide

## For Developers

### Installation

No additional dependencies required. The system uses existing dependencies:
- `decimal.js` - Precise decimal arithmetic
- `nanoid` - ID generation
- `react` - UI components
- `dexie` - Database operations

### Basic Usage

#### 1. Detect Loan Payment

```typescript
import { loanPaymentDetectionService } from '@/services/interestSplit';

// When a transaction is created/edited
const detectionResult = await loanPaymentDetectionService.detectLoanPayment(
  transaction,
  lineItems
);

if (detectionResult.isLiabilityPayment) {
  console.log('Detected loan payment:', detectionResult);
  // Show split prompt
}
```

#### 2. Show Interest Split Prompt

```tsx
import { InterestSplitPrompt } from '@/components/transactions/InterestSplitPrompt';

<InterestSplitPrompt
  isOpen={showPrompt}
  detectionResult={detectionResult}
  transactionId={transaction.id}
  transactionDate={new Date(transaction.transaction_date)}
  discProfile={userProfile.discProfile || 'I'}
  onDecision={handleSplitDecision}
  onClose={() => setShowPrompt(false)}
  defaultInterestAccountId={preferences.default_interest_expense_account_id}
/>
```

#### 3. Handle User Decision

```typescript
import {
  InterestSplitDecision,
  interestSplitJournalService,
  checklistIntegrationService,
} from '@/services/interestSplit';

async function handleSplitDecision(
  decision: InterestSplitDecision,
  principalAmount?: string,
  interestAmount?: string,
  interestExpenseAccountId?: string
) {
  switch (decision) {
    case InterestSplitDecision.SPLIT_NOW:
      // Create journal entry
      const journalEntry = await interestSplitJournalService.createInterestSplitEntry({
        original_transaction_id: transaction.id,
        company_id: companyId,
        liability_account_id: detectionResult.liabilityAccountId!,
        principal_amount: principalAmount!,
        interest_amount: interestAmount!,
        interest_expense_account_id: interestExpenseAccountId!,
        payment_date: transaction.transaction_date,
      });

      showSuccess('Payment split successfully!');
      break;

    case InterestSplitDecision.DEFER_TO_CHECKLIST:
      // Add to checklist
      await checklistIntegrationService.addDeferredSplitToChecklist(
        {
          transaction_id: transaction.id,
          liability_account_name: detectionResult.liabilityAccountName!,
          payment_amount: detectionResult.paymentAmount,
          payment_date: transaction.transaction_date,
          suggested_principal: detectionResult.suggestedPrincipalAmount,
          suggested_interest: detectionResult.suggestedInterestAmount,
        },
        companyId,
        userId
      );

      showInfo('Added to your checklist');
      break;

    case InterestSplitDecision.DISMISS:
      // Add to dismissed list
      updatePreferences({
        dismissed_transaction_ids: [
          ...preferences.dismissed_transaction_ids,
          transaction.id,
        ],
      });
      break;

    case InterestSplitDecision.DISABLE_PROMPTS:
      // Disable prompts
      updatePreferences({ prompts_enabled: false });
      showInfo('Interest split prompts disabled');
      break;
  }

  setShowPrompt(false);
}
```

#### 4. Create Amortization Schedule

```tsx
import { LoanAmortizationScheduleForm } from '@/components/loans/LoanAmortizationScheduleForm';

<LoanAmortizationScheduleForm
  companyId={companyId}
  liabilityAccountId={loanAccountId}
  onSave={async (loanInfo, schedule) => {
    // Save loan and schedule to database
    await db.loans.add({
      id: nanoid(),
      company_id: companyId,
      information: loanInfo,
      amortization_schedule: schedule,
      interest_expense_account_id: defaultInterestAccountId,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: {},
    });

    showSuccess('Amortization schedule created!');
  }}
  onCancel={() => setShowForm(false)}
/>
```

#### 5. Calculate Amortization (Standalone)

```typescript
import { amortizationService } from '@/services/interestSplit';

const result = amortizationService.calculateAmortizationSchedule(
  {
    principal: '50000.00',
    annual_rate: '5.5',
    term_months: 60,
    start_date: Date.now(),
    compounding_frequency: 'MONTHLY',
  },
  companyId,
  liabilityAccountId
);

console.log('Monthly Payment:', result.monthly_payment);
console.log('Total Interest:', result.total_interest);
console.log('Schedule:', result.schedule);
```

## For Users

### How to Use

#### First Time Setup

1. **Record a Loan Payment**
   - Go to Transactions → New Transaction
   - Record payment to your loan account
   - System will detect it's a loan payment

2. **Split Prompt Appears**
   - Review the suggested amounts (if available)
   - Enter principal and interest amounts
   - Select interest expense account
   - Click "Split Now"

3. **Set Up Amortization Schedule (Optional)**
   - Go to Loans → Amortization Schedules
   - Click "New Schedule"
   - Enter loan details (amount, rate, term)
   - System calculates payment breakdown
   - Save schedule

4. **Future Payments Auto-Calculated**
   - Record loan payment
   - System uses schedule to suggest split
   - Review and confirm
   - Done!

#### Managing Settings

Go to Settings → Transactions → Interest Split Prompts:

- **Enable/Disable Prompts:** Turn automatic detection on/off
- **Auto-Split:** Automatically split when schedule exists
- **Minimum Amount:** Only prompt for payments above this amount
- **Confidence Threshold:** How certain system should be before prompting
- **Default Account:** Pre-select interest expense account

### Tips & Tricks

**Tip 1: Create schedules for recurring loans**
Set up an amortization schedule for any loan with regular payments. The system will automatically calculate the split every time.

**Tip 2: Use "Later" for batch processing**
If you have multiple loan payments, click "Later" to add them to your checklist. Then process them all at once.

**Tip 3: Verify early payments**
For new loans, the first few payments have higher interest. The system will warn you if interest seems high - this is normal!

**Tip 4: Zero interest loans**
For 0% promotional financing, enter 0 for interest and the full payment as principal.

**Tip 5: Extra principal payments**
When making an extra principal payment, record it separately with zero interest.

## Common Scenarios

### Scenario 1: New Loan

```
Loan Amount: $10,000
Interest Rate: 6% annual
Term: 12 months
Monthly Payment: $860.66

First Payment Split:
- Interest: $50.00 (10000 × 0.06 / 12)
- Principal: $810.66 (860.66 - 50.00)
```

### Scenario 2: 0% Financing

```
Loan Amount: $5,000
Interest Rate: 0%
Term: 24 months
Monthly Payment: $208.33

Every Payment:
- Interest: $0.00
- Principal: $208.33
```

### Scenario 3: Balloon Payment

```
Loan Amount: $100,000
Regular Payment: $500/month
Final Payment: $50,000 (balloon)

Regular Payments: Calculate with schedule
Final Payment: Record separately
```

## Troubleshooting

### Problem: Prompt not showing
**Check:**
- Are prompts enabled in settings?
- Is the payment amount above minimum threshold?
- Have you dismissed this transaction before?
- Is the account in the excluded list?

### Problem: Calculation doesn't match lender
**Possible Causes:**
- Different compounding frequency
- Lender using different day count method
- Fees included in lender's amount

**Solution:** Use manual entry and match lender's statement exactly.

### Problem: Can't find interest account
**Solution:**
1. Go to Chart of Accounts
2. Create new account: "Interest Expense"
3. Type: Expense
4. Save
5. Set as default in Interest Split Settings

## API Reference

### Services

#### `loanPaymentDetectionService`
- `detectLoanPayment(transaction, lineItems)` - Detect if transaction is loan payment
- `shouldShowPrompt(detectionResult, preferences, transactionId)` - Check if should show prompt

#### `amortizationService`
- `calculateAmortizationSchedule(input, companyId, accountId)` - Generate full schedule
- `validateInput(input)` - Validate calculation inputs
- `calculateSinglePayment(payment, balance, rate, frequency)` - Calculate one payment

#### `interestSplitJournalService`
- `validateSplit(request, originalAmount)` - Validate split before saving
- `createInterestSplitEntry(request)` - Generate journal entry

#### `checklistIntegrationService`
- `addDeferredSplitToChecklist(deferredSplit, companyId, userId)` - Add to checklist
- `markSplitCompleted(transactionId, companyId, userId)` - Mark as done
- `getPendingInterestSplits(companyId, userId)` - Get pending splits

### Components

#### `<InterestSplitPrompt />`
Props:
- `isOpen: boolean` - Show/hide modal
- `detectionResult: LoanPaymentDetectionResult` - Detection data
- `transactionId: string` - Transaction ID
- `transactionDate: Date` - Payment date
- `discProfile?: DISCProfile` - Communication style (D/I/S/C)
- `onDecision: (decision, principal?, interest?, accountId?) => void` - Callback
- `onClose: () => void` - Close handler
- `defaultInterestAccountId?: string` - Pre-selected account

#### `<LoanAmortizationScheduleForm />`
Props:
- `companyId: string` - Company ID
- `liabilityAccountId?: string` - Loan account
- `existingLoanInfo?: LoanInformation` - For editing
- `onSave: (loanInfo, schedule) => Promise<void>` - Save callback
- `onCancel: () => void` - Cancel handler

#### `<InterestSplitSettings />`
Props:
- `companyId: string` - Company ID
- `userId: string` - User ID
- `currentPreferences: InterestSplitPreferences` - Current settings
- `currentDetectionSettings: InterestSplitDetectionSettings` - Detection config
- `onSave: (preferences, detectionSettings) => Promise<void>` - Save callback

## Testing

### Run Tests

```bash
# All interest split tests
npm test -- interestSplit

# Specific test file
npm test -- loanPaymentDetection.test.ts

# Watch mode
npm test -- --watch interestSplit
```

### Test Coverage

```bash
npm run test:coverage -- --coverage.include=src/services/interestSplit
```

## Resources

- [Full Documentation](./H7_INTEREST_SPLIT_IMPLEMENTATION.md)
- [Roadmap Entry](../Roadmaps/ROADMAP.md#h7-interest-split-prompt-system)
- [Type Definitions](../src/types/loanAmortization.types.ts)
- [Help Articles](/help/loan-payments)

---

**Questions?** Check the full documentation or implementation code for detailed examples.
