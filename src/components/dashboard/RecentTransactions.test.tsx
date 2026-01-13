/**
 * Tests for RecentTransactions Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecentTransactions, type Transaction } from './RecentTransactions';

const mockTransactions: Transaction[] = [
  {
    id: '1',
    date: Date.now() - 1000 * 60 * 60, // 1 hour ago
    description: 'Client Payment',
    amount: '1000.00',
    type: 'PAYMENT',
  },
  {
    id: '2',
    date: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
    description: 'Office Supplies',
    amount: '50.00',
    type: 'EXPENSE',
  },
  {
    id: '3',
    date: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
    description: 'Software Subscription',
    amount: '99.00',
    type: 'EXPENSE',
  },
];

describe('RecentTransactions Component', () => {
  describe('rendering', () => {
    it('should render with transactions', () => {
      render(<RecentTransactions transactions={mockTransactions} />);

      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
      expect(screen.getByText('Client Payment')).toBeInTheDocument();
      expect(screen.getByText('Office Supplies')).toBeInTheDocument();
    });

    it('should render correct number of transactions', () => {
      render(<RecentTransactions transactions={mockTransactions} />);

      const list = screen.getByRole('list', { name: /recent transactions/i });
      const items = list.querySelectorAll('li');
      expect(items).toHaveLength(3);
    });

    it('should respect limit prop', () => {
      render(<RecentTransactions transactions={mockTransactions} limit={2} />);

      const list = screen.getByRole('list', { name: /recent transactions/i });
      const items = list.querySelectorAll('li');
      expect(items).toHaveLength(2);
    });

    it('should format amounts correctly', () => {
      render(<RecentTransactions transactions={mockTransactions} />);

      expect(screen.getByText('$1,000.00')).toBeInTheDocument();
      expect(screen.getByText('$50.00')).toBeInTheDocument();
      expect(screen.getByText('$99.00')).toBeInTheDocument();
    });

    it('should format transaction types', () => {
      render(<RecentTransactions transactions={mockTransactions} />);

      const paymentElements = screen.getAllByText(/Payment/);
      expect(paymentElements.length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Expense/)).toHaveLength(2);
    });
  });

  describe('empty state', () => {
    it('should show empty state when no transactions', () => {
      render(<RecentTransactions transactions={[]} />);

      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
      expect(
        screen.getByText(/Your recent transactions will appear here/)
      ).toBeInTheDocument();
    });

    it('should not show list when empty', () => {
      render(<RecentTransactions transactions={[]} />);

      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when loading', () => {
      render(<RecentTransactions transactions={[]} isLoading />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading transactions...')).toBeInTheDocument();
    });

    it('should show multiple skeleton items', () => {
      const { container } = render(
        <RecentTransactions transactions={[]} isLoading />
      );

      // Look for skeleton items by finding spans with specific inline styles (width, height)
      const skeletonItems = container.querySelectorAll('span[style*="width"]');
      expect(skeletonItems.length).toBeGreaterThan(0);
    });

    it('should not show real transactions when loading', () => {
      render(<RecentTransactions transactions={mockTransactions} isLoading />);

      expect(screen.queryByText('Client Payment')).not.toBeInTheDocument();
    });
  });

  describe('view all button', () => {
    it('should render view all button when onViewAll provided', () => {
      const handleViewAll = vi.fn();
      render(<RecentTransactions transactions={mockTransactions} onViewAll={handleViewAll} />);

      expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument();
    });

    it('should call onViewAll when button clicked', async () => {
      const user = userEvent.setup();
      const handleViewAll = vi.fn();
      render(<RecentTransactions transactions={mockTransactions} onViewAll={handleViewAll} />);

      const button = screen.getByRole('button', { name: /view all/i });
      await user.click(button);

      expect(handleViewAll).toHaveBeenCalledTimes(1);
    });

    it('should not render view all button when onViewAll not provided', () => {
      render(<RecentTransactions transactions={mockTransactions} />);

      expect(screen.queryByRole('button', { name: /view all/i })).not.toBeInTheDocument();
    });
  });

  describe('more indicator', () => {
    it('should show more indicator when transactions exceed limit', () => {
      render(<RecentTransactions transactions={mockTransactions} limit={2} />);

      expect(screen.getByText(/Showing 2 of 3 transactions/)).toBeInTheDocument();
    });

    it('should not show more indicator when onViewAll provided', () => {
      const handleViewAll = vi.fn();
      render(
        <RecentTransactions
          transactions={mockTransactions}
          limit={2}
          onViewAll={handleViewAll}
        />
      );

      expect(screen.queryByText(/Showing 2 of 3/)).not.toBeInTheDocument();
    });

    it('should not show more indicator when all transactions fit', () => {
      render(<RecentTransactions transactions={mockTransactions} limit={10} />);

      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    });
  });

  describe('date formatting', () => {
    it('should show "Today" for today transactions', () => {
      const todayTransaction: Transaction = {
        id: '1',
        date: Date.now(),
        description: 'Today Transaction',
        amount: '100.00',
        type: 'PAYMENT',
      };

      render(<RecentTransactions transactions={[todayTransaction]} />);

      expect(screen.getByText('Today Transaction')).toBeInTheDocument();
      const dateElements = screen.getAllByText(/Today/);
      expect(dateElements.length).toBeGreaterThan(0);
    });

    it('should show "Yesterday" for yesterday transactions', () => {
      const yesterdayTransaction: Transaction = {
        id: '1',
        date: Date.now() - 1000 * 60 * 60 * 24,
        description: 'Yesterday Transaction',
        amount: '100.00',
        type: 'PAYMENT',
      };

      render(<RecentTransactions transactions={[yesterdayTransaction]} />);

      expect(screen.getByText('Yesterday Transaction')).toBeInTheDocument();
      const dateElements = screen.getAllByText(/Yesterday/);
      expect(dateElements.length).toBeGreaterThan(0);
    });

    it('should show days ago for recent transactions', () => {
      const recentTransaction: Transaction = {
        id: '1',
        date: Date.now() - 1000 * 60 * 60 * 24 * 3,
        description: 'Recent Transaction',
        amount: '100.00',
        type: 'PAYMENT',
      };

      render(<RecentTransactions transactions={[recentTransaction]} />);

      expect(screen.getByText(/3 days ago/)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible list label', () => {
      render(<RecentTransactions transactions={mockTransactions} />);

      expect(screen.getByRole('list', { name: /recent transactions/i })).toBeInTheDocument();
    });

    it('should have aria-label on amounts', () => {
      render(<RecentTransactions transactions={mockTransactions} />);

      expect(screen.getByLabelText('Amount: $1,000.00')).toBeInTheDocument();
    });

    it('should have accessible button label', () => {
      const handleViewAll = vi.fn();
      render(<RecentTransactions transactions={mockTransactions} onViewAll={handleViewAll} />);

      expect(screen.getByRole('button', { name: /view all transactions/i })).toBeInTheDocument();
    });

    it('should have aria-live region when loading', () => {
      render(<RecentTransactions transactions={[]} isLoading />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('custom props', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <RecentTransactions transactions={mockTransactions} className="custom-class" />
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv.className).toContain('custom-class');
    });
  });

  describe('edge cases', () => {
    it('should handle single transaction', () => {
      render(<RecentTransactions transactions={[mockTransactions[0]!]} />);

      expect(screen.getByText('Client Payment')).toBeInTheDocument();
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    });

    it('should handle very long descriptions', () => {
      const longDescTransaction: Transaction = {
        id: '1',
        date: Date.now(),
        description: 'This is a very long description that should be truncated or handled appropriately',
        amount: '100.00',
        type: 'PAYMENT',
      };

      render(<RecentTransactions transactions={[longDescTransaction]} />);

      expect(
        screen.getByText(/This is a very long description/)
      ).toBeInTheDocument();
    });

    it('should handle unknown transaction types', () => {
      const unknownTypeTransaction: Transaction = {
        id: '1',
        date: Date.now(),
        description: 'Unknown Type',
        amount: '100.00',
        type: 'UNKNOWN_TYPE',
      };

      render(<RecentTransactions transactions={[unknownTypeTransaction]} />);

      expect(screen.getByText(/UNKNOWN_TYPE/)).toBeInTheDocument();
    });

    it('should handle negative amounts', () => {
      const negativeTransaction: Transaction = {
        id: '1',
        date: Date.now(),
        description: 'Refund',
        amount: '-50.00',
        type: 'PAYMENT',
      };

      render(<RecentTransactions transactions={[negativeTransaction]} />);

      expect(screen.getByText('-$50.00')).toBeInTheDocument();
    });
  });
});
