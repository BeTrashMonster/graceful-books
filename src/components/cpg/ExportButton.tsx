/**
 * Export Button Component
 *
 * Standardized export button with dropdown menu for CSV/PDF exports.
 * Uses design tokens for consistent styling across the application.
 */

import { useState, useRef, useEffect } from 'react';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../styles/design-tokens';

export interface ExportOption {
  label: string;
  icon: string;
  onClick: () => void;
}

export interface ExportButtonProps {
  options: ExportOption[];
  label?: string;
  'aria-label'?: string;
}

export function ExportButton({ options, label = 'Export', 'aria-label': ariaLabel }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={buttonRef} style={{ position: 'relative', marginLeft: 'auto' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: `${spacing.sm} ${spacing.md}`,
          background: colors.primary,
          color: 'white',
          border: 'none',
          borderRadius: borderRadius.md,
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          transition: 'background-color 200ms',
        }}
        aria-label={ariaLabel || `${label} options`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onMouseEnter={(e) => e.currentTarget.style.background = colors.primaryLight}
        onMouseLeave={(e) => e.currentTarget.style.background = colors.primary}
      >
        {label}
        <span style={{ fontSize: fontSize.xs }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.25rem',
            background: colors.background,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            zIndex: 1000,
            minWidth: '200px',
          }}
          role="menu"
        >
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                option.onClick();
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                border: 'none',
                background: colors.background,
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: fontSize.sm,
                borderBottom: index < options.length - 1 ? `1px solid ${colors.backgroundTertiary}` : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
              }}
              role="menuitem"
              onMouseEnter={(e) => e.currentTarget.style.background = colors.backgroundSecondary}
              onMouseLeave={(e) => e.currentTarget.style.background = colors.background}
            >
              <span>{option.icon}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
