/**
 * GlossaryTerm - Clickable term with definition
 * Use inline in text to make accounting terms interactive
 */

import React from 'react';

export interface GlossaryTermProps {
  termId: string;
  children: React.ReactNode;
  onClick?: (termId: string) => void;
  className?: string;
}

export const GlossaryTerm: React.FC<GlossaryTermProps> = ({
  termId,
  children,
  onClick,
  className = '',
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(termId);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        inline-flex items-center
        text-blue-600 hover:text-blue-800
        underline decoration-dotted
        cursor-help
        transition-colors
        ${className}
      `}
      data-testid={`glossary-term-${termId}`}
      aria-label={`Learn about ${children}`}
    >
      {children}
    </button>
  );
};
