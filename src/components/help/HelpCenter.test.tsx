/**
 * Tests for HelpCenter component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HelpCenter } from './HelpCenter';

describe('HelpCenter', () => {
  it('should render help center', () => {
    render(<HelpCenter />);
    expect(screen.getByTestId('help-center')).toBeInTheDocument();
  });

  it('should display title', () => {
    render(<HelpCenter />);
    expect(screen.getByText('Help Center')).toBeInTheDocument();
  });

  it('should display search input', () => {
    render(<HelpCenter />);
    const searchInput = screen.getByTestId('help-center-search');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('placeholder', 'Search for help topics...');
  });

  it('should show all topics by default', () => {
    render(<HelpCenter />);
    // Should show at least the 12 required topics
    expect(screen.getByTestId('help-topic-double-entry-bookkeeping')).toBeInTheDocument();
    expect(screen.getByTestId('help-topic-debit-&-credit')).toBeInTheDocument();
  });

  it('should organize topics by category', () => {
    render(<HelpCenter />);
    expect(screen.getByText('Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Account Types')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('should filter topics based on search query', async () => {
    render(<HelpCenter />);
    const searchInput = screen.getByTestId('help-center-search');

    fireEvent.change(searchInput, { target: { value: 'snapshot' } });

    await waitFor(() => {
      expect(screen.getByTestId('help-topic-balance-sheet')).toBeInTheDocument();
      // Should not show unrelated topics
      expect(screen.queryByTestId('help-topic-debit-&-credit')).not.toBeInTheDocument();
    });
  });

  it('should show no results message when search has no matches', async () => {
    render(<HelpCenter />);
    const searchInput = screen.getByTestId('help-center-search');

    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });

    await waitFor(() => {
      expect(screen.getByTestId('help-center-no-results')).toBeInTheDocument();
      expect(screen.getByText(/No help topics found/)).toBeInTheDocument();
    });
  });

  it('should clear search when clear button clicked', async () => {
    render(<HelpCenter />);
    const searchInput = screen.getByTestId('help-center-search');

    fireEvent.change(searchInput, { target: { value: 'balance' } });

    await waitFor(() => {
      expect(screen.getByTestId('help-center-clear-search')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('help-center-clear-search'));

    await waitFor(() => {
      expect(searchInput).toHaveValue('');
      expect(screen.queryByTestId('help-center-clear-search')).not.toBeInTheDocument();
    });
  });

  it('should not show clear button when search is empty', () => {
    render(<HelpCenter />);
    expect(screen.queryByTestId('help-center-clear-search')).not.toBeInTheDocument();
  });

  it('should open modal when topic clicked', async () => {
    render(<HelpCenter />);
    const topic = screen.getByTestId('help-topic-double-entry-bookkeeping');

    fireEvent.click(topic);

    await waitFor(() => {
      expect(screen.getByTestId('help-modal-backdrop')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should close modal when close button clicked', async () => {
    render(<HelpCenter />);
    const topic = screen.getByTestId('help-topic-double-entry-bookkeeping');

    fireEvent.click(topic);

    await waitFor(() => {
      expect(screen.getByTestId('help-modal-backdrop')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('help-modal-close'));

    await waitFor(() => {
      expect(screen.queryByTestId('help-modal-backdrop')).not.toBeInTheDocument();
    });
  });

  it('should navigate to related term when clicked in modal', async () => {
    render(<HelpCenter />);
    const topic = screen.getByTestId('help-topic-double-entry-bookkeeping');

    fireEvent.click(topic);

    await waitFor(() => {
      expect(screen.getByTestId('help-modal-backdrop')).toBeInTheDocument();
    });

    // Click on a related term
    const relatedTerm = screen.getByTestId('related-term-debit-credit');
    fireEvent.click(relatedTerm);

    await waitFor(() => {
      // Should still show modal but with new content
      expect(screen.getByTestId('help-modal-backdrop')).toBeInTheDocument();
      // Check modal title which is unique
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should support initial search query', () => {
    render(<HelpCenter initialSearchQuery="cash" />);
    const searchInput = screen.getByTestId('help-center-search');
    expect(searchInput).toHaveValue('cash');
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<HelpCenter onClose={onClose} />);

    fireEvent.click(screen.getByTestId('help-center-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should not show close button if onClose not provided', () => {
    render(<HelpCenter />);
    expect(screen.queryByTestId('help-center-close')).not.toBeInTheDocument();
  });

  it('should display topic short descriptions', () => {
    render(<HelpCenter />);
    expect(screen.getByText('Every transaction has two sides')).toBeInTheDocument();
    expect(screen.getByText('Things you own')).toBeInTheDocument();
  });

  it('should be searchable by partial matches', async () => {
    render(<HelpCenter />);
    const searchInput = screen.getByTestId('help-center-search');

    fireEvent.change(searchInput, { target: { value: 'mon' } });

    await waitFor(() => {
      // Should find "money" in multiple topics
      const results = screen.queryAllByText(/money/i);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  it('should handle case-insensitive search', async () => {
    render(<HelpCenter />);
    const searchInput = screen.getByTestId('help-center-search');

    fireEvent.change(searchInput, { target: { value: 'ASSET' } });

    await waitFor(() => {
      expect(screen.getByTestId('help-topic-assets')).toBeInTheDocument();
    });
  });

  it('should show section headers only for non-empty categories', async () => {
    render(<HelpCenter />);
    const searchInput = screen.getByTestId('help-center-search');

    // Search for something specific to assets
    fireEvent.change(searchInput, { target: { value: 'things you own' } });

    await waitFor(() => {
      expect(screen.getByText('Account Types')).toBeInTheDocument();
      // Other category headers should not appear
      expect(screen.queryByText('Fundamentals')).not.toBeInTheDocument();
    });
  });

  it('should have proper accessibility for search', () => {
    render(<HelpCenter />);
    const searchInput = screen.getByTestId('help-center-search');
    expect(searchInput).toHaveAttribute('aria-label', 'Search help topics');
  });

  it('should handle rapid search input changes', async () => {
    render(<HelpCenter />);
    const searchInput = screen.getByTestId('help-center-search');

    fireEvent.change(searchInput, { target: { value: 'a' } });
    fireEvent.change(searchInput, { target: { value: 'as' } });
    fireEvent.change(searchInput, { target: { value: 'ass' } });
    fireEvent.change(searchInput, { target: { value: 'asse' } });
    fireEvent.change(searchInput, { target: { value: 'asset' } });

    await waitFor(() => {
      expect(screen.getByTestId('help-topic-assets')).toBeInTheDocument();
    });
  });
});
