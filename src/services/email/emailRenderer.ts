/**
 * Email Renderer
 *
 * Per D3: Weekly Email Summary Setup
 * Renders email content to HTML and plain text formats using MJML.
 */

import type { EmailContent, EmailSection, EmailSectionItem } from '../../types/email.types';

/**
 * Render email to HTML using MJML
 * For now, generates inline HTML. In production, would use MJML compiler.
 */
export function renderEmailToHTML(content: EmailContent): string {
  const { greeting, sections, footer, discType } = content;

  // Build HTML sections
  const sectionsHTML = sections
    .sort((a, b) => a.order - b.order)
    .map((section) => renderSection(section))
    .join('\n');

  // Build complete HTML email
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${content.subject.primary}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 0;
    }
    .header {
      background-color: #2D3748;
      color: #ffffff;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .greeting {
      font-size: 18px;
      color: #2D3748;
      margin-bottom: 24px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #2D3748;
      margin-bottom: 12px;
    }
    .section-intro {
      color: #4A5568;
      margin-bottom: 16px;
    }
    .task-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .task-item {
      background-color: #F7FAFC;
      border-left: 4px solid #4299E1;
      padding: 16px;
      margin-bottom: 12px;
      border-radius: 4px;
    }
    .task-item.priority-high {
      border-left-color: #F56565;
    }
    .task-item.priority-medium {
      border-left-color: #ED8936;
    }
    .task-item.priority-low {
      border-left-color: #48BB78;
    }
    .task-title {
      font-size: 16px;
      font-weight: 600;
      color: #2D3748;
      margin-bottom: 4px;
    }
    .task-description {
      font-size: 14px;
      color: #718096;
      margin-bottom: 8px;
    }
    .task-action {
      display: inline-block;
      background-color: #4299E1;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 4px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
    }
    .task-action:hover {
      background-color: #3182CE;
    }
    .tip-box {
      background-color: #EBF8FF;
      border-left: 4px solid #4299E1;
      padding: 16px;
      border-radius: 4px;
      color: #2C5282;
    }
    .progress-bar {
      background-color: #E2E8F0;
      border-radius: 8px;
      height: 24px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .progress-fill {
      background-color: #48BB78;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
    }
    .footer {
      background-color: #F7FAFC;
      padding: 24px;
      text-align: center;
      font-size: 14px;
      color: #718096;
    }
    .footer-links {
      margin-bottom: 16px;
    }
    .footer-link {
      color: #4299E1;
      text-decoration: none;
      margin: 0 12px;
    }
    .footer-link:hover {
      text-decoration: underline;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 24px 16px;
      }
      .header {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <h1>Graceful Books</h1>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Greeting -->
      <div class="greeting">
        ${escapeHTML(greeting)}
      </div>

      <!-- Sections -->
      ${sectionsHTML}
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <a href="${footer.preferencesLink}" class="footer-link">Email Preferences</a>
        <a href="${footer.unsubscribeLink}" class="footer-link">Unsubscribe</a>
      </div>
      <div>
        ${escapeHTML(footer.companyName)} | ${escapeHTML(footer.supportEmail)}
      </div>
      <div style="margin-top: 8px; font-size: 12px;">
        You're receiving this email because you signed up for weekly summaries.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Render individual section to HTML
 */
function renderSection(section: EmailSection): string {
  const { title, content, items } = section;

  let sectionHTML = `
    <div class="section">
      <div class="section-title">${escapeHTML(title)}</div>
      <div class="section-intro">${escapeHTML(content)}</div>
  `;

  // Render items if present
  if (items && items.length > 0) {
    sectionHTML += `<ul class="task-list">`;
    items.forEach((item) => {
      sectionHTML += renderSectionItem(item);
    });
    sectionHTML += `</ul>`;
  }

  sectionHTML += `</div>`;

  return sectionHTML;
}

/**
 * Render individual section item
 */
function renderSectionItem(item: EmailSectionItem): string {
  const priority = item.metadata?.priority as string | undefined;
  const priorityClass = priority ? `priority-${priority}` : '';

  let itemHTML = `
    <li class="task-item ${priorityClass}">
      <div class="task-title">${escapeHTML(item.title)}</div>
  `;

  if (item.description) {
    itemHTML += `<div class="task-description">${escapeHTML(item.description)}</div>`;
  }

  if (item.actionLink && item.actionText) {
    itemHTML += `
      <a href="${escapeHTML(item.actionLink)}" class="task-action">
        ${escapeHTML(item.actionText)}
      </a>
    `;
  }

  itemHTML += `</li>`;

  return itemHTML;
}

/**
 * Render email to plain text
 */
export function renderEmailToPlainText(content: EmailContent): string {
  const { greeting, sections, footer } = content;

  let text = `${greeting}\n\n`;

  // Render sections
  sections
    .sort((a, b) => a.order - b.order)
    .forEach((section) => {
      text += `${section.title}\n`;
      text += `${'-'.repeat(section.title.length)}\n`;
      text += `${section.content}\n\n`;

      if (section.items && section.items.length > 0) {
        section.items.forEach((item, index) => {
          text += `${index + 1}. ${item.title}\n`;
          if (item.description) {
            text += `   ${item.description}\n`;
          }
          if (item.actionLink) {
            text += `   Link: ${item.actionLink}\n`;
          }
          text += '\n';
        });
      }

      text += '\n';
    });

  // Add footer
  text += `\n${'='.repeat(60)}\n\n`;
  text += `${footer.companyName}\n`;
  text += `Support: ${footer.supportEmail}\n\n`;
  text += `Email Preferences: ${footer.preferencesLink}\n`;
  text += `Unsubscribe: ${footer.unsubscribeLink}\n`;

  return text;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHTML(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Generate email preview for UI display
 */
export function generateEmailPreviewHTML(content: EmailContent): string {
  // Same as renderEmailToHTML, but with additional preview styling
  const html = renderEmailToHTML(content);

  // Wrap in preview container
  return `
    <div style="background-color: #f5f5f5; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        ${html}
      </div>
    </div>
  `;
}
