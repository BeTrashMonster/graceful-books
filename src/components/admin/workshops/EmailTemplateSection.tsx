/**
 * Email Template Section Component
 *
 * Wrapper component for email template customization in workshop form.
 * Manages tabs, toggles, and layout between editor and preview panel.
 *
 * Features:
 * - Tab navigation for 7 email types
 * - "Use Default" vs "Customize" radio button toggle
 * - Two-column layout (editor + preview) when customizing
 * - Read-only preview when using defaults
 * - WCAG 2.1 AA compliant
 */

import { EmailTemplateEditor } from './EmailTemplateEditor';
import { EmailPreviewPanel } from './EmailPreviewPanel';
import {
  EmailType,
  EmailTemplate,
  EmailTemplates,
  EMAIL_TYPE_LABELS,
  ALL_EMAIL_TYPES,
} from '../../../utils/emailTemplates';
import styles from './EmailTemplateSection.module.css';

interface EmailTemplateSectionProps {
  workshopId?: string;
  workshopName: string;
  selectedEmailType: EmailType;
  onSelectEmailType: (type: EmailType) => void;
  customizedEmails: EmailType[];
  emailTemplateContent: EmailTemplates;
  onToggleCustomization: (emailType: EmailType) => void;
  onUpdateTemplate: (emailType: EmailType, template: EmailTemplate) => void;
}

const emailTypesForTabs = [
  { key: 'welcome' as EmailType, label: 'Welcome' },
  { key: 'reminder' as EmailType, label: 'Reminder' },
  { key: 'week1' as EmailType, label: 'Week 1' },
  { key: 'week2' as EmailType, label: 'Week 2' },
  { key: 'week3' as EmailType, label: 'Week 3' },
  { key: 'week4' as EmailType, label: 'Week 4' },
  { key: 'wrapUp' as EmailType, label: 'Wrap-Up' },
];

export default function EmailTemplateSection(props: EmailTemplateSectionProps) {
  const isCustomized = props.customizedEmails.includes(props.selectedEmailType);

  const handleRadioChange = (customize: boolean) => {
    // Only toggle if changing state
    if (customize !== isCustomized) {
      props.onToggleCustomization(props.selectedEmailType);
    }
  };

  return (
    <div className={styles.emailTemplateContainer}>
      {/* Tab navigation for email types */}
      <nav role="tablist" aria-label="Email template types" className={styles.emailTemplateTabs}>
        {emailTypesForTabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={props.selectedEmailType === key}
            aria-controls={`email-panel-${key}`}
            id={`email-tab-${key}`}
            className={`${styles.emailTab} ${props.selectedEmailType === key ? styles.emailTabActive : ''}`}
            onClick={() => props.onSelectEmailType(key)}
            tabIndex={props.selectedEmailType === key ? 0 : -1}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tab panel content */}
      <div
        role="tabpanel"
        id={`email-panel-${props.selectedEmailType}`}
        aria-labelledby={`email-tab-${props.selectedEmailType}`}
      >
        {/* Radio button toggle for "Use Default" vs "Customize" */}
        <fieldset className={styles.templateChoice}>
          <legend className={styles.visuallyHidden}>
            Email template customization option for {EMAIL_TYPE_LABELS[props.selectedEmailType]}
          </legend>

          <div className={styles.radioGroup}>
            <label
              className={`${styles.radioLabel} ${!isCustomized ? styles.radioLabelActive : ''}`}
            >
              <input
                type="radio"
                name={`email-template-${props.selectedEmailType}`}
                value="default"
                checked={!isCustomized}
                onChange={() => handleRadioChange(false)}
                className={styles.radio}
              />
              <span className={styles.radioContent}>
                <strong className={styles.radioTitle}>Use Default Template</strong>
                <p className={styles.optionDescription}>
                  Standard email with our recommended messaging
                </p>
              </span>
            </label>

            <label
              className={`${styles.radioLabel} ${isCustomized ? styles.radioLabelActive : ''}`}
            >
              <input
                type="radio"
                name={`email-template-${props.selectedEmailType}`}
                value="custom"
                checked={isCustomized}
                onChange={() => handleRadioChange(true)}
                className={styles.radio}
              />
              <span className={styles.radioContent}>
                <strong className={styles.radioTitle}>Customize Template</strong>
                <p className={styles.optionDescription}>
                  Edit subject, content, and formatting for this email
                </p>
              </span>
            </label>
          </div>
        </fieldset>

        {/* Editor + Preview Layout (conditional based on customization choice) */}
        {isCustomized ? (
          <div className={styles.editorPreviewLayout}>
            {/* Left column: Editor */}
            <div className={styles.editorColumn}>
              <EmailTemplateEditor
                templates={props.emailTemplateContent}
                selectedEmailType={props.selectedEmailType}
                onChange={(updatedTemplates) => {
                  const template = updatedTemplates[props.selectedEmailType];
                  if (template) {
                    props.onUpdateTemplate(props.selectedEmailType, template);
                  }
                }}
              />
            </div>

            {/* Right column: Preview */}
            <div className={styles.previewColumn}>
              <EmailPreviewPanel
                workshopId={props.workshopId || 'new'}
                templates={props.emailTemplateContent}
                workshopName={props.workshopName || 'Workshop'}
                selectedEmailType={props.selectedEmailType}
                readOnly={false}
              />
            </div>
          </div>
        ) : (
          <div className={styles.defaultPreview}>
            <EmailPreviewPanel
              workshopId={props.workshopId || 'new'}
              templates={{}}
              workshopName={props.workshopName || 'Workshop'}
              selectedEmailType={props.selectedEmailType}
              readOnly={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
