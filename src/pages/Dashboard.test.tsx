/**
 * Tests for Dashboard Page
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import * as hooks from '../hooks/useDashboardMetrics';

// Mock hooks
vi.mock('../hooks/useDashboardMetrics', () => ({
  useDashboardMetrics: vi.fn(() => ({
    revenue: '10000.00',
    expenses: '6000.00',
    netProfit: '4000.00',
    isProfitable: true,
    isLoading: false,
    error: null,
    transactionCount: 5,
  })),
  useRecentTransactions: vi.fn(() => ({
    transactions: [
      {
        id: '1',
        date: Date.now(),
        description: 'Test Transaction',
        amount: '100.00',
        type: 'PAYMENT',
      },
    ],
    isLoading: false,
  })),
}));

// Mock components
vi.mock('../components/navigation/Breadcrumbs', () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs">Breadcrumbs</div>,
}));

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock values
    vi.mocked(hooks.useDashboardMetrics).mockReturnValue({
      revenue: '10000.00',
      expenses: '6000.00',
      netProfit: '4000.00',
      isProfitable: true,
      isLoading: false,
      error: null,
      transactionCount: 5,
    });
    vi.mocked(hooks.useRecentTransactions).mockReturnValue({
      transactions: [
        {
          id: '1',
          date: Date.now(),
          description: 'Test Transaction',
          amount: '100.00',
          type: 'PAYMENT',
        },
      ],
      isLoading: false,
    });
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  describe('rendering', () => {
    it('should render dashboard page', () => {
      renderDashboard();

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(
        screen.getByText(/Welcome to Graceful Books/)
      ).toBeInTheDocument();
    });

    it('should render breadcrumbs', () => {
      renderDashboard();

      expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
    });

    it('should render metric cards', () => {
      renderDashboard();

      // Use getAllByText since these labels may appear in multiple places (metric cards, headings, etc.)
      expect(screen.getAllByText('Total Revenue').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Total Expenses').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Net Profit').length).toBeGreaterThan(0);
    });

    it('should render financial summary', () => {
      renderDashboard();

      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('Expenses')).toBeInTheDocument();
    });

    it('should render quick actions', () => {
      renderDashboard();

      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /new transaction/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /new account/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view reports/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    });

    it('should render recent transactions', () => {
      renderDashboard();

      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
      expect(screen.getByText('Test Transaction')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading state for metrics', () => {
      vi.mocked(hooks.useDashboardMetrics).mockReturnValue({
        revenue: '0.00',
        expenses: '0.00',
        netProfit: '0.00',
        isProfitable: false,
        isLoading: true,
        error: null,
        transactionCount: 0,
      });

      renderDashboard();

      // MetricCard loading states should be present
      const loadingElements = screen.getAllByText(/loading metric/i);
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('should show loading state for transactions', () => {
      vi.mocked(hooks.useRecentTransactions).mockReturnValue({
        transactions: [],
        isLoading: true,
      });

      renderDashboard();

      expect(screen.getByText(/loading transactions/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state for transactions', () => {
      vi.mocked(hooks.useRecentTransactions).mockReturnValue({
        transactions: [],
        isLoading: false,
      });

      renderDashboard();

      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    it('should display formatted revenue', () => {
      renderDashboard();

      // Values may appear in multiple places (metric card, charts, etc.)
      expect(screen.getAllByText('$10,000.00').length).toBeGreaterThan(0);
    });

    it('should display formatted expenses', () => {
      renderDashboard();

      // Values may appear in multiple places (metric card, charts, etc.)
      expect(screen.getAllByText('$6,000.00').length).toBeGreaterThan(0);
    });

    it('should display formatted net profit', () => {
      renderDashboard();

      // Values may appear in multiple places (metric card, charts, etc.)
      expect(screen.getAllByText('$4,000.00').length).toBeGreaterThan(0);
    });

    it('should show profit indicator when profitable', () => {
      renderDashboard();

      // Net Profit appears in multiple places (metric card, financial summary, etc.)
      expect(screen.getAllByText('Net Profit').length).toBeGreaterThan(0);
    });

    it('should show loss indicator when not profitable', () => {
      vi.mocked(hooks.useDashboardMetrics).mockReturnValue({
        revenue: '5000.00',
        expenses: '8000.00',
        netProfit: '-3000.00',
        isProfitable: false,
        isLoading: false,
        error: null,
        transactionCount: 3,
      });

      renderDashboard();

      // Net Loss may appear in multiple places (metric card, financial summary, etc.)
      expect(screen.getAllByText('Net Loss').length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('should have proper heading hierarchy', () => {
      renderDashboard();

      const h1 = screen.getByRole('heading', { level: 1, name: /dashboard/i });
      expect(h1).toBeInTheDocument();
    });

    it('should have accessible buttons', () => {
      renderDashboard();

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach((button) => {
        expect(button).toHaveAccessibleName();
      });
    });
  });

  describe('integration', () => {
    it('should render complete dashboard with all components', () => {
      renderDashboard();

      // Check all major sections are present
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getAllByText('Total Revenue').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Total Expenses').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Net Profit').length).toBeGreaterThan(0);
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    });
  });
});
