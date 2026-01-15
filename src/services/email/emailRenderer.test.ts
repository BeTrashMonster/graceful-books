/**
 * Email Renderer Tests
 *
 * Comprehensive tests for D3: Weekly Email Summary Setup
 * Tests HTML and plain text rendering, escaping, and formatting
 */

import { describe, it, expect } from 'vitest';
import {
  renderEmailToHTML,
  renderEmailToPlainText,
  generateEmailPreviewHTML,
} from './emailRenderer';
import type { EmailContent, EmailSection, EmailSectionItem } from '../../types/email.types';

/**
 * Create mock email content
 */
function createMockEmailContent(customizations?: Partial<EmailContent>): EmailContent {
  return {
    subject: {
      primary: 'Your Week Ahead: Small Steps, Big Progress',
      fallback: 'Weekly Summary',
    },
    preheader: 'You have 3 tasks this week',
    greeting: 'Hi Test User, here\'s what\'s on deck this week.',
    sections: [
      {
        type: 'checklist-summary',
        title: 'Your Tasks This Week',
        content: 'Here are your top priorities for the week.',
        items: [
          {
            id: 'task-1',
            title: 'Set up chart of accounts',
            description: 'Create your account structure',
            actionLink: '/chart-of-accounts',
            actionText: 'Take a look',
            metadata: {
              priority: 'high',
              category: 'foundation',
            },
          },
          {
            id: 'task-2',
            title: 'Reconcile transactions',
            description: 'Match your bank records',
            actionLink: '/reconciliation',
            actionText: 'Take a look',
            metadata: {
              priority: 'medium',
            },
          },
        ],
        order: 1,
      },
      {
        type: 'quick-tips',
        title: 'Helpful Insight',
        content: 'Reconciling weekly catches errors when they\'re easy to fix.',
        order: 2,
      },
    ],
    footer: {
      unsubscribeLink: '/email/unsubscribe?userId=test-user',
      preferencesLink: '/settings/email-preferences',
      companyName: 'Test Company LLC',
      supportEmail: 'support@gracefulbooks.com',
    },
    discType: 'S',
    ...customizations,
  };
}

describe('Email Renderer', () => {
  describe('renderEmailToHTML', () => {
    it('should render complete HTML email', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
      expect(html).toContain('Graceful Books');
    });

    it('should render greeting', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      // Greeting should be HTML-escaped (apostrophes become &#39;)
      expect(html).toContain('Hi Test User, here&#39;s what&#39;s on deck this week.');
      expect(html).toContain('class="greeting"');
    });

    it('should render sections in order', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('Your Tasks This Week');
      expect(html).toContain('Helpful Insight');

      // First section should appear before second
      const firstIndex = html.indexOf('Your Tasks This Week');
      const secondIndex = html.indexOf('Helpful Insight');
      expect(firstIndex).toBeLessThan(secondIndex);
    });

    it('should render section titles', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('class="section-title"');
      expect(html).toContain('Your Tasks This Week');
      expect(html).toContain('Helpful Insight');
    });

    it('should render section content/intro', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('Here are your top priorities for the week');
      expect(html).toContain('class="section-intro"');
    });

    it('should render task items with correct structure', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('class="task-list"');
      expect(html).toContain('class="task-item');
      expect(html).toContain('Set up chart of accounts');
      expect(html).toContain('Reconcile transactions');
    });

    it('should apply priority classes to tasks', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('priority-high');
      expect(html).toContain('priority-medium');
    });

    it('should render task descriptions', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('Create your account structure');
      expect(html).toContain('Match your bank records');
      expect(html).toContain('class="task-description"');
    });

    it('should render action links', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('href="/chart-of-accounts"');
      expect(html).toContain('class="task-action"');
      expect(html).toContain('Take a look');
    });

    it('should render footer with all elements', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('class="footer"');
      expect(html).toContain('Test Company LLC');
      expect(html).toContain('support@gracefulbooks.com');
      expect(html).toContain('/settings/email-preferences');
      expect(html).toContain('/email/unsubscribe');
    });

    it('should escape HTML in user content', () => {
      const content = createMockEmailContent({
        greeting: 'Hi <script>alert("xss")</script> User',
        sections: [
          {
            type: 'checklist-summary',
            title: 'Tasks <b>Bold</b>',
            content: 'Content & stuff',
            order: 1,
          },
        ],
      });

      const html = renderEmailToHTML(content);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
    });

    it('should include responsive meta tags', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('viewport');
      expect(html).toContain('width=device-width');
      expect(html).toContain('IE=edge');
    });

    it('should include CSS styles', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('<style>');
      expect(html).toContain('email-container');
      expect(html).toContain('max-width: 600px');
      expect(html).toContain('@media only screen');
    });

    it('should handle sections without items', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      // Quick tips section has no items
      expect(html).toContain('Helpful Insight');
      // Should not render empty task list
      const tipsSection = html.substring(
        html.indexOf('Helpful Insight'),
        html.indexOf('Helpful Insight') + 500
      );
      expect(tipsSection).not.toContain('<ul class="task-list">');
    });

    it('should handle empty sections array', () => {
      const content = createMockEmailContent({ sections: [] });
      const html = renderEmailToHTML(content);

      expect(html).toContain('<!DOCTYPE html>');
      // Greeting should be HTML-escaped (apostrophes become &#39;)
      expect(html).toContain('Hi Test User, here&#39;s what&#39;s on deck this week.');
      expect(html).toContain(content.footer.companyName);
    });

    it('should render subject in title tag', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain(`<title>${content.subject.primary}</title>`);
    });
  });

  describe('renderEmailToPlainText', () => {
    it('should render plain text email', () => {
      const content = createMockEmailContent();
      const text = renderEmailToPlainText(content);

      expect(text).toContain(content.greeting);
      expect(text).toContain('Your Tasks This Week');
      expect(text).toContain('Helpful Insight');
      expect(text).toContain(content.footer.companyName);
    });

    it('should use underlines for section headers', () => {
      const content = createMockEmailContent();
      const text = renderEmailToPlainText(content);

      expect(text).toContain('Your Tasks This Week');
      expect(text).toContain('--------------------'); // Underline (20 chars to match title length)
    });

    it('should render tasks as numbered list', () => {
      const content = createMockEmailContent();
      const text = renderEmailToPlainText(content);

      expect(text).toContain('1. Set up chart of accounts');
      expect(text).toContain('2. Reconcile transactions');
    });

    it('should include task descriptions', () => {
      const content = createMockEmailContent();
      const text = renderEmailToPlainText(content);

      expect(text).toContain('Create your account structure');
      expect(text).toContain('Match your bank records');
    });

    it('should include action links', () => {
      const content = createMockEmailContent();
      const text = renderEmailToPlainText(content);

      expect(text).toContain('Link: /chart-of-accounts');
      expect(text).toContain('Link: /reconciliation');
    });

    it('should include footer links', () => {
      const content = createMockEmailContent();
      const text = renderEmailToPlainText(content);

      expect(text).toContain('Email Preferences:');
      expect(text).toContain('Unsubscribe:');
      expect(text).toContain('/settings/email-preferences');
      expect(text).toContain('/email/unsubscribe');
    });

    it('should format footer with separator', () => {
      const content = createMockEmailContent();
      const text = renderEmailToPlainText(content);

      expect(text).toContain('='.repeat(60));
      expect(text).toContain('Support:');
    });

    it('should not include HTML tags', () => {
      const content = createMockEmailContent();
      const text = renderEmailToPlainText(content);

      expect(text).not.toContain('<');
      expect(text).not.toContain('>');
      expect(text).not.toContain('&lt;');
      expect(text).not.toContain('class=');
    });

    it('should handle sections without items', () => {
      const content = createMockEmailContent();
      const text = renderEmailToPlainText(content);

      // Quick tips section should render without list
      expect(text).toContain('Helpful Insight');
      expect(text).toContain('Reconciling weekly catches errors');
    });

    it('should maintain readability with proper spacing', () => {
      const content = createMockEmailContent();
      const text = renderEmailToPlainText(content);

      // Should have double newlines between sections
      expect(text).toContain('\n\n');
      // Should have indentation for descriptions
      expect(text).toContain('   ');
    });
  });

  describe('generateEmailPreviewHTML', () => {
    it('should wrap email in preview container', () => {
      const content = createMockEmailContent();
      const preview = generateEmailPreviewHTML(content);

      expect(preview).toContain('background-color: #f5f5f5');
      expect(preview).toContain('padding: 20px');
      expect(preview).toContain('box-shadow');
    });

    it('should include complete email HTML', () => {
      const content = createMockEmailContent();
      const preview = generateEmailPreviewHTML(content);

      expect(preview).toContain('<!DOCTYPE html>');
      // Greeting should be HTML-escaped (apostrophes become &#39;)
      expect(preview).toContain('Hi Test User, here&#39;s what&#39;s on deck this week.');
      expect(preview).toContain(content.footer.companyName);
    });

    it('should have preview-specific styling', () => {
      const content = createMockEmailContent();
      const preview = generateEmailPreviewHTML(content);

      // Should have outer wrapper that regular email doesn't have
      const regularHtml = renderEmailToHTML(content);
      expect(preview.length).toBeGreaterThan(regularHtml.length);
      expect(preview).toContain(regularHtml);
    });
  });

  describe('HTML escaping', () => {
    it('should escape ampersands', () => {
      const content = createMockEmailContent({
        greeting: 'Ben & Jerry',
      });
      const html = renderEmailToHTML(content);

      expect(html).toContain('Ben &amp; Jerry');
      expect(html).not.toContain('Ben & Jerry');
    });

    it('should escape less than signs', () => {
      const content = createMockEmailContent({
        greeting: '5 < 10',
      });
      const html = renderEmailToHTML(content);

      expect(html).toContain('5 &lt; 10');
    });

    it('should escape greater than signs', () => {
      const content = createMockEmailContent({
        greeting: '10 > 5',
      });
      const html = renderEmailToHTML(content);

      expect(html).toContain('10 &gt; 5');
    });

    it('should escape quotes', () => {
      const content = createMockEmailContent({
        greeting: 'He said "hello"',
      });
      const html = renderEmailToHTML(content);

      expect(html).toContain('He said &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      const content = createMockEmailContent({
        greeting: "It's working",
      });
      const html = renderEmailToHTML(content);

      expect(html).toContain('It&#39;s working');
    });

    it('should escape in all user-provided content', () => {
      const maliciousContent = createMockEmailContent({
        greeting: '<script>alert(1)</script>',
        sections: [
          {
            type: 'checklist-summary',
            title: '<img src=x onerror=alert(1)>',
            content: '<iframe src="evil.com"></iframe>',
            items: [
              {
                id: '1',
                title: '<svg onload=alert(1)>',
                description: '<object data="evil.com"></object>',
                actionLink: 'javascript:alert(1)',
                actionText: '<script>alert(1)</script>',
              },
            ],
            order: 1,
          },
        ],
      });

      const html = renderEmailToHTML(maliciousContent);

      // No actual tags should remain
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).not.toContain('<img src=x');
      expect(html).not.toContain('<iframe');
      expect(html).not.toContain('<svg onload');
      expect(html).not.toContain('<object');

      // Should be escaped
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;img');
    });
  });

  describe('Priority styling', () => {
    it('should apply high priority class', () => {
      const content = createMockEmailContent({
        sections: [
          {
            type: 'checklist-summary',
            title: 'Tasks',
            content: 'Content',
            items: [
              {
                id: '1',
                title: 'Critical Task',
                metadata: { priority: 'high' },
              },
            ],
            order: 1,
          },
        ],
      });

      const html = renderEmailToHTML(content);
      expect(html).toContain('task-item priority-high');
    });

    it('should apply medium priority class', () => {
      const content = createMockEmailContent({
        sections: [
          {
            type: 'checklist-summary',
            title: 'Tasks',
            content: 'Content',
            items: [
              {
                id: '1',
                title: 'Normal Task',
                metadata: { priority: 'medium' },
              },
            ],
            order: 1,
          },
        ],
      });

      const html = renderEmailToHTML(content);
      expect(html).toContain('task-item priority-medium');
    });

    it('should apply low priority class', () => {
      const content = createMockEmailContent({
        sections: [
          {
            type: 'checklist-summary',
            title: 'Tasks',
            content: 'Content',
            items: [
              {
                id: '1',
                title: 'Low Task',
                metadata: { priority: 'low' },
              },
            ],
            order: 1,
          },
        ],
      });

      const html = renderEmailToHTML(content);
      expect(html).toContain('task-item priority-low');
    });

    it('should handle missing priority', () => {
      const content = createMockEmailContent({
        sections: [
          {
            type: 'checklist-summary',
            title: 'Tasks',
            content: 'Content',
            items: [
              {
                id: '1',
                title: 'Task without priority',
              },
            ],
            order: 1,
          },
        ],
      });

      const html = renderEmailToHTML(content);
      expect(html).toContain('task-item'); // Should still have base class
      expect(html).not.toContain('priority-undefined');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty greeting', () => {
      const content = createMockEmailContent({ greeting: '' });
      const html = renderEmailToHTML(content);

      expect(html).toContain('class="greeting"');
    });

    it('should handle very long content', () => {
      const longText = 'A'.repeat(10000);
      const content = createMockEmailContent({
        sections: [
          {
            type: 'quick-tips',
            title: 'Long Content',
            content: longText,
            order: 1,
          },
        ],
      });

      const html = renderEmailToHTML(content);
      expect(html).toContain(longText);
    });

    it('should handle special characters in company name', () => {
      const content = createMockEmailContent({
        footer: {
          ...createMockEmailContent().footer,
          companyName: 'Smith & Sons "Quality" Products',
        },
      });

      const html = renderEmailToHTML(content);
      expect(html).toContain('Smith &amp; Sons &quot;Quality&quot; Products');
    });

    it('should handle items without descriptions', () => {
      const content = createMockEmailContent({
        sections: [
          {
            type: 'checklist-summary',
            title: 'Tasks',
            content: 'Content',
            items: [
              {
                id: '1',
                title: 'Task without description',
              },
            ],
            order: 1,
          },
        ],
      });

      const html = renderEmailToHTML(content);
      expect(html).toContain('Task without description');
      expect(html).not.toContain('class="task-description"');
    });

    it('should handle items without action links', () => {
      const content = createMockEmailContent({
        sections: [
          {
            type: 'checklist-summary',
            title: 'Tasks',
            content: 'Content',
            items: [
              {
                id: '1',
                title: 'Task without link',
              },
            ],
            order: 1,
          },
        ],
      });

      const html = renderEmailToHTML(content);
      expect(html).toContain('Task without link');
      expect(html).not.toContain('class="task-action"');
    });

    it('should handle multiple sections of same type', () => {
      const content = createMockEmailContent({
        sections: [
          {
            type: 'checklist-summary',
            title: 'Foundation Tasks',
            content: 'Setup tasks',
            order: 1,
          },
          {
            type: 'checklist-summary',
            title: 'Weekly Tasks',
            content: 'Recurring tasks',
            order: 2,
          },
        ],
      });

      const html = renderEmailToHTML(content);
      expect(html).toContain('Foundation Tasks');
      expect(html).toContain('Weekly Tasks');
    });
  });

  describe('Accessibility', () => {
    it('should include lang attribute', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('lang="en"');
    });

    it('should have proper heading structure', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      expect(html).toContain('<h1>');
    });

    it('should have readable color contrast in CSS', () => {
      const content = createMockEmailContent();
      const html = renderEmailToHTML(content);

      // Check for dark text on light backgrounds
      expect(html).toContain('color: #333333');
      expect(html).toContain('background-color: #ffffff');
    });
  });
});
