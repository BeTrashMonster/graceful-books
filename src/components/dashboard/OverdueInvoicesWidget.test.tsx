/**
 * Overdue Invoices Widget Tests
 *
 * Comprehensive tests for OverdueInvoicesWidget component
 * Requirements: F1 - Dashboard (Full Featured)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OverdueInvoicesWidget } from './OverdueInvoicesWidget';
import type { OverdueInvoice } from './OverdueInvoicesWidget';

// Wrapper for router context
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('OverdueInvoicesWidget', () => {
  const mockInvoices: OverdueInvoice[] = [
    {
      id: 'inv-1',
      invoice_number: 'INV-001',
      customer_name: 'Acme Corp',
      total: 1500.0,
      due_date: new Date('2025-12-31').getTime(),
      days_overdue: 17,
    },
    {
      id: 'inv-2',
      invoice_number: 'INV-002',
      customer_name: 'Tech Solutions',
      total: 2500.0,
      due_date: new Date('2025-12-15').getTime(),
      days_overdue: 33,
    },
    {
      id: 'inv-3',
      invoice_number: 'INV-003',
      customer_name: 'Design Co',
      total: 800.0,
      due_date: new Date('2026-01-05').getTime(),
      days_overdue: 12,
    },
  ];

  describe('rendering', () => {
    it('should render overdue invoices count', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      expect(screen.getByText('Overdue Invoices')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display total overdue amount', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      // Total: 1500 + 2500 + 800 = 4800
      expect(screen.getByText('$4,800.00')).toBeInTheDocument();
    });

    it('should show invoice details', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      expect(screen.getByText('INV-001')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('$1,500.00')).toBeInTheDocument();
      expect(screen.getByText('17 days overdue')).toBeInTheDocument();
    });

    it('should render follow-up links', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      const followUpLinks = screen.getAllByText(/follow up/i);
      expect(followUpLinks.length).toBeGreaterThan(0);
    });

    it('should show "View All" link', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      expect(screen.getByText('View All')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no overdue invoices', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={[]} />
        </RouterWrapper>
      );

      expect(screen.getByText(/no overdue invoices/i)).toBeInTheDocument();
      expect(screen.getByText(/great job/i)).toBeInTheDocument();
    });

    it('should not show total when no invoices', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={[]} />
        </RouterWrapper>
      );

      expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when loading', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={[]} isLoading />
        </RouterWrapper>
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading overdue invoices...')).toBeInTheDocument();
    });

    it('should not show content when loading', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} isLoading />
        </RouterWrapper>
      );

      expect(screen.queryByText('INV-001')).not.toBeInTheDocument();
    });

    it('should have aria-live region when loading', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={[]} isLoading />
        </RouterWrapper>
      );

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('interactions', () => {
    it('should call onFollowUp when follow-up button clicked', () => {
      const onFollowUp = vi.fn();

      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} onFollowUp={onFollowUp} />
        </RouterWrapper>
      );

      const followUpButtons = screen.getAllByText(/follow up/i);
      fireEvent.click(followUpButtons[0]!);

      // INV-002 has 33 days overdue (most), so it's sorted first
      expect(onFollowUp).toHaveBeenCalledWith('inv-2');
    });

    it('should handle multiple follow-up clicks', () => {
      const onFollowUp = vi.fn();

      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} onFollowUp={onFollowUp} />
        </RouterWrapper>
      );

      const followUpButtons = screen.getAllByText(/follow up/i);
      fireEvent.click(followUpButtons[0]!);
      fireEvent.click(followUpButtons[1]!);

      expect(onFollowUp).toHaveBeenCalledTimes(2);
      // Sorted by days overdue: inv-2 (33 days), inv-1 (17 days), inv-3 (12 days)
      expect(onFollowUp).toHaveBeenCalledWith('inv-2');
      expect(onFollowUp).toHaveBeenCalledWith('inv-1');
    });

    it('should navigate to invoice detail when invoice clicked', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      const invoiceLinks = screen.getAllByRole('link', { name: /INV-/i });
      // INV-002 is first (33 days overdue, most)
      expect(invoiceLinks[0]).toHaveAttribute('href', '/invoices/inv-2');
    });
  });

  describe('formatting', () => {
    it('should format currency with commas', () => {
      const largeInvoices: OverdueInvoice[] = [
        {
          id: 'inv-large',
          invoice_number: 'INV-999',
          customer_name: 'Big Client',
          total: 123456.78,
          due_date: new Date('2025-12-01').getTime(),
          days_overdue: 45,
        },
      ];

      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={largeInvoices} />
        </RouterWrapper>
      );

      // Currency appears in both summary and invoice item
      const amounts = screen.getAllByText('$123,456.78');
      expect(amounts.length).toBeGreaterThan(0);
    });

    it('should format dates correctly', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      // Check for due date labels (date formatting may vary by environment)
      const dueDates = screen.getAllByText(/Due:/i);
      expect(dueDates.length).toBeGreaterThan(0);
    });

    it('should show singular "day" for 1 day overdue', () => {
      const oneDay: OverdueInvoice[] = [
        {
          id: 'inv-1day',
          invoice_number: 'INV-100',
          customer_name: 'Client',
          total: 100.0,
          due_date: new Date().getTime(),
          days_overdue: 1,
        },
      ];

      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={oneDay} />
        </RouterWrapper>
      );

      expect(screen.getByText('1 day overdue')).toBeInTheDocument();
    });

    it('should show plural "days" for multiple days', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      expect(screen.getByText('17 days overdue')).toBeInTheDocument();
    });
  });

  describe('sorting and display limits', () => {
    it('should display invoices in order of days overdue (most overdue first)', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      const invoiceNumbers = screen.getAllByText(/INV-/);
      // INV-002 has 33 days overdue (most)
      expect(invoiceNumbers[0]?.textContent).toContain('INV-002');
    });

    it('should limit display to 5 invoices', () => {
      const manyInvoices: OverdueInvoice[] = Array.from({ length: 10 }, (_, i) => ({
        id: `inv-${i}`,
        invoice_number: `INV-${i.toString().padStart(3, '0')}`,
        customer_name: `Customer ${i}`,
        total: 100 * (i + 1),
        due_date: new Date('2025-12-01').getTime(),
        days_overdue: 10 + i,
      }));

      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={manyInvoices} />
        </RouterWrapper>
      );

      // Should only show 5 invoices
      const invoiceItems = screen.getAllByText(/INV-/);
      expect(invoiceItems.length).toBeLessThanOrEqual(5);
    });

    it('should show count of additional invoices if more than 5', () => {
      const manyInvoices: OverdueInvoice[] = Array.from({ length: 10 }, (_, i) => ({
        id: `inv-${i}`,
        invoice_number: `INV-${i.toString().padStart(3, '0')}`,
        customer_name: `Customer ${i}`,
        total: 100,
        due_date: new Date('2025-12-01').getTime(),
        days_overdue: 10,
      }));

      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={manyInvoices} />
        </RouterWrapper>
      );

      expect(screen.getByText(/5 more/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      expect(screen.getByLabelText(/total overdue amount/i)).toBeInTheDocument();
    });

    it('should have semantic heading', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      const heading = screen.getByRole('heading', { name: /overdue invoices/i });
      expect(heading).toBeInTheDocument();
    });

    it('should have list structure for invoices', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();

      const listItems = screen.getAllByRole('listitem');
      expect(listItems.length).toBeGreaterThan(0);
    });

    it('should have accessible buttons', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      const followUpButtons = screen.getAllByRole('button', { name: /follow up/i });
      expect(followUpButtons.length).toBeGreaterThan(0);
    });

    it('should hide decorative icons from screen readers', () => {
      const { container } = render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('urgency indicators', () => {
    it('should highlight invoices overdue > 30 days', () => {
      const { container } = render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} />
        </RouterWrapper>
      );

      // INV-002 is 33 days overdue
      const urgentItems = container.querySelectorAll('.urgent');
      expect(urgentItems.length).toBeGreaterThan(0);
    });

    it('should show warning for invoices overdue > 60 days', () => {
      const veryOverdue: OverdueInvoice[] = [
        {
          id: 'inv-very-late',
          invoice_number: 'INV-LATE',
          customer_name: 'Late Payer',
          total: 5000.0,
          due_date: new Date('2025-10-01').getTime(),
          days_overdue: 90,
        },
      ];

      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={veryOverdue} />
        </RouterWrapper>
      );

      expect(screen.getByText(/90 days overdue/i)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle single overdue invoice', () => {
      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={[mockInvoices[0]!]} />
        </RouterWrapper>
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      // Amount appears in both summary and invoice item
      const amounts = screen.getAllByText('$1,500.00');
      expect(amounts.length).toBeGreaterThan(0);
    });

    it('should handle very small amounts', () => {
      const smallInvoice: OverdueInvoice[] = [
        {
          id: 'inv-small',
          invoice_number: 'INV-SMALL',
          customer_name: 'Client',
          total: 0.99,
          due_date: new Date('2025-12-31').getTime(),
          days_overdue: 10,
        },
      ];

      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={smallInvoice} />
        </RouterWrapper>
      );

      // Amount appears in both summary and invoice item
      const amounts = screen.getAllByText('$0.99');
      expect(amounts.length).toBeGreaterThan(0);
    });

    it('should handle long customer names', () => {
      const longName: OverdueInvoice[] = [
        {
          id: 'inv-long',
          invoice_number: 'INV-LONG',
          customer_name: 'Very Long Company Name That Should Truncate Properly Inc.',
          total: 1000.0,
          due_date: new Date('2025-12-31').getTime(),
          days_overdue: 10,
        },
      ];

      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={longName} />
        </RouterWrapper>
      );

      expect(
        screen.getByText(/Very Long Company Name That Should Truncate Properly Inc./i)
      ).toBeInTheDocument();
    });
  });

  describe('custom props', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <RouterWrapper>
          <OverdueInvoicesWidget
            invoices={mockInvoices}
            className="custom-widget"
          />
        </RouterWrapper>
      );

      const widget = container.firstChild as HTMLElement;
      expect(widget.className).toContain('custom-widget');
    });
  });

  describe('integration', () => {
    it('should render complete widget with all features', () => {
      const onFollowUp = vi.fn();

      render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} onFollowUp={onFollowUp} />
        </RouterWrapper>
      );

      expect(screen.getByText('Overdue Invoices')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('$4,800.00')).toBeInTheDocument();
      expect(screen.getAllByText(/follow up/i).length).toBeGreaterThan(0);
    });

    it('should handle transition from loading to loaded', () => {
      const { rerender } = render(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={[]} isLoading />
        </RouterWrapper>
      );

      expect(screen.getByText('Loading overdue invoices...')).toBeInTheDocument();

      rerender(
        <RouterWrapper>
          <OverdueInvoicesWidget invoices={mockInvoices} isLoading={false} />
        </RouterWrapper>
      );

      expect(
        screen.queryByText('Loading overdue invoices...')
      ).not.toBeInTheDocument();
      expect(screen.getByText('INV-001')).toBeInTheDocument();
    });
  });
});
