/**
 * Invoice Template Customization Component
 *
 * Provides a comprehensive UI for customizing invoice templates with:
 * - Logo upload with automatic resizing
 * - Brand color picker with WCAG warnings
 * - Layout selection
 * - Custom messages
 * - Live preview with actual customer data
 *
 * Requirements:
 * - E3: Invoice Templates - Customizable (Nice)
 * - DISC-adapted messaging
 * - WCAG 2.1 AA accessibility
 */

import React, { useState, useEffect } from 'react';
import ColorPicker from './ColorPicker';
import { uploadLogo, formatFileSize, MAX_FILE_SIZE } from '../../services/logoUpload';
import type {
  BrandColors,
  LogoConfig,
  InvoiceTemplateLayout,
  FontFamily,
  LogoPosition,
} from '../../db/schema/invoiceTemplates.schema';
import { createDefaultBrandColors } from '../../db/schema/invoiceTemplates.schema';

export interface TemplateCustomizationProps {
  /**
   * Current template data
   */
  template: {
    name: string;
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
    headerMessage?: string;
    footerMessage?: string;
    paymentTerms?: string;
    paymentInstructions?: string;
  };

  /**
   * Callback when template changes
   */
  onChange: (template: Partial<typeof template>) => void;

  /**
   * Callback when save is requested
   */
  onSave: () => void;

  /**
   * Callback when cancel is requested
   */
  onCancel: () => void;

  /**
   * User's DISC profile for adapted messaging
   */
  discProfile?: 'D' | 'I' | 'S' | 'C';

  /**
   * Whether the form is saving
   */
  isSaving?: boolean;
}

/**
 * Layout options with descriptions
 */
const LAYOUT_OPTIONS: Array<{
  value: InvoiceTemplateLayout;
  label: string;
  description: string;
}> = [
  {
    value: 'left-aligned',
    label: 'Left Aligned',
    description: 'Traditional left-aligned layout',
  },
  {
    value: 'centered',
    label: 'Centered',
    description: 'Modern centered design',
  },
  {
    value: 'two-column',
    label: 'Two Column',
    description: 'Side-by-side information layout',
  },
  {
    value: 'modern-split',
    label: 'Modern Split',
    description: 'Contemporary asymmetric layout',
  },
  {
    value: 'classic-formal',
    label: 'Classic Formal',
    description: 'Professional formal invoice',
  },
];

/**
 * Font family options
 */
const FONT_OPTIONS: Array<{ value: FontFamily; label: string }> = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Verdana', label: 'Verdana' },
];

/**
 * Logo position options
 */
const LOGO_POSITION_OPTIONS: Array<{ value: LogoPosition; label: string }> = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'header-inline', label: 'Header Inline' },
];

/**
 * Get DISC-adapted message
 */
function getDiscMessage(
  messageType: 'success' | 'info' | 'warning',
  discProfile?: 'D' | 'I' | 'S' | 'C'
): string {
  const messages = {
    success: {
      D: 'Brand colors applied! Your invoices now match your business personality.',
      I: 'Amazing! Your invoices are going to look fantastic with your brand colors!',
      S: "Your brand colors have been carefully applied. Your invoices will now reflect your business's unique style.",
      C: 'Brand colors successfully applied with validated contrast ratios for optimal readability.',
    },
    info: {
      D: 'Upload your logo to brand your invoices. Max 5MB.',
      I: "Let's add your logo to make your invoices uniquely yours!",
      S: 'You can upload your business logo here. We recommend using a PNG or JPEG file under 5MB.',
      C: 'Logo upload supports PNG, JPEG, GIF, and WebP formats with automatic resizing (max 5MB, 800x400px).',
    },
    warning: {
      D: 'Color contrast below WCAG standards. Adjust for better accessibility.',
      I: 'Your color choices are creative, but they might be hard to read. How about adjusting them?',
      S: "We noticed the color contrast might make text difficult to read. Would you like to adjust it for better clarity?",
      C: 'WCAG 2.1 AA contrast ratio not met. Current ratio below 4.5:1 threshold for normal text.',
    },
  };

  return messages[messageType][discProfile || 'S'];
}

/**
 * TemplateCustomization Component
 */
export const TemplateCustomization: React.FC<TemplateCustomizationProps> = ({
  template,
  onChange,
  onSave,
  onCancel,
  discProfile,
  isSaving = false,
}) => {
  const [activeTab, setActiveTab] = useState<'branding' | 'layout' | 'messages'>('branding');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Handle logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setLogoError(null);

    try {
      const result = await uploadLogo(file);

      if (result.success && result.data) {
        onChange({ logo: result.data });
      } else {
        setLogoError(result.error?.message || 'Failed to upload logo');
      }
    } catch (error) {
      setLogoError('An unexpected error occurred while uploading');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle logo removal
  const handleRemoveLogo = () => {
    onChange({ logo: null });
  };

  // Handle color changes
  const handleColorChange = (colorKey: keyof BrandColors, value: string) => {
    onChange({
      colors: {
        ...template.colors,
        [colorKey]: value,
      },
    });
  };

  return (
    <div className="template-customization">
      {/* Header */}
      <div className="customization-header">
        <h2>Customize Invoice Template</h2>
        <p className="subtitle">{getDiscMessage('info', discProfile)}</p>
      </div>

      {/* Tabs */}
      <div className="customization-tabs">
        <button
          className={`tab ${activeTab === 'branding' ? 'active' : ''}`}
          onClick={() => setActiveTab('branding')}
        >
          Branding
        </button>
        <button
          className={`tab ${activeTab === 'layout' ? 'active' : ''}`}
          onClick={() => setActiveTab('layout')}
        >
          Layout
        </button>
        <button
          className={`tab ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          Messages
        </button>
      </div>

      {/* Tab Content */}
      <div className="customization-content">
        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="tab-panel">
            {/* Logo Upload */}
            <section className="customization-section">
              <h3>Logo</h3>
              <div className="logo-upload">
                {template.logo ? (
                  <div className="logo-preview">
                    <img
                      src={template.logo.data}
                      alt="Company logo"
                      style={{
                        maxWidth: `${template.logo.maxWidth}px`,
                        maxHeight: `${template.logo.maxHeight}px`,
                      }}
                    />
                    <div className="logo-info">
                      <p>{template.logo.filename}</p>
                      <p className="logo-dimensions">
                        {template.logo.width} × {template.logo.height}px
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="button-remove"
                      disabled={uploadingLogo}
                    >
                      Remove Logo
                    </button>
                  </div>
                ) : (
                  <div className="logo-upload-area">
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="file-input"
                    />
                    <label htmlFor="logo-upload" className="upload-label">
                      {uploadingLogo ? (
                        <span>Uploading...</span>
                      ) : (
                        <>
                          <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span>Click to upload logo</span>
                          <span className="upload-hint">PNG, JPEG, GIF, or WebP (max {formatFileSize(MAX_FILE_SIZE)})</span>
                        </>
                      )}
                    </label>
                  </div>
                )}
                {logoError && (
                  <div className="error-message" role="alert">
                    {logoError}
                  </div>
                )}
              </div>

              {/* Logo Position */}
              {template.logo && (
                <div className="form-group">
                  <label htmlFor="logo-position">Logo Position</label>
                  <select
                    id="logo-position"
                    value={template.logoPosition}
                    onChange={(e) => onChange({ logoPosition: e.target.value as LogoPosition })}
                  >
                    {LOGO_POSITION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {/* Brand Colors */}
            <section className="customization-section">
              <h3>Brand Colors</h3>
              <div className="colors-grid">
                <ColorPicker
                  label="Primary Color"
                  value={template.colors.primary}
                  onChange={(value) => handleColorChange('primary', value)}
                  contrastAgainst={template.colors.headerText}
                  fontSize={template.fontSize}
                  showAccessibilityWarnings={true}
                />
                <ColorPicker
                  label="Secondary Color"
                  value={template.colors.secondary}
                  onChange={(value) => handleColorChange('secondary', value)}
                  showAccessibilityWarnings={false}
                />
                <ColorPicker
                  label="Header Text"
                  value={template.colors.headerText}
                  onChange={(value) => handleColorChange('headerText', value)}
                  contrastAgainst={template.colors.primary}
                  fontSize={template.fontSize}
                  showAccessibilityWarnings={true}
                />
                <ColorPicker
                  label="Body Text"
                  value={template.colors.bodyText}
                  onChange={(value) => handleColorChange('bodyText', value)}
                  contrastAgainst={template.colors.background}
                  fontSize={template.fontSize}
                  showAccessibilityWarnings={true}
                />
                <ColorPicker
                  label="Border Color"
                  value={template.colors.border}
                  onChange={(value) => handleColorChange('border', value)}
                  showAccessibilityWarnings={false}
                />
                <ColorPicker
                  label="Background"
                  value={template.colors.background}
                  onChange={(value) => handleColorChange('background', value)}
                  showAccessibilityWarnings={false}
                />
              </div>
            </section>
          </div>
        )}

        {/* Layout Tab */}
        {activeTab === 'layout' && (
          <div className="tab-panel">
            {/* Layout Style */}
            <section className="customization-section">
              <h3>Layout Style</h3>
              <div className="layout-options">
                {LAYOUT_OPTIONS.map((option) => (
                  <label key={option.value} className="layout-option">
                    <input
                      type="radio"
                      name="layout"
                      value={option.value}
                      checked={template.layout === option.value}
                      onChange={(e) => onChange({ layout: e.target.value as InvoiceTemplateLayout })}
                    />
                    <div className="layout-card">
                      <span className="layout-name">{option.label}</span>
                      <span className="layout-description">{option.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* Typography */}
            <section className="customization-section">
              <h3>Typography</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="font-family">Font Family</label>
                  <select
                    id="font-family"
                    value={template.fontFamily}
                    onChange={(e) => onChange({ fontFamily: e.target.value as FontFamily })}
                  >
                    {FONT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="font-size">Font Size (pt)</label>
                  <input
                    type="number"
                    id="font-size"
                    value={template.fontSize}
                    onChange={(e) => onChange({ fontSize: parseInt(e.target.value, 10) })}
                    min={8}
                    max={16}
                  />
                </div>
              </div>
            </section>

            {/* Display Options */}
            <section className="customization-section">
              <h3>Display Options</h3>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={template.showLineItemBorders}
                    onChange={(e) => onChange({ showLineItemBorders: e.target.checked })}
                  />
                  <span>Show line item borders</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={template.showItemNumbers}
                    onChange={(e) => onChange({ showItemNumbers: e.target.checked })}
                  />
                  <span>Number line items (1, 2, 3...)</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={template.showTaxIdOnInvoice}
                    onChange={(e) => onChange({ showTaxIdOnInvoice: e.target.checked })}
                  />
                  <span>Show company tax ID on invoice</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={template.showPageNumbers}
                    onChange={(e) => onChange({ showPageNumbers: e.target.checked })}
                  />
                  <span>Show page numbers (multi-page invoices)</span>
                </label>
              </div>
            </section>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="tab-panel">
            <section className="customization-section">
              <h3>Custom Messages</h3>

              <div className="form-group">
                <label htmlFor="header-message">
                  Header Message
                  <span className="label-hint">Displayed at the top of the invoice</span>
                </label>
                <textarea
                  id="header-message"
                  value={template.headerMessage || ''}
                  onChange={(e) => onChange({ headerMessage: e.target.value })}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g., Thank you for choosing our services!"
                />
                <div className="char-count">
                  {template.headerMessage?.length || 0} / 500
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="footer-message">
                  Footer Message
                  <span className="label-hint">Displayed at the bottom of the invoice</span>
                </label>
                <textarea
                  id="footer-message"
                  value={template.footerMessage || ''}
                  onChange={(e) => onChange({ footerMessage: e.target.value })}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g., Thank you for your business!"
                />
                <div className="char-count">
                  {template.footerMessage?.length || 0} / 500
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="payment-terms">
                  Payment Terms
                  <span className="label-hint">e.g., Net 30, Due on receipt</span>
                </label>
                <input
                  type="text"
                  id="payment-terms"
                  value={template.paymentTerms || ''}
                  onChange={(e) => onChange({ paymentTerms: e.target.value })}
                  maxLength={200}
                  placeholder="Net 30"
                />
              </div>

              <div className="form-group">
                <label htmlFor="payment-instructions">
                  Payment Instructions
                  <span className="label-hint">
                    How customers can pay (bank details, payment link, etc.)
                  </span>
                </label>
                <textarea
                  id="payment-instructions"
                  value={template.paymentInstructions || ''}
                  onChange={(e) => onChange({ paymentInstructions: e.target.value })}
                  rows={5}
                  maxLength={1000}
                  placeholder="e.g., Please make payment to:\nBank: ABC Bank\nAccount: 12345678\nRouting: 987654321"
                />
                <div className="char-count">
                  {template.paymentInstructions?.length || 0} / 1000
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="customization-actions">
        <button type="button" onClick={onCancel} className="button-secondary" disabled={isSaving}>
          Cancel
        </button>
        <button type="button" onClick={onSave} className="button-primary" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Template'}
        </button>
      </div>

      <style jsx>{`
        .template-customization {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 900px;
          margin: 0 auto;
        }

        .customization-header h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
          color: #111827;
        }

        .subtitle {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .customization-tabs {
          display: flex;
          border-bottom: 2px solid #e5e7eb;
          gap: 4px;
        }

        .tab {
          padding: 12px 24px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          color: #6b7280;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #374151;
        }

        .tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }

        .customization-content {
          min-height: 400px;
        }

        .tab-panel {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .customization-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .customization-section h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .logo-upload {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .logo-preview {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
        }

        .logo-preview img {
          display: block;
        }

        .logo-info {
          flex: 1;
        }

        .logo-info p {
          margin: 0;
          font-size: 14px;
        }

        .logo-dimensions {
          color: #6b7280;
          font-size: 12px;
        }

        .logo-upload-area {
          position: relative;
        }

        .file-input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .upload-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 48px;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          color: #6b7280;
        }

        .upload-label:hover {
          border-color: #9ca3af;
          background-color: #f9fafb;
        }

        .upload-hint {
          font-size: 12px;
          color: #9ca3af;
        }

        .colors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .layout-options {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }

        .layout-option {
          cursor: pointer;
        }

        .layout-option input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .layout-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .layout-option input:checked + .layout-card {
          border-color: #3b82f6;
          background-color: #eff6ff;
        }

        .layout-card:hover {
          border-color: #3b82f6;
        }

        .layout-name {
          font-weight: 600;
          color: #111827;
        }

        .layout-description {
          font-size: 13px;
          color: #6b7280;
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .label-hint {
          font-size: 12px;
          font-weight: 400;
          color: #6b7280;
        }

        .form-group input[type='text'],
        .form-group input[type='number'],
        .form-group select,
        .form-group textarea {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-size: 14px;
          color: #374151;
        }

        .checkbox-label input[type='checkbox'] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .char-count {
          font-size: 12px;
          color: #9ca3af;
          text-align: right;
        }

        .error-message {
          padding: 10px;
          background-color: #fee2e2;
          border-left: 3px solid #ef4444;
          border-radius: 4px;
          color: #991b1b;
          font-size: 14px;
        }

        .customization-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .button-primary,
        .button-secondary,
        .button-remove {
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .button-primary {
          background-color: #3b82f6;
          color: white;
        }

        .button-primary:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .button-primary:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
        }

        .button-secondary {
          background-color: #f3f4f6;
          color: #374151;
        }

        .button-secondary:hover:not(:disabled) {
          background-color: #e5e7eb;
        }

        .button-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .button-remove {
          background-color: #fee2e2;
          color: #991b1b;
        }

        .button-remove:hover:not(:disabled) {
          background-color: #fecaca;
        }
      `}</style>
    </div>
  );
};

export default TemplateCustomization;
