/**
 * Email Template Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 3, Task 3.3 (Chunk 3E):
 * HTML email templates for backup restoration links.
 *
 * Features:
 * - Responsive design for all email clients
 * - Clear step-by-step instructions
 * - Security warnings and notices
 * - Branded styling (Audacious Money)
 * - Plain text fallback
 *
 * Security Notes:
 * - Restoration links expire in 7 days
 * - One-time use tokens
 * - Rate limiting enforced
 * - Zero-knowledge encryption explained
 */

/**
 * Email template options
 */
export interface EmailTemplateOptions {
  recipientEmail: string
  restorationUrl: string
  companyName: string
  backupDate: Date
  expirationDate: Date
  backupSizeFormatted: string
}

/**
 * Email template result
 */
export interface EmailTemplateResult {
  html: string
  text: string
  subject: string
}

/**
 * Brand colors for Audacious Money
 */
const BRAND_COLORS = {
  primary: '#2C5F2D', // Forest green
  secondary: '#97BC62', // Sage green
  accent: '#FFB81C', // Warm gold
  text: '#2D3748',
  textLight: '#718096',
  background: '#FFFFFF',
  backgroundAlt: '#F7FAFC',
  border: '#E2E8F0',
  success: '#48BB78',
  warning: '#ED8936',
  danger: '#F56565',
}

/**
 * Generate restoration email template
 *
 * Creates HTML and plain text versions of the backup restoration email.
 *
 * @param options - Email template options
 * @returns Email template result with HTML, text, and subject
 */
export function generateRestorationEmail(
  options: EmailTemplateOptions
): EmailTemplateResult {
  const {
    _recipientEmail,
    _restorationUrl,
    companyName,
    _backupDate,
    _expirationDate,
    _backupSizeFormatted,
  } = options

  const subject = `Your ${companyName} Backup is Ready`

  const html = generateHTMLTemplate(options)
  const text = generatePlainTextTemplate(options)

  return {
    html,
    text,
    subject,
  }
}

/**
 * Generate HTML email template
 *
 * Responsive design with inline CSS for email client compatibility.
 *
 * @param options - Email template options
 * @returns HTML string
 */
function generateHTMLTemplate(options: EmailTemplateOptions): string {
  const {
    recipientEmail,
    restorationUrl,
    companyName,
    backupDate,
    expirationDate,
    backupSizeFormatted,
  } = options

  const backupDateFormatted = formatDate(backupDate)
  const expirationDateFormatted = formatDate(expirationDate)
  const daysUntilExpiration = Math.floor(
    (expirationDate.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  const companyNameEscaped = escapeHtml(companyName)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName} Backup Ready</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      line-height: 1.6;
      color: ${BRAND_COLORS.text};
      background-color: ${BRAND_COLORS.backgroundAlt};
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${BRAND_COLORS.background};
    }
    .header {
      background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: ${BRAND_COLORS.background};
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      color: ${BRAND_COLORS.text};
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      color: ${BRAND_COLORS.textLight};
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .cta-button {
      display: inline-block;
      padding: 16px 32px;
      background-color: ${BRAND_COLORS.primary};
      color: ${BRAND_COLORS.background} !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
      margin: 20px 0;
    }
    .cta-button:hover {
      background-color: ${BRAND_COLORS.secondary};
    }
    .info-box {
      background-color: ${BRAND_COLORS.backgroundAlt};
      border-left: 4px solid ${BRAND_COLORS.accent};
      padding: 20px;
      margin: 30px 0;
      border-radius: 4px;
    }
    .info-box h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: ${BRAND_COLORS.text};
    }
    .info-box p {
      margin: 5px 0;
      font-size: 14px;
      color: ${BRAND_COLORS.textLight};
    }
    .info-box strong {
      color: ${BRAND_COLORS.text};
    }
    .warning-box {
      background-color: #FFF5F5;
      border-left: 4px solid ${BRAND_COLORS.warning};
      padding: 20px;
      margin: 30px 0;
      border-radius: 4px;
    }
    .warning-box h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: ${BRAND_COLORS.warning};
    }
    .warning-box ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .warning-box li {
      font-size: 14px;
      color: ${BRAND_COLORS.textLight};
      margin: 5px 0;
    }
    .steps {
      margin: 30px 0;
    }
    .step {
      display: flex;
      margin: 20px 0;
    }
    .step-number {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      background-color: ${BRAND_COLORS.primary};
      color: ${BRAND_COLORS.background};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      margin-right: 15px;
    }
    .step-content {
      flex: 1;
    }
    .step-content h4 {
      margin: 0 0 5px 0;
      font-size: 16px;
      color: ${BRAND_COLORS.text};
    }
    .step-content p {
      margin: 0;
      font-size: 14px;
      color: ${BRAND_COLORS.textLight};
    }
    .footer {
      background-color: ${BRAND_COLORS.backgroundAlt};
      padding: 30px;
      text-align: center;
      border-top: 1px solid ${BRAND_COLORS.border};
    }
    .footer p {
      margin: 5px 0;
      font-size: 14px;
      color: ${BRAND_COLORS.textLight};
    }
    .footer a {
      color: ${BRAND_COLORS.primary};
      text-decoration: none;
    }
    .security-badge {
      display: inline-block;
      padding: 8px 16px;
      background-color: ${BRAND_COLORS.success};
      color: ${BRAND_COLORS.background};
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 10px;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
      .greeting {
        font-size: 16px;
      }
      .message {
        font-size: 14px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>📦 Your Backup is Ready</h1>
    </div>

    <!-- Content -->
    <div class="content">
      <p class="greeting">Hi there,</p>

      <p class="message">
        Your weekly backup for <strong>${companyNameEscaped}</strong> has been created and is ready whenever you need it. Take your time with this—this backup is securely encrypted and can only be accessed by you.
      </p>

      <!-- Backup Details -->
      <div class="info-box">
        <h3>📋 Backup Details</h3>
        <p><strong>Company:</strong> ${companyNameEscaped}</p>
        <p><strong>Created:</strong> ${backupDateFormatted}</p>
        <p><strong>Size:</strong> ${backupSizeFormatted}</p>
        <p><strong>Expires:</strong> ${expirationDateFormatted} (${daysUntilExpiration} days)</p>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 40px 0;">
        <a href="${restorationUrl}" class="cta-button">
          Access Your Backup
        </a>
        <p style="font-size: 12px; color: ${BRAND_COLORS.textLight}; margin-top: 10px;">
          Or copy this link: <br>
          <span style="word-break: break-all;">${restorationUrl}</span>
        </p>
      </div>

      <!-- How to Restore -->
      <h2 style="font-size: 20px; color: ${BRAND_COLORS.text}; margin: 40px 0 20px 0;">
        How to Restore Your Backup
      </h2>

      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>Click the restoration link</h4>
            <p>Use the button above or copy the link into your browser</p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>Enter your passphrase</h4>
            <p>You'll need your Graceful Books passphrase to decrypt the backup</p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>Choose what to restore</h4>
            <p>Select which data you want to restore to this device</p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">4</div>
          <div class="step-content">
            <h4>You're all set!</h4>
            <p>Your data will be restored and ready to use</p>
          </div>
        </div>
      </div>

      <!-- Security Notice -->
      <div class="warning-box">
        <h3>🔒 Security Notice</h3>
        <ul>
          <li><strong>This link expires in ${daysUntilExpiration} days</strong> (${expirationDateFormatted})</li>
          <li><strong>One-time use only:</strong> The link becomes invalid after use</li>
          <li><strong>Your data is encrypted:</strong> We cannot access your backup without your passphrase</li>
          <li><strong>Don't share this link:</strong> Anyone with this link can access your backup</li>
          <li><strong>Rate limited:</strong> Maximum 5 access attempts per hour</li>
        </ul>
      </div>

      <!-- Zero Knowledge Explanation -->
      <div class="info-box">
        <h3>🛡️ Zero-Knowledge Encryption</h3>
        <p>
          Your backup is encrypted on your device before it ever leaves your computer.
          We never have access to your passphrase or your unencrypted data. This means:
        </p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li style="font-size: 14px; color: ${BRAND_COLORS.textLight}; margin: 5px 0;">
            Only you can decrypt your backup
          </li>
          <li style="font-size: 14px; color: ${BRAND_COLORS.textLight}; margin: 5px 0;">
            Your financial data remains completely private
          </li>
          <li style="font-size: 14px; color: ${BRAND_COLORS.textLight}; margin: 5px 0;">
            We cannot recover your data if you lose your passphrase
          </li>
        </ul>
        <div class="security-badge">🔐 Zero-Knowledge Protected</div>
      </div>

      <!-- Help Text -->
      <p class="message" style="margin-top: 40px;">
        <strong>Need help?</strong> If you didn't request this backup or have questions,
        please contact us at support@gracefulbooks.com
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong>Graceful Books</strong></p>
      <p>Accounting software for entrepreneurs who care</p>
      <p style="margin-top: 20px;">
        <a href="https://gracefulbooks.com/privacy">Privacy Policy</a> ·
        <a href="https://gracefulbooks.com/security">Security</a> ·
        <a href="https://gracefulbooks.com/support">Support</a>
      </p>
      <p style="margin-top: 20px; font-size: 12px;">
        This email was sent to ${recipientEmail}
      </p>
    </div>
  </div>
</body>
</html>
`.trim()
}

/**
 * Generate plain text email template
 *
 * Fallback for email clients that don't support HTML.
 *
 * @param options - Email template options
 * @returns Plain text string
 */
function generatePlainTextTemplate(options: EmailTemplateOptions): string {
  const {
    recipientEmail,
    restorationUrl,
    companyName,
    backupDate,
    expirationDate,
    backupSizeFormatted,
  } = options

  const backupDateFormatted = formatDate(backupDate)
  const expirationDateFormatted = formatDate(expirationDate)
  const daysUntilExpiration = Math.floor(
    (expirationDate.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  return `
YOUR BACKUP IS READY
====================

Hi there,

Your weekly backup for ${companyName} has been created and is ready whenever you need it. This backup is securely encrypted and can only be accessed by you.

BACKUP DETAILS
--------------
Company: ${companyName}
Created: ${backupDateFormatted}
Size: ${backupSizeFormatted}
Expires: ${expirationDateFormatted} (${daysUntilExpiration} days)

RESTORATION LINK
----------------
${restorationUrl}

HOW TO RESTORE YOUR BACKUP
---------------------------

1. Click the restoration link
   Use the link above in your browser

2. Enter your passphrase
   You'll need your Graceful Books passphrase to decrypt the backup

3. Choose what to restore
   Select which data you want to restore to this device

4. You're all set!
   Your data will be restored and ready to use

SECURITY NOTICE
---------------
⚠️ IMPORTANT:

• This link expires in ${daysUntilExpiration} days (${expirationDateFormatted})
• One-time use only: The link becomes invalid after use
• Your data is encrypted: We cannot access your backup without your passphrase
• Don't share this link: Anyone with this link can access your backup
• Rate limited: Maximum 5 access attempts per hour

ZERO-KNOWLEDGE ENCRYPTION
-------------------------
Your backup is encrypted on your device before it ever leaves your computer.
We never have access to your passphrase or your unencrypted data. This means:

• Only you can decrypt your backup
• Your financial data remains completely private
• We cannot recover your data if you lose your passphrase

🔐 Zero-Knowledge Protected

NEED HELP?
----------
If you didn't request this backup or have questions, please contact us at
support@gracefulbooks.com

---
Graceful Books
Accounting software for entrepreneurs who care

Privacy Policy: https://gracefulbooks.com/privacy
Security: https://gracefulbooks.com/security
Support: https://gracefulbooks.com/support

This email was sent to ${recipientEmail}
`.trim()
}

/**
 * Format date for email display
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

/**
 * Validate email template options
 *
 * Ensures all required fields are present and valid.
 *
 * @param options - Email template options
 * @returns Validation result
 */
export function validateEmailTemplateOptions(
  options: EmailTemplateOptions
): { valid: boolean; error?: string } {
  if (!options.recipientEmail) {
    return { valid: false, error: 'Recipient email is required' }
  }

  if (!isValidEmail(options.recipientEmail)) {
    return { valid: false, error: 'Recipient email is invalid' }
  }

  if (!options.restorationUrl) {
    return { valid: false, error: 'Restoration URL is required' }
  }

  if (!isValidUrl(options.restorationUrl)) {
    return { valid: false, error: 'Restoration URL is invalid' }
  }

  if (!options.companyName) {
    return { valid: false, error: 'Company name is required' }
  }

  if (!options.backupDate) {
    return { valid: false, error: 'Backup date is required' }
  }

  if (!options.expirationDate) {
    return { valid: false, error: 'Expiration date is required' }
  }

  if (options.expirationDate <= options.backupDate) {
    return {
      valid: false,
      error: 'Expiration date must be after backup date',
    }
  }

  if (!options.backupSizeFormatted) {
    return { valid: false, error: 'Backup size is required' }
  }

  return { valid: true }
}

/**
 * Validate email address format
 *
 * @param email - Email address to validate
 * @returns True if valid
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate URL format
 *
 * @param url - URL to validate
 * @returns True if valid
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Escape HTML special characters
 *
 * Prevents XSS by escaping HTML entities in user-provided text.
 *
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char)
}

/**
 * Preview email in browser
 *
 * Utility function for testing email templates during development.
 *
 * @param options - Email template options
 * @returns Data URL that can be opened in browser
 */
export function previewEmailInBrowser(options: EmailTemplateOptions): string {
  const { html } = generateRestorationEmail(options)
  const blob = new Blob([html], { type: 'text/html' })
  return URL.createObjectURL(blob)
}
