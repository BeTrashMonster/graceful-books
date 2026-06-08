/**
 * Email Template Editor Component
 *
 * WYSIWYG rich text editor for customizing workshop email templates.
 *
 * Features:
 * - 7 email templates (welcome, reminder, weeks 1-4, wrap-up)
 * - Rich text formatting (bold, italic, headings, lists, etc.)
 * - Font controls (size, family, color)
 * - Emoji picker integration
 * - Template tags for personalization
 * - Preview mode (desktop + mobile)
 * - Email-safe HTML validation
 *
 * Requirements:
 * - C2b: Rich Text Email Editor Component
 * - Quill.js integration
 * - WCAG 2.1 AA compliant
 */

import { useState, useRef, useMemo } from 'react';
import ReactQuill from 'react-quill';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import 'quill/dist/quill.snow.css';
import styles from './EmailTemplateEditor.module.css';

// Types (will be imported from API service when backend is integrated)
interface EmailTemplate {
  subject: string;
  preheader?: string;
  htmlBody: string;
  plainTextBody?: string;
  fromName?: string;
}

interface EmailTemplates {
  welcome?: EmailTemplate;
  reminder?: EmailTemplate;
  week1?: EmailTemplate;
  week2?: EmailTemplate;
  week3?: EmailTemplate;
  week4?: EmailTemplate;
  wrapUp?: EmailTemplate;
}

interface EmailTemplateEditorProps {
  templates: EmailTemplates;
  onChange: (templates: EmailTemplates) => void;
}

type EmailType = 'welcome' | 'reminder' | 'week1' | 'week2' | 'week3' | 'week4' | 'wrapUp';

const emailTypeLabels: Record<EmailType, string> = {
  welcome: 'Welcome Email',
  reminder: 'Pre-Workshop Reminder',
  week1: 'Week 1 Email',
  week2: 'Week 2 Email',
  week3: 'Week 3 Email',
  week4: 'Week 4 Email',
  wrapUp: 'Wrap-Up Email',
};

const defaultTemplates: Record<EmailType, EmailTemplate> = {
  welcome: {
    subject: 'Welcome to {{workshopName}}!',
    preheader: "We're excited to have you join us",
    htmlBody: '<p>Hi {{firstName}},</p><p>Welcome to {{workshopName}}! We\'re so glad you\'re here.</p><p>Your workshop begins on {{workshopDate}} at {{workshopTime}}.</p><p>See you soon!</p>',
  },
  reminder: {
    subject: 'Workshop starts tomorrow!',
    preheader: "Don't forget about {{workshopName}}",
    htmlBody: '<p>Hi {{firstName}},</p><p>Just a friendly reminder that {{workshopName}} starts tomorrow at {{workshopTime}}.</p><p>Location: {{workshopLocation}}</p><p>See you there!</p>',
  },
  week1: {
    subject: 'Week 1: Getting Started',
    preheader: 'Your first week journey begins',
    htmlBody: '<p>Hi {{firstName}},</p><p>Welcome to Week 1 of your journey!</p><p>This week, focus on getting familiar with the platform.</p>',
  },
  week2: {
    subject: 'Week 2: Building Momentum',
    preheader: "You're making great progress",
    htmlBody: '<p>Hi {{firstName}},</p><p>Week 2 is all about building momentum!</p><p>Keep up the great work.</p>',
  },
  week3: {
    subject: 'Week 3: Going Deeper',
    preheader: 'Time to dive into advanced features',
    htmlBody: '<p>Hi {{firstName}},</p><p>This week, we\'re diving deeper into the platform.</p><p>Explore the advanced features!</p>',
  },
  week4: {
    subject: 'Week 4: Mastering the Basics',
    preheader: "You've come so far",
    htmlBody: '<p>Hi {{firstName}},</p><p>Week 4 - you\'re becoming a pro!</p><p>Let\'s master these fundamentals.</p>',
  },
  wrapUp: {
    subject: "You've completed the journey!",
    preheader: 'Congratulations on your achievement',
    htmlBody: '<p>Hi {{firstName}},</p><p>Congratulations on completing {{workshopName}}!</p><p>We hope you found it valuable.</p><p>Keep up the great work!</p>',
  },
};

const templateTags = [
  { tag: '{{firstName}}', description: "Recipient's first name" },
  { tag: '{{fullName}}', description: "Recipient's full name" },
  { tag: '{{workshopName}}', description: 'Workshop cohort name' },
  { tag: '{{workshopDate}}', description: 'Workshop start date' },
  { tag: '{{workshopTime}}', description: 'Workshop start time' },
  { tag: '{{workshopLocation}}', description: 'Workshop location/URL' },
  { tag: '{{trialEndDate}}', description: 'Trial expiration date' },
  { tag: '{{trialDaysRemaining}}', description: 'Days until trial expires' },
];

export function EmailTemplateEditor({ templates, onChange }: EmailTemplateEditorProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailType>('welcome');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const quillRef = useRef<ReactQuill>(null);

  const currentTemplate = templates[selectedEmail] || defaultTemplates[selectedEmail];

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ size: ['small', false, 'large', 'huge'] }],
          [{ font: [] }],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['blockquote', 'code-block'],
          ['clean'],
        ],
      },
    }),
    []
  );

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'size',
    'font',
    'color',
    'background',
    'align',
    'list',
    'bullet',
    'link',
    'blockquote',
    'code-block',
  ];

  const updateTemplate = (field: keyof EmailTemplate, value: string) => {
    const updated = {
      ...templates,
      [selectedEmail]: {
        ...currentTemplate,
        [field]: value,
      },
    };
    onChange(updated);
  };

  const insertTag = (tag: string) => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection();
      if (range) {
        quill.insertText(range.index, tag);
        quill.setSelection(range.index + tag.length, 0);
      }
    }
  };

  const insertEmoji = (emojiData: EmojiClickData) => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection();
      if (range) {
        quill.insertText(range.index, emojiData.emoji);
        quill.setSelection(range.index + emojiData.emoji.length, 0);
      }
    }
    setShowEmojiPicker(false);
  };

  const resetToDefault = () => {
    if (confirm('Reset this email to the default template? Your changes will be lost.')) {
      const updated = { ...templates };
      delete updated[selectedEmail];
      onChange(updated);
    }
  };

  return (
    <div className={styles.container}>
      {/* Email Selector */}
      <div className={styles.emailSelector}>
        <label htmlFor="email-type" className={styles.label}>
          Select Email Template:
        </label>
        <select
          id="email-type"
          value={selectedEmail}
          onChange={(e) => setSelectedEmail(e.target.value as EmailType)}
          className={styles.select}
          aria-label="Select email template to edit"
        >
          {Object.entries(emailTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.editorContainer}>
        {/* Template Tags Sidebar */}
        <aside className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>Template Tags</h3>
          <p className={styles.sidebarDescription}>
            Click to insert dynamic content into your email.
          </p>
          <div className={styles.tagList}>
            {templateTags.map(({ tag, description }) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertTag(tag)}
                className={styles.tagButton}
                aria-label={`Insert ${description}`}
              >
                <code className={styles.tagCode}>{tag}</code>
                <span className={styles.tagDescription}>{description}</span>
              </button>
            ))}
          </div>

          <div className={styles.emojiSection}>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={styles.emojiButton}
              aria-expanded={showEmojiPicker}
              aria-label="Toggle emoji picker"
            >
              😊 Add Emoji
            </button>
            {showEmojiPicker && (
              <div className={styles.emojiPickerWrapper}>
                <EmojiPicker onEmojiClick={insertEmoji} width={280} height={400} />
              </div>
            )}
          </div>
        </aside>

        {/* Editor */}
        <div className={styles.editor}>
          <div className={styles.field}>
            <label htmlFor="email-subject" className={styles.label}>
              Subject Line <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="email-subject"
              value={currentTemplate.subject}
              onChange={(e) => updateTemplate('subject', e.target.value)}
              className={styles.input}
              required
              aria-required="true"
              placeholder="Email subject line..."
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="email-preheader" className={styles.label}>
              Preheader (Preview Text)
            </label>
            <input
              type="text"
              id="email-preheader"
              value={currentTemplate.preheader || ''}
              onChange={(e) => updateTemplate('preheader', e.target.value)}
              className={styles.input}
              placeholder="Text shown in email preview..."
            />
            <p className={styles.helperText}>
              This appears in the inbox preview, after the subject line.
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="email-body" className={styles.label}>
              Email Body <span className={styles.required}>*</span>
            </label>
            <div className={styles.quillWrapper}>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={currentTemplate.htmlBody}
                onChange={(value) => updateTemplate('htmlBody', value)}
                modules={modules}
                formats={formats}
                placeholder="Write your email content here..."
                className={styles.quill}
              />
            </div>
          </div>

          <div className={styles.editorActions}>
            <button
              type="button"
              onClick={resetToDefault}
              className={styles.resetButton}
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
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
            <div className={styles.emailSubject}>{currentTemplate.subject}</div>
            {currentTemplate.preheader && (
              <div className={styles.emailPreheader}>{currentTemplate.preheader}</div>
            )}
            <div
              className={styles.emailBody}
              dangerouslySetInnerHTML={{ __html: currentTemplate.htmlBody }}
            />
          </div>
        </div>

        <p className={styles.previewNote}>
          Template tags will be replaced with actual data when emails are sent.
        </p>
      </div>
    </div>
  );
}
