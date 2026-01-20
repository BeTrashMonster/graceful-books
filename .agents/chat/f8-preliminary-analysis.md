## F8 - Preliminary Technical Analysis (While Waiting)

**Agent:** F8 - Cash vs. Accrual Toggle Agent
**Time:** 2026-01-17 11:00
**Status:** Waiting for Checkpoint 2, conducting preliminary analysis

### Dependencies Analysis

**B2 (Transactions) - ✅ COMPLETE:**
- `src/db/schema/transactions.schema.ts` exists
- Full double-entry accounting support
- Transaction and TransactionLineItem schemas
- Balance validation logic
- Already includes all necessary fields for both cash and accrual

**D6 (Profit & Loss Report) - ✅ COMPLETE:**
- `src/services/reports/profitLoss.ts` exists
- Already accepts `AccountingMethod` parameter
- Line 44 shows `_accountingMethod: AccountingMethod` parameter
- Interface is partially ready for cash/accrual toggle

**D7 (Balance Sheet) - ✅ COMPLETE:**
- `src/services/reports/balanceSheet.ts` exists
- Balance sheet calculation service implemented
- Uses Decimal.js for precision
- Ready to be adapted for accounting method support

**Type Definition Already Exists:**
- `src/types/index.ts` line 122: `export type AccountingMethod = 'cash' | 'accrual'`
- This is the foundational type I'll use throughout

### Key Discovery: Foundation Is Already In Place

The good news: Much of the foundation for cash vs. accrual accounting already exists!

1. **AccountingMethod type is defined**
2. **Profit & Loss already has parameter for it** (though may not be fully implemented)
3. **Transaction schema supports both methods**
4. **Balance Sheet service exists and can be extended**

This means my implementation will focus on:
1. **Persistence layer** - Store user's accounting method preference
2. **Service coordination** - Ensure all reports use the selected method
3. **UI components** - Toggle control, educational content, warnings
4. **Report adaptation** - Modify how reports calculate based on method
5. **Testing** - Verify accuracy for both methods

### What I Need from Checkpoint 2

I'm waiting for interface designs from:

1. **F1 (Dashboard)** - How does dashboard display metrics? I need to know:
   - What metrics are displayed
   - How they're calculated
   - Where accounting method needs to be injected

2. **F4 (Cash Flow Report)** - Interface for cash flow calculations:
   - How cash flow is calculated
   - What fields are returned
   - How accounting method affects it

3. **F5 (A/R Aging Report)** - Interface for A/R aging:
   - How aging is calculated
   - Whether accrual affects aging buckets
   - What data structure is returned

4. **F6 (A/P Aging Report)** - Interface for A/P aging:
   - How aging is calculated
   - Whether accrual affects aging buckets
   - What data structure is returned

5. **F7 (Journal Entries)** - How entries are recorded:
   - Service interface for creating entries
   - How accounting method affects entry creation
   - What hooks/services I need to modify

### Planned Architecture (Preliminary)

While waiting, I'm designing the architecture:

**Core Service:**
```typescript
// src/services/accountingMethod.service.ts
interface AccountingMethodService {
  getAccountingMethod(): Promise<AccountingMethod>
  setAccountingMethod(method: AccountingMethod): Promise<void>
  // Encrypted storage, persists across sessions
}
```

**React Hook:**
```typescript
// src/hooks/useAccountingMethod.ts
interface UseAccountingMethodReturn {
  accountingMethod: AccountingMethod
  isLoading: boolean
  setAccountingMethod: (method: AccountingMethod) => Promise<void>
  toggleAccountingMethod: () => Promise<void>
}
```

**Report Adapters:**
Each report will get an adapter that modifies calculations based on method:
- `src/services/adapters/profitLossAdapter.ts`
- `src/services/adapters/balanceSheetAdapter.ts`
- `src/services/adapters/cashFlowAdapter.ts`
- `src/services/adapters/agingAdapter.ts`

**UI Components:**
- `src/components/accounting/AccountingMethodToggle.tsx` - Toggle control
- `src/components/accounting/AccountingMethodExplanation.tsx` - Educational content
- `src/components/accounting/MethodSwitchWarning.tsx` - Warning dialog

### Cash vs. Accrual: The Fundamental Difference

**Cash Basis:**
- Record revenue when cash is received
- Record expenses when cash is paid
- Simpler for small businesses
- Shows actual cash position
- Not GAAP-compliant for larger businesses

**Accrual Basis:**
- Record revenue when earned (invoice sent)
- Record expenses when incurred (bill received)
- GAAP-compliant
- Better shows true profitability
- Matches revenue to expenses in same period

**Impact on Reports:**
- **P&L:** Cash shows cash in/out, Accrual shows earned/incurred
- **Balance Sheet:** Both similar, but A/R and A/P handling differs
- **Cash Flow:** Less affected (it's already cash-based)
- **A/R Aging:** More relevant in accrual (invoices not yet paid)
- **A/P Aging:** More relevant in accrual (bills not yet paid)

### DISC-Adapted Educational Content

I'll create 4 variants for the accounting method explanation:

**Dominance (D):** "Cash = when money moves. Accrual = when you earn/owe. Pick based on your business needs."

**Influence (I):** "Great question! Cash basis is simpler - you track money when it actually moves. Accrual is more complete - you track when you earn or owe money, even before cash changes hands. Both are totally valid!"

**Steadiness (S):** "Let's make sure you pick the right method for you. Cash basis means you record transactions when money actually moves in or out. Accrual means you record when you earn money or owe money, even if it hasn't been paid yet. Don't worry - you can always switch if you need to."

**Conscientiousness (C):** "Accounting method determines when you recognize revenue and expenses. Cash basis: recognition occurs upon cash receipt/payment. Accrual basis: recognition occurs when earned/incurred, regardless of payment timing. Accrual is GAAP-compliant and required for businesses >$25M revenue or inventory."

### Next Steps

1. ✅ Reviewed all dependencies (all complete)
2. ✅ Analyzed existing code architecture
3. ✅ Designed preliminary service architecture
4. ✅ Prepared DISC-adapted content
5. ⏳ **WAITING for Checkpoint 2** - F1, F4, F5, F6, F7 interface designs
6. ⏳ Will post modification plan after reviewing interfaces
7. ⏳ Will wait for explicit approval before implementation

---

**Current Status:** ✅ Dependencies verified, architecture designed, WAITING for Checkpoint 2
**Blocking On:** F4, F5, F6 interface designs (F1 and F7 have posted, confirmed coordination)
**Next Action:** Review interface designs when posted, then create modification plan
**Estimated Time After Approval:** 6-8 hours for full implementation

---
