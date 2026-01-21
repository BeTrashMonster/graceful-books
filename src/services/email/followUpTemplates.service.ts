/**
 * Email Follow-Up Templates Service
 *
 * Provides email templates for invoice follow-ups with DISC-adapted messaging.
 * Part of F5 - A/R Aging Report implementation.
 *
 * Features:
 * - Three template types: polite reminder, formal notice, urgent follow-up
 * - DISC personality adaptation (D, I, S, C variants)
 * - Variable substitution for personalization
 * - Plain-text and HTML variants
 *
 * Requirements:
 * - DISC-adapted communication (CLAUDE.md)
 * - F5: Email follow-up templates for overdue invoices
 */

import type { EmailFollowUpTemplate, EmailFollowUpTemplateContent } from '../../types/reports.types'

/**
 * DISC profile type
 */
export type DISCProfile = 'D' | 'I' | 'S' | 'C'

/**
 * Follow-up template type
 */
export type FollowUpTemplateType = 'polite-reminder' | 'formal-notice' | 'urgent-follow-up'

/**
 * Template variables for personalization
 */
export interface TemplateVariables {
  customerName: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  amountDue: string
  daysOverdue: number
  companyName: string
  contactEmail?: string
  contactPhone?: string
  paymentLink?: string
}

/**
 * DISC-adapted template content
 */
interface DISCTemplateContent {
  D: { subject: string; body: string }
  I: { subject: string; body: string }
  S: { subject: string; body: string }
  C: { subject: string; body: string }
}

/**
 * Polite Reminder Templates (1-30 days overdue)
 * Gentle, friendly tone assuming good faith
 */
const POLITE_REMINDER_TEMPLATES: DISCTemplateContent = {
  // Dominance: Direct, results-oriented
  D: {
    subject: 'Invoice {{invoiceNumber}} - Payment Due',
    body: `Hi {{customerName}},

Invoice {{invoiceNumber}} for {{amountDue}} is now {{daysOverdue}} days past due (due date: {{dueDate}}).

Please submit payment to keep your account current.

{{paymentLink}}

Questions? Reply to this email or contact us at {{contactEmail}}{{contactPhone}}.

{{companyName}}`,
  },

  // Influence: Warm, collaborative
  I: {
    subject: 'Friendly reminder about Invoice {{invoiceNumber}}',
    body: `Hi {{customerName}}!

I hope you're doing well! I wanted to reach out about Invoice {{invoiceNumber}} for {{amountDue}}, which was due on {{dueDate}}.

I know things get busy - just wanted to make sure this didn't slip through the cracks!

{{paymentLink}}

If you have any questions or need to discuss payment arrangements, I'm here to help. Just reply to this email at {{contactEmail}} or give me a call at {{contactPhone}}.

Looking forward to hearing from you!

{{companyName}}`,
  },

  // Steadiness: Patient, supportive
  S: {
    subject: 'Gentle reminder: Invoice {{invoiceNumber}}',
    body: `Dear {{customerName}},

I hope this message finds you well. I wanted to gently remind you about Invoice {{invoiceNumber}} for {{amountDue}}, which was due on {{dueDate}}.

I understand that sometimes invoices can be overlooked in busy schedules. If there's anything I can help clarify or if you need assistance with payment, please don't hesitate to reach out.

{{paymentLink}}

We're here to support you and make this process as smooth as possible. You can reach us at {{contactEmail}} or {{contactPhone}}.

Warm regards,
{{companyName}}`,
  },

  // Conscientiousness: Analytical, precise
  C: {
    subject: 'Payment Reminder: Invoice {{invoiceNumber}} - Due {{dueDate}}',
    body: `Dear {{customerName}},

This is a courtesy reminder regarding Invoice {{invoiceNumber}}.

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Invoice Date: {{invoiceDate}}
- Due Date: {{dueDate}}
- Amount Due: {{amountDue}}
- Days Overdue: {{daysOverdue}}

{{paymentLink}}

If payment has already been sent, please disregard this message. If you have questions about this invoice or need a copy of the original, please contact us at {{contactEmail}} or {{contactPhone}}.

Thank you for your attention to this matter.

Sincerely,
{{companyName}}`,
  },
}

/**
 * Formal Notice Templates (31-60 days overdue)
 * More serious tone while maintaining professionalism
 */
const FORMAL_NOTICE_TEMPLATES: DISCTemplateContent = {
  // Dominance: Direct, action-oriented
  D: {
    subject: 'PAST DUE: Invoice {{invoiceNumber}} - Action Required',
    body: `{{customerName}},

Invoice {{invoiceNumber}} for {{amountDue}} is now {{daysOverdue}} days overdue.

Action required: Submit payment immediately to avoid account restrictions.

{{paymentLink}}

If payment has been sent, confirm via reply. Otherwise, contact us today at {{contactEmail}} or {{contactPhone}} to resolve.

{{companyName}}`,
  },

  // Influence: Firm but friendly
  I: {
    subject: 'Important: Invoice {{invoiceNumber}} needs your attention',
    body: `Hi {{customerName}},

I wanted to reach out personally because Invoice {{invoiceNumber}} for {{amountDue}} is now {{daysOverdue}} days past due.

I really value our working relationship, and I'd love to work together to get this resolved. Can we find a solution that works for both of us?

{{paymentLink}}

If there's a reason this hasn't been paid, let's talk about it. I'm confident we can figure something out together. Reach me at {{contactEmail}} or {{contactPhone}}.

Please get back to me this week so we can move forward.

Best regards,
{{companyName}}`,
  },

  // Steadiness: Caring but firm
  S: {
    subject: 'Important Notice: Invoice {{invoiceNumber}} - {{daysOverdue}} days past due',
    body: `Dear {{customerName}},

I'm reaching out because Invoice {{invoiceNumber}} for {{amountDue}} is now {{daysOverdue}} days past due, and I want to make sure we address this together.

I understand that circumstances can change, and I'm here to help find a solution that works for you. If you're experiencing any difficulties with payment, please let me know so we can discuss options.

{{paymentLink}}

Your partnership is important to us, and we want to work with you to resolve this matter. Please contact me at {{contactEmail}} or {{contactPhone}} within the next few days so we can move forward together.

With appreciation,
{{companyName}}`,
  },

  // Conscientiousness: Professional, detailed
  C: {
    subject: 'Formal Notice: Invoice {{invoiceNumber}} - {{daysOverdue}} Days Past Due',
    body: `Dear {{customerName}},

This is a formal notice regarding Invoice {{invoiceNumber}}, which is now significantly past due.

Account Status:
- Invoice Number: {{invoiceNumber}}
- Original Due Date: {{dueDate}}
- Amount Outstanding: {{amountDue}}
- Days Past Due: {{daysOverdue}}
- Current Status: OVERDUE

{{paymentLink}}

To maintain your account in good standing, payment must be received within 7 business days. If there are extenuating circumstances or billing discrepancies, please provide documentation via reply to {{contactEmail}} or by calling {{contactPhone}}.

If payment has been processed, please provide confirmation (check number, transaction ID, or payment date) to update our records accordingly.

Respectfully,
{{companyName}}`,
  },
}

/**
 * Urgent Follow-Up Templates (60+ days overdue)
 * Serious tone, final notice
 */
const URGENT_FOLLOWUP_TEMPLATES: DISCTemplateContent = {
  // Dominance: Very direct, consequences clear
  D: {
    subject: 'URGENT: Invoice {{invoiceNumber}} - Final Notice',
    body: `{{customerName}},

Final notice: Invoice {{invoiceNumber}} for {{amountDue}} is {{daysOverdue}} days overdue.

Payment required within 48 hours. Failure to respond will result in:
- Account suspension
- Collections referral
- Potential legal action

{{paymentLink}}

Contact us immediately at {{contactEmail}} or {{contactPhone}} to resolve.

{{companyName}}`,
  },

  // Influence: Serious but still relationship-focused
  I: {
    subject: 'Urgent: We need to resolve Invoice {{invoiceNumber}}',
    body: `{{customerName}},

I need your immediate attention on Invoice {{invoiceNumber}} for {{amountDue}}, which is now {{daysOverdue}} days past due.

I've reached out several times, and I really want to help resolve this, but I need you to work with me. Our accounting team is requiring action on this account.

{{paymentLink}}

Please - let's talk this week and find a path forward. I'd much rather work this out together than escalate to collections. Call me at {{contactPhone}} or email {{contactEmail}}.

Can you respond by end of day Friday?

Sincerely,
{{companyName}}`,
  },

  // Steadiness: Regretful but firm
  S: {
    subject: 'Urgent Attention Required: Invoice {{invoiceNumber}}',
    body: `Dear {{customerName}},

I'm writing with concern about Invoice {{invoiceNumber}} for {{amountDue}}, which has been outstanding for {{daysOverdue}} days.

Despite previous reminders, this invoice remains unpaid. While I understand that situations can be complex, I must respectfully ask for your immediate attention to this matter.

{{paymentLink}}

I truly value our relationship and would prefer to resolve this amicably. However, if I don't hear from you within 5 business days, I will be required to escalate this to our collections department.

Please reach out at {{contactEmail}} or {{contactPhone}} so we can work together to resolve this.

Respectfully,
{{companyName}}`,
  },

  // Conscientiousness: Formal, legal language
  C: {
    subject: 'FINAL NOTICE: Invoice {{invoiceNumber}} - Immediate Payment Required',
    body: `Dear {{customerName}},

This is a FINAL NOTICE regarding Invoice {{invoiceNumber}}.

Outstanding Balance Summary:
- Invoice Number: {{invoiceNumber}}
- Original Invoice Date: {{invoiceDate}}
- Original Due Date: {{dueDate}}
- Amount Due: {{amountDue}}
- Days Past Due: {{daysOverdue}}
- Account Status: SEVERELY DELINQUENT

{{paymentLink}}

REQUIRED ACTION: Full payment must be received within 5 business days of this notice (by [specific date]).

CONSEQUENCES OF NON-PAYMENT:
1. Account will be referred to collections agency
2. Late fees and interest may be applied per contract terms
3. Credit reporting agencies may be notified
4. Legal action may be initiated to recover outstanding balance

If payment has been submitted, provide immediate confirmation with transaction details to {{contactEmail}} or {{contactPhone}}. If there is a legitimate dispute regarding this invoice, provide written documentation within 3 business days.

This is a business matter that requires immediate resolution. Please treat it with appropriate urgency.

{{companyName}}
[Account Management]`,
  },
}

/**
 * Get email template based on type and DISC profile
 *
 * @param templateType - Template type (polite-reminder, formal-notice, urgent-follow-up)
 * @param discProfile - DISC profile (D, I, S, C)
 * @param variables - Template variables for substitution
 * @returns Complete email template with variables substituted
 */
export function getFollowUpTemplate(
  templateType: FollowUpTemplateType,
  discProfile: DISCProfile,
  variables: TemplateVariables
): EmailFollowUpTemplateContent {
  // Select template set based on type
  let templateSet: DISCTemplateContent
  switch (templateType) {
    case 'polite-reminder':
      templateSet = POLITE_REMINDER_TEMPLATES
      break
    case 'formal-notice':
      templateSet = FORMAL_NOTICE_TEMPLATES
      break
    case 'urgent-follow-up':
      templateSet = URGENT_FOLLOWUP_TEMPLATES
      break
  }

  // Get template for DISC profile
  const template = templateSet[discProfile]

  // Substitute variables
  let subject = template.subject
  let body = template.body

  // Replace all variable placeholders
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    subject = subject.replace(new RegExp(placeholder, 'g'), String(value))
    body = body.replace(new RegExp(placeholder, 'g'), String(value))
  })

  // Handle optional variables
  if (!variables.paymentLink) {
    body = body.replace(/{{paymentLink}}\n?\n?/g, '')
  }

  return {
    templateId: templateType,
    subject,
    body,
    variables,
  }
}

/**
 * Get template preview (for testing/UI display)
 *
 * @param templateType - Template type
 * @param discProfile - DISC profile
 * @returns Template with placeholder variables
 */
export function getTemplatePreview(
  templateType: FollowUpTemplateType,
  discProfile: DISCProfile
): { subject: string; body: string } {
  let templateSet: DISCTemplateContent
  switch (templateType) {
    case 'polite-reminder':
      templateSet = POLITE_REMINDER_TEMPLATES
      break
    case 'formal-notice':
      templateSet = FORMAL_NOTICE_TEMPLATES
      break
    case 'urgent-follow-up':
      templateSet = URGENT_FOLLOWUP_TEMPLATES
      break
  }

  return templateSet[discProfile]
}

/**
 * Get all available templates for a DISC profile
 *
 * @param discProfile - DISC profile
 * @returns Array of all template types with previews
 */
export function getAllTemplatesForProfile(discProfile: DISCProfile): Array<{
  templateType: FollowUpTemplateType
  subject: string
  body: string
}> {
  return [
    {
      templateType: 'polite-reminder',
      ...POLITE_REMINDER_TEMPLATES[discProfile],
    },
    {
      templateType: 'formal-notice',
      ...FORMAL_NOTICE_TEMPLATES[discProfile],
    },
    {
      templateType: 'urgent-follow-up',
      ...URGENT_FOLLOWUP_TEMPLATES[discProfile],
    },
  ]
}

/**
 * Format template variables from invoice data
 *
 * @param invoice - Invoice data
 * @param customer - Customer data
 * @param company - Company data
 * @returns Formatted template variables
 */
export function formatTemplateVariables(
  invoice: {
    invoice_number: string
    invoice_date: number
    due_date: number
    total: string
  },
  customer: { name: string; email?: string },
  company: { name: string; email?: string; phone?: string },
  asOfDate: Date = new Date()
): TemplateVariables {
  const daysOverdue = Math.max(
    0,
    Math.floor((asOfDate.getTime() - invoice.due_date) / (24 * 60 * 60 * 1000))
  )

  return {
    customerName: customer.name,
    invoiceNumber: invoice.invoice_number,
    invoiceDate: new Date(invoice.invoice_date).toLocaleDateString('en-US', { timeZone: 'UTC' }),
    dueDate: new Date(invoice.due_date).toLocaleDateString('en-US', { timeZone: 'UTC' }),
    amountDue: `$${parseFloat(invoice.total).toFixed(2)}`,
    daysOverdue,
    companyName: company.name,
    contactEmail: company.email,
    contactPhone: company.phone,
  }
}
