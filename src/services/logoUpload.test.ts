/**
 * Logo Upload Service Tests
 *
 * Tests for logo file validation, upload, resizing, and optimization
 */

import { describe, it, expect } from 'vitest';
import {
  validateLogoFile,
  getLogoDisplayDimensions,
  dataUrlToBlob,
  formatFileSize,
  estimateLogoSize,
  MAX_FILE_SIZE,
  MAX_LOGO_WIDTH,
  MAX_LOGO_HEIGHT,
  SUPPORTED_FORMATS,
} from './logoUpload';
import type { LogoConfig } from '../db/schema/invoiceTemplates.schema';

describe('Logo Upload Service', () => {
  describe('validateLogoFile', () => {
    it('should accept valid PNG file', () => {
      const file = new File(['dummy'], 'logo.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      const result = validateLogoFile(file);
      expect(result.valid).toBe(true);
      expect((result as any).error).toBeUndefined();
    });

    it('should accept valid JPEG file', () => {
      const file = new File(['dummy'], 'logo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 }); // 2MB

      const result = validateLogoFile(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid WebP file', () => {
      const file = new File(['dummy'], 'logo.webp', { type: 'image/webp' });
      Object.defineProperty(file, 'size', { value: 500 * 1024 }); // 500KB

      const result = validateLogoFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject file exceeding max size', () => {
      const file = new File(['dummy'], 'large.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 }); // 6MB

      const result = validateLogoFile(file);
      expect(result.valid).toBe(false);
      expect((result as any).error).toContain('exceeds maximum allowed size');
      expect((result as any).error).toContain('5MB');
    });

    it('should reject unsupported file type', () => {
      const file = new File(['dummy'], 'document.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      const result = validateLogoFile(file);
      expect(result.valid).toBe(false);
      expect((result as any).error).toContain('not supported');
      expect((result as any).error).toContain('PNG, JPEG, GIF, or WebP');
    });

    it('should reject SVG files', () => {
      const file = new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' });
      Object.defineProperty(file, 'size', { value: 1024 });

      const result = validateLogoFile(file);
      expect(result.valid).toBe(false);
    });

    it('should handle edge case at exact max size', () => {
      const file = new File(['dummy'], 'logo.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE });

      const result = validateLogoFile(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('getLogoDisplayDimensions', () => {
    it('should scale down large logo maintaining aspect ratio (landscape)', () => {
      const logo: LogoConfig = {
        data: '',
        filename: 'logo.png',
        mimeType: 'image/png',
        width: 800,
        height: 400,
        maxWidth: 800,
        maxHeight: 400,
        uploadedAt: Date.now(),
      };

      const dimensions = getLogoDisplayDimensions(logo, 150, 80);

      expect(dimensions.width).toBe(150);
      expect(dimensions.height).toBe(75);
    });

    it('should scale down large logo maintaining aspect ratio (portrait)', () => {
      const logo: LogoConfig = {
        data: '',
        filename: 'logo.png',
        mimeType: 'image/png',
        width: 400,
        height: 800,
        maxWidth: 400,
        maxHeight: 800,
        uploadedAt: Date.now(),
      };

      const dimensions = getLogoDisplayDimensions(logo, 150, 80);

      expect(dimensions.width).toBe(40);
      expect(dimensions.height).toBe(80);
    });

    it('should not scale up small logos', () => {
      const logo: LogoConfig = {
        data: '',
        filename: 'logo.png',
        mimeType: 'image/png',
        width: 100,
        height: 50,
        maxWidth: 100,
        maxHeight: 50,
        uploadedAt: Date.now(),
      };

      const dimensions = getLogoDisplayDimensions(logo, 150, 80);

      expect(dimensions.width).toBe(100);
      expect(dimensions.height).toBe(50);
    });

    it('should handle square logos', () => {
      const logo: LogoConfig = {
        data: '',
        filename: 'logo.png',
        mimeType: 'image/png',
        width: 500,
        height: 500,
        maxWidth: 500,
        maxHeight: 500,
        uploadedAt: Date.now(),
      };

      const dimensions = getLogoDisplayDimensions(logo, 150, 80);

      expect(dimensions.width).toBe(80);
      expect(dimensions.height).toBe(80);
    });
  });

  describe('dataUrlToBlob', () => {
    it('should convert PNG data URL to blob', () => {
      // Small 1x1 transparent PNG
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const blob = dataUrlToBlob(dataUrl);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should convert JPEG data URL to blob', () => {
      // Small JPEG data URL
      const dataUrl =
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwA9RRRQAf/Z';

      const blob = dataUrlToBlob(dataUrl);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(10 * 1024)).toBe('10 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
      expect(formatFileSize(MAX_FILE_SIZE)).toBe('5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
    });

    it('should round to 2 decimal places', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1587)).toBe('1.55 KB');
    });
  });

  describe('estimateLogoSize', () => {
    it('should estimate size of logo config', () => {
      const logo: LogoConfig = {
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        filename: 'test-logo.png',
        mimeType: 'image/png',
        width: 100,
        height: 50,
        maxWidth: 800,
        maxHeight: 400,
        uploadedAt: Date.now(),
      };

      const size = estimateLogoSize(logo);

      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('should include metadata in size estimate', () => {
      const logoSmall: LogoConfig = {
        data: 'data:image/png;base64,AA==',
        filename: 'a.png',
        mimeType: 'image/png',
        width: 1,
        height: 1,
        maxWidth: 1,
        maxHeight: 1,
        uploadedAt: 0,
      };

      const logoLarge: LogoConfig = {
        data: 'data:image/png;base64,AABBCCDDEE==',
        filename: 'very-long-filename-for-testing.png',
        mimeType: 'image/png',
        width: 1000,
        height: 1000,
        maxWidth: 800,
        maxHeight: 400,
        uploadedAt: Date.now(),
      };

      const sizeSmall = estimateLogoSize(logoSmall);
      const sizeLarge = estimateLogoSize(logoLarge);

      expect(sizeLarge).toBeGreaterThan(sizeSmall);
    });
  });

  describe('constants', () => {
    it('should have correct MAX_FILE_SIZE', () => {
      expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    });

    it('should have correct MAX_LOGO_WIDTH', () => {
      expect(MAX_LOGO_WIDTH).toBe(800);
    });

    it('should have correct MAX_LOGO_HEIGHT', () => {
      expect(MAX_LOGO_HEIGHT).toBe(400);
    });

    it('should have correct SUPPORTED_FORMATS', () => {
      expect(SUPPORTED_FORMATS).toEqual([
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
      ]);
    });
  });
});
