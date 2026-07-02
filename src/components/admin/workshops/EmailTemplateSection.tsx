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

export interface EmailScheduleConfig {
  enabled: boolean;
  when: 'immediate' | { hours_before: number } | { days_after_workshop: number };
}

export interface EmailSchedule {
  welcome: EmailScheduleConfig;
  reminder: EmailScheduleConfig;
  week1: EmailScheduleConfig;
  week2: EmailScheduleConfig;
  week3: EmailScheduleConfig;
  week4: EmailScheduleConfig;
  wrapUp: EmailScheduleConfig;
}

interface EmailTemplateSectionProps {
  workshopId?: string;
  workshopName: string;
  selectedEmailType: EmailType;
  onSelectEmailType: (type: EmailType) => void;
  customizedEmails: EmailType[];
  emailTemplateContent: EmailTemplates;
  emailSchedule: EmailSchedule;
  onToggleCustomization: (emailType: EmailType) => void;
  onUpdateTemplate: (emailType: EmailType, template: EmailTemplate) => void;
  onUpdateSchedule: (emailType: EmailType, config: EmailScheduleConfig) => void;
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
  const currentSchedule = props.emailSchedule[props.selectedEmailType];

  const handleRadioChange = (customize: boolean) => {
    // Only toggle if changing state
    if (customize !== isCustomized) {
      props.onToggleCustomization(props.selectedEmailType);
    }
  };

  const handleToggleEnabled = (enabled: boolean) => {
    props.onUpdateSchedule(props.selectedEmailType, {
      ...currentSchedule,
      enabled,
    });
  };

  const handleUpdateTiming = (when: EmailScheduleConfig['when']) => {
    props.onUpdateSchedule(props.selectedEmailType, {
      ...currentSchedule,
      when,
    });
  };

  // Get timing description for UI
  const getTimingDescription = (emailType: EmailType, when: EmailScheduleConfig['when']): string => {
    if (when === 'immediate') return 'Sent immediately on enrollment';
    if (typeof when === 'object' && 'hours_before' in when) {
      return `Sent ${when.hours_before} hours before workshop`;
    }
    if (typeof when === 'object' && 'days_after_workshop' in when) {
      return `Sent ${when.days_after_workshop} days after workshop`;
    }
    return 'Custom timing';
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
        {/* Email Schedule Configuration */}
        <div className={styles.scheduleSection}>
          <div className={styles.scheduleHeader}>
            <label className={styles.enabledToggle}>
              <input
                type="checkbox"
                checked={currentSchedule.enabled}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.enabledLabel}>
                <strong>Send this email</strong>
                <span className={styles.enabledDescription}>
                  {currentSchedule.enabled ? 'Email will be sent automatically' : 'Email is disabled'}
                </span>
              </span>
            </label>
          </div>

          {currentSchedule.enabled && (
            <div className={styles.timingControls}>
              <label className={styles.timingLabel}>When to send:</label>

              {props.selectedEmailType === 'welcome' && (
                <div className={styles.timingInfo}>
                  <span className={styles.timingBadge}>📧 Immediate</span>
                  <span className={styles.timingDescription}>Sent immediately when user enrolls</span>
                </div>
              )}

              {props.selectedEmailType === 'reminder' && (
                <div className={styles.timingInput}>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={typeof currentSchedule.when === 'object' && 'hours_before' in currentSchedule.when ? currentSchedule.when.hours_before : 24}
                    onChange={(e) => handleUpdateTiming({ hours_before: parseInt(e.target.value) || 24 })}
                    className={styles.numberInput}
                  />
                  <span className={styles.timingUnit}>hours before workshop starts</span>
                </div>
              )}

              {['week1', 'week2', 'week3', 'week4', 'wrapUp'].includes(props.selectedEmailType) && (
                <div className={styles.timingInput}>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={typeof currentSchedule.when === 'object' && 'days_after_workshop' in currentSchedule.when ? currentSchedule.when.days_after_workshop : 7}
                    onChange={(e) => handleUpdateTiming({ days_after_workshop: parseInt(e.target.value) || 7 })}
                    className={styles.numberInput}
                  />
                  <span className={styles.timingUnit}>days after workshop ends</span>
                </div>
              )}
            </div>
          )}
        </div>

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
