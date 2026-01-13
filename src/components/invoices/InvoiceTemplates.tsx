/**
 * InvoiceTemplates Component
 *
 * Template selector for invoices
 */

import { invoiceTemplates } from '../../features/invoices/templates';

export interface InvoiceTemplatesProps {
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
}

export const InvoiceTemplates = ({
  selectedTemplateId,
  onSelect,
}: InvoiceTemplatesProps) => {
  return (
    <div className="invoice-templates">
      <h3 className="text-lg font-semibold mb-4">Choose a Template</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {invoiceTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className={`p-4 border-2 rounded-lg text-center transition-all hover:shadow-lg ${
              selectedTemplateId === template.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-4xl mb-2">{template.preview}</div>
            <div className="font-semibold mb-1">{template.name}</div>
            <div className="text-xs text-gray-600">{template.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
