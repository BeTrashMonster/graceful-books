/**
 * BackupFallback Tests
 *
 * Comprehensive tests for Task 2.8: Fallback for Unsupported Browsers
 *
 * Test Coverage:
 * - Browser capability detection
 * - Manual download/upload functionality
 * - File validation
 * - Error handling
 * - User messaging
 * - Safari/Firefox compatibility
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  detectBackupCapabilities,
  createManualBackupDownload,
  restoreFromManualUpload,
  getUnsupportedBrowserNotification,
  getBrowserRecommendationMessage,
  isAutomaticBackupSupported,
  validateBackupFile,
  getFriendlyBackupErrorMessage,
  BackupFallback,
  type BrowserCapabilities,
  type BackupCapabilityResult,
} from './BackupFallback';
import { BackupService } from './backupService';
import { AppError, ErrorCode } from '../../utils/errors';

// Mock the BackupService
vi.mock('./backupService', () => ({
  BackupService: {
    createBackup: vi.fn(),
    restoreBackup: vi.fn(),
    downloadBackup: vi.fn(),
    validateBackup: vi.fn(),
  },
}));

describe('BackupFallback', () => {
  // Store original values
  const originalShowDirectoryPicker = (window as any).showDirectoryPicker;
  const originalIndexedDB = (window as any).indexedDB;
  const originalCryptoSubtle = window.crypto.subtle;

  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Reset window properties to defaults for each test
    // Each test will override as needed
  });

  // Restore original values after all tests
  afterAll(() => {
    if (originalShowDirectoryPicker) {
      (window as any).showDirectoryPicker = originalShowDirectoryPicker;
    }
    if (originalIndexedDB) {
      (window as any).indexedDB = originalIndexedDB;
    }
    if (originalCryptoSubtle) {
      window.crypto.subtle = originalCryptoSubtle;
    }
  });

  describe('detectBackupCapabilities', () => {
    it('should detect full support for Chrome', async () => {
      // Mock Chrome environment
      Object.defineProperty(window, 'showDirectoryPicker', {
        value: vi.fn(),
        configurable: true,
      });
      Object.defineProperty(window, 'indexedDB', {
        value: {},
        configurable: true,
      });
      Object.defineProperty(window.crypto, 'subtle', {
        value: {},
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        configurable: true,
      });

      const result = await detectBackupCapabilities();

      expect(result.capabilities.supportsFileSystemAccess).toBe(true);
      expect(result.capabilities.supportsIndexedDB).toBe(true);
      expect(result.capabilities.supportsWebCrypto).toBe(true);
      expect(result.capabilities.browserName).toBe('Chrome');
      expect(result.recommendedMethod).toBe('file-system-access');
      expect(result.canAutoBackup).toBe(true);
      expect(result.shouldSuggestBrowserChange).toBe(false);
      expect(result.message).toContain('automatic backups');
    });

    it('should detect partial support for Safari', async () => {
      // Mock Safari environment (no File System Access API)
      delete (window as any).showDirectoryPicker;
      Object.defineProperty(window, 'indexedDB', {
        value: {},
        configurable: true,
      });
      Object.defineProperty(window.crypto, 'subtle', {
        value: {},
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        configurable: true,
      });

      const result = await detectBackupCapabilities();

      expect(result.capabilities.supportsFileSystemAccess).toBe(false);
      expect(result.capabilities.supportsIndexedDB).toBe(true);
      expect(result.capabilities.supportsWebCrypto).toBe(true);
      expect(result.capabilities.browserName).toBe('Safari');
      expect(result.recommendedMethod).toBe('manual-download');
      expect(result.canAutoBackup).toBe(false);
      expect(result.shouldSuggestBrowserChange).toBe(true);
      expect(result.message).toContain('manual');
    });

    it('should detect partial support for Firefox', async () => {
      // Mock Firefox environment (no File System Access API)
      delete (window as any).showDirectoryPicker;
      Object.defineProperty(window, 'indexedDB', {
        value: {},
        configurable: true,
      });
      Object.defineProperty(window.crypto, 'subtle', {
        value: {},
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        configurable: true,
      });

      const result = await detectBackupCapabilities();

      expect(result.capabilities.supportsFileSystemAccess).toBe(false);
      expect(result.capabilities.browserName).toBe('Firefox');
      expect(result.recommendedMethod).toBe('manual-download');
      expect(result.canAutoBackup).toBe(false);
      expect(result.shouldSuggestBrowserChange).toBe(true);
    });

    it('should detect Edge browser correctly', async () => {
      Object.defineProperty(window, 'showDirectoryPicker', {
        value: vi.fn(),
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        configurable: true,
      });

      const result = await detectBackupCapabilities();

      expect(result.capabilities.browserName).toBe('Edge');
      expect(result.capabilities.supportsFileSystemAccess).toBe(true);
      expect(result.canAutoBackup).toBe(true);
    });

    it('should handle unknown browsers gracefully', async () => {
      delete (window as any).showDirectoryPicker;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'SomeFutureBrowser/1.0',
        configurable: true,
      });

      const result = await detectBackupCapabilities();

      expect(result.capabilities.browserName).toBe('Unknown');
      expect(result.recommendedMethod).toBe('manual-download');
      expect(result.shouldSuggestBrowserChange).toBe(true);
    });

    it('should handle errors during detection', async () => {
      // Force an error by making userAgent throw
      Object.defineProperty(navigator, 'userAgent', {
        get() {
          throw new Error('Test error');
        },
        configurable: true,
      });

      const result = await detectBackupCapabilities();

      // Should return safe fallback
      expect(result.recommendedMethod).toBe('manual-download');
      expect(result.message).toContain('manual');
    });

    it('should include supported browsers list', async () => {
      const result = await detectBackupCapabilities();

      expect(result.supportedBrowsers).toContain('Chrome 86 or later');
      expect(result.supportedBrowsers).toContain('Microsoft Edge 86 or later');
    });
  });

  describe('createManualBackupDownload', () => {
    it('should create and trigger manual backup download', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/json' });
      const mockBackup = {
        version: 1,
        createdAt: Date.now(),
        encryptedData: 'encrypted',
      };

      (BackupService.createBackup as Mock).mockResolvedValue({
        success: true,
        backup: mockBackup,
        blob: mockBlob,
        filename: 'test-backup.gbbackup',
      });

      (BackupService.downloadBackup as Mock).mockImplementation(() => {});

      const result = await createManualBackupDownload({
        passphrase: 'test-passphrase',
        includeAuditLogs: true,
      });

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-backup.gbbackup');
      expect(BackupService.createBackup).toHaveBeenCalledWith('test-passphrase', true);
      expect(BackupService.downloadBackup).toHaveBeenCalledWith(
        mockBlob,
        'test-backup.gbbackup'
      );
    });

    it('should reject empty passphrase', async () => {
      const result = await createManualBackupDownload({
        passphrase: '',
        includeAuditLogs: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('passphrase is required');
      expect(BackupService.createBackup).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only passphrase', async () => {
      const result = await createManualBackupDownload({
        passphrase: '   ',
        includeAuditLogs: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('passphrase is required');
    });

    it('should use custom filename if provided', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/json' });

      (BackupService.createBackup as Mock).mockResolvedValue({
        success: true,
        blob: mockBlob,
        filename: 'default-name.gbbackup',
      });

      (BackupService.downloadBackup as Mock).mockImplementation(() => {});

      const result = await createManualBackupDownload({
        passphrase: 'test-passphrase',
        filename: 'custom-name.gbbackup',
      });

      expect(result.success).toBe(true);
      expect(result.filename).toBe('custom-name.gbbackup');
      expect(BackupService.downloadBackup).toHaveBeenCalledWith(
        mockBlob,
        'custom-name.gbbackup'
      );
    });

    it('should handle backup creation failure', async () => {
      (BackupService.createBackup as Mock).mockResolvedValue({
        success: false,
        error: 'Backup creation failed',
      });

      const result = await createManualBackupDownload({
        passphrase: 'test-passphrase',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Backup creation failed');
    });

    it('should handle exceptions during download', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/json' });

      (BackupService.createBackup as Mock).mockResolvedValue({
        success: true,
        blob: mockBlob,
        filename: 'test-backup.gbbackup',
      });

      (BackupService.downloadBackup as Mock).mockImplementation(() => {
        throw new Error('Download failed');
      });

      const result = await createManualBackupDownload({
        passphrase: 'test-passphrase',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Something went wrong');
    });

    it('should default includeAuditLogs to true', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/json' });

      (BackupService.createBackup as Mock).mockResolvedValue({
        success: true,
        blob: mockBlob,
        filename: 'test-backup.gbbackup',
      });

      (BackupService.downloadBackup as Mock).mockImplementation(() => {});

      await createManualBackupDownload({
        passphrase: 'test-passphrase',
      });

      expect(BackupService.createBackup).toHaveBeenCalledWith('test-passphrase', true);
    });
  });

  describe('restoreFromManualUpload', () => {
    const createMockFile = (content: string, name: string = 'backup.gbbackup'): File => {
      const blob = new Blob([content], { type: 'application/json' });
      const file = new File([blob], name, { type: 'application/json' });
      // Ensure text() method is available in test environment
      if (!file.text) {
        (file as any).text = async () => content;
      }
      return file;
    };

    it('should restore from manual upload successfully', async () => {
      const mockFile = createMockFile('{"test": "data"}');

      (BackupService.restoreBackup as Mock).mockResolvedValue({
        success: true,
        recordsRestored: 100,
        details: {
          accounts: 10,
          transactions: 50,
          contacts: 20,
          products: 15,
          companies: 5,
        },
      });

      const result = await restoreFromManualUpload({
        file: mockFile,
        passphrase: 'test-passphrase',
        clearExisting: true,
      });

      expect(result.success).toBe(true);
      expect(result.recordsRestored).toBe(100);
      expect(BackupService.restoreBackup).toHaveBeenCalledWith(
        mockFile,
        'test-passphrase',
        true
      );
    });

    it('should reject missing file', async () => {
      const result = await restoreFromManualUpload({
        file: null as any,
        passphrase: 'test-passphrase',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('select a backup file');
      expect(BackupService.restoreBackup).not.toHaveBeenCalled();
    });

    it('should reject empty passphrase', async () => {
      const mockFile = createMockFile('{"test": "data"}');

      const result = await restoreFromManualUpload({
        file: mockFile,
        passphrase: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('passphrase is required');
      expect(BackupService.restoreBackup).not.toHaveBeenCalled();
    });

    it('should accept files without .gbbackup extension', async () => {
      const mockFile = createMockFile('{"test": "data"}', 'backup.json');

      (BackupService.restoreBackup as Mock).mockResolvedValue({
        success: true,
        recordsRestored: 50,
      });

      const result = await restoreFromManualUpload({
        file: mockFile,
        passphrase: 'test-passphrase',
      });

      // Should succeed despite different extension
      expect(result.success).toBe(true);
      expect(BackupService.restoreBackup).toHaveBeenCalled();
    });

    it('should default clearExisting to true', async () => {
      const mockFile = createMockFile('{"test": "data"}');

      (BackupService.restoreBackup as Mock).mockResolvedValue({
        success: true,
        recordsRestored: 50,
      });

      await restoreFromManualUpload({
        file: mockFile,
        passphrase: 'test-passphrase',
      });

      expect(BackupService.restoreBackup).toHaveBeenCalledWith(
        mockFile,
        'test-passphrase',
        true
      );
    });

    it('should respect clearExisting false', async () => {
      const mockFile = createMockFile('{"test": "data"}');

      (BackupService.restoreBackup as Mock).mockResolvedValue({
        success: true,
        recordsRestored: 50,
      });

      await restoreFromManualUpload({
        file: mockFile,
        passphrase: 'test-passphrase',
        clearExisting: false,
      });

      expect(BackupService.restoreBackup).toHaveBeenCalledWith(
        mockFile,
        'test-passphrase',
        false
      );
    });

    it('should handle restore failure', async () => {
      const mockFile = createMockFile('{"test": "data"}');

      (BackupService.restoreBackup as Mock).mockResolvedValue({
        success: false,
        error: 'Wrong passphrase',
      });

      const result = await restoreFromManualUpload({
        file: mockFile,
        passphrase: 'wrong-passphrase',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Wrong passphrase');
    });

    it('should handle exceptions during restore', async () => {
      const mockFile = createMockFile('{"test": "data"}');

      (BackupService.restoreBackup as Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await restoreFromManualUpload({
        file: mockFile,
        passphrase: 'test-passphrase',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Something went wrong');
    });
  });

  describe('validateBackupFile', () => {
    const createMockFile = (
      content: string,
      name: string = 'backup.gbbackup',
      size?: number
    ): File => {
      const blob = new Blob([content], { type: 'application/json' });
      const file = new File([blob], name, { type: 'application/json' });
      if (size !== undefined) {
        Object.defineProperty(file, 'size', { value: size });
      }
      // Ensure text() method is available in test environment
      if (!file.text) {
        (file as any).text = async () => content;
      }
      return file;
    };

    it('should validate correct backup file', async () => {
      const validBackup = JSON.stringify({
        version: 1,
        createdAt: Date.now(),
        encryptedData: 'test',
      });
      const mockFile = createMockFile(validBackup);

      const result = await validateBackupFile(mockFile);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject null/undefined file', async () => {
      const result = await validateBackupFile(null as any);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('select a file');
    });

    it('should reject empty file', async () => {
      const mockFile = createMockFile('', 'backup.gbbackup', 0);

      const result = await validateBackupFile(mockFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject overly large file', async () => {
      const mockFile = createMockFile('test', 'backup.gbbackup', 150 * 1024 * 1024);

      const result = await validateBackupFile(mockFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('unusually large');
    });

    it('should validate file without .gbbackup extension', async () => {
      const validBackup = JSON.stringify({
        version: 1,
        createdAt: Date.now(),
        encryptedData: 'test',
      });
      const mockFile = createMockFile(validBackup, 'backup.json');

      const result = await validateBackupFile(mockFile);

      // Should still be valid
      expect(result.valid).toBe(true);
    });

    it('should reject invalid JSON', async () => {
      const mockFile = createMockFile('not valid json {');

      const result = await validateBackupFile(mockFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid backup');
    });

    it('should reject file with missing version', async () => {
      const invalidBackup = JSON.stringify({
        createdAt: Date.now(),
        encryptedData: 'test',
      });
      const mockFile = createMockFile(invalidBackup);

      const result = await validateBackupFile(mockFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid backup');
    });

    it('should reject file with missing encryptedData', async () => {
      const invalidBackup = JSON.stringify({
        version: 1,
        createdAt: Date.now(),
      });
      const mockFile = createMockFile(invalidBackup);

      const result = await validateBackupFile(mockFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid backup');
    });

    it('should handle file read errors', async () => {
      const mockFile = {
        name: 'backup.gbbackup',
        size: 100,
        text: vi.fn().mockRejectedValue(new Error('Read error')),
      } as any;

      const result = await validateBackupFile(mockFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('couldn\'t read');
    });
  });

  describe('getUnsupportedBrowserNotification', () => {
    it('should return supportive notification', () => {
      const notification = getUnsupportedBrowserNotification();

      expect(notification.title).toBe('Manual Backups Available');
      expect(notification.type).toBe('info');
      expect(notification.message).toContain('don\'t worry');
      expect(notification.message).toContain('still protect your data');
      expect(notification.showLearnMore).toBe(true);
      expect(notification.learnMoreUrl).toBeDefined();
    });

    it('should include manual backup actions', () => {
      const notification = getUnsupportedBrowserNotification();

      expect(notification.actions).toHaveLength(3);

      const downloadAction = notification.actions.find(
        (a) => a.label === 'Download Backup Now'
      );
      expect(downloadAction?.available).toBe(true);

      const uploadAction = notification.actions.find(
        (a) => a.label === 'Upload Backup File'
      );
      expect(uploadAction?.available).toBe(true);

      const autoAction = notification.actions.find(
        (a) => a.label === 'Automatic Backups'
      );
      expect(autoAction?.available).toBe(false);
    });

    it('should use patient, supportive tone', () => {
      const notification = getUnsupportedBrowserNotification();

      // Check for Steadiness communication markers
      expect(notification.message.toLowerCase()).toContain('don\'t worry');
      expect(notification.message).not.toContain('must');
      expect(notification.message).not.toContain('required');
      expect(notification.message).not.toContain('cannot');
    });
  });

  describe('getBrowserRecommendationMessage', () => {
    it('should provide supportive message for Safari', () => {
      const message = getBrowserRecommendationMessage('Safari');

      expect(message).toContain('Chrome or Edge');
      expect(message).toContain('Safari works great');
      expect(message).not.toContain('must');
      expect(message).not.toContain('required');
    });

    it('should provide supportive message for Firefox', () => {
      const message = getBrowserRecommendationMessage('Firefox');

      expect(message).toContain('Chrome or Edge');
      expect(message).toContain('Firefox works great');
      expect(message).not.toContain('must');
    });

    it('should provide fallback message for unknown browser', () => {
      const message = getBrowserRecommendationMessage('Unknown');

      expect(message).toContain('Chrome');
      expect(message).toContain('Edge');
      expect(message).toContain('version 86 or later');
    });

    it('should handle random browser names gracefully', () => {
      const message = getBrowserRecommendationMessage('FutureBrowser');

      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('isAutomaticBackupSupported', () => {
    it('should return true when File System Access API is available', async () => {
      Object.defineProperty(window, 'showDirectoryPicker', {
        value: vi.fn(),
        configurable: true,
      });

      const result = await isAutomaticBackupSupported();

      expect(result).toBe(true);
    });

    it('should return false when File System Access API is unavailable', async () => {
      delete (window as any).showDirectoryPicker;

      const result = await isAutomaticBackupSupported();

      expect(result).toBe(false);
    });
  });

  describe('getFriendlyBackupErrorMessage', () => {
    it('should handle encryption errors', () => {
      const error = new AppError(
        ErrorCode.ENCRYPTION_ERROR,
        'Encryption failed'
      );

      const message = getFriendlyBackupErrorMessage(error);

      expect(message).toContain('securing your backup');
      expect(message).toContain('try again');
      expect(message).not.toContain('failed');
    });

    it('should handle decryption errors', () => {
      const error = new AppError(
        ErrorCode.DECRYPTION_FAILED,
        'Decryption failed'
      );

      const message = getFriendlyBackupErrorMessage(error);

      expect(message).toContain('passphrase didn\'t work');
      expect(message).toContain('try again');
    });

    it('should handle invalid passphrase errors', () => {
      const error = new AppError(
        ErrorCode.INVALID_PASSPHRASE,
        'Invalid passphrase'
      );

      const message = getFriendlyBackupErrorMessage(error);

      expect(message).toContain('doesn\'t match');
      expect(message).toContain('try again');
    });

    it('should handle validation errors', () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Validation failed'
      );

      const message = getFriendlyBackupErrorMessage(error);

      expect(message).toContain('doesn\'t look quite right');
    });

    it('should handle generic AppError', () => {
      const error = new AppError(
        ErrorCode.UNKNOWN_ERROR,
        'Something went wrong'
      );

      const message = getFriendlyBackupErrorMessage(error);

      expect(message).toBe('Something went wrong');
    });

    it('should handle standard Error', () => {
      const error = new Error('Test error');

      const message = getFriendlyBackupErrorMessage(error);

      expect(message).toContain('Oops!');
      expect(message).toContain('Test error');
    });

    it('should handle unknown error types', () => {
      const error = 'string error';

      const message = getFriendlyBackupErrorMessage(error);

      expect(message).toContain('unexpected');
      expect(message).toContain('try again');
    });

    it('should use Steadiness tone in all messages', () => {
      const errors = [
        new AppError(ErrorCode.ENCRYPTION_ERROR, 'test'),
        new AppError(ErrorCode.DECRYPTION_FAILED, 'test'),
        new Error('test'),
        'test',
      ];

      errors.forEach((error) => {
        const message = getFriendlyBackupErrorMessage(error);

        // Should not contain blaming language
        expect(message.toLowerCase()).not.toContain('invalid');
        expect(message.toLowerCase()).not.toContain('incorrect');
        expect(message.toLowerCase()).not.toContain('wrong input');
      });
    });
  });

  describe('BackupFallback namespace export', () => {
    it('should export all functions', () => {
      expect(BackupFallback.detectBackupCapabilities).toBeDefined();
      expect(BackupFallback.createManualBackupDownload).toBeDefined();
      expect(BackupFallback.restoreFromManualUpload).toBeDefined();
      expect(BackupFallback.getUnsupportedBrowserNotification).toBeDefined();
      expect(BackupFallback.getBrowserRecommendationMessage).toBeDefined();
      expect(BackupFallback.isAutomaticBackupSupported).toBeDefined();
      expect(BackupFallback.validateBackupFile).toBeDefined();
      expect(BackupFallback.getFriendlyBackupErrorMessage).toBeDefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete Safari backup flow', async () => {
      // Setup Safari environment
      delete (window as any).showDirectoryPicker;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Safari/17.0',
        configurable: true,
      });

      // Detect capabilities
      const capabilities = await detectBackupCapabilities();
      expect(capabilities.canAutoBackup).toBe(false);
      expect(capabilities.recommendedMethod).toBe('manual-download');

      // Get notification
      const notification = getUnsupportedBrowserNotification();
      expect(notification.message).toContain('manual');

      // Check if auto backup supported
      const isSupported = await isAutomaticBackupSupported();
      expect(isSupported).toBe(false);
    });

    it('should handle complete Chrome backup flow', async () => {
      // Setup Chrome environment
      Object.defineProperty(window, 'showDirectoryPicker', {
        value: vi.fn(),
        configurable: true,
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Chrome/120.0',
        configurable: true,
      });

      // Detect capabilities
      const capabilities = await detectBackupCapabilities();
      expect(capabilities.canAutoBackup).toBe(true);
      expect(capabilities.recommendedMethod).toBe('file-system-access');

      // Should not need fallback
      const isSupported = await isAutomaticBackupSupported();
      expect(isSupported).toBe(true);
    });
  });
});
