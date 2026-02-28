#!/bin/bash
# Comprehensive CPG TypeScript Error Fixes

echo "Starting CPG error fixes..."

# Fix 1: CPGProductLink import in InvoiceEntryFormIntegrated.tsx
sed -i "s/import.*CPGProductLink.*from.*cpg\.schema/import type { CPGProductLink } from '..\/..\/db\/schema\/cpgProductLinks.schema'/" src/components/cpg/InvoiceEntryFormIntegrated.tsx

# Fix 2: Remaining button size in BalanceSheetEntryForm.tsx
sed -i 's/size="small"/size="sm"/g' src/components/cpg/BalanceSheetEntryForm.tsx

# Fix 3: Prefix unused variables with underscore
# CategoryManager.tsx - useEffect
sed -i 's/import { useState, useEffect }/import { useState, useEffect as _useEffect }/' src/components/cpg/CategoryManager.tsx

# PLEntryForm.tsx - Decimal
sed -i 's/^import Decimal from/import _Decimal from/' src/components/cpg/PLEntryForm.tsx
sed -i 's/^import Decimal from/import _Decimal from/' src/components/cpg/BalanceSheetEntryForm.tsx

# DistributorSelector.tsx - useState
sed -i 's/^import { useState } from/import { useState as _useState } from/' src/components/cpg/DistributorSelector.tsx

# CPUTimeline.tsx - categories parameter
sed -i 's/(categories, setCate/(\_categories, setCate/' src/components/cpg/CPUTimeline.tsx

# Fix 4: Loop index parameters
sed -i 's/\.map((item, index)/\.map((item, _index)/g' src/components/cpg/DistributorProfileForm.tsx
sed -i 's/\.map((item, index)/\.map((item, _index)/g' src/components/cpg/InvoiceEntryForm.tsx
sed -i 's/\.map((item, index)/\.map((item, _index)/g' src/components/cpg/InvoiceEntryFormIntegrated.tsx

# Fix 5: Unused key variables in Object.entries loops
sed -i 's/for (const \[key,/for (const [_key,/g' src/components/cpg/InvoiceEntryForm.tsx
sed -i 's/for (const \[key,/for (const [_key,/g' src/components/cpg/InvoiceEntryFormIntegrated.tsx

# Fix 6: Unused functions
sed -i 's/const getVariantsForCategory/const _getVariantsForCategory/' src/components/cpg/InvoiceEntryForm.tsx
sed -i 's/const getVariantsForCategory/const _getVariantsForCategory/' src/components/cpg/InvoiceEntryFormIntegrated.tsx
sed -i 's/const totalPaid =/const _totalPaid =/' src/components/cpg/InvoiceEntryFormIntegrated.tsx

echo "Batch fixes applied successfully!"
echo "Remaining errors will need manual fixes..."
