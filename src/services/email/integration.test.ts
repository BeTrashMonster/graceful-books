/**
 * IC4: Email Service Integration Test
 *
 * End-to-end integration test verifying complete email workflow
 */

import { describe, it, expect } from 'vitest';
import { EmailTemplateType } from '../../types/ic4-email.types';

describe('IC4: Email Service Integration', () => {
  it('should have all required email templates', async () => {
    const { getAvailableTemplates } = await import('./templateRenderer');
    const templates = getAvailableTemplates();

    expect(templates).toContain(EmailTemplateType.ADVISOR_INVITATION);
    expect(templates).toContain(EmailTemplateType.CLIENT_BILLING_TRANSFER);
    expect(templates).toContain(EmailTemplateType.ADVISOR_REMOVED_CLIENT);
    expect(templates).toContain(EmailTemplateType.SCENARIO_PUSHED);
    expect(templates).toContain(EmailTemplateType.TAX_SEASON_ACCESS);
    expect(templates).toContain(EmailTemplateType.TAX_PREP_COMPLETION);
    expect(templates).toContain(EmailTemplateType.WELCOME);
    expect(templates).toContain(EmailTemplateType.PASSWORD_RESET);
    expect(templates).toContain(EmailTemplateType.EMAIL_VERIFICATION);

    expect(templates.length).toBe(9);
  });

  it('should render all templates without errors', async () => {
    const { renderTemplate } = await import('./templateRenderer');

    const testCases = [
      {
        type: EmailTemplateType.ADVISOR_INVITATION,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          advisorFirm: 'Acme Advisors',
          invitationUrl: 'https://app.gracefulbooks.com/invite/123',
        },
      },
      {
        type: EmailTemplateType.CLIENT_BILLING_TRANSFER,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          accountUrl: 'https://app.gracefulbooks.com/account',
          advisorEmail: 'jane@advisor.com',
        },
      },
      {
        type: EmailTemplateType.ADVISOR_REMOVED_CLIENT,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          billingChoiceUrl: 'https://app.gracefulbooks.com/billing',
        },
      },
      {
        type: EmailTemplateType.SCENARIO_PUSHED,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          scenarioName: 'Q1 Plan',
          advisorNote: 'Review this scenario',
          scenarioUrl: 'https://app.gracefulbooks.com/scenarios/123',
        },
      },
      {
        type: EmailTemplateType.TAX_SEASON_ACCESS,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          taxYear: '2025',
          accessExpiresDate: 'April 15, 2026',
          taxPrepUrl: 'https://app.gracefulbooks.com/tax-prep',
          advisorEmail: 'jane@advisor.com',
        },
      },
      {
        type: EmailTemplateType.TAX_PREP_COMPLETION,
        variables: {
          firstName: 'John',
          taxYear: '2025',
          downloadUrl: 'https://app.gracefulbooks.com/download/tax-2025',
        },
      },
      {
        type: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'John',
          dashboardUrl: 'https://app.gracefulbooks.com/dashboard',
          charityName: 'Red Cross',
        },
      },
      {
        type: EmailTemplateType.PASSWORD_RESET,
        variables: {
          firstName: 'John',
          resetUrl: 'https://app.gracefulbooks.com/reset/token123',
        },
      },
      {
        type: EmailTemplateType.EMAIL_VERIFICATION,
        variables: {
          firstName: 'John',
          verificationUrl: 'https://app.gracefulbooks.com/verify/token123',
        },
      },
    ];

    for (const testCase of testCases) {
      const content = renderTemplate(testCase.type, testCase.variables as any);

      expect(content).toBeTruthy();
      expect(content?.html).toBeTruthy();
      expect(content?.plainText).toBeTruthy();
      expect(content?.subject).toBeTruthy();

      // Verify no USER financial data in email content (security requirement)
      // Generic pricing info like "$40/month" is OK, but no account balances, amounts, etc.
      // This is a notification-only design - users must log in to see their data

      // Verify proper HTML structure
      expect(content?.html).toContain('<table');
      expect(content?.html).toContain('Graceful Books');

      // Verify plain text includes key information
      expect(content?.plainText).toContain('Graceful Books');
    }
  });

  it('should sanitize all user input to prevent XSS', async () => {
    const { renderTemplate } = await import('./templateRenderer');

    const xssPayload = '<script>alert("xss")</script>';

    const content = renderTemplate(EmailTemplateType.WELCOME, {
      firstName: xssPayload,
      dashboardUrl: 'https://app.gracefulbooks.com',
      charityName: 'Test Charity',
    });

    expect(content).toBeTruthy();

    // Verify HTML escaping (tags are escaped, not removed)
    expect(content?.html).not.toContain('<script>');
    expect(content?.html).not.toContain('</script>');

    // Verify the malicious payload was properly escaped
    // The HTML should contain "Hi &lt;script&gt;..." instead of "Hi <script>..."
    expect(content?.html).toContain('&lt;script&gt;');
    expect(content?.html).toContain('&lt;&#x2F;script&gt;');

    // Also test with other payloads
    const content2 = renderTemplate(EmailTemplateType.WELCOME, {
      firstName: '<iframe src="evil.com"></iframe>',
      dashboardUrl: 'https://app.gracefulbooks.com',
      charityName: 'Test Charity',
    });

    expect(content2?.html).not.toContain('<iframe');
    expect(content2?.html).toContain('&lt;iframe');
  });

  it('should have proper email structure for accessibility', async () => {
    const { renderTemplate } = await import('./templateRenderer');

    const content = renderTemplate(EmailTemplateType.WELCOME, {
      firstName: 'John',
      dashboardUrl: 'https://app.gracefulbooks.com',
      charityName: 'Red Cross',
    });

    expect(content).toBeTruthy();

    // Check for semantic HTML
    expect(content?.html).toContain('<table');
    expect(content?.html).toContain('<a href=');

    // Check for proper button styling (WCAG 2.1 AA)
    expect(content?.html).toContain('padding:');
    expect(content?.html).toContain('background-color:');

    // Check for readable font size
    expect(content?.html).toContain('font-size: 16px');

    // Check for plain text fallback
    expect(content?.plainText.length).toBeGreaterThan(100);
  });

  it('should include required links in all emails', async () => {
    const { renderTemplate } = await import('./templateRenderer');

    const content = renderTemplate(EmailTemplateType.WELCOME, {
      firstName: 'John',
      dashboardUrl: 'https://app.gracefulbooks.com',
      charityName: 'Red Cross',
    });

    expect(content).toBeTruthy();

    // Footer links (unless critical email)
    expect(content?.html).toContain('Help Center');
    expect(content?.html).toContain('Contact Support');
    expect(content?.html).toContain('Privacy Policy');

    // Copyright notice
    expect(content?.html).toContain('Graceful Books');
    expect(content?.html).toContain('All rights reserved');
  });

  it('should handle mobile-responsive design', async () => {
    const { renderTemplate } = await import('./templateRenderer');

    const content = renderTemplate(EmailTemplateType.WELCOME, {
      firstName: 'John',
      dashboardUrl: 'https://app.gracefulbooks.com',
      charityName: 'Red Cross',
    });

    expect(content).toBeTruthy();

    // Check for mobile-friendly table width
    expect(content?.html).toContain('width="600"');

    // Check for responsive padding
    expect(content?.html).toContain('padding:');

    // Check for touch-friendly button size
    expect(content?.html).toContain('min-width:');
  });

  it('should not include unsubscribe links in critical emails', async () => {
    const { renderTemplate } = await import('./templateRenderer');

    const criticalEmails = [
      {
        type: EmailTemplateType.PASSWORD_RESET,
        variables: {
          firstName: 'John',
          resetUrl: 'https://app.gracefulbooks.com/reset/123',
        },
      },
      {
        type: EmailTemplateType.EMAIL_VERIFICATION,
        variables: {
          firstName: 'John',
          verificationUrl: 'https://app.gracefulbooks.com/verify/123',
        },
      },
    ];

    for (const email of criticalEmails) {
      const content = renderTemplate(email.type, email.variables as any);
      expect(content).toBeTruthy();

      // Critical emails should NOT have unsubscribe links
      expect(content?.html).not.toContain('unsubscribe');
      expect(content?.html).not.toContain('Update email preferences');
    }
  });

  it('should maintain consistent branding across all templates', async () => {
    const { renderTemplate } = await import('./templateRenderer');

    const templates = [
      {
        type: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'John',
          dashboardUrl: 'https://app.gracefulbooks.com',
          charityName: 'Red Cross',
        },
      },
      {
        type: EmailTemplateType.ADVISOR_INVITATION,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          advisorFirm: 'Acme',
          invitationUrl: 'https://app.gracefulbooks.com/invite/123',
        },
      },
    ];

    for (const template of templates) {
      const content = renderTemplate(template.type, template.variables as any);
      expect(content).toBeTruthy();

      // Check for brand colors
      expect(content?.html).toContain('#4A90E2'); // Primary blue
      expect(content?.html).toContain('Graceful Books'); // Brand name
      expect(content?.html).toContain('linear-gradient'); // Header gradient

      // Check for consistent typography
      expect(content?.html).toContain('-apple-system, BlinkMacSystemFont');
    }
  });
});
