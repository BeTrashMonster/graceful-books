/**
 * HelpModal - Detailed help explanations in a modal dialog
 */

import React from 'react';
import type { HelpDefinition } from '../../features/helpers/helpDefinitions';

export interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  definition: HelpDefinition;
  onNavigateToTerm?: (termId: string) => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  definition,
  onNavigateToTerm,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleRelatedTermClick = (termId: string) => {
    if (onNavigateToTerm) {
      onNavigateToTerm(termId);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
      data-testid="help-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2
            id="help-modal-title"
            className="text-2xl font-bold text-gray-900"
          >
            {definition.term}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
            data-testid="help-modal-close"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Short Description */}
          <div className="text-lg text-gray-600 italic">
            {definition.shortDescription}
          </div>

          {/* Long Description */}
          <div className="text-gray-700 whitespace-pre-line leading-relaxed">
            {definition.longDescription}
          </div>

          {/* Example */}
          {definition.example && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
              <div className="font-semibold text-blue-900 mb-2">
                Example:
              </div>
              <div className="text-blue-800 whitespace-pre-line">
                {definition.example}
              </div>
            </div>
          )}

          {/* Why It Matters */}
          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
            <div className="font-semibold text-green-900 mb-2">
              Why it matters:
            </div>
            <div className="text-green-800">
              {definition.whyItMatters}
            </div>
          </div>

          {/* Common Misconception */}
          {definition.commonMisconception && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              <div className="font-semibold text-yellow-900 mb-2">
                Common misconception:
              </div>
              <div className="text-yellow-800">
                {definition.commonMisconception}
              </div>
            </div>
          )}

          {/* Related Terms */}
          {definition.relatedTerms && definition.relatedTerms.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <div className="font-semibold text-gray-900 mb-3">
                Related Topics:
              </div>
              <div className="flex flex-wrap gap-2">
                {definition.relatedTerms.map((termId) => (
                  <button
                    key={termId}
                    onClick={() => handleRelatedTermClick(termId)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm transition-colors"
                    data-testid={`related-term-${termId}`}
                  >
                    {termId.split('-').map(word =>
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            data-testid="help-modal-close-button"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
