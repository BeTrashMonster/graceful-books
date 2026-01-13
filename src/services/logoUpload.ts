/**
 * Logo Upload Service
 *
 * Handles logo file uploads with automatic resizing, validation, and optimization.
 * Ensures uploaded logos meet size and format requirements for invoice templates.
 *
 * Requirements:
 * - E3: Invoice Templates - Customizable (Nice)
 * - Automatic image resizing to prevent large file sizes
 * - Format validation (PNG, JPEG, GIF, WebP)
 * - Size limits for storage efficiency
 */

import type { LogoConfig } from '../db/schema/invoiceTemplates.schema';

/**
 * Maximum file size in bytes (5MB)
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Maximum logo dimensions
 */
export const MAX_LOGO_WIDTH = 800;
export const MAX_LOGO_HEIGHT = 400;

/**
 * Supported image formats
 */
export const SUPPORTED_FORMATS = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

/**
 * Logo upload result
 */
export interface LogoUploadResult {
  success: boolean;
  data?: LogoConfig;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Image dimensions
 */
interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Validate file before processing
 */
export function validateLogoFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 5MB`,
    };
  }

  // Check file type
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: `File format ${file.type} is not supported. Please use PNG, JPEG, GIF, or WebP`,
    };
  }

  return { valid: true };
}

/**
 * Load image from File object
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        resolve(img);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateResizedDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): ImageDimensions {
  let width = originalWidth;
  let height = originalHeight;

  // Check if resizing is needed
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  // Calculate aspect ratio
  const aspectRatio = width / height;

  // Resize based on which dimension is the limiting factor
  if (width / maxWidth > height / maxHeight) {
    // Width is the limiting factor
    width = maxWidth;
    height = Math.round(width / aspectRatio);
  } else {
    // Height is the limiting factor
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  return { width, height };
}

/**
 * Resize image using canvas
 */
function resizeImage(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.9
): Promise<{ dataUrl: string; dimensions: ImageDimensions }> {
  return new Promise((resolve, reject) => {
    const { width, height } = calculateResizedDimensions(
      img.width,
      img.height,
      maxWidth,
      maxHeight
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Use high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw resized image
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to data URL
    try {
      const dataUrl = canvas.toDataURL('image/png', quality);
      resolve({
        dataUrl,
        dimensions: { width, height },
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Upload and process logo file
 *
 * @param file - The logo file to upload
 * @param maxWidth - Maximum logo width (default: 800px)
 * @param maxHeight - Maximum logo height (default: 400px)
 * @returns LogoUploadResult with processed logo data
 */
export async function uploadLogo(
  file: File,
  maxWidth: number = MAX_LOGO_WIDTH,
  maxHeight: number = MAX_LOGO_HEIGHT
): Promise<LogoUploadResult> {
  try {
    // Validate file
    const validation = validateLogoFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error!,
        },
      };
    }

    // Load image
    const img = await loadImage(file);

    // Resize if needed
    const { dataUrl, dimensions } = await resizeImage(img, maxWidth, maxHeight);

    // Create logo configuration
    const logoConfig: LogoConfig = {
      data: dataUrl,
      filename: file.name,
      mimeType: 'image/png', // Always convert to PNG for consistency
      width: dimensions.width,
      height: dimensions.height,
      maxWidth,
      maxHeight,
      uploadedAt: Date.now(),
    };

    return {
      success: true,
      data: logoConfig,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Failed to process logo',
      },
    };
  }
}

/**
 * Get logo display dimensions for invoice preview
 * Scales logo to fit within specified bounds while maintaining aspect ratio
 */
export function getLogoDisplayDimensions(
  logo: LogoConfig,
  maxDisplayWidth: number = 150,
  maxDisplayHeight: number = 80
): ImageDimensions {
  return calculateResizedDimensions(
    logo.width,
    logo.height,
    maxDisplayWidth,
    maxDisplayHeight
  );
}

/**
 * Convert data URL to blob for storage
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const contentType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const raw = atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Estimate storage size for logo config
 */
export function estimateLogoSize(logo: LogoConfig): number {
  // Data URL includes base64 encoding overhead (~33% larger than raw data)
  // Also includes metadata
  const dataUrlSize = logo.data.length;
  const metadataSize = JSON.stringify({
    filename: logo.filename,
    mimeType: logo.mimeType,
    width: logo.width,
    height: logo.height,
    maxWidth: logo.maxWidth,
    maxHeight: logo.maxHeight,
    uploadedAt: logo.uploadedAt,
  }).length;

  return dataUrlSize + metadataSize;
}
