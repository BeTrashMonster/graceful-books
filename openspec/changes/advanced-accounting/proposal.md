# Advanced Accounting (Phase 3 - Group G: Growing Stronger)

## Why This Change

This change introduces advanced accounting features for product-based businesses, complex tracking needs, and tax compliance. After mastering daily workflows in Group F, users need capabilities for inventory management, sales tax, automated data extraction, and advanced reporting to support business growth and regulatory requirements.

**Dependencies:** Requires Group F completion
- Dashboard - Full Featured (F1)
- Classes & Categories System (F2)
- Tags System (F3)
- Cash Flow Report (F4)
- A/R Aging Report (F5)
- A/P Aging Report (F6)
- Journal Entries - Full (F7)
- Cash vs. Accrual Toggle (F8)

**Target Users:**
- Product-based businesses needing inventory tracking
- Businesses collecting sales tax
- Users wanting advanced reporting capabilities
- Businesses with contractor (1099) payments
- Users seeking automation via OCR
- Power users in "Build" or "Grow" phases

**Success Metrics:**
- 60%+ of product businesses use inventory tracking
- 50%+ of applicable businesses set up sales tax
- 40%+ of users create custom reports
- 70%+ OCR accuracy for receipts and bills
- 80%+ of 1099-eligible vendors tracked

## Roadmap Reference

**Phase:** Phase 3: The Expansion
**Group:** Group G - Growing Stronger
**Roadmap Items:** G1-G7 (Custom Reports Builder, Product/Service Catalog, Basic Inventory Tracking, Sales Tax - Basic, Receipt OCR Processing, Bill OCR Processing, 1099 Tracking)
**Roadmap Location:** [Roadmaps/ROADMAP.md - Phase 3, Group G](../../Roadmaps/ROADMAP.md#group-g-growing-stronger)
**Priority:** MVP (G2, G4); Nice-to-have (G1, G3, G5, G6, G7)

## What Changes

This proposal introduces seven items focused on advanced accounting capabilities:

### Group G Items (G1-G7):

**G1. Custom Reports Builder** (Nice)
- User-defined report configurations
- Column selection and customization
- Filter configuration (accounts, classes, tags, dates)
- Date range templates
- Save and name report configurations
- Export to PDF, CSV, Excel
- Schedule delivery (email integration)

**G2. Product/Service Catalog** [MVP for product businesses]
- Manage products and services sold
- Pricing and pricing tiers
- Categories and organization
- Cost tracking for COGS
- SKU support
- Product images
- Link to invoicing and inventory

**G3. Basic Inventory Tracking** (Nice)
- Track stock levels and movements
- Quantity on hand tracking
- Reorder point alerts
- Simple valuation (FIFO/weighted average)
- Manual adjustments
- Stock take/physical count
- Inventory asset valuation
- COGS automatic calculation

**G4. Sales Tax - Basic** [MVP where applicable]
- Tax rate setup (single and combined)
- Apply to invoices automatically
- Tax collected tracking
- Tax liability report
- Filing reminders
- Tax jurisdictions
- Customer exemptions

**G5. Receipt OCR Processing** (Nice)
- Extract data from receipt images automatically
- Amount extraction
- Date extraction
- Vendor detection
- Manual correction interface
- Learning from corrections
- Confidence indicators

**G6. Bill OCR Processing** (Nice)
- Extract bill details from uploaded images
- Pre-fill bill entry form
- Amount, date, vendor extraction
- Manual correction workflow
- Confidence scoring
- Integration with bill management

**G7. 1099 Tracking** (Nice)
- Track payments to contractors for 1099 reporting
- Mark vendors as 1099-eligible
- Track payments over threshold ($600)
- W-9 storage
- 1099 summary report
- Generation guidance for tax season

## Capabilities

### New Capabilities

#### `custom-reports`
**Purpose:** User-defined report builder for tailored business insights

**Features:**
- **Column Selection:**
  - Choose which data fields to display
  - Reorder columns
  - Custom column headers
  - Calculated columns (formulas)
- **Filter Configuration:**
  - Filter by account, class, category, tags
  - Date range selection (presets + custom)
  - Amount ranges
  - Transaction types
  - Customer/vendor selection
- **Date Range Templates:**
  - This Month, Last Month, Quarter, Year
  - Last 30/60/90 days
  - Year-to-Date
  - Custom date ranges
  - Period comparison
- **Save Configurations:**
  - Name and save report definitions
  - Personal and shared reports
  - Report library
  - Quick-access favorites
- **Export Options:**
  - PDF (formatted)
  - CSV (data export)
  - Excel (with formatting)
  - Email delivery
- **Scheduled Delivery:**
  - Schedule reports for automatic generation
  - Email delivery on schedule
  - Multiple recipients
  - Delivery history

**Technical Approach:**
- Report definition storage (JSON)
- Dynamic query builder
- Template engine for formatting
- Scheduler integration

#### `product-service-catalog`
**Purpose:** Manage products and services sold by the business

**Features:**
- **Product Management:**
  - Product name, description, SKU
  - Product categories
  - Product images
  - Cost per unit (for COGS)
  - Multiple pricing tiers
  - Active/inactive status
- **Service Management:**
  - Service name and description
  - Hourly vs. fixed pricing
  - Service packages
  - Time tracking integration
  - Service categories
- **Pricing:**
  - Base price
  - Tiered pricing (volume discounts)
  - Customer-specific pricing
  - Price history
- **Integration:**
  - Link to invoice line items
  - Link to inventory tracking (products)
  - COGS calculation
  - Profitability analysis
- **Catalog Management:**
  - Search and filter
  - Bulk import/export
  - Duplicate products
  - Archive unused items

**Technical Approach:**
- PRODUCTS table with pricing structure
- Image upload and storage
- Relationship to invoices and inventory
- Profitability calculation engine

#### `inventory-basic`
**Purpose:** Basic inventory tracking for product businesses

**Features:**
- **Stock Tracking:**
  - Quantity on hand per product
  - Stock movements (in/out)
  - Adjustment tracking
  - Location support (single location v1.0)
- **Reorder Point Alerts:**
  - Set minimum stock levels
  - Low stock alerts
  - Email notifications
  - Dashboard widget
- **Valuation Methods:**
  - FIFO (First In, First Out)
  - Weighted Average
  - Simple cost tracking
- **Stock Operations:**
  - Receive inventory (purchase)
  - Adjust inventory (manual corrections)
  - Stock take/physical count
  - Transfer between locations (future)
- **Inventory Valuation:**
  - Total inventory value calculation
  - Cost per unit tracking
  - COGS automatic calculation on sale
  - Inventory asset on balance sheet
- **Reports:**
  - Inventory Valuation Report
  - Stock Movement Report
  - Low Stock Report
  - COGS Report

**Technical Approach:**
- INVENTORY_TRANSACTIONS table
- Real-time quantity calculation
- Valuation method selection
- COGS posting on invoice
- Alert system integration

#### `sales-tax`
**Purpose:** Sales tax calculation, collection tracking, and reporting

**Features:**
- **Tax Rate Setup:**
  - Single tax rates
  - Combined rates (state + local)
  - Tax jurisdictions
  - Effective date ranges
  - Rate change history
- **Application to Invoices:**
  - Automatic tax calculation
  - Apply to taxable line items
  - Override capability
  - Tax exemption handling
- **Tax Collected Tracking:**
  - Running total of tax collected
  - Track by jurisdiction
  - Track by period
  - Tax payment recording
- **Tax Liability Report:**
  - Total tax collected
  - Less tax paid
  - Net liability
  - By jurisdiction breakdown
  - Filing period support
- **Customer Exemptions:**
  - Mark customers as tax-exempt
  - Store exemption certificates
  - Exemption expiration tracking
  - Exemption reason codes
- **Filing Reminders:**
  - Configurable filing periods
  - Reminder notifications
  - Filing history tracking
  - Link to tax reports

**Technical Approach:**
- TAX_RATES table with jurisdiction support
- Tax calculation engine
- Exemption certificate storage
- Tax transaction tracking
- Alert system for filing deadlines

#### `receipt-ocr`
**Purpose:** Optical Character Recognition for receipt images

**Features:**
- **OCR Processing:**
  - Extract amount from receipt
  - Extract date from receipt
  - Detect vendor name
  - Extract line items (best effort)
  - Category suggestion based on vendor
- **Image Handling:**
  - Upload via camera or file
  - Image preprocessing (deskew, enhance)
  - Multiple format support (JPG, PNG, PDF)
  - Image storage and retrieval
- **Confidence Scoring:**
  - Per-field confidence percentage
  - Visual confidence indicators
  - Low confidence warnings
  - Manual verification prompts
- **Manual Correction:**
  - Edit any extracted field
  - Confirm or modify
  - Save corrections
  - Learning from corrections (pattern improvement)
- **Integration:**
  - Create expense from OCR data
  - Link receipt image to transaction
  - Pre-fill expense form
  - Bulk receipt processing

**Technical Approach:**
- OCR service integration (Tesseract, Cloud Vision, etc.)
- Image preprocessing pipeline
- Data extraction algorithms
- Learning/pattern storage
- Error handling and fallback

#### `bill-ocr`
**Purpose:** OCR processing for vendor bills

**Features:**
- **Bill Data Extraction:**
  - Vendor name detection
  - Bill amount extraction
  - Due date extraction
  - Bill number extraction
  - Line item extraction (best effort)
  - Payment terms detection
- **Pre-Fill Bill Entry:**
  - Auto-populate bill form
  - Link to existing vendor
  - Create new vendor if needed
  - Apply extracted data
  - User review and confirm
- **Confidence Indicators:**
  - Field-by-field confidence
  - Visual confidence display
  - Low confidence flagging
  - Manual verification workflow
- **Correction and Learning:**
  - Edit extracted fields
  - Confirm correct extractions
  - Pattern learning from corrections
  - Vendor-specific patterns
- **Batch Processing:**
  - Upload multiple bills
  - Queue for processing
  - Review all before creating
  - Bulk create bills

**Technical Approach:**
- Extends receipt-ocr capability
- Bill-specific extraction templates
- Vendor matching algorithms
- Bill form integration
- Batch processing queue

#### `1099-tracking`
**Purpose:** Track contractor payments for 1099 reporting

**Features:**
- **1099-Eligible Vendor Marking:**
  - Flag vendors as 1099-eligible
  - Vendor type selection (individual, LLC, etc.)
  - TIN/SSN storage (encrypted)
  - Exemption tracking
- **Payment Tracking:**
  - Automatic tracking of payments to 1099 vendors
  - Year-to-date total per vendor
  - Threshold monitoring ($600 minimum)
  - Payment category tracking
- **W-9 Management:**
  - W-9 form upload and storage
  - Expiration tracking
  - Missing W-9 alerts
  - Request W-9 workflow
- **1099 Summary Report:**
  - List all 1099-eligible vendors
  - Total payments per vendor
  - Threshold status (over/under $600)
  - Box assignment (Box 1, 7, etc.)
  - Export for 1099 preparation
- **Tax Season Support:**
  - Year-end 1099 checklist
  - Missing information identification
  - Filing deadline reminders
  - Accountant export package
- **Compliance:**
  - Secure storage of TIN/SSN
  - Audit trail for changes
  - Data retention compliance
  - Privacy protection

**Technical Approach:**
- Vendor flag for 1099 eligibility
- Payment aggregation by vendor and year
- W-9 document storage (encrypted)
- Threshold calculation and alerts
- Reporting queries optimized

## Impact

### User Experience
- **Product Business Support:** Inventory and catalog enable product-based businesses
- **Tax Compliance:** Sales tax and 1099 tracking reduce compliance burden
- **Automation:** OCR reduces manual data entry
- **Insights:** Custom reports enable tailored business intelligence
- **Professional Capability:** Advanced features support business growth

### Technical
- **OCR Infrastructure:** Foundation for future AI features
- **Inventory Engine:** Enables advanced inventory features (Phase 4)
- **Report Builder:** Framework for unlimited custom reporting
- **Tax Calculation:** Engine for multi-jurisdiction tax support

### Business
- **Market Expansion:** Product businesses now addressable
- **Compliance Value:** Tax features reduce risk and save time
- **Premium Features:** Advanced capabilities justify higher pricing
- **Accountant Appeal:** 1099 tracking attracts CPA partnerships

## Migration Plan

### Data Migration

**Product Catalog:**
- New PRODUCTS table
- Optional migration from existing invoice line items (one-time import)
- No backward compatibility issues

**Inventory:**
- New INVENTORY_TRANSACTIONS table
- Opening balance entry on first use
- Historical data not required

**Sales Tax:**
- New TAX_RATES and TAX_TRANSACTIONS tables
- No migration needed (start fresh)
- Historical tax reporting from original invoices

**1099 Tracking:**
- Flag existing vendors as 1099-eligible
- Historical payment aggregation (automatic)
- W-9 upload on setup

### Feature Flags

**New Flags:**
- `custom-reports`: Enable custom report builder
- `product-service-catalog`: Enable catalog management
- `inventory-basic`: Enable inventory tracking
- `sales-tax`: Enable sales tax features
- `receipt-ocr`: Enable receipt OCR processing
- `bill-ocr`: Enable bill OCR processing
- `1099-tracking`: Enable 1099 contractor tracking

**Rollout Strategy:**
1. **Week 1:** Deploy custom reports (G1) and product catalog (G2)
2. **Week 2:** Deploy inventory tracking (G3)
3. **Week 3:** Deploy sales tax (G4)
4. **Week 4:** Deploy receipt OCR (G5) and bill OCR (G6)
5. **Week 5:** Deploy 1099 tracking (G7)

**User Communication:**
- Feature announcements via email
- In-app tours for new capabilities
- Blog posts about use cases
- Webinars for advanced features
- Tutorial videos for OCR and inventory

### Rollback Plan

All capabilities are additive with feature flags:
- Disable feature flag to hide capability
- No data loss on rollback
- Users notified if feature temporarily disabled
- Re-enable when issue resolved

### Testing Requirements

**Before Production:**
- [ ] All unit tests passing (>90% coverage)
- [ ] Integration tests for each capability
- [ ] UAT with product businesses (inventory)
- [ ] UAT with tax-collecting businesses (sales tax)
- [ ] OCR accuracy testing (>70% target)
- [ ] Performance testing with 10,000+ products
- [ ] Security audit for 1099 data
- [ ] Accessibility testing (WCAG 2.1 AA)

## Success Criteria

### Adoption Metrics
- 60%+ of product businesses enable inventory
- 50%+ of applicable businesses set up sales tax
- 40%+ of users create custom reports
- 30%+ of users use OCR for receipts
- 80%+ of 1099-eligible vendors tracked

### Performance Metrics
- OCR processing <10 seconds per image
- Custom report generation <5 seconds
- Inventory calculations real-time
- Sales tax calculation instant
- 1099 report generation <2 seconds

### Quality Metrics
- >70% OCR accuracy on clear receipts
- >90% OCR accuracy with manual correction
- Zero sales tax calculation errors
- 100% 1099 data encryption
- Zero inventory COGS errors

### Business Impact
- 40% increase in product business adoption
- 25% increase in professional tier upgrades
- 30% reduction in data entry time (OCR users)
- 50% reduction in tax compliance support requests
- 35% increase in year-end 1099 readiness
