/**
 * Invoice Template Customization Schema
 *
 * Defines the structure for customizable invoice templates in Graceful Books.
 * Templates store branding information including logos, colors, layouts, and custom messages.
 *
 * Requirements:
 * - E3: Invoice Templates - Customizable (Nice)
 * - ARCH-004: CRDT-Compatible Schema Design
 * - Zero-knowledge encryption for user branding data
 */

import type { VersionVector } from '../../types/database.types';

/**
 * Layout options for invoice templates
 */
export type InvoiceTemplateLayout =
  | 'left-aligned'
  | 'centered'
  | 'two-column'
  | 'modern-split'
  | 'classic-formal';

/**
 * Logo position options
 */
export type LogoPosition = 'top-left' | 'top-center' | 'top-right' | 'header-inline';

/**
 * Font family options
 */
export type FontFamily =
  | 'Arial'
  | 'Helvetica'
  | 'Georgia'
  | 'Times New Roman'
  | 'Calibri'
  | 'Verdana';

/**
 * Logo configuration
 * Stores encrypted logo data and metadata
 */
export interface LogoConfig {
  data: string; // ENCRYPTED - Base64 encoded image data
  filename: string; // Original filename
  mimeType: string; // Image MIME type (image/png, image/jpeg, etc.)
  width: number; // Actual width in pixels
  height: number; // Actual height in pixels
  maxWidth: number; // Max display width
  maxHeight: number; // Max display height
  uploadedAt: number; // Unix timestamp
}

/**
 * Brand colors configuration
 */
export interface BrandColors {
  primary: string; // Primary brand color (hex)
  secondary: string; // Secondary/accent color (hex)
  headerText: string; // Header text color (hex)
  bodyText: string; // Body text color (hex)
  border: string; // Border color (hex)
  background: string; // Background color (hex)
}

/**
 * Accessibility validation result for color contrast
 */
export interface ContrastValidation {
  ratio: number; // Contrast ratio (e.g., 4.5:1)
  wcagAA: boolean; // Meets WCAG 2.1 AA standard
  wcagAAA: boolean; // Meets WCAG 2.1 AAA standard
  recommendation?: string; // Warning message if contrast is insufficient
}

/**
 * Invoice Template Customization entity
 * Stores complete branding and layout configuration
 */
export interface InvoiceTemplateCustomization {
  id: string; // UUID
  company_id: string; // Company UUID
  name: string; // ENCRYPTED - Template name (e.g., "Professional Blue", "Modern Minimal")
  description: string | null; // ENCRYPTED - Optional description
  isDefault: boolean; // Whether this is the default template for the company
  active: boolean; // Whether this template is active/available

  // Logo configuration
  logo: LogoConfig | null; // ENCRYPTED - Logo data and metadata (null if no logo)
  logoPosition: LogoPosition; // Where to position the logo
  showLogo: boolean; // Whether to display the logo

  // Color scheme
  colors: string; // ENCRYPTED - JSON stringified BrandColors object

  // Layout and typography
  layout: InvoiceTemplateLayout; // Layout style
  fontFamily: FontFamily; // Font family for the template
  fontSize: number; // Base font size in points (default: 11)

  // Display options
  showLineItemBorders: boolean; // Show borders around line items
  showItemNumbers: boolean; // Number line items (1, 2, 3...)
  showTaxIdOnInvoice: boolean; // Display company tax ID on invoice
  showPageNumbers: boolean; // Show page numbers on multi-page invoices

  // Custom messages
  headerMessage: string | null; // ENCRYPTED - Custom message in header area
  footerMessage: string | null; // ENCRYPTED - Custom message in footer (e.g., "Thank you for your business!")
  paymentTerms: string | null; // ENCRYPTED - Payment terms text (e.g., "Net 30", "Due on receipt")
  paymentInstructions: string | null; // ENCRYPTED - How to pay (bank details, payment link, etc.)

  // CRDT and audit fields
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  deleted_at: number | null; // Tombstone marker for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema definition for InvoiceTemplateCustomizations table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying templates by company
 * - [company_id+isDefault]: Compound index for finding default template
 * - [company_id+active]: Compound index for finding active templates
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const invoiceTemplateCustomizationsSchema =
  'id, company_id, [company_id+isDefault], [company_id+active], updated_at, deleted_at';

/**
 * Table name constant
 */
export const INVOICE_TEMPLATE_CUSTOMIZATIONS_TABLE = 'invoiceTemplateCustomizations';

/**
 * Default brand colors (professional blue theme)
 */
export const createDefaultBrandColors = (): BrandColors => ({
  primary: '#2c3e50',
  secondary: '#ecf0f1',
  headerText: '#ffffff',
  bodyText: '#2c3e50',
  border: '#bdc3c7',
  background: '#ffffff',
});

/**
 * Create default template customization
 */
export const createDefaultTemplateCustomization = (
  companyId: string,
  deviceId: string,
  name: string = 'Classic Professional'
): Partial<InvoiceTemplateCustomization> => {
  const now = Date.now();

  return {
    company_id: companyId,
    name,
    description: 'Professional invoice template with classic styling',
    isDefault: true,
    active: true,
    logo: null,
    logoPosition: 'top-left',
    showLogo: true,
    colors: JSON.stringify(createDefaultBrandColors()),
    layout: 'left-aligned',
    fontFamily: 'Arial',
    fontSize: 11,
    showLineItemBorders: true,
    showItemNumbers: false,
    showTaxIdOnInvoice: true,
    showPageNumbers: true,
    headerMessage: null,
    footerMessage: 'Thank you for your business!',
    paymentTerms: 'Net 30',
    paymentInstructions: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure template has valid fields
 */
export const validateTemplateCustomization = (
  template: Partial<InvoiceTemplateCustomization>
): string[] => {
  const errors: string[] = [];

  if (!template.company_id) {
    errors.push('company_id is required');
  }

  if (!template.name || template.name.trim() === '') {
    errors.push('name is required');
  }

  if (template.name && template.name.length > 100) {
    errors.push('name must be 100 characters or less');
  }

  if (template.fontSize && (template.fontSize < 8 || template.fontSize > 16)) {
    errors.push('fontSize must be between 8 and 16');
  }

  // Validate logo configuration
  if (template.logo) {
    if (!template.logo.data) {
      errors.push('logo.data is required when logo is provided');
    }
    if (!template.logo.mimeType) {
      errors.push('logo.mimeType is required when logo is provided');
    }
    if (
      template.logo.mimeType &&
      !['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'].includes(
        template.logo.mimeType
      )
    ) {
      errors.push('logo.mimeType must be a valid image type');
    }
    if (template.logo.width && template.logo.width > 2000) {
      errors.push('logo width must be 2000 pixels or less');
    }
    if (template.logo.height && template.logo.height > 2000) {
      errors.push('logo height must be 2000 pixels or less');
    }
  }

  // Validate color format (hex colors)
  if (template.colors) {
    try {
      const colors: BrandColors = JSON.parse(template.colors);
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;

      if (!hexRegex.test(colors.primary)) {
        errors.push('colors.primary must be a valid hex color (e.g., #2c3e50)');
      }
      if (!hexRegex.test(colors.secondary)) {
        errors.push('colors.secondary must be a valid hex color');
      }
      if (!hexRegex.test(colors.headerText)) {
        errors.push('colors.headerText must be a valid hex color');
      }
      if (!hexRegex.test(colors.bodyText)) {
        errors.push('colors.bodyText must be a valid hex color');
      }
      if (!hexRegex.test(colors.border)) {
        errors.push('colors.border must be a valid hex color');
      }
      if (!hexRegex.test(colors.background)) {
        errors.push('colors.background must be a valid hex color');
      }
    } catch (e) {
      errors.push('colors must be a valid JSON string');
    }
  }

  // Validate custom message lengths
  if (template.headerMessage && template.headerMessage.length > 500) {
    errors.push('headerMessage must be 500 characters or less');
  }
  if (template.footerMessage && template.footerMessage.length > 500) {
    errors.push('footerMessage must be 500 characters or less');
  }
  if (template.paymentTerms && template.paymentTerms.length > 200) {
    errors.push('paymentTerms must be 200 characters or less');
  }
  if (template.paymentInstructions && template.paymentInstructions.length > 1000) {
    errors.push('paymentInstructions must be 1000 characters or less');
  }

  return errors;
};

/**
 * Helper: Calculate contrast ratio between two colors
 * Based on WCAG 2.1 guidelines
 */
export const calculateContrastRatio = (color1: string, color2: string): number => {
  // Convert hex to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  };

  // Calculate relative luminance
  const getLuminance = (rgb: [number, number, number]): number => {
    const [r, g, b] = rgb.map((val) => {
      const sRGB = val / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };

  const lum1 = getLuminance(hexToRgb(color1));
  const lum2 = getLuminance(hexToRgb(color2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Helper: Validate color contrast for accessibility
 */
export const validateColorContrast = (
  textColor: string,
  backgroundColor: string,
  fontSize: number = 11
): ContrastValidation => {
  const ratio = calculateContrastRatio(textColor, backgroundColor);

  // WCAG 2.1 thresholds
  // Normal text (< 18pt or < 14pt bold): 4.5:1 for AA, 7:1 for AAA
  // Large text (>= 18pt or >= 14pt bold): 3:1 for AA, 4.5:1 for AAA
  const isLargeText = fontSize >= 14; // Simplified check

  const aaThreshold = isLargeText ? 3 : 4.5;
  const aaaThreshold = isLargeText ? 4.5 : 7;

  const wcagAA = ratio >= aaThreshold;
  const wcagAAA = ratio >= aaaThreshold;

  let recommendation: string | undefined;
  if (!wcagAA) {
    recommendation = `Contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA standard (${aaThreshold}:1). Consider using darker text or lighter background for better accessibility.`;
  } else if (!wcagAAA) {
    recommendation = `Contrast ratio ${ratio.toFixed(2)}:1 meets WCAG AA but not AAA (${aaaThreshold}:1). Consider improving contrast for better accessibility.`;
  }

  return {
    ratio,
    wcagAA,
    wcagAAA,
    recommendation,
  };
};

/**
 * Helper: Validate all brand colors for accessibility
 */
export const validateBrandColorsAccessibility = (
  colors: BrandColors,
  fontSize: number = 11
): Record<string, ContrastValidation> => {
  return {
    headerContrast: validateColorContrast(colors.headerText, colors.primary, fontSize),
    bodyContrast: validateColorContrast(colors.bodyText, colors.background, fontSize),
    primaryOnSecondary: validateColorContrast(colors.primary, colors.secondary, fontSize),
  };
};

/**
 * Helper: Generate CSS for custom template
 * Converts template customization into CSS string
 */
export const generateCustomTemplateCSS = (
  template: InvoiceTemplateCustomization,
  colors: BrandColors
): string => {
  return `
    .invoice {
      font-family: ${template.fontFamily}, sans-serif;
      font-size: ${template.fontSize}pt;
      color: ${colors.bodyText};
      background-color: ${colors.background};
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }

    .invoice-header {
      background-color: ${colors.primary};
      color: ${colors.headerText};
      padding: 30px;
      margin-bottom: 40px;
      ${template.layout === 'centered' ? 'text-align: center;' : ''}
    }

    .invoice-header h1 {
      margin: 0 0 10px 0;
      font-size: ${template.fontSize + 10}pt;
      font-weight: bold;
    }

    .invoice-details {
      display: ${template.layout === 'two-column' || template.layout === 'modern-split' ? 'grid' : 'block'};
      ${template.layout === 'two-column' || template.layout === 'modern-split' ? 'grid-template-columns: 1fr 1fr;' : ''}
      gap: 30px;
      margin-bottom: 40px;
    }

    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    .invoice-table thead {
      background-color: ${colors.secondary};
    }

    .invoice-table th {
      padding: 15px;
      text-align: left;
      font-weight: bold;
      color: ${colors.primary};
      ${template.showLineItemBorders ? `border-bottom: 2px solid ${colors.border};` : ''}
    }

    .invoice-table td {
      padding: 15px;
      ${template.showLineItemBorders ? `border-bottom: 1px solid ${colors.border};` : ''}
    }

    .invoice-totals .total {
      background-color: ${colors.primary};
      color: ${colors.headerText};
      font-weight: bold;
    }

    .invoice-footer {
      text-align: center;
      padding-top: 30px;
      border-top: 2px solid ${colors.border};
      color: ${colors.bodyText};
      font-size: ${template.fontSize - 1}pt;
    }

    .company-logo {
      max-width: ${template.logo?.maxWidth || 150}px;
      max-height: ${template.logo?.maxHeight || 80}px;
      margin-bottom: 20px;
      ${template.logoPosition === 'top-center' ? 'margin-left: auto; margin-right: auto; display: block;' : ''}
      ${template.logoPosition === 'top-right' ? 'float: right;' : ''}
    }

    @media print {
      .invoice {
        padding: 0;
      }
      .invoice-header {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `;
};
