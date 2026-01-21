/**
 * IC4: Template Renderer
 *
 * Central template rendering system that routes to specific templates
 * All templates use XSS-safe variable substitution
 */

import type {
  EmailTemplateType,
  EmailTemplateVariables,
  EmailContent,
} from '../../types/ic4-email.types';
import { EmailTemplateType as TemplateEnum } from '../../types/ic4-email.types';
import { logger } from '../../utils/logger';
import { validateVariables } from './templateUtils';

// Import all template renderers
import { renderAdvisorInvitation } from './templates/advisorInvitation';
import { renderClientBillingTransfer } from './templates/clientBillingTransfer';
import { renderAdvisorRemovedClient } from './templates/advisorRemovedClient';
import { renderScenarioPushed } from './templates/scenarioPushed';
import { renderTaxSeasonAccess } from './templates/taxSeasonAccess';
import { renderTaxPrepCompletion } from './templates/taxPrepCompletion';
import { renderWelcome } from './templates/welcome';
import { renderPasswordReset } from './templates/passwordReset';
import { renderEmailVerification } from './templates/emailVerification';

const log = logger.child('TemplateRenderer');

/**
 * Template configuration - defines required variables for each template
 */
const TEMPLATE_CONFIG: Record<EmailTemplateType, string[]> = {
  [TemplateEnum.ADVISOR_INVITATION]: [
    'clientFirstName',
    'advisorName',
    'advisorFirm',
    'invitationUrl',
  ],
  [TemplateEnum.CLIENT_BILLING_TRANSFER]: [
    'clientFirstName',
    'advisorName',
    'accountUrl',
    'advisorEmail',
  ],
  [TemplateEnum.ADVISOR_REMOVED_CLIENT]: [
    'clientFirstName',
    'advisorName',
    'billingChoiceUrl',
  ],
  [TemplateEnum.SCENARIO_PUSHED]: [
    'clientFirstName',
    'advisorName',
    'scenarioName',
    'advisorNote',
    'scenarioUrl',
  ],
  [TemplateEnum.TAX_SEASON_ACCESS]: [
    'clientFirstName',
    'advisorName',
    'taxYear',
    'accessExpiresDate',
    'taxPrepUrl',
    'advisorEmail',
  ],
  [TemplateEnum.TAX_PREP_COMPLETION]: ['firstName', 'taxYear', 'downloadUrl'],
  [TemplateEnum.WELCOME]: ['firstName', 'dashboardUrl', 'charityName'],
  [TemplateEnum.PASSWORD_RESET]: ['firstName', 'resetUrl'],
  [TemplateEnum.EMAIL_VERIFICATION]: ['firstName', 'verificationUrl'],
};

/**
 * Render an email template with variables
 */
export function renderTemplate(
  templateType: EmailTemplateType,
  variables: EmailTemplateVariables
): EmailContent | null {
  try {
    // Validate required variables
    const requiredVars = TEMPLATE_CONFIG[templateType];
    const validation = validateVariables(
      variables as unknown as Record<string, string>,
      requiredVars
    );

    if (!validation.valid) {
      log.error('Missing required variables for template', {
        templateType,
        missing: validation.missing,
      });
      return null;
    }

    // Route to appropriate template renderer
    let result: { html: string; plainText: string; subject: string };

    switch (templateType) {
      case TemplateEnum.ADVISOR_INVITATION:
        result = renderAdvisorInvitation(variables as any);
        break;

      case TemplateEnum.CLIENT_BILLING_TRANSFER:
        result = renderClientBillingTransfer(variables as any);
        break;

      case TemplateEnum.ADVISOR_REMOVED_CLIENT:
        result = renderAdvisorRemovedClient(variables as any);
        break;

      case TemplateEnum.SCENARIO_PUSHED:
        result = renderScenarioPushed(variables as any);
        break;

      case TemplateEnum.TAX_SEASON_ACCESS:
        result = renderTaxSeasonAccess(variables as any);
        break;

      case TemplateEnum.TAX_PREP_COMPLETION:
        result = renderTaxPrepCompletion(variables as any);
        break;

      case TemplateEnum.WELCOME:
        result = renderWelcome(variables as any);
        break;

      case TemplateEnum.PASSWORD_RESET:
        result = renderPasswordReset(variables as any);
        break;

      case TemplateEnum.EMAIL_VERIFICATION:
        result = renderEmailVerification(variables as any);
        break;

      default:
        log.error('Unknown template type', { templateType });
        return null;
    }

    return {
      html: result.html,
      plainText: result.plainText,
      subject: result.subject,
    };
  } catch (error) {
    log.error('Error rendering template', { error, templateType });
    return null;
  }
}

/**
 * Get list of all available templates
 */
export function getAvailableTemplates(): EmailTemplateType[] {
  return Object.keys(TEMPLATE_CONFIG) as EmailTemplateType[];
}

/**
 * Get required variables for a template
 */
export function getRequiredVariables(
  templateType: EmailTemplateType
): string[] {
  return TEMPLATE_CONFIG[templateType] || [];
}

/**
 * Check if a template exists
 */
export function templateExists(templateType: string): boolean {
  return templateType in TEMPLATE_CONFIG;
}
