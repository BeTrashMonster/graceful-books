/**
 * HelpCenter - Searchable help center with all topics
 */

import React, { useState, useMemo } from 'react';
import { searchHelpDefinitions, getAllHelpTerms, getHelpDefinition, type HelpDefinition } from '../../features/helpers/helpDefinitions';
import { HelpModal } from './HelpModal';

export interface HelpCenterProps {
  initialSearchQuery?: string;
  onClose?: () => void;
}

export const HelpCenter: React.FC<HelpCenterProps> = ({
  initialSearchQuery = '',
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedTerm, setSelectedTerm] = useState<HelpDefinition | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get all terms or search results
  const displayedTerms = useMemo(() => {
    if (!searchQuery.trim()) {
      const allTermIds = getAllHelpTerms();
      return allTermIds
        .map(id => getHelpDefinition(id))
        .filter((def): def is HelpDefinition => def !== undefined);
    }
    return searchHelpDefinitions(searchQuery);
  }, [searchQuery]);

  // Group terms by category
  const categorizedTerms = useMemo(() => {
    const categories: Record<string, HelpDefinition[]> = {
      'Fundamentals': [],
      'Account Types': [],
      'Reports': [],
      'Other': [],
    };

    displayedTerms.forEach(term => {
      const termId = term.term.toLowerCase().replace(/\s+/g, '-');

      if (['double-entry', 'debit-credit', 'chart-of-accounts', 'accrual-vs-cash'].includes(termId)) {
        categories['Fundamentals']?.push(term);
      } else if (['assets', 'liabilities', 'equity', 'revenue', 'expenses'].includes(termId)) {
        categories['Account Types']?.push(term);
      } else if (['balance-sheet', 'profit-loss', 'cash-flow'].includes(termId)) {
        categories['Reports']?.push(term);
      } else {
        categories['Other']?.push(term);
      }
    });

    // Remove empty categories
    return Object.fromEntries(
      Object.entries(categories).filter(([_, terms]) => terms.length > 0)
    );
  }, [displayedTerms]);

  const handleTermClick = (term: HelpDefinition) => {
    setSelectedTerm(term);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleNavigateToTerm = (termId: string) => {
    const term = getHelpDefinition(termId);
    if (term) {
      setSelectedTerm(term);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl mx-auto" data-testid="help-center">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Help Center
          </h1>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              aria-label="Close"
              data-testid="help-center-close"
            >
              &times;
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for help topics..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="help-center-search"
            aria-label="Search help topics"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
              data-testid="help-center-clear-search"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="px-6 py-4 max-h-[600px] overflow-y-auto">
        {displayedTerms.length === 0 ? (
          <div className="text-center py-12 text-gray-500" data-testid="help-center-no-results">
            No help topics found for "{searchQuery}"
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(categorizedTerms).map(([category, terms]) => (
              <div key={category}>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  {category}
                </h2>
                <div className="grid gap-3">
                  {terms.map((term) => (
                    <button
                      key={term.term}
                      onClick={() => handleTermClick(term)}
                      className="text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                      data-testid={`help-topic-${term.term.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="font-semibold text-gray-900 group-hover:text-blue-600 mb-1">
                        {term.term}
                      </div>
                      <div className="text-sm text-gray-600">
                        {term.shortDescription}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Modal */}
      {selectedTerm && (
        <HelpModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          definition={selectedTerm}
          onNavigateToTerm={handleNavigateToTerm}
        />
      )}
    </div>
  );
};
