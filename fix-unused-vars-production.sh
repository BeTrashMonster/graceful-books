#!/bin/bash

# Fix unused variables in VendorIntelTab.tsx
sed -i 's/const \[vendorSortColumn, setVendorSortColumn\]/const [_vendorSortColumn, _setVendorSortColumn]/g' \
  "C:/Users/Admin/graceful_books/src/pages/cpg/tabs/intelligence/VendorIntelTab.tsx"

sed -i 's/const \[vendorSortDirection, setVendorSortDirection\]/const [_vendorSortDirection, _setVendorSortDirection]/g' \
  "C:/Users/Admin/graceful_books/src/pages/cpg/tabs/intelligence/VendorIntelTab.tsx"

# Fix unused function parameters (key, idx)
sed -i 's/\.map((\([^,)]*\), key)/\.map((\1, _key)/g' \
  "C:/Users/Admin/graceful_books/src/pages/cpg/tabs/intelligence/VendorIntelTab.tsx"

sed -i 's/\.map((\([^,)]*\), idx)/\.map((\1, _idx)/g' \
  "C:/Users/Admin/graceful_books/src/pages/cpg/tabs/intelligence/VendorIntelTab.tsx"

# Fix avgPrice
sed -i 's/const avgPrice =/const _avgPrice =/g' \
  "C:/Users/Admin/graceful_books/src/pages/cpg/tabs/intelligence/VendorIntelTab.tsx"

echo "✅ Fixed VendorIntelTab.tsx"
