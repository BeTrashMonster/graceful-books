/**
 * RichTextEditor Component
 *
 * A reusable rich text editor for general content editing.
 * Simpler than EmailTemplateEditor - no email-specific features.
 *
 * Features:
 * - Basic formatting (bold, italic, underline)
 * - Lists (ordered and unordered)
 * - Indentation
 * - Links
 *
 * Requirements:
 * - WCAG 2.1 AA compliant
 */

import { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'quill/dist/quill.snow.css';
import styles from './RichTextEditor.module.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  id?: string;
  'aria-label'?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter content...',
  minHeight = 150,
  id,
  'aria-label': ariaLabel,
}: RichTextEditorProps) {
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          ['link'],
          ['clean'],
        ],
      },
    }),
    []
  );

  const formats = [
    'bold',
    'italic',
    'underline',
    'list',
    'bullet',
    'indent',
    'link',
  ];

  // Normalize empty Quill content to empty string
  const handleChange = (content: string) => {
    const normalized = content === '<p><br></p>' ? '' : content;
    onChange(normalized);
  };

  return (
    <div
      className={styles.wrapper}
      style={{ '--editor-min-height': `${minHeight}px` } as React.CSSProperties}
    >
      <ReactQuill
        id={id}
        theme="snow"
        value={value}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className={styles.editor}
        aria-label={ariaLabel}
      />
    </div>
  );
}
