/**
 * Contact form routes
 *
 * Handles contact form submissions from the marketing website
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types/hono.js';
import { validate, contactFormSchema } from '../utils/validation.js';
import { success, badRequest, ErrorCodes } from '../utils/responses.js';
import { sendContactFormEmail } from '../services/email.service.js';

const contact = new Hono<HonoEnv>();

/**
 * POST /contact
 *
 * Submit contact form from marketing website
 *
 * Request body:
 * - name: string (required)
 * - email: string (required, valid email)
 * - subject: enum (required, one of: general, support, billing, feature, bug, feedback, other)
 * - message: string (required, 10-2000 chars)
 *
 * Response:
 * - 200: Message sent successfully
 * - 400: Validation error
 * - 500: Failed to send message
 */
contact.post('/', validate(contactFormSchema), async (c) => {
  const { name, email, subject, message } = c.get('validatedData');

  try {
    // Send email to hello@audacious.money via Postmark
    await sendContactFormEmail(name, email, subject, message);

    return success(c, {
      message: 'Your message has been sent successfully. We\'ll get back to you soon!'
    });

  } catch (error) {
    console.error('[Contact] Failed to send contact form email:', error);

    return badRequest(
      c,
      ErrorCodes.VALIDATION_ERROR,
      'Failed to send message. Please try again or email us directly at hello@audacious.money'
    );
  }
});

export default contact;
