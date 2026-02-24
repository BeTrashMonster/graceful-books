/**
 * HTML Sanitization Utilities
 *
 * Uses DOMPurify to prevent XSS attacks when rendering user-generated HTML.
 *
 * SECURITY: All user-generated HTML MUST be sanitized before rendering.
 * Never use dangerouslySetInnerHTML without sanitization.
 *
 * Per SECURITY_HARDENING_ROADMAP.md Task S4-1
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS attacks
 *
 * This removes all dangerous HTML elements and attributes while preserving
 * safe formatting elements.
 *
 * @param dirty - Untrusted HTML string
 * @returns Sanitized HTML safe for rendering
 *
 * @example
 * ```typescript
 * // Safe rendering with React:
 * import { sanitizeHtml } from '@/utils/sanitize';
 *
 * function MyComponent({ userContent }: { userContent: string }) {
 *   return (
 *     <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // XSS payloads are neutralized:
 * sanitizeHtml('<script>alert("xss")</script>')
 * // Returns: ""
 *
 * sanitizeHtml('<img src=x onerror=alert(1)>')
 * // Returns: "<img src="x">"
 *
 * sanitizeHtml('<strong>Safe HTML</strong>')
 * // Returns: "<strong>Safe HTML</strong>"
 * ```
 */
export function sanitizeHtml(dirty: string): string {
  // DOMPurify.sanitize removes all dangerous elements and attributes
  // while preserving safe formatting like <strong>, <em>, <p>, etc.
  return DOMPurify.sanitize(dirty, {
    // Use default safe configuration
    // This allows safe HTML tags (p, div, span, strong, em, etc.)
    // and removes dangerous elements (script, iframe, object, embed)
    // and event handlers (onclick, onerror, etc.)
  });
}

/**
 * Sanitize HTML with strict mode - removes ALL HTML tags
 *
 * Use this when you only want plain text with no formatting.
 *
 * @param dirty - Untrusted HTML string
 * @returns Plain text with all HTML removed
 *
 * @example
 * ```typescript
 * sanitizeHtmlStrict('<strong>Bold</strong> and <script>alert(1)</script>')
 * // Returns: "Bold and "
 * ```
 */
export function sanitizeHtmlStrict(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // Strip all tags
  });
}

/**
 * Sanitize URL to prevent javascript: and data: URLs
 *
 * Use this when accepting URLs from users (e.g., links, images).
 *
 * @param url - Untrusted URL string
 * @returns Sanitized URL or empty string if dangerous
 *
 * @example
 * ```typescript
 * sanitizeUrl('javascript:alert(1)')
 * // Returns: "about:blank"
 *
 * sanitizeUrl('https://example.com')
 * // Returns: "https://example.com"
 * ```
 */
export function sanitizeUrl(url: string): string {
  const sanitized = DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  // Additional check for dangerous protocols
  const lowerUrl = sanitized.toLowerCase().trim();
  if (
    lowerUrl.startsWith('javascript:') || // eslint-disable-line no-script-url
    lowerUrl.startsWith('data:') ||
    lowerUrl.startsWith('vbscript:')
  ) {
    return 'about:blank';
  }

  return sanitized;
}

/**
 * Sanitize HTML for email content
 *
 * More permissive than default sanitization to allow email formatting,
 * but still removes dangerous elements.
 *
 * Allows: tables, lists, headings, links, images (with safe src)
 * Removes: scripts, iframes, forms, event handlers
 *
 * @param dirty - Untrusted email HTML
 * @returns Sanitized email HTML
 */
export function sanitizeEmailHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'div',
      'span',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}
