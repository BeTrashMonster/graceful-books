/**
 * Tests for HTML Sanitization Utility
 *
 * Per S4-4: XSS Prevention Testing
 * Verifies that all XSS payloads are neutralized by DOMPurify
 */

/* eslint-disable no-script-url */
// Disable no-script-url rule for tests - we're intentionally testing javascript: URLs to verify they're blocked

import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  sanitizeHtmlStrict,
  sanitizeUrl,
  sanitizeEmailHtml,
} from './sanitize';

describe('sanitizeHtml', () => {
  describe('XSS payload neutralization', () => {
    it('should remove script tags', () => {
      const dangerous = '<script>alert("xss")</script>';
      const result = sanitizeHtml(dangerous);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
    });

    it('should remove script tags with variations', () => {
      const payloads = [
        '<SCRIPT>alert("xss")</SCRIPT>',
        '<script>alert("xss")</script>',
        '<ScRiPt>alert("xss")</ScRiPt>',
        '<script src="evil.js"></script>',
      ];

      payloads.forEach((payload) => {
        const result = sanitizeHtml(payload);
        expect(result).not.toContain('<script');
        expect(result).not.toContain('alert');
      });
    });

    it('should remove inline event handlers', () => {
      const payloads = [
        '<img src=x onerror=alert(1)>',
        '<img src=x onerror="alert(1)">',
        '<div onclick="alert(1)">Click me</div>',
        '<body onload="alert(1)">',
        '<svg onload="alert(1)">',
        '<iframe onload="alert(1)">',
      ];

      payloads.forEach((payload) => {
        const result = sanitizeHtml(payload);
        expect(result).not.toMatch(/on\w+=/i);
      });
    });

    it('should remove javascript: URLs', () => {
      const payloads = [
        '<a href="javascript:alert(1)">Click</a>',
        '<a href="javascript:void(0)">Click</a>',
        '<a href="jAvAsCrIpT:alert(1)">Click</a>',
      ];

      payloads.forEach((payload) => {
        const result = sanitizeHtml(payload);
        expect(result.toLowerCase()).not.toContain('javascript:');
      });
    });

    it('should remove iframe tags', () => {
      const dangerous = '<iframe src="evil.com"></iframe>';
      const result = sanitizeHtml(dangerous);
      expect(result).not.toContain('<iframe');
    });

    it('should remove object and embed tags', () => {
      const payloads = [
        '<object data="evil.swf"></object>',
        '<embed src="evil.swf">',
      ];

      payloads.forEach((payload) => {
        const result = sanitizeHtml(payload);
        expect(result).not.toContain('<object');
        expect(result).not.toContain('<embed');
      });
    });

    it('should handle SVG-based XSS', () => {
      const payloads = [
        '<svg onload="alert(1)">',
        '<svg><script>alert(1)</script></svg>',
        '<svg><animate onbegin="alert(1)">',
      ];

      payloads.forEach((payload) => {
        const result = sanitizeHtml(payload);
        expect(result).not.toContain('alert');
        expect(result).not.toMatch(/on\w+=/i);
      });
    });

    it('should handle form-based XSS', () => {
      const dangerous = '<form action="javascript:alert(1)"><input type="submit"></form>';
      const result = sanitizeHtml(dangerous);
      // DOMPurify should remove the form or sanitize the action
      expect(result.toLowerCase()).not.toContain('javascript:');
    });

    it('should handle meta refresh XSS', () => {
      const dangerous = '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">';
      const result = sanitizeHtml(dangerous);
      expect(result).not.toContain('<meta');
    });
  });

  describe('safe HTML preservation', () => {
    it('should preserve safe formatting tags', () => {
      const safe = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
      const result = sanitizeHtml(safe);
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
      expect(result).toContain('Bold');
      expect(result).toContain('italic');
    });

    it('should preserve headings', () => {
      const safe = '<h1>Title</h1><h2>Subtitle</h2>';
      const result = sanitizeHtml(safe);
      expect(result).toContain('<h1>');
      expect(result).toContain('<h2>');
    });

    it('should preserve lists', () => {
      const safe = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = sanitizeHtml(safe);
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
    });

    it('should preserve safe links', () => {
      const safe = '<a href="https://example.com">Link</a>';
      const result = sanitizeHtml(safe);
      expect(result).toContain('<a');
      expect(result).toContain('href');
      expect(result).toContain('https://example.com');
    });

    it('should preserve safe images', () => {
      const safe = '<img src="https://example.com/image.jpg" alt="Description">';
      const result = sanitizeHtml(safe);
      expect(result).toContain('<img');
      expect(result).toContain('src');
      expect(result).toContain('alt');
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('should handle plain text without HTML', () => {
      const plain = 'Just plain text';
      expect(sanitizeHtml(plain)).toBe(plain);
    });

    it('should handle mixed safe and unsafe content', () => {
      const mixed = '<p>Safe paragraph</p><script>alert(1)</script><strong>Safe bold</strong>';
      const result = sanitizeHtml(mixed);
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).not.toContain('<script');
    });
  });
});

describe('sanitizeHtmlStrict', () => {
  it('should remove all HTML tags', () => {
    const html = '<p><strong>Bold</strong> and <em>italic</em></p>';
    const result = sanitizeHtmlStrict(html);
    expect(result).toBe('Bold and italic');
  });

  it('should remove dangerous HTML and return text only', () => {
    const dangerous = '<script>alert(1)</script>Hello<strong>World</strong>';
    const result = sanitizeHtmlStrict(dangerous);
    expect(result).not.toContain('<');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });
});

describe('sanitizeUrl', () => {
  it('should allow safe URLs', () => {
    const safeUrls = [
      'https://example.com',
      'http://example.com',
      '/relative/path',
      '#anchor',
    ];

    safeUrls.forEach((url) => {
      const result = sanitizeUrl(url);
      expect(result).toBe(url);
    });
  });

  it('should block javascript: URLs', () => {
    const dangerous = 'javascript:alert(1)';
    const result = sanitizeUrl(dangerous);
    expect(result).toBe('about:blank');
    expect(result).not.toContain('javascript:');
  });

  it('should block data: URLs', () => {
    const dangerous = 'data:text/html,<script>alert(1)</script>';
    const result = sanitizeUrl(dangerous);
    expect(result).toBe('about:blank');
  });

  it('should block vbscript: URLs', () => {
    const dangerous = 'vbscript:msgbox(1)';
    const result = sanitizeUrl(dangerous);
    expect(result).toBe('about:blank');
  });

  it('should handle case variations', () => {
    const variations = [
      'JavaScript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'JaVaScRiPt:alert(1)',
    ];

    variations.forEach((url) => {
      const result = sanitizeUrl(url);
      expect(result).toBe('about:blank');
    });
  });
});

describe('sanitizeEmailHtml', () => {
  it('should allow email-safe HTML tags', () => {
    const email = `
      <div>
        <h1>Email Title</h1>
        <p>Paragraph with <strong>bold</strong> and <em>italic</em></p>
        <ul>
          <li>List item 1</li>
          <li>List item 2</li>
        </ul>
        <table>
          <tr><td>Cell</td></tr>
        </table>
        <a href="https://example.com">Link</a>
        <img src="https://example.com/image.jpg" alt="Image">
      </div>
    `;

    const result = sanitizeEmailHtml(email);
    expect(result).toContain('<h1>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
    expect(result).toContain('<table>');
    expect(result).toContain('<a');
    expect(result).toContain('<img');
  });

  it('should remove dangerous content from email HTML', () => {
    const dangerous = `
      <h1>Title</h1>
      <script>alert("xss")</script>
      <p onclick="alert(1)">Paragraph</p>
      <iframe src="evil.com"></iframe>
    `;

    const result = sanitizeEmailHtml(dangerous);
    expect(result).toContain('<h1>');
    expect(result).not.toContain('<script');
    expect(result).not.toMatch(/onclick/i);
    expect(result).not.toContain('<iframe');
  });
});

describe('Real-world XSS payloads', () => {
  it('should handle OWASP XSS filter evasion payloads', () => {
    const owaspPayloads = [
      // No filter evasion
      '<SCRIPT SRC=http://xss.rocks/xss.js></SCRIPT>',

      // Image tag variations
      '<IMG SRC="javascript:alert(\'XSS\');">',
      '<IMG SRC=javascript:alert(\'XSS\')>',
      '<IMG SRC=JaVaScRiPt:alert(\'XSS\')>',
      '<IMG SRC=javascript:alert(&quot;XSS&quot;)>',

      // No quotes and semicolons
      '<IMG SRC=javascript:alert(String.fromCharCode(88,83,83))>',

      // SVG object tag
      '<svg/onload=alert(\'XSS\')>',

      // Body tag
      '<BODY ONLOAD=alert(\'XSS\')>',

      // Event handlers
      '<IMG SRC=x ONERROR="alert(String.fromCharCode(88,83,83))">',
      '<IMG SRC=x ONERROR="alert(\'XSS\')">',

      // Mixed case
      '<ScRiPt>alert("XSS")</ScRiPt>',
    ];

    owaspPayloads.forEach((payload) => {
      const result = sanitizeHtml(payload);
      expect(result.toLowerCase()).not.toContain('alert');
      expect(result.toLowerCase()).not.toContain('javascript:');
      expect(result).not.toMatch(/on\w+=/i);
    });
  });
});
