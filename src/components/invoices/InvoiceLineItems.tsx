/**
 * InvoiceLineItems Component
 *
 * Editable table for invoice line items with:
 * - Add/remove line items
 * - Real-time total calculations
 * - Validation
 */

import type { InvoiceLineItem } from '../../db/schema/invoices.schema';
import { calculateLineItemTotal } from '../../db/schema/invoices.schema';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { nanoid } from 'nanoid';

export interface InvoiceLineItemsProps {
  lineItems: InvoiceLineItem[];
  onChange: (lineItems: InvoiceLineItem[]) => void;
  disabled?: boolean;
}

export const InvoiceLineItems = ({
  lineItems,
  onChange,
  disabled = false,
}: InvoiceLineItemsProps) => {
  const handleAddLine = () => {
    const newLine: InvoiceLineItem = {
      id: nanoid(),
      description: '',
      quantity: 1,
      unitPrice: '0.00',
      accountId: '',
      total: '0.00',
    };
    onChange([...lineItems, newLine]);
  };

  const handleRemoveLine = (id: string) => {
    onChange(lineItems.filter((item) => item.id !== id));
  };

  const handleUpdateLine = (id: string, updates: Partial<InvoiceLineItem>) => {
    onChange(
      lineItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          // Recalculate total if quantity or unitPrice changed
          if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
            updated.total = calculateLineItemTotal(
              updated.quantity,
              updated.unitPrice
            );
          }
          return updated;
        }
        return item;
      })
    );
  };

  return (
    <div className="invoice-line-items">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-3 text-left">Description</th>
            <th className="p-3 text-center w-24">Quantity</th>
            <th className="p-3 text-right w-32">Unit Price</th>
            <th className="p-3 text-right w-32">Total</th>
            <th className="p-3 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="p-2">
                <Input
                  value={item.description}
                  onChange={(e) =>
                    handleUpdateLine(item.id, { description: e.target.value })
                  }
                  placeholder="Item description"
                  disabled={disabled}
                  fullWidth
                />
              </td>
              <td className="p-2">
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    handleUpdateLine(item.id, {
                      quantity: parseFloat(e.target.value) || 0,
                    })
                  }
                  min="0"
                  step="1"
                  disabled={disabled}
                  fullWidth
                />
              </td>
              <td className="p-2">
                <Input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) =>
                    handleUpdateLine(item.id, { unitPrice: e.target.value })
                  }
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  fullWidth
                />
              </td>
              <td className="p-2 text-right font-semibold">
                ${item.total}
              </td>
              <td className="p-2 text-center">
                <button
                  onClick={() => handleRemoveLine(item.id)}
                  disabled={disabled || lineItems.length === 1}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                  aria-label={`Remove ${item.description || 'line item'}`}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4">
        <Button onClick={handleAddLine} disabled={disabled} variant="secondary">
          + Add Line Item
        </Button>
      </div>
    </div>
  );
};
