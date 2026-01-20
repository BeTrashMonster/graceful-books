# J8 Tax Prep Mode - Quick Reference

## For Developers

### Key Components
- **TaxPrepMode** - Main dashboard (activation + active state)
- **TaxDocumentChecklist** - 8-category checklist
- **TaxDocumentUpload** - File upload interface
- **TaxPackageAssembly** - ZIP export
- **TaxAdvisorReview** - J7 advisor interface

### Key Services
- **taxDocumentManager** - Document CRUD operations
- **taxPackageGenerator** - ZIP generation & advisor access

### Database Tables (Version 17)
- `taxDocuments` - Uploaded files
- `taxCategoryStatus` - Category completion tracking
- `taxPrepSessions` - Active sessions
- `taxAdvisorAccess` - J7 advisor permissions
- `taxPackages` - Generated exports

## For Users

### How to Activate Tax Prep Mode
1. Navigate to Settings → Tax Preparation
2. Click "Start Tax Prep"
3. Select tax year (current or prior)
4. Select business structure
5. Indicate if working with CPA

### 8 Document Categories
1. **Income Documents** (Required) - 1099s, K-1s, W-2s
2. **Expense Receipts** (Required) - Purchases, business expenses
3. **Mileage Log** (Optional) - Business miles
4. **Home Office** (Optional) - Square footage, expenses
5. **Asset Purchases** (Optional) - Equipment, vehicles
6. **Bank Statements** (Required) - Year-end statements
7. **Prior Year Return** (Optional) - For reference
8. **Other** (Optional) - Miscellaneous

### How to Upload Documents
1. Click category to expand
2. Click "Choose Files"
3. Select PDF or images (max 10MB each)
4. Add optional notes for accountant
5. Click "N/A" if category doesn't apply
6. Click "✓" when category is complete

### How to Export Tax Package
1. Complete all applicable categories
2. Scroll to "Export Tax Package" section
3. Click "Download ZIP Package"
4. Send ZIP to your accountant

### Package Contents
- Profit & Loss Statement (PDF)
- Balance Sheet (PDF)
- Transaction CSV (all year transactions)
- Depreciation Schedule (if assets exist)
- All uploaded documents (organized by category)
- README with instructions

## For Advisors (J7)

### Granting Tax Season Access
1. Client invites you as advisor (J7)
2. Client activates tax prep mode
3. Client clicks "Share with Advisor"
4. You receive email notification (IC4 Template 5)
5. Access granted until April 30 (or custom date)

### Reviewing Client Tax Package
1. Log in to Graceful Books
2. Navigate to client's tax prep dashboard
3. View all documents and reports
4. Add notes/questions in "Advisor Notes"
5. Click "Mark as Reviewed" or "Request More Info"
6. Client receives email notification (IC4 Template 6)

### Access Expiration
- Default: April 30 of tax year
- Custom: Set by client
- Auto-expires after date
- Client can revoke at any time

## File Locations

### Components
```
src/components/tax/
├── TaxPrepMode.tsx (194 lines)
├── TaxPrepMode.css (110 lines)
├── TaxDocumentChecklist.tsx (178 lines)
├── TaxDocumentChecklist.css (170 lines)
├── TaxDocumentUpload.tsx (82 lines)
├── TaxDocumentUpload.css (20 lines)
├── TaxPackageAssembly.tsx (43 lines)
├── TaxPackageAssembly.css (6 lines)
├── TaxAdvisorReview.tsx (51 lines)
├── TaxAdvisorReview.css (8 lines)
└── index.ts (6 lines)
```

### Services
```
src/services/tax/
├── taxDocumentManager.service.ts (326 lines)
├── taxPackageGenerator.service.ts (336 lines)
└── index.ts (6 lines)
```

### Schema & Types
```
src/db/schema/tax.schema.ts (17 lines)
src/types/tax.types.ts (60 lines)
```

## Testing

### To Run Tests (once implemented)
```bash
npm test tax
```

### Test Files to Create
- `taxDocumentManager.service.test.ts`
- `taxPackageGenerator.service.test.ts`
- `TaxPrepMode.test.tsx`
- `TaxDocumentChecklist.test.tsx`
- `TaxDocumentUpload.test.tsx`
- `TaxPackageAssembly.test.tsx`
- `TaxAdvisorReview.test.tsx`
- `taxPrepWorkflow.integration.test.ts`

## Common Issues

### "File too large" error
- Max file size: 10MB
- Compress large PDFs before upload
- Split multi-page PDFs if needed

### "Invalid file type" error
- Accepted: PDF, JPEG, PNG only
- Convert other formats (e.g., Word docs to PDF)

### Documents not appearing
- Check browser console for errors
- Ensure IndexedDB is enabled
- Try refreshing page

### ZIP download not starting
- Check browser pop-up blocker
- Ensure sufficient disk space
- Try different browser

## WCAG Compliance

All components meet WCAG 2.1 AA:
- Keyboard navigation: Tab, Enter, Space, Esc
- Screen reader support: ARIA labels throughout
- Color contrast: ≥ 4.5:1 for text, ≥ 3:1 for UI
- Focus indicators: 2px outline, 2px offset
- No information by color alone

## Support

### For Users
- Help section in app (checklist help)
- Contact support@gracefulbooks.com
- Video tutorials (planned)

### For Developers
- See: `docs/J8_TAX_PREP_MODE_IMPLEMENTATION_SUMMARY.md`
- See: `Roadmaps/ROADMAP.md` (lines 3833-4181)
- See: `docs/IC_AND_J_IMPLEMENTATION_GUIDELINES.md`

---

**Last Updated:** 2026-01-19
