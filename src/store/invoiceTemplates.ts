/**
 * Invoice Template Customizations Data Access Layer
 *
 * Provides CRUD operations for invoice template customizations with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Default template management
 * - Logo data encryption
 *
 * Requirements:
 * - E3: Invoice Templates - Customizable (Nice)
 */

import { nanoid } from 'nanoid';
import { db } from '../db/database';
import type { DatabaseResult, EncryptionContext, VersionVector } from './types';
import type {
  InvoiceTemplateCustomization,
  BrandColors,
  LogoConfig,
  InvoiceTemplateLayout,
  FontFamily,
  LogoPosition,
} from '../db/schema/invoiceTemplates.schema';
import {
  validateTemplateCustomization,
  createDefaultTemplateCustomization,
  validateBrandColorsAccessibility,
} from '../db/schema/invoiceTemplates.schema';
import { getDeviceId } from '../utils/device';
import { incrementVersionVector } from '../db/crdt';

/**
 * Initialize version vector for a new entity
 */
function initVersionVector(): VersionVector {
  const deviceId = getDeviceId();
  return { [deviceId]: 1 };
}

/**
 * Create a new invoice template customization
 */
export async function createInvoiceTemplate(
  templateData: {
    companyId: string;
    name: string;
    description?: string;
    isDefault?: boolean;
    active?: boolean;
    logo?: LogoConfig | null;
    logoPosition?: LogoPosition;
    showLogo?: boolean;
    colors: BrandColors;
    layout?: InvoiceTemplateLayout;
    fontFamily?: FontFamily;
    fontSize?: number;
    showLineItemBorders?: boolean;
    showItemNumbers?: boolean;
    showTaxIdOnInvoice?: boolean;
    showPageNumbers?: boolean;
    headerMessage?: string;
    footerMessage?: string;
    paymentTerms?: string;
    paymentInstructions?: string;
  },
  context?: EncryptionContext
): Promise<DatabaseResult<InvoiceTemplateCustomization>> {
  try {
    const {
      companyId,
      name,
      description,
      isDefault = false,
      active = true,
      logo = null,
      logoPosition = 'top-left',
      showLogo = true,
      colors,
      layout = 'left-aligned',
      fontFamily = 'Arial',
      fontSize = 11,
      showLineItemBorders = true,
      showItemNumbers = false,
      showTaxIdOnInvoice = true,
      showPageNumbers = true,
      headerMessage,
      footerMessage = 'Thank you for your business!',
      paymentTerms = 'Net 30',
      paymentInstructions,
    } = templateData;

    // If this is set as default, unset other defaults for this company
    if (isDefault) {
      await db.invoiceTemplateCustomizations
        .where('company_id')
        .equals(companyId)
        .modify({ isDefault: false });
    }

    // Create template entity
    const now = Date.now();

    const template: InvoiceTemplateCustomization = {
      id: nanoid(),
      company_id: companyId,
      name,
      description: description || null,
      isDefault,
      active,
      logo,
      logoPosition,
      showLogo,
      colors: JSON.stringify(colors),
      layout,
      fontFamily,
      fontSize,
      showLineItemBorders,
      showItemNumbers,
      showTaxIdOnInvoice,
      showPageNumbers,
      headerMessage: headerMessage || null,
      footerMessage: footerMessage || null,
      paymentTerms: paymentTerms || null,
      paymentInstructions: paymentInstructions || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: initVersionVector(),
    };

    // Validate template
    const errors = validateTemplateCustomization(template);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Template validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Validate accessibility
    const accessibilityResults = validateBrandColorsAccessibility(colors, fontSize);
    const accessibilityWarnings: string[] = [];

    if (accessibilityResults.headerContrast?.recommendation) {
      accessibilityWarnings.push(`Header: ${accessibilityResults.headerContrast.recommendation}`);
    }
    if (accessibilityResults.bodyContrast?.recommendation) {
      accessibilityWarnings.push(`Body: ${accessibilityResults.bodyContrast.recommendation}`);
    }

    // Apply encryption if service provided
    let encryptedTemplate = template;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      encryptedTemplate = {
        ...template,
        name: await encryptionService.encrypt(template.name),
        description: template.description
          ? await encryptionService.encrypt(template.description)
          : null,
        colors: await encryptionService.encrypt(template.colors),
        headerMessage: template.headerMessage
          ? await encryptionService.encrypt(template.headerMessage)
          : null,
        footerMessage: template.footerMessage
          ? await encryptionService.encrypt(template.footerMessage)
          : null,
        paymentTerms: template.paymentTerms
          ? await encryptionService.encrypt(template.paymentTerms)
          : null,
        paymentInstructions: template.paymentInstructions
          ? await encryptionService.encrypt(template.paymentInstructions)
          : null,
        logo: template.logo
          ? {
              ...template.logo,
              data: await encryptionService.encrypt(template.logo.data),
            }
          : null,
      };
    }

    // Store in database
    await db.invoiceTemplateCustomizations.add(encryptedTemplate);

    return {
      success: true,
      data: template,
      warnings: accessibilityWarnings.length > 0 ? accessibilityWarnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get template by ID
 */
export async function getInvoiceTemplate(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<InvoiceTemplateCustomization>> {
  try {
    const entity = await db.invoiceTemplateCustomizations.get(id);

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Template not found: ${id}`,
        },
      };
    }

    // Check if soft deleted
    if (entity.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Template has been deleted: ${id}`,
        },
      };
    }

    // Decrypt if service provided
    let result = entity;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...entity,
        name: await encryptionService.decrypt(entity.name),
        description: entity.description
          ? await encryptionService.decrypt(entity.description)
          : null,
        colors: await encryptionService.decrypt(entity.colors),
        headerMessage: entity.headerMessage
          ? await encryptionService.decrypt(entity.headerMessage)
          : null,
        footerMessage: entity.footerMessage
          ? await encryptionService.decrypt(entity.footerMessage)
          : null,
        paymentTerms: entity.paymentTerms
          ? await encryptionService.decrypt(entity.paymentTerms)
          : null,
        paymentInstructions: entity.paymentInstructions
          ? await encryptionService.decrypt(entity.paymentInstructions)
          : null,
        logo: entity.logo
          ? {
              ...entity.logo,
              data: await encryptionService.decrypt(entity.logo.data),
            }
          : null,
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Update an invoice template
 */
export async function updateInvoiceTemplate(
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    isDefault: boolean;
    active: boolean;
    logo: LogoConfig | null;
    logoPosition: LogoPosition;
    showLogo: boolean;
    colors: BrandColors;
    layout: InvoiceTemplateLayout;
    fontFamily: FontFamily;
    fontSize: number;
    showLineItemBorders: boolean;
    showItemNumbers: boolean;
    showTaxIdOnInvoice: boolean;
    showPageNumbers: boolean;
    headerMessage: string;
    footerMessage: string;
    paymentTerms: string;
    paymentInstructions: string;
  }>,
  context?: EncryptionContext
): Promise<DatabaseResult<InvoiceTemplateCustomization>> {
  try {
    const existing = await db.invoiceTemplateCustomizations.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Template not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Template has been deleted: ${id}`,
        },
      };
    }

    // If setting as default, unset other defaults for this company
    if (updates.isDefault && !existing.isDefault) {
      await db.invoiceTemplateCustomizations
        .where('company_id')
        .equals(existing.company_id)
        .and((t) => t.id !== id)
        .modify({ isDefault: false });
    }

    // Decrypt existing colors if updating
    let existingColors: BrandColors | undefined;
    if (context?.encryptionService && !updates.colors) {
      const decrypted = await context.encryptionService.decrypt(existing.colors);
      existingColors = JSON.parse(decrypted);
    }

    // Prepare updated entity
    const now = Date.now();
    const deviceId = getDeviceId();

    const updated: InvoiceTemplateCustomization = {
      ...existing,
      name: updates.name !== undefined ? updates.name : existing.name,
      description:
        updates.description !== undefined ? updates.description : existing.description,
      isDefault: updates.isDefault !== undefined ? updates.isDefault : existing.isDefault,
      active: updates.active !== undefined ? updates.active : existing.active,
      logo: updates.logo !== undefined ? updates.logo : existing.logo,
      logoPosition:
        updates.logoPosition !== undefined ? updates.logoPosition : existing.logoPosition,
      showLogo: updates.showLogo !== undefined ? updates.showLogo : existing.showLogo,
      colors: updates.colors
        ? JSON.stringify(updates.colors)
        : existingColors
          ? JSON.stringify(existingColors)
          : existing.colors,
      layout: updates.layout !== undefined ? updates.layout : existing.layout,
      fontFamily: updates.fontFamily !== undefined ? updates.fontFamily : existing.fontFamily,
      fontSize: updates.fontSize !== undefined ? updates.fontSize : existing.fontSize,
      showLineItemBorders:
        updates.showLineItemBorders !== undefined
          ? updates.showLineItemBorders
          : existing.showLineItemBorders,
      showItemNumbers:
        updates.showItemNumbers !== undefined
          ? updates.showItemNumbers
          : existing.showItemNumbers,
      showTaxIdOnInvoice:
        updates.showTaxIdOnInvoice !== undefined
          ? updates.showTaxIdOnInvoice
          : existing.showTaxIdOnInvoice,
      showPageNumbers:
        updates.showPageNumbers !== undefined
          ? updates.showPageNumbers
          : existing.showPageNumbers,
      headerMessage:
        updates.headerMessage !== undefined ? updates.headerMessage : existing.headerMessage,
      footerMessage:
        updates.footerMessage !== undefined ? updates.footerMessage : existing.footerMessage,
      paymentTerms:
        updates.paymentTerms !== undefined ? updates.paymentTerms : existing.paymentTerms,
      paymentInstructions:
        updates.paymentInstructions !== undefined
          ? updates.paymentInstructions
          : existing.paymentInstructions,
      updated_at: now,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    };

    // Validate updated template
    const errors = validateTemplateCustomization(updated);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Template validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Validate accessibility if colors changed
    const accessibilityWarnings: string[] = [];
    if (updates.colors) {
      const accessibilityResults = validateBrandColorsAccessibility(
        updates.colors,
        updated.fontSize
      );

      if (accessibilityResults.headerContrast?.recommendation) {
        accessibilityWarnings.push(
          `Header: ${accessibilityResults.headerContrast.recommendation}`
        );
      }
      if (accessibilityResults.bodyContrast?.recommendation) {
        accessibilityWarnings.push(`Body: ${accessibilityResults.bodyContrast.recommendation}`);
      }
    }

    // Apply encryption if service provided
    let encryptedTemplate = updated;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      encryptedTemplate = {
        ...updated,
        name: await encryptionService.encrypt(updated.name),
        description: updated.description
          ? await encryptionService.encrypt(updated.description)
          : null,
        colors: await encryptionService.encrypt(updated.colors),
        headerMessage: updated.headerMessage
          ? await encryptionService.encrypt(updated.headerMessage)
          : null,
        footerMessage: updated.footerMessage
          ? await encryptionService.encrypt(updated.footerMessage)
          : null,
        paymentTerms: updated.paymentTerms
          ? await encryptionService.encrypt(updated.paymentTerms)
          : null,
        paymentInstructions: updated.paymentInstructions
          ? await encryptionService.encrypt(updated.paymentInstructions)
          : null,
        logo: updated.logo
          ? {
              ...updated.logo,
              data: await encryptionService.encrypt(updated.logo.data),
            }
          : null,
      };
    }

    // Update in database
    await db.invoiceTemplateCustomizations.put(encryptedTemplate);

    return {
      success: true,
      data: updated,
      warnings: accessibilityWarnings.length > 0 ? accessibilityWarnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Delete a template (soft delete)
 */
export async function deleteInvoiceTemplate(id: string): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.invoiceTemplateCustomizations.get(id);

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Template not found: ${id}`,
        },
      };
    }

    if (existing.deleted_at) {
      return { success: true, data: undefined };
    }

    // Don't allow deleting the default template
    if (existing.isDefault) {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot delete the default template. Set another template as default first.',
        },
      };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    await db.invoiceTemplateCustomizations.update(id, {
      deleted_at: now,
      updated_at: now,
      active: false,
      version_vector: incrementVersionVector(existing.version_vector, deviceId),
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get all templates for a company
 */
export async function getCompanyTemplates(
  companyId: string,
  includeInactive: boolean = false,
  context?: EncryptionContext
): Promise<DatabaseResult<InvoiceTemplateCustomization[]>> {
  try {
    let collection = db.invoiceTemplateCustomizations
      .where('company_id')
      .equals(companyId)
      .and((t) => !t.deleted_at);

    if (!includeInactive) {
      collection = collection.and((t) => t.active);
    }

    const entities = await collection.toArray();

    // Decrypt if service provided
    let results = entities;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          name: await encryptionService.decrypt(entity.name),
          description: entity.description
            ? await encryptionService.decrypt(entity.description)
            : null,
          colors: await encryptionService.decrypt(entity.colors),
          headerMessage: entity.headerMessage
            ? await encryptionService.decrypt(entity.headerMessage)
            : null,
          footerMessage: entity.footerMessage
            ? await encryptionService.decrypt(entity.footerMessage)
            : null,
          paymentTerms: entity.paymentTerms
            ? await encryptionService.decrypt(entity.paymentTerms)
            : null,
          paymentInstructions: entity.paymentInstructions
            ? await encryptionService.decrypt(entity.paymentInstructions)
            : null,
          logo: entity.logo
            ? {
                ...entity.logo,
                data: await encryptionService.decrypt(entity.logo.data),
              }
            : null,
        }))
      );
    }

    return { success: true, data: results };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get default template for a company
 */
export async function getDefaultTemplate(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<InvoiceTemplateCustomization>> {
  try {
    // Query by company_id and filter for isDefault
    // Note: Using filter instead of compound index due to boolean handling in IndexedDB
    const entity = await db.invoiceTemplateCustomizations
      .where('company_id')
      .equals(companyId)
      .filter((t) => t.isDefault === true && !t.deleted_at)
      .first();

    if (!entity) {
      // No default template found, create one
      const defaults = createDefaultTemplateCustomization(companyId, getDeviceId());
      return createInvoiceTemplate(
        {
          companyId: defaults.company_id!,
          name: defaults.name!,
          description: defaults.description || undefined,
          isDefault: true,
          colors: JSON.parse(defaults.colors!),
        },
        context
      );
    }

    // Decrypt if service provided
    let result = entity;
    if (context?.encryptionService) {
      const { encryptionService } = context;
      result = {
        ...entity,
        name: await encryptionService.decrypt(entity.name),
        description: entity.description
          ? await encryptionService.decrypt(entity.description)
          : null,
        colors: await encryptionService.decrypt(entity.colors),
        headerMessage: entity.headerMessage
          ? await encryptionService.decrypt(entity.headerMessage)
          : null,
        footerMessage: entity.footerMessage
          ? await encryptionService.decrypt(entity.footerMessage)
          : null,
        paymentTerms: entity.paymentTerms
          ? await encryptionService.decrypt(entity.paymentTerms)
          : null,
        paymentInstructions: entity.paymentInstructions
          ? await encryptionService.decrypt(entity.paymentInstructions)
          : null,
        logo: entity.logo
          ? {
              ...entity.logo,
              data: await encryptionService.decrypt(entity.logo.data),
            }
          : null,
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Set template as default
 */
export async function setDefaultTemplate(
  templateId: string
): Promise<DatabaseResult<InvoiceTemplateCustomization>> {
  try {
    const template = await db.invoiceTemplateCustomizations.get(templateId);

    if (!template || template.deleted_at) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Template not found: ${templateId}`,
        },
      };
    }

    // Unset other defaults for this company
    await db.invoiceTemplateCustomizations
      .where('company_id')
      .equals(template.company_id)
      .and((t) => t.id !== templateId)
      .modify({ isDefault: false });

    // Set this one as default
    const now = Date.now();
    const deviceId = getDeviceId();

    await db.invoiceTemplateCustomizations.update(templateId, {
      isDefault: true,
      updated_at: now,
      version_vector: incrementVersionVector(template.version_vector, deviceId),
    });

    const updated = await db.invoiceTemplateCustomizations.get(templateId);
    return { success: true, data: updated! };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}
