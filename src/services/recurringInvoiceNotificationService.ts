/**
 * Recurring Invoice Notification Service
 *
 * Handles customer notifications for auto-sent recurring invoices.
 * Integrates with the existing email service for delivery.
 *
 * Requirements:
 * - E4: Recurring Invoices - Customer notifications
 * - DISC-adapted messaging
 * - Professional invoice delivery emails
 */

import type { RecurringInvoice } from '../db/schema/recurringInvoices.schema';
import type { Invoice } from '../db/schema/invoices.schema';
import { getRecurringInvoice } from '../store/recurringInvoices';
import { getInvoice } from '../store/invoices';
import type { EncryptionContext } from '../store/types';
import { logger } from '../utils/logger';
import type { DISCType } from '../features/messaging/messageLibrary';

const notificationLogger = logger.child('RecurringInvoiceNotification');

/**
 * Invoice notification email template
 */
export interface InvoiceNotificationEmail {
  subject: string;
  htmlContent: string;
  textContent: string;
  recipientEmail: string;
  recipientName: string;
  invoiceId: string;
  invoiceNumber: string;
}

/**
 * Generate invoice notification email
 */
export async function generateInvoiceNotificationEmail(
  invoiceId: string,
  customerEmail: string,
  customerName: string,
  discType: DISCType = 'S',
  context?: EncryptionContext
): Promise<InvoiceNotificationEmail | null> {
  try {
    // Get invoice
    const invoiceResult = await getInvoice(invoiceId, context);
    if (!invoiceResult.success) {
      notificationLogger.error('Failed to get invoice for notification', {
        invoiceId,
        error: invoiceResult.error,
      });
      return null;
    }

    const invoice = invoiceResult.data;

    // Generate DISC-adapted message
    const message = getInvoiceNotificationMessage(invoice, discType);

    // Build email
    const email: InvoiceNotificationEmail = {
      subject: message.subject,
      htmlContent: buildHtmlEmail(invoice, customerName, message),
      textContent: buildTextEmail(invoice, customerName, message),
      recipientEmail: customerEmail,
      recipientName: customerName,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
    };

    return email;
  } catch (error) {
    notificationLogger.error('Failed to generate invoice notification email', {
      error,
      invoiceId,
    });
    return null;
  }
}

/**
 * Get DISC-adapted invoice notification message
 */
function getInvoiceNotificationMessage(
  invoice: Invoice,
  discType: DISCType
): {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  callToAction: string;
} {
  const amount = `$${parseFloat(invoice.total).toFixed(2)}`;
  const dueDate = new Date(invoice.due_date).toLocaleDateString();

  switch (discType) {
    case 'D': // Dominance - Direct and concise
      return {
        subject: `Invoice ${invoice.invoice_number} - ${amount} Due ${dueDate}`,
        greeting: 'Hi,',
        body: `Invoice ${invoice.invoice_number} is ready. Amount: ${amount}. Due: ${dueDate}.`,
        closing: 'Thanks.',
        callToAction: 'View Invoice',
      };

    case 'I': // Influence - Warm and friendly
      return {
        subject: `Your Invoice is Ready - ${invoice.invoice_number}`,
        greeting: `Hi ${invoice.customer_id}!`,
        body: `We're sending along your invoice ${invoice.invoice_number} for ${amount}. Your payment is due on ${dueDate}. We really appreciate your business!`,
        closing: 'Thanks so much!',
        callToAction: 'View Your Invoice',
      };

    case 'C': // Conscientiousness - Detailed and precise
      return {
        subject: `Invoice ${invoice.invoice_number} - Payment Due ${dueDate}`,
        greeting: 'Hello,',
        body: `This email contains your invoice ${invoice.invoice_number} dated ${new Date(invoice.invoice_date).toLocaleDateString()}. The total amount of ${amount} is due on ${dueDate}. Please review the attached invoice for itemized details.`,
        closing: 'Sincerely,',
        callToAction: 'View Invoice Details',
      };

    case 'S': // Steadiness - Supportive and patient (default)
    default:
      return {
        subject: `Invoice ${invoice.invoice_number} - ${amount}`,
        greeting: 'Hello,',
        body: `We're sending your invoice ${invoice.invoice_number} for ${amount}. Payment is due on ${dueDate}. If you have any questions about this invoice, please don't hesitate to reach out. We're here to help.`,
        closing: 'Thank you,',
        callToAction: 'View Invoice',
      };
  }
}

/**
 * Build HTML email content
 */
function buildHtmlEmail(
  invoice: Invoice,
  customerName: string,
  message: {
    subject: string;
    greeting: string;
    body: string;
    closing: string;
    callToAction: string;
  }
): string {
  const amount = `$${parseFloat(invoice.total).toFixed(2)}`;
  const dueDate = new Date(invoice.due_date).toLocaleDateString();
  const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${message.subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e0e0e0;
      border-top: none;
    }
    .invoice-details {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #666;
    }
    .detail-value {
      color: #333;
    }
    .amount {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 14px;
      background: #f8f9fa;
      border-radius: 0 0 8px 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Invoice ${invoice.invoice_number}</h1>
  </div>

  <div class="content">
    <p>${message.greeting}</p>
    <p>${message.body}</p>

    <div class="invoice-details">
      <div class="detail-row">
        <span class="detail-label">Invoice Number:</span>
        <span class="detail-value">${invoice.invoice_number}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Invoice Date:</span>
        <span class="detail-value">${invoiceDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Due Date:</span>
        <span class="detail-value">${dueDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount Due:</span>
        <span class="detail-value amount">${amount}</span>
      </div>
    </div>

    <center>
      <a href="#" class="cta-button">${message.callToAction}</a>
    </center>

    ${invoice.notes ? `<p><em>Note: ${invoice.notes}</em></p>` : ''}

    <p>${message.closing}</p>
  </div>

  <div class="footer">
    <p>This invoice was sent automatically from Graceful Books.</p>
    <p>Questions? Contact us and we'll be happy to help.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Build plain text email content
 */
function buildTextEmail(
  invoice: Invoice,
  customerName: string,
  message: {
    subject: string;
    greeting: string;
    body: string;
    closing: string;
    callToAction: string;
  }
): string {
  const amount = `$${parseFloat(invoice.total).toFixed(2)}`;
  const dueDate = new Date(invoice.due_date).toLocaleDateString();
  const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString();

  return `
${message.subject}

${message.greeting}

${message.body}

Invoice Details:
----------------
Invoice Number: ${invoice.invoice_number}
Invoice Date: ${invoiceDate}
Due Date: ${dueDate}
Amount Due: ${amount}

${invoice.notes ? `\nNote: ${invoice.notes}\n` : ''}

${message.closing}

---
This invoice was sent automatically from Graceful Books.
Questions? Contact us and we'll be happy to help.
  `.trim();
}

/**
 * Send invoice notification
 * MOCKED: In production, this would integrate with email service
 */
export async function sendInvoiceNotification(
  invoiceId: string,
  customerEmail: string,
  customerName: string,
  discType: DISCType = 'S',
  context?: EncryptionContext
): Promise<{ success: boolean; message: string; messageId?: string }> {
  try {
    // Generate email
    const email = await generateInvoiceNotificationEmail(
      invoiceId,
      customerEmail,
      customerName,
      discType,
      context
    );

    if (!email) {
      return {
        success: false,
        message: 'Failed to generate notification email',
      };
    }

    // MOCKED: In production, send via email service (SendGrid, AWS SES, etc.)
    notificationLogger.info('Sending invoice notification (MOCKED)', {
      invoiceId,
      customerEmail,
      subject: email.subject,
    });

    // Simulate sending delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // In production:
    // - Call email service API
    // - Handle authentication and rate limits
    // - Track delivery status
    // - Handle bounces and failures
    // - Provide message ID for tracking

    return {
      success: true,
      message: 'Invoice notification sent successfully',
      messageId: `mock-${Date.now()}-${invoiceId}`,
    };
  } catch (error) {
    notificationLogger.error('Failed to send invoice notification', {
      error,
      invoiceId,
      customerEmail,
    });

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send recurring invoice reminder
 * Sends a reminder N days before the due date
 */
export async function sendInvoiceReminder(
  invoiceId: string,
  customerEmail: string,
  customerName: string,
  daysUntilDue: number,
  discType: DISCType = 'S',
  context?: EncryptionContext
): Promise<{ success: boolean; message: string }> {
  try {
    // Get invoice
    const invoiceResult = await getInvoice(invoiceId, context);
    if (!invoiceResult.success) {
      return {
        success: false,
        message: 'Invoice not found',
      };
    }

    const invoice = invoiceResult.data;
    const amount = `$${parseFloat(invoice.total).toFixed(2)}`;

    // Generate DISC-adapted reminder message
    const message = getReminderMessage(invoice, daysUntilDue, discType);

    notificationLogger.info('Sending invoice reminder (MOCKED)', {
      invoiceId,
      customerEmail,
      daysUntilDue,
    });

    // MOCKED: In production, send via email service
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      message: 'Invoice reminder sent successfully',
    };
  } catch (error) {
    notificationLogger.error('Failed to send invoice reminder', {
      error,
      invoiceId,
      customerEmail,
    });

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get DISC-adapted reminder message
 */
function getReminderMessage(
  invoice: Invoice,
  daysUntilDue: number,
  discType: DISCType
): { subject: string; body: string } {
  const amount = `$${parseFloat(invoice.total).toFixed(2)}`;
  const dueDate = new Date(invoice.due_date).toLocaleDateString();

  switch (discType) {
    case 'D': // Dominance - Direct
      return {
        subject: `Reminder: Invoice ${invoice.invoice_number} Due in ${daysUntilDue} Days`,
        body: `Invoice ${invoice.invoice_number} for ${amount} is due on ${dueDate} (${daysUntilDue} days).`,
      };

    case 'I': // Influence - Friendly
      return {
        subject: `Friendly Reminder: Invoice ${invoice.invoice_number}`,
        body: `Just a friendly heads up! Your invoice ${invoice.invoice_number} for ${amount} is coming due on ${dueDate}. That's in ${daysUntilDue} days. Thanks for staying on top of this!`,
      };

    case 'C': // Conscientiousness - Detailed
      return {
        subject: `Payment Reminder: Invoice ${invoice.invoice_number} Due ${dueDate}`,
        body: `This is a reminder that invoice ${invoice.invoice_number} in the amount of ${amount} is scheduled for payment on ${dueDate}, which is ${daysUntilDue} days from today. Please ensure timely payment to avoid any late fees.`,
      };

    case 'S': // Steadiness - Supportive (default)
    default:
      return {
        subject: `Reminder: Invoice ${invoice.invoice_number} Payment Due Soon`,
        body: `We wanted to remind you that invoice ${invoice.invoice_number} for ${amount} is due on ${dueDate}. That's coming up in ${daysUntilDue} days. If you have any questions or need help, please let us know.`,
      };
  }
}
