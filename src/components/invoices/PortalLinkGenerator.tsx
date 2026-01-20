/**
 * Portal Link Generator Component
 *
 * Allows business users to generate secure portal links for customers.
 * Features:
 * - One-click link generation
 * - Copy to clipboard functionality
 * - Email sending (future)
 * - Token management
 *
 * Requirements:
 * - H4: Client Portal
 * - WCAG 2.1 AA compliance
 */

import { useState } from 'react';
import { Button } from '../core/Button';
import { createPortalToken, generatePortalUrl } from '../../services/portalService';
import type { PortalToken } from '../../db/schema/portalTokens.schema';
import type { Invoice } from '../../db/schema/invoices.schema';
import styles from './PortalLinkGenerator.module.css';

export interface PortalLinkGeneratorProps {
  invoice: Invoice;
  companyId: string;
  customerEmail: string;
  onLinkGenerated?: (token: PortalToken) => void;
}

/**
 * Portal Link Generator Component
 */
export const PortalLinkGenerator: React.FC<PortalLinkGeneratorProps> = ({
  invoice,
  companyId,
  customerEmail,
  onLinkGenerated,
}) => {
  const [loading, setLoading] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate portal link
  const handleGenerateLink = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      // Create portal token
      const result = await createPortalToken(companyId, invoice.id, customerEmail);

      if (!result.success) {
        setError(result.error?.message || 'Failed to generate portal link');
        setLoading(false);
        return;
      }

      // Generate URL
      const url = generatePortalUrl(result.data.token);
      setPortalUrl(url);

      // Callback
      if (onLinkGenerated) {
        onLinkGenerated(result.data);
      }

      setLoading(false);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    if (!portalUrl) return;

    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);

      // Reset copied state after 3 seconds
      setTimeout(() => {
        setCopied(false);
      }, 3000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(timestamp));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Customer Portal Link</h3>
        <p className={styles.description}>
          Generate a secure link for your customer to view and pay this invoice online.
          Links expire after 90 days.
        </p>
      </div>

      {!portalUrl && !error && (
        <div className={styles.generateSection}>
          <Button
            variant="primary"
            onClick={handleGenerateLink}
            loading={loading}
            disabled={loading}
            fullWidth
            aria-label="Generate portal link"
          >
            {loading ? 'Generating Link...' : 'Generate Portal Link'}
          </Button>
        </div>
      )}

      {error && (
        <div className={styles.errorMessage} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">⚠️</span>
          <p className={styles.errorText}>{error}</p>
          <Button
            variant="secondary"
            onClick={handleGenerateLink}
            size="sm"
            className={styles.retryButton}
          >
            Try Again
          </Button>
        </div>
      )}

      {portalUrl && (
        <div className={styles.linkSection} role="region" aria-labelledby="portal-link-heading">
          <h4 id="portal-link-heading" className={styles.linkHeading}>
            Portal Link Generated
          </h4>

          <div className={styles.linkBox}>
            <input
              type="text"
              value={portalUrl}
              readOnly
              className={styles.linkInput}
              aria-label="Portal link URL"
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="outline"
              onClick={handleCopyToClipboard}
              className={styles.copyButton}
              aria-label={copied ? 'Link copied' : 'Copy link to clipboard'}
            >
              {copied ? (
                <>
                  <span aria-hidden="true">✓</span> Copied
                </>
              ) : (
                <>
                  <span aria-hidden="true">📋</span> Copy
                </>
              )}
            </Button>
          </div>

          {copied && (
            <div className={styles.copiedMessage} role="status" aria-live="polite">
              Link copied to clipboard!
            </div>
          )}

          <div className={styles.linkInfo}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Sent to:</span>
              <span className={styles.infoValue}>{customerEmail}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Expires:</span>
              <span className={styles.infoValue}>
                {formatDate(Date.now() + 90 * 24 * 60 * 60 * 1000)}
              </span>
            </div>
          </div>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={handleGenerateLink}
              size="sm"
              aria-label="Generate new link"
            >
              Generate New Link
            </Button>
          </div>

          <div className={styles.securityNotice}>
            <span className={styles.securityIcon} aria-hidden="true">🔒</span>
            <p className={styles.securityText}>
              This link is secure and can only be used to view this specific invoice.
              The link will expire in 90 days.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
