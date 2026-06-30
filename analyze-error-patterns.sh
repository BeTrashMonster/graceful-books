#!/bin/bash
# Analyze TypeScript errors by pattern to build targeted fixes

echo "📊 Error Pattern Analysis"
echo "========================"
echo ""

echo "1. CPG Schema Errors (missing properties):"
grep -c "is_distribution_category\|unit_of_measure\|payment_method" typescript-errors-current.txt || echo "0"

echo ""
echo "2. Null Safety Errors (possibly undefined):"
grep -c "TS18048\|TS2532" typescript-errors-current.txt || echo "0"

echo ""
echo "3. Type Assignment Errors:"
grep -c "TS2345\|TS2322" typescript-errors-current.txt || echo "0"

echo ""
echo "4. Property Missing Errors:"
grep -c "TS2339\|TS2741" typescript-errors-current.txt || echo "0"

echo ""
echo "5. Unused Variable Errors:"
grep -c "TS6133" typescript-errors-current.txt || echo "0"

echo ""
echo "📁 Top 5 Files by Error Count:"
grep "error TS" typescript-errors-current.txt | cut -d'(' -f1 | sort | uniq -c | sort -rn | head -5

