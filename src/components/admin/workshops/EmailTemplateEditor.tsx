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
import {
  EmailType,
  EmailTemplate,
  EmailTemplates,
  DEFAULT_EMAIL_TEMPLATES,
  TEMPLATE_TAGS,
} from '../../../utils/emailTemplates';

interface EmailTemplateEditorProps {
  templates: EmailTemplates;
  selectedEmailType: EmailType; // NEW: Controlled by parent (tabs)
  onChange: (templates: EmailTemplates) => void;
}

export function EmailTemplateEditor({ templates, selectedEmailType, onChange }: EmailTemplateEditorProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const quillRef = useRef<ReactQuill>(null);

  const currentTemplate = templates[selectedEmailType] || DEFAULT_EMAIL_TEMPLATES[selectedEmailType];

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

  const handleTemplateTagSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tag = e.target.value;
    if (tag) {
      insertTag(tag);
      e.target.value = ''; // Reset dropdown
    }
  };

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
      [selectedEmailType]: {
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
      delete updated[selectedEmailType];
      onChange(updated);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.editorContainer}>
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

              {/* Custom toolbar controls */}
              <div className={styles.customToolbar}>
                <div className={styles.toolbarGroup}>
                  <label htmlFor="template-tags-select" className={styles.toolbarLabel}>
                    Insert Template Tag:
                  </label>
                  <select
                    id="template-tags-select"
                    onChange={handleTemplateTagSelect}
                    className={styles.templateTagSelect}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select a tag...
                    </option>
                    {TEMPLATE_TAGS.map(({ tag, description }) => (
                      <option key={tag} value={tag}>
                        {tag} - {description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.toolbarGroup}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={styles.emojiButton}
                    aria-label="Add emoji"
                  >
                    😊 Add Emoji
                  </button>
                  {showEmojiPicker && (
                    <div className={styles.emojiPickerWrapper}>
                      <EmojiPicker onEmojiClick={insertEmoji} />
                    </div>
                  )}
                </div>
              </div>
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
