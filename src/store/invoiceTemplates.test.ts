/**
 * Invoice Template Storage Integration Tests
 *
 * Tests for CRUD operations, encryption, and default template management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import {
  createInvoiceTemplate,
  getInvoiceTemplate,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
  getCompanyTemplates,
  getDefaultTemplate,
  setDefaultTemplate,
} from './invoiceTemplates';
import { db } from '../db/database';
import type { BrandColors } from '../db/schema/invoiceTemplates.schema';
import { createDefaultBrandColors } from '../db/schema/invoiceTemplates.schema';

describe('Invoice Template Storage', () => {
  const companyId = 'test-company-' + nanoid();
  const testColors: BrandColors = createDefaultBrandColors();

  beforeEach(async () => {
    // Clear templates for test company
    await db.invoiceTemplateCustomizations
      .where('company_id')
      .equals(companyId)
      .delete();
  });

  afterEach(async () => {
    // Cleanup
    await db.invoiceTemplateCustomizations
      .where('company_id')
      .equals(companyId)
      .delete();
  });

  describe('createInvoiceTemplate', () => {
    it('should create a new template', async () => {
      const result = await createInvoiceTemplate({
        companyId,
        name: 'Professional Blue',
        colors: testColors,
      });

      expect(result.success).toBe(true);
      expect((result as any).data).toBeDefined();
      expect((result as any).data.name).toBe('Professional Blue');
      expect((result as any).data.company_id).toBe(companyId);
    });

    it('should create default template automatically', async () => {
      const result = await createInvoiceTemplate({
        companyId,
        name: 'My Default',
        isDefault: true,
        colors: testColors,
      });

      expect(result.success).toBe(true);
      expect((result as any).data.isDefault).toBe(true);
    });

    it('should unset other defaults when creating new default', async () => {
      // Create first default
      const result1 = await createInvoiceTemplate({
        companyId,
        name: 'First Default',
        isDefault: true,
        colors: testColors,
      });

      expect(result1.success).toBe(true);
      const firstId = (result1 as any).data.id;

      // Create second default
      const result2 = await createInvoiceTemplate({
        companyId,
        name: 'Second Default',
        isDefault: true,
        colors: testColors,
      });

      expect(result2.success).toBe(true);

      // Check first is no longer default
      const first = await db.invoiceTemplateCustomizations.get(firstId);
      expect(first?.isDefault).toBe(false);
    });

    it('should validate template data', async () => {
      const result = await createInvoiceTemplate({
        companyId: '',
        name: '',
        colors: testColors,
      });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('VALIDATION_ERROR');
    });

    it('should return accessibility warnings for poor contrast', async () => {
      const poorColors: BrandColors = {
        primary: '#ffff00',
        secondary: '#ffffcc',
        headerText: '#ffffff',
        bodyText: '#cccccc',
        border: '#dddddd',
        background: '#ffffff',
      };

      const result = await createInvoiceTemplate({
        companyId,
        name: 'Poor Contrast Template',
        colors: poorColors,
      });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });

    it('should create template with logo', async () => {
      const result = await createInvoiceTemplate({
        companyId,
        name: 'Template with Logo',
        logo: {
          data: 'data:image/png;base64,ABC',
          filename: 'logo.png',
          mimeType: 'image/png',
          width: 200,
          height: 100,
          maxWidth: 800,
          maxHeight: 400,
          uploadedAt: Date.now(),
        },
        colors: testColors,
      });

      expect(result.success).toBe(true);
      expect((result as any).data.logo).toBeDefined();
      expect((result as any).data.logo?.filename).toBe('logo.png');
    });
  });

  describe('getInvoiceTemplate', () => {
    it('should retrieve template by ID', async () => {
      const createResult = await createInvoiceTemplate({
        companyId,
        name: 'Test Template',
        colors: testColors,
      });

      const id = (createResult as any).data.id;
      const getResult = await getInvoiceTemplate(id);

      expect(getResult.success).toBe(true);
      expect((getResult as any).data.id).toBe(id);
      expect((getResult as any).data.name).toBe('Test Template');
    });

    it('should return error for non-existent template', async () => {
      const result = await getInvoiceTemplate('non-existent-id');

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });

    it('should return error for deleted template', async () => {
      const createResult = await createInvoiceTemplate({
        companyId,
        name: 'To Delete',
        colors: testColors,
      });

      const id = (createResult as any).data.id;

      // Soft delete
      await db.invoiceTemplateCustomizations.update(id, {
        deleted_at: Date.now(),
      });

      const getResult = await getInvoiceTemplate(id);

      expect(getResult.success).toBe(false);
      expect((getResult as any).error.code).toBe('NOT_FOUND');
    });
  });

  describe('updateInvoiceTemplate', () => {
    it('should update template properties', async () => {
      const createResult = await createInvoiceTemplate({
        companyId,
        name: 'Original Name',
        colors: testColors,
      });

      const id = (createResult as any).data.id;

      const updateResult = await updateInvoiceTemplate(id, {
        name: 'Updated Name',
        fontSize: 12,
      });

      expect(updateResult.success).toBe(true);
      expect((updateResult as any).data.name).toBe('Updated Name');
      expect((updateResult as any).data.fontSize).toBe(12);
    });

    it('should handle setting as default', async () => {
      // Create two templates
      const result1 = await createInvoiceTemplate({
        companyId,
        name: 'Template 1',
        isDefault: true,
        colors: testColors,
      });

      const result2 = await createInvoiceTemplate({
        companyId,
        name: 'Template 2',
        colors: testColors,
      });

      const id2 = (result2 as any).data.id;

      // Set second as default
      const updateResult = await updateInvoiceTemplate(id2, {
        isDefault: true,
      });

      expect(updateResult.success).toBe(true);

      // Check first is no longer default
      const first = await db.invoiceTemplateCustomizations.get((result1 as any).data.id);
      expect(first?.isDefault).toBe(false);
    });

    it('should update colors and return accessibility warnings', async () => {
      const createResult = await createInvoiceTemplate({
        companyId,
        name: 'Template',
        colors: testColors,
      });

      const poorColors: BrandColors = {
        ...testColors,
        headerText: '#ffff00',
        primary: '#ffffff',
      };

      const updateResult = await updateInvoiceTemplate((createResult as any).data.id, {
        colors: poorColors,
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.warnings).toBeDefined();
    });

    it('should not update non-existent template', async () => {
      const result = await updateInvoiceTemplate('non-existent', {
        name: 'New Name',
      });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });
  });

  describe('deleteInvoiceTemplate', () => {
    it('should soft delete template', async () => {
      const createResult = await createInvoiceTemplate({
        companyId,
        name: 'To Delete',
        colors: testColors,
      });

      const id = (createResult as any).data.id;

      const deleteResult = await deleteInvoiceTemplate(id);

      expect(deleteResult.success).toBe(true);

      // Check template is soft deleted
      const template = await db.invoiceTemplateCustomizations.get(id);
      expect(template?.deleted_at).toBeTruthy();
      expect(template?.active).toBe(false);
    });

    it('should not delete default template', async () => {
      const createResult = await createInvoiceTemplate({
        companyId,
        name: 'Default',
        isDefault: true,
        colors: testColors,
      });

      const deleteResult = await deleteInvoiceTemplate((createResult as any).data.id);

      expect(deleteResult.success).toBe(false);
      expect((deleteResult as any).error.code).toBe('CONSTRAINT_VIOLATION');
    });

    it('should handle deleting non-existent template', async () => {
      const result = await deleteInvoiceTemplate('non-existent');

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });
  });

  describe('getCompanyTemplates', () => {
    it('should retrieve all templates for company', async () => {
      // Create multiple templates
      await createInvoiceTemplate({
        companyId,
        name: 'Template 1',
        colors: testColors,
      });

      await createInvoiceTemplate({
        companyId,
        name: 'Template 2',
        colors: testColors,
      });

      const result = await getCompanyTemplates(companyId);

      expect(result.success).toBe(true);
      expect((result as any).data).toHaveLength(2);
    });

    it('should filter out inactive templates by default', async () => {
      const result1 = await createInvoiceTemplate({
        companyId,
        name: 'Active',
        colors: testColors,
      });

      await createInvoiceTemplate({
        companyId,
        name: 'Inactive',
        active: false,
        colors: testColors,
      });

      const result = await getCompanyTemplates(companyId, false);

      expect(result.success).toBe(true);
      expect((result as any).data).toHaveLength(1);
      expect((result as any).data[0].name).toBe('Active');
    });

    it('should include inactive when requested', async () => {
      await createInvoiceTemplate({
        companyId,
        name: 'Active',
        colors: testColors,
      });

      await createInvoiceTemplate({
        companyId,
        name: 'Inactive',
        active: false,
        colors: testColors,
      });

      const result = await getCompanyTemplates(companyId, true);

      expect(result.success).toBe(true);
      expect((result as any).data).toHaveLength(2);
    });

    it('should not include deleted templates', async () => {
      const result1 = await createInvoiceTemplate({
        companyId,
        name: 'Active',
        colors: testColors,
      });

      const result2 = await createInvoiceTemplate({
        companyId,
        name: 'Deleted',
        colors: testColors,
      });

      // Soft delete second
      await db.invoiceTemplateCustomizations.update((result2 as any).data.id, {
        deleted_at: Date.now(),
      });

      const result = await getCompanyTemplates(companyId);

      expect(result.success).toBe(true);
      expect((result as any).data).toHaveLength(1);
      expect((result as any).data[0].name).toBe('Active');
    });
  });

  describe('getDefaultTemplate', () => {
    it('should retrieve default template', async () => {
      await createInvoiceTemplate({
        companyId,
        name: 'Default Template',
        isDefault: true,
        colors: testColors,
      });

      const result = await getDefaultTemplate(companyId);

      expect(result.success).toBe(true);
      expect((result as any).data.name).toBe('Default Template');
      expect((result as any).data.isDefault).toBe(true);
    });

    it('should create default template if none exists', async () => {
      const result = await getDefaultTemplate(companyId);

      expect(result.success).toBe(true);
      expect((result as any).data).toBeDefined();
      expect((result as any).data.isDefault).toBe(true);

      // Verify it was actually created
      const templates = await getCompanyTemplates(companyId);
      expect((templates as any).data).toHaveLength(1);
    });
  });

  describe('setDefaultTemplate', () => {
    it('should set template as default', async () => {
      const result1 = await createInvoiceTemplate({
        companyId,
        name: 'First',
        isDefault: true,
        colors: testColors,
      });

      const result2 = await createInvoiceTemplate({
        companyId,
        name: 'Second',
        colors: testColors,
      });

      const setResult = await setDefaultTemplate((result2 as any).data.id);

      expect(setResult.success).toBe(true);

      // Check second is now default
      const second = await db.invoiceTemplateCustomizations.get((result2 as any).data.id);
      expect(second?.isDefault).toBe(true);

      // Check first is not default
      const first = await db.invoiceTemplateCustomizations.get((result1 as any).data.id);
      expect(first?.isDefault).toBe(false);
    });

    it('should handle setting non-existent template as default', async () => {
      const result = await setDefaultTemplate('non-existent');

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });
  });
});
