/**
 * Tests for HelpModal component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpModal } from './HelpModal';
import type { HelpDefinition } from '../../features/helpers/helpDefinitions';

const mockDefinition: HelpDefinition = {
  term: 'Test Term',
  shortDescription: 'Short description',
  longDescription: 'Long description with details',
  example: 'Example text',
  whyItMatters: 'This is why it matters',
  commonMisconception: 'Common mistake',
  relatedTerms: ['term1', 'term2'],
};

describe('HelpModal', () => {
  it('should not render when closed', () => {
    render(
      <HelpModal
        isOpen={false}
        onClose={vi.fn()}
        definition={mockDefinition}
      />
    );
    expect(screen.queryByTestId('help-modal-backdrop')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={mockDefinition}
      />
    );
    expect(screen.getByTestId('help-modal-backdrop')).toBeInTheDocument();
  });

  it('should display term title', () => {
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={mockDefinition}
      />
    );
    expect(screen.getByText('Test Term')).toBeInTheDocument();
  });

  it('should display short description', () => {
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={mockDefinition}
      />
    );
    expect(screen.getByText('Short description')).toBeInTheDocument();
  });

  it('should display long description', () => {
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={mockDefinition}
      />
    );
    expect(screen.getByText('Long description with details')).toBeInTheDocument();
  });

  it('should display example when provided', () => {
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={mockDefinition}
      />
    );
    expect(screen.getByText('Example text')).toBeInTheDocument();
  });

  it('should display why it matters', () => {
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={mockDefinition}
      />
    );
    expect(screen.getByText('This is why it matters')).toBeInTheDocument();
  });

  it('should display common misconception when provided', () => {
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={mockDefinition}
      />
    );
    expect(screen.getByText('Common mistake')).toBeInTheDocument();
  });

  it('should not display example section if not provided', () => {
    const defWithoutExample = { ...mockDefinition, example: undefined };
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={defWithoutExample}
      />
    );
    expect(screen.queryByText('Example:')).not.toBeInTheDocument();
  });

  it('should not display misconception section if not provided', () => {
    const defWithoutMisconception = { ...mockDefinition, commonMisconception: undefined };
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={defWithoutMisconception}
      />
    );
    expect(screen.queryByText('Common misconception:')).not.toBeInTheDocument();
  });

  it('should display related terms', () => {
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={mockDefinition}
      />
    );
    expect(screen.getByTestId('related-term-term1')).toBeInTheDocument();
    expect(screen.getByTestId('related-term-term2')).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <HelpModal
        isOpen={true}
        onClose={onClose}
        definition={mockDefinition}
      />
    );
    fireEvent.click(screen.getByTestId('help-modal-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when Got it button clicked', () => {
    const onClose = vi.fn();
    render(
      <HelpModal
        isOpen={true}
        onClose={onClose}
        definition={mockDefinition}
      />
    );
    fireEvent.click(screen.getByTestId('help-modal-close-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(
      <HelpModal
        isOpen={true}
        onClose={onClose}
        definition={mockDefinition}
      />
    );
    fireEvent.click(screen.getByTestId('help-modal-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should not close when modal content clicked', () => {
    const onClose = vi.fn();
    render(
      <HelpModal
        isOpen={true}
        onClose={onClose}
        definition={mockDefinition}
      />
    );
    const modalContent = screen.getByText('Test Term').closest('div');
    if (modalContent) {
      fireEvent.click(modalContent);
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should call onNavigateToTerm when related term clicked', () => {
    const onNavigateToTerm = vi.fn();
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={mockDefinition}
        onNavigateToTerm={onNavigateToTerm}
      />
    );
    fireEvent.click(screen.getByTestId('related-term-term1'));
    expect(onNavigateToTerm).toHaveBeenCalledWith('term1');
  });

  it('should have proper accessibility attributes', () => {
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={mockDefinition}
      />
    );
    const modal = screen.getByTestId('help-modal-backdrop');
    expect(modal).toHaveAttribute('role', 'dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-labelledby', 'help-modal-title');
  });

  it('should format related term names correctly', () => {
    const defWithHyphenatedTerms: HelpDefinition = {
      ...mockDefinition,
      relatedTerms: ['double-entry', 'debit-credit'],
    };
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={defWithHyphenatedTerms}
      />
    );
    expect(screen.getByText('Double Entry')).toBeInTheDocument();
    expect(screen.getByText('Debit Credit')).toBeInTheDocument();
  });

  it('should not show related terms section if no terms provided', () => {
    const defWithoutTerms = { ...mockDefinition, relatedTerms: undefined };
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={defWithoutTerms}
      />
    );
    expect(screen.queryByText('Related Topics:')).not.toBeInTheDocument();
  });

  it('should not show related terms section if empty array', () => {
    const defWithEmptyTerms = { ...mockDefinition, relatedTerms: [] };
    render(
      <HelpModal
        isOpen={true}
        onClose={vi.fn()}
        definition={defWithEmptyTerms}
      />
    );
    expect(screen.queryByText('Related Topics:')).not.toBeInTheDocument();
  });
});
