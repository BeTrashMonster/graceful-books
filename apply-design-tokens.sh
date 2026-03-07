#!/bin/bash

# Script to apply design tokens to CPUTracker.tsx
# Run from project root

FILE="src/pages/cpg/CPUTracker.tsx"

echo "Applying design token replacements to $FILE..."

# 1. Add import (after other imports, before styles import)
sed -i '/import styles from/i import { colors, spacing, borderRadius, fontSize, dateRangeOptions, getDateRangeFromPreset, type DateRangePreset } from '\''../../styles/design-tokens'\'';' "$FILE"

# 2. Fix tab type
sed -i "s/type CPUTrackerTab = 'products' | 'raw-materials' | 'comparison';/type CPUTrackerTab = 'products' | 'invoices' | 'comparison';/" "$FILE"

# 3. Replace raw-materials with invoices in strings and IDs
sed -i 's/raw-materials/invoices/g' "$FILE"

# 4. Rename variables
sed -i 's/rawMaterials/invoice/g' "$FILE"

# 5. Remove duplicate DateRangePreset type definition (keep import)
sed -i '/^  type DateRangePreset = /d' "$FILE"

# 6. Add date range switch cases
sed -i "/case '12mo':/a\\
        case 'last-calendar-year':\\
          startDate = new Date('2025-01-01').getTime();\\
          break;\\
        case 'this-calendar-year':\\
          startDate = new Date('2026-01-01').getTime();\\
          break;\\
        case 'custom':\\
          startDate = 0;\\
          break;" "$FILE"

# 7. Add date range options to Tab 3 dropdown
sed -i '/<option value="12mo">Last 12 Months<\/option>/a\                              <option value="last-calendar-year">Last Calendar Year (2025)<\/option>\n                              <option value="this-calendar-year">This Calendar Year (2026)<\/option>\n                              <option value="custom">Custom Range...<\/option>' "$FILE"

# 8. Replace colors (in style objects only - be careful!)
# Replace #64748b (gray-500) with colors.textSecondary
sed -i "s/'#64748b'/colors.textSecondary/g" "$FILE"
sed -i 's/"#64748b"/colors.textSecondary/g' "$FILE"
sed -i "s/#64748b'/colors.textSecondary'/g" "$FILE"

# Replace #e5e7eb (gray-200) with colors.border
sed -i "s/'#e5e7eb'/colors.border/g" "$FILE"
sed -i 's/"#e5e7eb"/colors.border/g' "$FILE"

# Replace #4b006e (primary purple) with colors.primary
sed -i "s/'#4b006e'/colors.primary/g" "$FILE"
sed -i 's/"#4b006e"/colors.primary/g' "$FILE"

# Replace #6b21a8 (primary light) with colors.primaryLight
sed -i "s/'#6b21a8'/colors.primaryLight/g" "$FILE"
sed -i 's/"#6b21a8"/colors.primaryLight/g' "$FILE"

# Replace #f9fafb (gray-50) with colors.backgroundSecondary
sed -i "s/'#f9fafb'/colors.backgroundSecondary/g" "$FILE"
sed -i 's/"#f9fafb"/colors.backgroundSecondary/g' "$FILE"

# Replace #6b7280 (gray-500) with colors.textSecondary
sed -i "s/'#6b7280'/colors.textSecondary/g" "$FILE"
sed -i 's/"#6b7280"/colors.textSecondary/g' "$FILE"

echo "Design tokens applied successfully!"
echo "Running type check..."

npm run type-check 2>&1 | grep -E "(error TS|CPUTracker)" | head -10
