/**
 * useOverdueInvoices Hook
 *
 * Fetches overdue invoices for display in the dashboard widget.
 */

import { useState, useEffect } from 'react';
import type { OverdueInvoice } from '../components/dashboard/OverdueInvoicesWidget';
import { db } from '../db/database';

export function useOverdueInvoices(companyId: string, limit = 5): {
  invoices: OverdueInvoice[];
  isLoading: boolean;
  error: Error | null;
} {
  const [invoices, setInvoices] = useState<OverdueInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchOverdueInvoices() {
      try {
        setIsLoading(true);
        setError(null);

        const now = Date.now();

        // Get all invoices for this company
        const allInvoices = await db.invoices
          .where('company_id')
          .equals(companyId)
          .toArray();

        // Filter for overdue invoices (status not PAID and dueDate < now)
        const overdueInvoices = allInvoices
          .filter(invoice => {
            const isPaid = invoice.status === 'PAID';
            const isDue = invoice.dueDate ? invoice.dueDate < now : false;
            return !isPaid && isDue;
          })
          .map(invoice => {
            const dueDate = invoice.dueDate || now;
            const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

            // Get customer name (may need to fetch from contacts)
            const customerName = invoice.customerName || 'Unknown Customer';

            return {
              id: invoice.id,
              invoice_number: invoice.invoiceNumber,
              customer_name: customerName,
              total: parseFloat(invoice.totalCents || '0') / 100,
              due_date: dueDate,
              days_overdue: daysOverdue,
            };
          })
          .sort((a, b) => b.days_overdue - a.days_overdue) // Most overdue first
          .slice(0, limit);

        if (mounted) {
          setInvoices(overdueInvoices);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch overdue invoices'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    if (companyId) {
      fetchOverdueInvoices();
    } else {
      setIsLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [companyId, limit]);

  return { invoices, isLoading, error };
}
