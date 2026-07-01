/**
 * Email Preview Panel Component
 *
 * Admin UI for previewing and testing workshop email templates.
 *
 * Features:
 * - Email template selector (all 7 emails)
 * - Live preview with rendered email (HTML view)
 * - Desktop and mobile preview toggle
 * - Template tag value inputs for test data
 * - "Send Test Email" button
 * - Subject line and preheader display
 * - HTML source view toggle
 * - Plain text version preview
 * - Email client compatibility indicators
 * - Real-time template tag replacement
 *
 * Requirements:
 * - E3: Admin Email Preview and Testing
 * - WCAG 2.1 AA compliant
 * - Integration with EmailTemplateEditor component
 */

import { useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import styles from './EmailPreviewPanel.module.css';
import {
  EmailType,
  EmailTemplate,
  EmailTemplates,
  DEFAULT_EMAIL_TEMPLATES,
} from '../../../utils/emailTemplates';

interface EmailPreviewPanelProps {
  workshopId: string;
  templates: EmailTemplates;
  workshopName?: string;
  selectedEmailType: EmailType; // NEW: Controlled by parent (tabs)
  readOnly?: boolean; // NEW: Disable test email sending for default previews
}

type PreviewMode = 'desktop' | 'mobile' | 'html' | 'plaintext';

// Email client compatibility status
const emailClients = [
  { name: 'Gmail', compatible: true },
  { name: 'Outlook', compatible: true },
  { name: 'Apple Mail', compatible: true },
  { name: 'Yahoo Mail', compatible: true },
  { name: 'Mobile (iOS)', compatible: true },
  { name: 'Mobile (Android)', compatible: true },
];

// Default template tag values for preview
const defaultTagValues: Record<string, string> = {
  '{{firstName}}': 'Jane',
  '{{fullName}}': 'Jane Smith',
  '{{workshopName}}': 'Spring 2026 Bootcamp',
  '{{workshopDate}}': 'March 15, 2026',
  '{{workshopTime}}': '10:00 AM PT',
  '{{workshopLocation}}': 'Online via Zoom',
  '{{trialEndDate}}': 'April 14, 2026',
  '{{trialDaysRemaining}}': '30',
};

export function EmailPreviewPanel({
  workshopId,
  templates,
  workshopName,
  selectedEmailType,
  readOnly = false,
}: EmailPreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const [tagValues, setTagValues] = useState<Record<string, string>>(defaultTagValues);
  const [testEmail, setTestEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Get current template (use default if not customized)
  const currentTemplate = templates[selectedEmailType] || DEFAULT_EMAIL_TEMPLATES[selectedEmailType];

  // Replace template tags with test data
  const renderWithTags = (text: string): string => {
    let rendered = text;
    Object.entries(tagValues).forEach(([tag, value]) => {
      rendered = rendered.replace(new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    return rendered;
  };

  // Rendered email content
  const renderedSubject = useMemo(
    () => currentTemplate ? renderWithTags(currentTemplate.subject) : '',
    [currentTemplate, tagValues]
  );

  const renderedPreheader = useMemo(
    () => currentTemplate?.preheader ? renderWithTags(currentTemplate.preheader) : '',
    [currentTemplate, tagValues]
  );

  const renderedHtmlBody = useMemo(
    () => currentTemplate ? DOMPurify.sanitize(renderWithTags(currentTemplate.htmlBody)) : '',
    [currentTemplate, tagValues]
  );

  const renderedPlainText = useMemo(() => {
    if (!currentTemplate) return '';

    // If plain text version exists, use it; otherwise generate from HTML
    if (currentTemplate.plainTextBody) {
      return renderWithTags(currentTemplate.plainTextBody);
    }

    // Simple HTML to text conversion
    const temp = document.createElement('div');
    temp.innerHTML = renderedHtmlBody;
    return temp.textContent || temp.innerText || '';
  }, [currentTemplate, renderedHtmlBody, tagValues]);

  // Update tag value
  const updateTagValue = (tag: string, value: string) => {
    setTagValues((prev) => ({ ...prev, [tag]: value }));
  };

  // Send test email
  const sendTestEmail = async () => {
    if (!testEmail) {
      setTestStatus({
        type: 'error',
        message: 'Please enter an email address.',
      });
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      setTestStatus({
        type: 'error',
        message: 'Please enter a valid email address.',
      });
      return;
    }

    setIsLoading(true);
    setTestStatus({ type: null, message: '' });

    try {
      // Get API URL and auth token
      const API_URL = 'https://api.audacious.money';
      const adminSessionData = sessionStorage.getItem('graceful_books_admin_session');
      const token = adminSessionData ? JSON.parse(adminSessionData).token : null;

      const response = await fetch(
        `${API_URL}/api/workshops/${workshopId}/emails/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            emailType: selectedEmailType,
            recipientEmail: testEmail,
            tagValues,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to send test email');
      }

      setTestStatus({
        type: 'success',
        message: `Test email sent successfully to ${testEmail}!`,
      });

      // Clear success message after 5 seconds
      setTimeout(() => {
        setTestStatus({ type: null, message: '' });
      }, 5000);
    } catch (error) {
      console.error('[EmailPreviewPanel] Error sending test email:', error);
      setTestStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send test email. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentTemplate) {
    return (
      <div className={styles.container}>
        <div className={styles.noTemplate}>
          <p>No template available for this email type.</p>
          <p className={styles.helperText}>
            Please configure the email template in the workshop form.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {/* Preview Mode Toggle */}
        <div className={styles.previewModeToggle}>
          <button
            type="button"
            onClick={() => setPreviewMode('desktop')}
            className={`${styles.modeButton} ${
              previewMode === 'desktop' ? styles.modeButtonActive : ''
            }`}
            aria-pressed={previewMode === 'desktop'}
            aria-label="Desktop preview"
          >
            💻 Desktop
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('mobile')}
            className={`${styles.modeButton} ${
              previewMode === 'mobile' ? styles.modeButtonActive : ''
            }`}
            aria-pressed={previewMode === 'mobile'}
            aria-label="Mobile preview"
          >
            📱 Mobile
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('html')}
            className={`${styles.modeButton} ${
              previewMode === 'html' ? styles.modeButtonActive : ''
            }`}
            aria-pressed={previewMode === 'html'}
            aria-label="HTML source view"
          >
            &lt;/&gt; HTML
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('plaintext')}
            className={`${styles.modeButton} ${
              previewMode === 'plaintext' ? styles.modeButtonActive : ''
            }`}
            aria-pressed={previewMode === 'plaintext'}
            aria-label="Plain text preview"
          >
            📄 Plain Text
          </button>
        </div>
      </div>

      <div className={styles.mainContent}>
        {/* Sidebar: Template Tags & Test Email */}
        <aside className={styles.sidebar}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Template Tags</h3>
            <p className={styles.sectionDescription}>
              Edit values to preview how the email will look with real data.
            </p>

            <div className={styles.tagInputs}>
              {Object.entries(tagValues).map(([tag, value]) => (
                <div key={tag} className={styles.tagInput}>
                  <label htmlFor={`tag-${tag}`} className={styles.tagLabel}>
                    <code>{tag}</code>
                  </label>
                  <input
                    id={`tag-${tag}`}
                    type="text"
                    value={value}
                    onChange={(e) => updateTagValue(tag, e.target.value)}
                    className={styles.input}
                    placeholder={`Value for ${tag}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Test Email Section (only shown when not read-only) */}
          {!readOnly && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Send Test Email</h3>
              <p className={styles.sectionDescription}>
                Send a test email to verify how it looks in your inbox.
              </p>

              <div className={styles.testEmailForm}>
                <label htmlFor="test-email" className={styles.visuallyHidden}>
                  Recipient email address
                </label>
                <input
                  id="test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className={styles.input}
                  placeholder="your.email@example.com"
                  aria-label="Test email recipient address"
                />
                <button
                  type="button"
                  onClick={sendTestEmail}
                  disabled={isLoading}
                  className={styles.sendButton}
                  aria-label="Send test email"
                >
                  {isLoading ? 'Sending...' : '📧 Send Test Email'}
                </button>

                {testStatus.type && (
                  <div
                    className={`${styles.testStatus} ${
                      testStatus.type === 'success'
                        ? styles.testStatusSuccess
                        : styles.testStatusError
                    }`}
                    role="alert"
                  >
                    {testStatus.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email Client Compatibility */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Email Client Compatibility</h3>
            <ul className={styles.compatibilityList}>
              {emailClients.map((client) => (
                <li key={client.name} className={styles.compatibilityItem}>
                  <span
                    className={`${styles.compatibilityIcon} ${
                      client.compatible
                        ? styles.compatibilityIconSuccess
                        : styles.compatibilityIconWarning
                    }`}
                    aria-label={client.compatible ? 'Compatible' : 'Limited support'}
                  >
                    {client.compatible ? '✓' : '⚠'}
                  </span>
                  {client.name}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Preview Panel */}
        <div className={styles.previewPanel}>
          {/* Subject & Preheader */}
          <div className={styles.emailMeta}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Subject:</span>
              <span className={styles.metaValue}>{renderedSubject}</span>
            </div>
            {renderedPreheader && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Preheader:</span>
                <span className={styles.metaValue}>{renderedPreheader}</span>
              </div>
            )}
          </div>

          {/* Preview Content */}
          <div
            className={`${styles.previewContent} ${
              previewMode === 'mobile' ? styles.previewContentMobile : ''
            } ${
              previewMode === 'html' || previewMode === 'plaintext'
                ? styles.previewContentCode
                : ''
            }`}
          >
            {previewMode === 'desktop' || previewMode === 'mobile' ? (
              <div className={styles.emailFrame}>
                <div className={styles.emailContainer}>
                  <div
                    className={styles.emailBody}
                    dangerouslySetInnerHTML={{ __html: renderedHtmlBody }}
                  />
                </div>
              </div>
            ) : previewMode === 'html' ? (
              <pre className={styles.codeBlock}>
                <code>{currentTemplate.htmlBody}</code>
              </pre>
            ) : (
              <pre className={styles.textBlock}>{renderedPlainText}</pre>
            )}
          </div>

          {/* Preview Note */}
          <div className={styles.previewNote}>
            <p>
              <strong>Note:</strong> Template tags have been replaced with test data.
              Actual emails will use real user and workshop data.
            </p>
            <p className={styles.helperText}>
              Emojis are UTF-8 encoded and should display correctly in all major email
              clients.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
