/**
 * Invoice Template Schema Tests
 *
 * Tests for template validation, WCAG contrast calculation, and helper functions
 */

import { describe, it, expect } from 'vitest';
import {
  validateTemplateCustomization,
  createDefaultTemplateCustomization,
  createDefaultBrandColors,
  calculateContrastRatio,
  validateColorContrast,
  validateBrandColorsAccessibility,
  type BrandColors,
  type InvoiceTemplateCustomization,
} from './invoiceTemplates.schema';

describe('Invoice Template Schema', () => {
  describe('createDefaultBrandColors', () => {
    it('should create default brand colors', () => {
      const colors = createDefaultBrandColors();

      expect(colors).toHaveProperty('primary');
      expect(colors).toHaveProperty('secondary');
      expect(colors).toHaveProperty('headerText');
      expect(colors).toHaveProperty('bodyText');
      expect(colors).toHaveProperty('border');
      expect(colors).toHaveProperty('background');

      // All colors should be valid hex
      expect(colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.headerText).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.bodyText).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe('createDefaultTemplateCustomization', () => {
    it('should create valid default template', () => {
      const template = createDefaultTemplateCustomization('company-123', 'device-456');

      expect(template.company_id).toBe('company-123');
      expect(template.name).toBeDefined();
      expect(template.isDefault).toBe(true);
      expect(template.active).toBe(true);
      expect(template.logo).toBeNull();
      expect(template.colors).toBeDefined();
      expect(template.layout).toBe('left-aligned');
      expect(template.fontFamily).toBe('Arial');
      expect(template.fontSize).toBe(11);
      expect(template.version_vector).toHaveProperty('device-456', 1);
    });

    it('should allow custom template name', () => {
      const template = createDefaultTemplateCustomization(
        'company-123',
        'device-456',
        'My Custom Template'
      );

      expect(template.name).toBe('My Custom Template');
    });
  });

  describe('validateTemplateCustomization', () => {
    it('should validate valid template', () => {
      const template = createDefaultTemplateCustomization('company-123', 'device-456');
      const errors = validateTemplateCustomization(template as InvoiceTemplateCustomization);

      expect(errors).toHaveLength(0);
    });

    it('should require company_id', () => {
      const template = { ...createDefaultTemplateCustomization('', 'device-456') };
      template.company_id = '';

      const errors = validateTemplateCustomization(template as any);

      expect(errors).toContain('company_id is required');
    });

    it('should require name', () => {
      const template = { ...createDefaultTemplateCustomization('company-123', 'device-456') };
      template.name = '';

      const errors = validateTemplateCustomization(template as any);

      expect(errors).toContain('name is required');
    });

    it('should enforce name length limit', () => {
      const template = { ...createDefaultTemplateCustomization('company-123', 'device-456') };
      template.name = 'a'.repeat(101);

      const errors = validateTemplateCustomization(template as any);

      expect(errors).toContain('name must be 100 characters or less');
    });

    it('should validate fontSize range', () => {
      const template1 = { ...createDefaultTemplateCustomization('company-123', 'device-456') };
      template1.fontSize = 7;

      const errors1 = validateTemplateCustomization(template1 as any);
      expect(errors1).toContain('fontSize must be between 8 and 16');

      const template2 = { ...createDefaultTemplateCustomization('company-123', 'device-456') };
      template2.fontSize = 17;

      const errors2 = validateTemplateCustomization(template2 as any);
      expect(errors2).toContain('fontSize must be between 8 and 16');
    });

    it('should validate logo configuration', () => {
      const template = { ...createDefaultTemplateCustomization('company-123', 'device-456') };
      template.logo = {
        data: '',
        filename: 'logo.png',
        mimeType: 'image/png',
        width: 100,
        height: 100,
        maxWidth: 800,
        maxHeight: 400,
        uploadedAt: Date.now(),
      };

      const errors = validateTemplateCustomization(template as any);

      expect(errors).toContain('logo.data is required when logo is provided');
    });

    it('should validate logo MIME type', () => {
      const template = { ...createDefaultTemplateCustomization('company-123', 'device-456') };
      template.logo = {
        data: 'data:image/png;base64,ABC',
        filename: 'logo.svg',
        mimeType: 'image/svg+xml',
        width: 100,
        height: 100,
        maxWidth: 800,
        maxHeight: 400,
        uploadedAt: Date.now(),
      };

      const errors = validateTemplateCustomization(template as any);

      expect(errors).toContain('logo.mimeType must be a valid image type');
    });

    it('should validate logo dimensions', () => {
      const template = { ...createDefaultTemplateCustomization('company-123', 'device-456') };
      template.logo = {
        data: 'data:image/png;base64,ABC',
        filename: 'logo.png',
        mimeType: 'image/png',
        width: 2500,
        height: 100,
        maxWidth: 800,
        maxHeight: 400,
        uploadedAt: Date.now(),
      };

      const errors = validateTemplateCustomization(template as any);

      expect(errors).toContain('logo width must be 2000 pixels or less');
    });

    it('should validate color format', () => {
      const template = { ...createDefaultTemplateCustomization('company-123', 'device-456') };
      const invalidColors = {
        primary: 'blue',
        secondary: '#ecf0f1',
        headerText: '#ffffff',
        bodyText: '#2c3e50',
        border: '#bdc3c7',
        background: '#ffffff',
      };
      template.colors = JSON.stringify(invalidColors);

      const errors = validateTemplateCustomization(template as any);

      expect(errors.some((e) => e.includes('must be a valid hex color'))).toBe(true);
    });

    it('should validate custom message lengths', () => {
      const template = { ...createDefaultTemplateCustomization('company-123', 'device-456') };
      template.headerMessage = 'a'.repeat(501);

      const errors = validateTemplateCustomization(template as any);

      expect(errors).toContain('headerMessage must be 500 characters or less');
    });
  });

  describe('calculateContrastRatio', () => {
    it('should calculate contrast for black on white', () => {
      const ratio = calculateContrastRatio('#000000', '#ffffff');

      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should calculate contrast for white on black', () => {
      const ratio = calculateContrastRatio('#ffffff', '#000000');

      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should calculate contrast for same colors', () => {
      const ratio = calculateContrastRatio('#ff0000', '#ff0000');

      expect(ratio).toBeCloseTo(1, 0);
    });

    it('should calculate contrast for gray scale', () => {
      const ratio = calculateContrastRatio('#808080', '#ffffff');

      expect(ratio).toBeGreaterThan(3);
      expect(ratio).toBeLessThan(5);
    });

    it('should be symmetric', () => {
      const ratio1 = calculateContrastRatio('#2c3e50', '#ffffff');
      const ratio2 = calculateContrastRatio('#ffffff', '#2c3e50');

      expect(ratio1).toBeCloseTo(ratio2, 2);
    });

    it('should handle lowercase hex colors', () => {
      const ratio = calculateContrastRatio('#ffffff', '#000000');

      expect(ratio).toBeCloseTo(21, 0);
    });
  });

  describe('validateColorContrast', () => {
    it('should pass WCAG AAA for black on white', () => {
      const result = validateColorContrast('#000000', '#ffffff', 11);

      expect(result.wcagAA).toBe(true);
      expect(result.wcagAAA).toBe(true);
      expect(result.ratio).toBeCloseTo(21, 0);
      expect(result.recommendation).toBeUndefined();
    });

    it('should fail for insufficient contrast', () => {
      const result = validateColorContrast('#888888', '#999999', 11);

      expect(result.wcagAA).toBe(false);
      expect(result.wcagAAA).toBe(false);
      expect(result.recommendation).toBeDefined();
      expect(result.recommendation).toContain('below WCAG AA standard');
    });

    it('should pass AA but not AAA for moderate contrast', () => {
      const result = validateColorContrast('#595959', '#ffffff', 11);

      expect(result.wcagAA).toBe(true);
      expect(result.wcagAAA).toBe(false);
      expect(result.recommendation).toBeDefined();
      expect(result.recommendation).toContain('meets WCAG AA but not AAA');
    });

    it('should adjust thresholds for large text', () => {
      // Large text has lower requirements
      const result = validateColorContrast('#777777', '#ffffff', 14);

      expect(result.wcagAA).toBe(true);
    });

    it('should provide helpful recommendations', () => {
      const result = validateColorContrast('#cccccc', '#ffffff', 11);

      expect(result.recommendation).toContain('contrast');
      expect(result.recommendation).toContain('accessibility');
    });
  });

  describe('validateBrandColorsAccessibility', () => {
    it('should validate all brand color combinations', () => {
      const colors: BrandColors = {
        primary: '#2c3e50',
        secondary: '#ecf0f1',
        headerText: '#ffffff',
        bodyText: '#2c3e50',
        border: '#bdc3c7',
        background: '#ffffff',
      };

      const results = validateBrandColorsAccessibility(colors, 11);

      expect(results).toHaveProperty('headerContrast');
      expect(results).toHaveProperty('bodyContrast');
      expect(results).toHaveProperty('primaryOnSecondary');

      // Header text on primary should have good contrast
      expect(results.headerContrast.wcagAA).toBe(true);

      // Body text on background should have good contrast
      expect(results.bodyContrast.wcagAA).toBe(true);
    });

    it('should detect poor accessibility in brand colors', () => {
      const colors: BrandColors = {
        primary: '#ffff00',
        secondary: '#ffffcc',
        headerText: '#ffffff',
        bodyText: '#cccccc',
        border: '#dddddd',
        background: '#ffffff',
      };

      const results = validateBrandColorsAccessibility(colors, 11);

      // At least one combination should have poor contrast
      const hasPoorContrast = Object.values(results).some((result) => !result.wcagAA);

      expect(hasPoorContrast).toBe(true);
    });

    it('should consider font size in validation', () => {
      const colors: BrandColors = {
        primary: '#595959',
        secondary: '#ecf0f1',
        headerText: '#ffffff',
        bodyText: '#595959',
        border: '#bdc3c7',
        background: '#ffffff',
      };

      const resultsSmall = validateBrandColorsAccessibility(colors, 10);
      const resultsLarge = validateBrandColorsAccessibility(colors, 14);

      // Body contrast requirements differ by font size
      expect(resultsLarge.bodyContrast.wcagAA).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle template with all optional fields null', () => {
      const template = createDefaultTemplateCustomization('company-123', 'device-456');
      template.description = null;
      template.logo = null;
      template.headerMessage = null;
      template.footerMessage = null;
      template.paymentTerms = null;
      template.paymentInstructions = null;

      const errors = validateTemplateCustomization(template as any);

      expect(errors).toHaveLength(0);
    });

    it('should handle colors at WCAG threshold boundaries', () => {
      // Test colors right at the 4.5:1 threshold
      const result = validateColorContrast('#767676', '#ffffff', 11);

      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
      expect(result.wcagAA).toBe(true);
    });

    it('should handle very similar colors', () => {
      const ratio = calculateContrastRatio('#000000', '#000001');

      expect(ratio).toBeCloseTo(1, 1);
    });
  });
});
