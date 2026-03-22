/**
 * Email service for Audacious Money platform
 *
 * Handles sending emails via SendGrid with graceful fallback to console logging
 * in development mode or when SendGrid is not configured
 */

import { sign } from 'hono/jwt';
import {
  emailVerificationTemplate,
  passwordResetTemplate,
  renderTemplate,
} from '../emails/templates.js';

/**
 * Email service configuration
 */
interface EmailConfig {
  from: string;
  sendGridApiKey?: string;
  frontendUrl: string;
}

/**
 * Get email configuration from environment
 */
function getEmailConfig(): EmailConfig {
  return {
    from: process.env.EMAIL_FROM || 'noreply@audaciousmoney.com',
    sendGridApiKey: process.env.SENDGRID_API_KEY,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  };
}

/**
 * Send email via SendGrid or log to console in dev mode
 *
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML email body
 * @param text - Plain text email body
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  const config = getEmailConfig();

  // If SendGrid is not configured, log to console (dev mode)
  if (!config.sendGridApiKey) {
    console.log('\n='.repeat(60));
    console.log('📧 EMAIL (DEV MODE - NOT SENT)');
    console.log('='.repeat(60));
    console.log(`To: ${to}`);
    console.log(`From: ${config.from}`);
    console.log(`Subject: ${subject}`);
    console.log('-'.repeat(60));
    console.log(text);
    console.log('='.repeat(60) + '\n');
    return;
  }

  // Send via SendGrid
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.sendGridApiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: config.from },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${error}`);
    }

    console.log(`[Email] Sent to ${to}: ${subject}`);
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    // In production, you might want to queue failed emails for retry
    // For now, we'll just log the error and continue
  }
}

/**
 * Generate email verification token (JWT)
 *
 * @param userId - User ID
 * @param email - User email
 * @returns JWT token for email verification
 */
async function generateVerificationToken(
  userId: string,
  email: string
): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const payload = {
    userId,
    email,
    purpose: 'email_verification',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };

  return await sign(payload, secret);
}

/**
 * Generate password reset token (JWT)
 *
 * @param userId - User ID
 * @param email - User email
 * @returns JWT token for password reset
 */
async function generatePasswordResetToken(
  userId: string,
  email: string
): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const payload = {
    userId,
    email,
    purpose: 'password_reset',
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
  };

  return await sign(payload, secret);
}

/**
 * Send email verification email
 *
 * @param email - User's email address
 * @param userId - User's ID
 * @param firstName - User's first name
 */
export async function sendVerificationEmail(
  email: string,
  userId: string,
  firstName: string
): Promise<void> {
  const config = getEmailConfig();
  const token = await generateVerificationToken(userId, email);
  const verificationLink = `${config.frontendUrl}/verify-email?token=${token}`;

  const rendered = renderTemplate(emailVerificationTemplate, {
    firstName,
    verificationLink,
  });

  await sendEmail(email, rendered.subject, rendered.html, rendered.text);
}

/**
 * Send password reset email
 *
 * @param email - User's email address
 * @param userId - User's ID
 * @param firstName - User's first name
 */
export async function sendPasswordResetEmail(
  email: string,
  userId: string,
  firstName: string
): Promise<void> {
  const config = getEmailConfig();
  const token = await generatePasswordResetToken(userId, email);
  const resetLink = `${config.frontendUrl}/reset-password?token=${token}`;

  const rendered = renderTemplate(passwordResetTemplate, {
    firstName,
    resetLink,
  });

  await sendEmail(email, rendered.subject, rendered.html, rendered.text);
}

/**
 * Send trial started email
 *
 * @param email - User's email address
 * @param firstName - User's first name
 * @param productName - Product name
 * @param trialEndDate - Trial end date (formatted string)
 */
export async function sendTrialStartedEmail(
  email: string,
  firstName: string,
  productName: string,
  trialEndDate: string
): Promise<void> {
  const { trialStartedTemplate } = await import('../emails/templates.js');
  const rendered = renderTemplate(trialStartedTemplate, {
    firstName,
    productName,
    trialEndDate,
  });

  await sendEmail(email, rendered.subject, rendered.html, rendered.text);
}

/**
 * Send payment failed email
 *
 * @param email - User's email address
 * @param firstName - User's first name
 * @param productName - Product name
 * @param failureReason - Reason for payment failure
 */
export async function sendPaymentFailedEmail(
  email: string,
  firstName: string,
  productName: string,
  failureReason: string
): Promise<void> {
  const config = getEmailConfig();
  const { paymentFailedTemplate } = await import('../emails/templates.js');
  const accountLink = `${config.frontendUrl}/account/billing`;

  const rendered = renderTemplate(paymentFailedTemplate, {
    firstName,
    productName,
    failureReason,
    accountLink,
  });

  await sendEmail(email, rendered.subject, rendered.html, rendered.text);
}
