/**
 * Email Preview Panel Component
 *
 * Clean preview of email templates with sample data substituted.
 * Shows desktop and mobile views.
 *
 * Features:
 * - Desktop/mobile preview toggle
 * - Template tag substitution with sample data
 * - Clean, distraction-free preview
 */

import { useState } from 'react';
import styles from './EmailPreviewPanel.module.css';
import {
  EmailType,
  EmailTemplates,
  DEFAULT_EMAIL_TEMPLATES,
} from '../../../utils/emailTemplates';

interface EmailPreviewPanelProps {
  workshopId: string;
  templates: EmailTemplates;
  workshopName: string;
  selectedEmailType: EmailType;
  readOnly: boolean;
}

// Sample data for template tag substitution
const sampleData: Record<string, string> = {
  '{{firstName}}': 'Sarah',
  '{{fullName}}': 'Sarah Johnson',
  '{{workshopName}}': 'Financial Wellness Workshop',
  '{{workshopDate}}': 'Saturday, March 15, 2025',
  '{{workshopTime}}': '2:00 PM PT',
  '{{workshopLocation}}': 'Online via Zoom',
  '{{loginLink}}': 'https://audacious.money/login',
};

export function EmailPreviewPanel({
  workshopId,
  templates,
  workshopName,
  selectedEmailType,
  readOnly,
}: EmailPreviewPanelProps) {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Get current template (use default if not customized)
  const currentTemplate = templates[selectedEmailType] || DEFAULT_EMAIL_TEMPLATES[selectedEmailType];

  // Replace template tags with sample data
  const substituteTags = (text: string): string => {
    let result = text;
    // Update workshopName in sample data
    const data = { ...sampleData, '{{workshopName}}': workshopName };
    Object.entries(data).forEach(([tag, value]) => {
      result = result.replace(new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    return result;
  };

  const previewSubject = substituteTags(currentTemplate.subject);
  const previewPreheader = currentTemplate.preheader ? substituteTags(currentTemplate.preheader) : '';
  const previewBody = substituteTags(currentTemplate.htmlBody);

  return (
    <div className={styles.preview}>
      <div className={styles.previewHeader}>
        <h3 className={styles.previewTitle}>Preview</h3>
        <div className={styles.previewToggle}>
          <button
            type="button"
            onClick={() => setPreviewMode('desktop')}
            className={`${styles.previewButton} ${
              previewMode === 'desktop' ? styles.previewButtonActive : ''
            }`}
            aria-pressed={previewMode === 'desktop'}
          >
            💻 Desktop
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('mobile')}
            className={`${styles.previewButton} ${
              previewMode === 'mobile' ? styles.previewButtonActive : ''
            }`}
            aria-pressed={previewMode === 'mobile'}
          >
            📱 Mobile
          </button>
        </div>
      </div>

      <div
        className={`${styles.previewFrame} ${
          previewMode === 'mobile' ? styles.previewFrameMobile : ''
        }`}
      >
        <div className={styles.emailPreview}>
          <div className={styles.emailSubject}>{previewSubject}</div>
          {previewPreheader && (
            <div className={styles.emailPreheader}>{previewPreheader}</div>
          )}
          <div
            className={styles.emailBody}
            dangerouslySetInnerHTML={{ __html: previewBody }}
          />
        </div>
      </div>

      <p className={styles.previewNote}>
        Preview shows sample data. Actual emails will use real participant information.
      </p>
    </div>
  );
}
