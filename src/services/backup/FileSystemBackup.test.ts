/**
 * Tests for File System Access API Integration
 *
 * Comprehensive test suite for Task 2.1 implementation.
 * Tests browser support detection, permission flows, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  detectBrowserSupport,
  requestFolderPermission,
  storeDirectoryHandle,
  retrieveDirectoryHandle,
  verifyDirectoryPermission,
  requestPermissionReauthorization,
  clearDirectoryHandle,
  getBackupDirectoryStatus,
  testDirectoryWriteAccess,
  writeBackupToFile,
  type BackupProgressCallback,
} from './FileSystemBackup';
import type { SecureBackupBundle } from './BackupEncryption';

// Mock FileSystemDirectoryHandle
class MockFileSystemDirectoryHandle {
  name: string;
  private permissionState: PermissionState = 'prompt';

  constructor(name: string, permissionState: PermissionState = 'prompt') {
    this.name = name;
    this.permissionState = permissionState;
  }

  async queryPermission(): Promise<PermissionState> {
    return this.permissionState;
  }

  async requestPermission(): Promise<PermissionState> {
    // Simulate user granting permission
    this.permissionState = 'granted';
    return this.permissionState;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> {
    return new MockFileSystemFileHandle(name) as unknown as FileSystemFileHandle;
  }

  async removeEntry(name: string): Promise<void> {
    // Mock removal
  }
}

class MockFileSystemFileHandle {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    return {
      write: async () => {},
      close: async () => {},
    } as unknown as FileSystemWritableFileStream;
  }
}

// Mock IndexedDB
class MockIDBDatabase {
  objectStoreNames = {
    contains: (name: string) => false,
  };

  transaction(storeNames: string[], mode: IDBTransactionMode): MockIDBTransaction {
    return new MockIDBTransaction(storeNames, mode);
  }

  createObjectStore(name: string, options?: IDBObjectStoreParameters): MockIDBObjectStore {
    return new MockIDBObjectStore();
  }
}

class MockIDBTransaction {
  oncomplete: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  error: Error | null = null;

  constructor(
    public storeNames: string[],
    public mode: IDBTransactionMode
  ) {}

  objectStore(name: string): MockIDBObjectStore {
    return new MockIDBObjectStore();
  }
}

class MockIDBObjectStore {
  private storage: Map<string, unknown> = new Map();

  async get(key: string): Promise<unknown> {
    return this.storage.get(key) || null;
  }

  async put(value: unknown): Promise<void> {
    if (value && typeof value === 'object' && 'id' in value) {
      this.storage.set((value as { id: string }).id, value);
    }
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
}

describe('FileSystemBackup - Browser Support Detection', () => {
  beforeEach(() => {
    // Reset window mock
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/100.0.0.0',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should detect supported browser (Chrome)', () => {
    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(),
    });

    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/100.0.0.0 Safari/537.36',
    });

    const result = detectBrowserSupport();

    expect(result.supported).toBe(true);
    expect(result.browser).toBe('Chrome');
    expect(result.version).toBe('100');
  });

  it('should detect supported browser (Edge)', () => {
    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(),
    });

    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/95.0.1020.30',
    });

    const result = detectBrowserSupport();

    expect(result.supported).toBe(true);
    expect(result.browser).toBe('Edge');
    expect(result.version).toBe('95');
  });

  it('should detect unsupported browser (no API)', () => {
    vi.stubGlobal('window', {});

    const result = detectBrowserSupport();

    expect(result.supported).toBe(false);
    expect(result.reason).toBe('File System Access API not available in this browser');
  });

  it('should detect unsupported browser (Firefox)', () => {
    vi.stubGlobal('window', {});

    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0',
    });

    const result = detectBrowserSupport();

    expect(result.supported).toBe(false);
  });

  it('should detect unsupported browser (Safari)', () => {
    vi.stubGlobal('window', {});

    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/15.0 Safari/605.1.15',
    });

    const result = detectBrowserSupport();

    expect(result.supported).toBe(false);
  });

  it('should handle detection errors gracefully', () => {
    vi.stubGlobal('window', {
      showDirectoryPicker: null,
    });

    // Force error by making userAgent throw
    Object.defineProperty(navigator, 'userAgent', {
      get: () => {
        throw new Error('Test error');
      },
    });

    const result = detectBrowserSupport();

    expect(result.supported).toBe(false);
    expect(result.reason).toBe('Error checking browser capabilities');
  });
});

describe('FileSystemBackup - Folder Permission Request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should successfully request folder permission', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'granted');

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockResolvedValue(mockHandle),
    });

    const result = await requestFolderPermission();

    expect(result.success).toBe(true);
    expect(result.handle).toBe(mockHandle);
    expect(result.permissionState).toBe('granted');
  });

  it('should request permission if not initially granted', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'prompt');

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockResolvedValue(mockHandle),
    });

    const result = await requestFolderPermission();

    expect(result.success).toBe(true);
    expect(result.permissionState).toBe('granted');
  });

  it('should handle permission denial', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'denied');
    mockHandle.requestPermission = vi.fn().mockResolvedValue('denied');

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockResolvedValue(mockHandle),
    });

    const result = await requestFolderPermission();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PERMISSION_DENIED');
  });

  it('should handle user cancellation (AbortError)', async () => {
    const abortError = new Error('User cancelled');
    abortError.name = 'AbortError';

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockRejectedValue(abortError),
    });

    const result = await requestFolderPermission();

    expect(result.success).toBe(false);
    expect(result.error).toContain('cancelled');
    expect(result.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should handle security error', async () => {
    const securityError = new Error('User gesture required');
    securityError.name = 'SecurityError';

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockRejectedValue(securityError),
    });

    const result = await requestFolderPermission();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PERMISSION_DENIED');
  });

  it('should handle unsupported browser', async () => {
    vi.stubGlobal('window', {});

    const result = await requestFolderPermission();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NOT_IMPLEMENTED');
  });

  it('should handle unknown errors', async () => {
    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockRejectedValue(new Error('Unknown error')),
    });

    const result = await requestFolderPermission();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNKNOWN_ERROR');
  });

  it('should support read-only mode', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'granted');

    const mockShowPicker = vi.fn().mockResolvedValue(mockHandle);
    vi.stubGlobal('window', {
      showDirectoryPicker: mockShowPicker,
    });

    await requestFolderPermission('read');

    expect(mockShowPicker).toHaveBeenCalledWith({
      mode: 'read',
      startIn: 'documents',
    });
  });

  it('should handle null directory handle', async () => {
    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockResolvedValue(null),
    });

    const result = await requestFolderPermission();

    expect(result.success).toBe(false);
    expect(result.error).toContain('No folder selected');
  });
});

describe('FileSystemBackup - Directory Handle Storage', () => {
  let mockDB: MockIDBDatabase;

  beforeEach(() => {
    mockDB = new MockIDBDatabase();

    vi.stubGlobal('indexedDB', {
      open: vi.fn((name: string, version: number) => {
        const request = {
          result: mockDB,
          error: null,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onupgradeneeded: null as ((event: { target: { result: MockIDBDatabase } }) => void) | null,
        };

        setTimeout(() => {
          if (request.onupgradeneeded) {
            request.onupgradeneeded({ target: { result: mockDB } });
          }
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should store directory handle successfully', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'granted');

    const result = await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.success).toBe(true);
  });

  it('should handle storage errors', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'granted');

    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        const request = {
          result: null,
          error: new Error('Storage error'),
          onsuccess: null,
          onerror: null as (() => void) | null,
          onupgradeneeded: null,
        };

        setTimeout(() => {
          if (request.onerror) {
            request.onerror();
          }
        }, 0);

        return request;
      }),
    });

    const result = await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('FileSystemBackup - Permission Verification', () => {
  it('should verify granted permission', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'granted');

    const result = await verifyDirectoryPermission(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.granted).toBe(true);
    expect(result.needsReauthorization).toBe(false);
  });

  it('should detect need for reauthorization', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'prompt');

    const result = await verifyDirectoryPermission(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.granted).toBe(false);
    expect(result.needsReauthorization).toBe(true);
  });

  it('should detect denied permission', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'denied');

    const result = await verifyDirectoryPermission(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.granted).toBe(false);
    expect(result.needsReauthorization).toBe(true);
    expect(result.error).toContain('revoked');
  });

  it('should handle verification errors', async () => {
    const mockHandle = {
      name: 'TestFolder',
      queryPermission: vi.fn().mockRejectedValue(new Error('Query failed')),
    };

    const result = await verifyDirectoryPermission(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.granted).toBe(false);
    expect(result.needsReauthorization).toBe(true);
  });

  it('should support read-only permission check', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'granted');
    const queryMock = vi.spyOn(mockHandle, 'queryPermission');

    await verifyDirectoryPermission(mockHandle as unknown as FileSystemDirectoryHandle, 'read');

    expect(queryMock).toHaveBeenCalledWith({ mode: 'read' });
  });
});

describe('FileSystemBackup - Permission Reauthorization', () => {
  it('should successfully reauthorize permission', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'prompt');

    // Mock IndexedDB for update
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        const request = {
          result: new MockIDBDatabase(),
          error: null,
          onsuccess: null as (() => void) | null,
          onerror: null,
          onupgradeneeded: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      }),
    });

    const result = await requestPermissionReauthorization(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.success).toBe(true);
  });

  it('should handle reauthorization denial', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'denied');
    mockHandle.requestPermission = vi.fn().mockResolvedValue('denied');

    const result = await requestPermissionReauthorization(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.success).toBe(false);
    expect(result.error).toContain('permission');
  });

  it('should handle reauthorization errors', async () => {
    const mockHandle = {
      name: 'TestFolder',
      requestPermission: vi.fn().mockRejectedValue(new Error('Request failed')),
    };

    const result = await requestPermissionReauthorization(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.success).toBe(false);
  });
});

describe('FileSystemBackup - Directory Handle Clearing', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        const request = {
          result: new MockIDBDatabase(),
          error: null,
          onsuccess: null as (() => void) | null,
          onerror: null,
          onupgradeneeded: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should clear directory handle successfully', async () => {
    const result = await clearDirectoryHandle();

    expect(result.success).toBe(true);
  });

  it('should handle clearing errors', async () => {
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        const request = {
          result: null,
          error: new Error('Clear error'),
          onsuccess: null,
          onerror: null as (() => void) | null,
          onupgradeneeded: null,
        };

        setTimeout(() => {
          if (request.onerror) {
            request.onerror();
          }
        }, 0);

        return request;
      }),
    });

    const result = await clearDirectoryHandle();

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('FileSystemBackup - Directory Write Access Test', () => {
  it('should successfully test write access', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'granted');

    const result = await testDirectoryWriteAccess(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.success).toBe(true);
  });

  it('should handle write access failure', async () => {
    const mockHandle = {
      name: 'TestFolder',
      getFileHandle: vi.fn().mockRejectedValue(new Error('Write failed')),
      removeEntry: vi.fn(),
    };

    const result = await testDirectoryWriteAccess(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should clean up test file after success', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'granted');
    const removeEntrySpy = vi.spyOn(mockHandle, 'removeEntry');

    await testDirectoryWriteAccess(mockHandle as unknown as FileSystemDirectoryHandle);

    expect(removeEntrySpy).toHaveBeenCalled();
  });
});

describe('FileSystemBackup - Backup Directory Status', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        const request = {
          result: new MockIDBDatabase(),
          error: null,
          onsuccess: null as (() => void) | null,
          onerror: null,
          onupgradeneeded: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return unconfigured status when no handle stored', async () => {
    const status = await getBackupDirectoryStatus();

    expect(status.configured).toBe(false);
  });

  it('should handle status check errors', async () => {
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        throw new Error('Status check error');
      }),
    });

    const status = await getBackupDirectoryStatus();

    expect(status.configured).toBe(false);
  });
});

describe('FileSystemBackup - Integration Tests', () => {
  it('should complete full permission flow', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'prompt');

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockResolvedValue(mockHandle),
    });

    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        const request = {
          result: new MockIDBDatabase(),
          error: null,
          onsuccess: null as (() => void) | null,
          onerror: null,
          onupgradeneeded: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      }),
    });

    // Step 1: Request permission
    const permissionResult = await requestFolderPermission();
    expect(permissionResult.success).toBe(true);

    // Step 2: Store handle
    if (permissionResult.handle) {
      const storeResult = await storeDirectoryHandle(permissionResult.handle);
      expect(storeResult.success).toBe(true);
    }

    // Step 3: Verify permission
    if (permissionResult.handle) {
      const verifyResult = await verifyDirectoryPermission(permissionResult.handle);
      expect(verifyResult.granted).toBe(true);
    }
  });

  it('should handle permission revocation gracefully', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'denied');

    // Verify detects revocation
    const verifyResult = await verifyDirectoryPermission(mockHandle as unknown as FileSystemDirectoryHandle);
    expect(verifyResult.granted).toBe(false);
    expect(verifyResult.needsReauthorization).toBe(true);

    // Reauthorization fails
    mockHandle.requestPermission = vi.fn().mockResolvedValue('denied');
    const reauthorizeResult = await requestPermissionReauthorization(mockHandle as unknown as FileSystemDirectoryHandle);
    expect(reauthorizeResult.success).toBe(false);
  });
});

describe('FileSystemBackup - Edge Cases', () => {
  it('should handle rapid permission state changes', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'prompt');

    // Verify initially prompts
    let result = await verifyDirectoryPermission(mockHandle as unknown as FileSystemDirectoryHandle);
    expect(result.needsReauthorization).toBe(true);

    // Grant permission
    mockHandle.requestPermission = vi.fn().mockResolvedValue('granted');
    Object.defineProperty(mockHandle, 'permissionState', { value: 'granted', writable: true });

    // Verify now granted
    result = await verifyDirectoryPermission(mockHandle as unknown as FileSystemDirectoryHandle);
    expect(result.granted).toBe(true);
  });

  it('should handle concurrent permission requests', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('TestFolder', 'prompt');

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockResolvedValue(mockHandle),
    });

    // Make multiple concurrent requests
    const results = await Promise.all([
      requestFolderPermission(),
      requestFolderPermission(),
      requestFolderPermission(),
    ]);

    // All should succeed
    results.forEach((result) => {
      expect(result.success).toBe(true);
    });
  });

  it('should handle very long folder names', async () => {
    const longName = 'A'.repeat(1000);
    const mockHandle = new MockFileSystemDirectoryHandle(longName, 'granted');

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockResolvedValue(mockHandle),
    });

    const result = await requestFolderPermission();

    expect(result.success).toBe(true);
    expect(result.handle?.name).toBe(longName);
  });

  it('should handle special characters in folder names', async () => {
    const specialName = 'Test-Folder_123!@#$%';
    const mockHandle = new MockFileSystemDirectoryHandle(specialName, 'granted');

    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn().mockResolvedValue(mockHandle),
    });

    const result = await requestFolderPermission();

    expect(result.success).toBe(true);
    expect(result.handle?.name).toBe(specialName);
  });
});

// ============================================================================
// Task 2.5: Backup Writing & Storage Tests
// ============================================================================

/**
 * Helper to create a mock backup bundle for testing
 */
function createMockBackupBundle(): SecureBackupBundle {
  return {
    version: '1.0',
    metadata: {
      companyId: 'test-company-123',
      userId: 'test-user-456',
      userRole: 'Admin',
      timestamp: Date.now(),
      keyRotationEpoch: 1,
    },
    encryptedData: {
      transactions: 'encrypted-transactions-data',
      accounts: 'encrypted-accounts-data',
      reports: 'encrypted-reports-data',
      preferences: 'encrypted-preferences-data',
    },
    encryptedKeys: {
      derivedKey: 'encrypted-derived-key',
      keyId: 'key-123',
      salt: 'random-salt-base64',
      iterations: 3,
      memoryCost: 65536,
      parallelism: 4,
    },
    integrity: {
      hmac: 'hmac-signature',
      hmacSalt: 'hmac-salt-base64',
    },
  };
}

describe('FileSystemBackup - writeBackupToFile (Task 2.5)', () => {
  beforeEach(() => {
    // Setup standard mocks
    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(),
      isSecureContext: true,
    });

    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        const mockDB = new MockIDBDatabase();
        const request = {
          result: mockDB,
          error: null,
          onsuccess: null as (() => void) | null,
          onerror: null,
          onupgradeneeded: null as ((event: { target: { result: MockIDBDatabase } }) => void) | null,
        };

        setTimeout(() => {
          if (request.onupgradeneeded) {
            request.onupgradeneeded({ target: { result: mockDB } });
          }
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should write backup successfully with progress tracking', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'granted');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    const bundle = createMockBackupBundle();
    const fileName = 'audacious-backup-2026-03-29-120000.encrypted';
    const progressUpdates: Array<{ phase: string; percent: number }> = [];

    const onProgress: BackupProgressCallback = (progress) => {
      progressUpdates.push({
        phase: progress.phase,
        percent: progress.percent,
      });
    };

    const result = await writeBackupToFile({
      bundle,
      fileName,
      onProgress,
    });

    expect(result.success).toBe(true);
    expect(result.fileName).toBe(fileName);
    expect(result.filePath).toBe('BackupFolder');
    expect(result.fileSize).toBeGreaterThan(0);

    // Verify progress phases
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[0].phase).toBe('preparing');
    expect(progressUpdates[progressUpdates.length - 1].phase).toBe('complete');
    expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);
  });

  it('should fail when no directory handle is stored', async () => {
    const bundle = createMockBackupBundle();

    const result = await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('VALIDATION_ERROR');
    expect(result.error).toContain('No backup folder');
  });

  it('should fail when permission is revoked', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'denied');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    const bundle = createMockBackupBundle();

    const result = await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PERMISSION_DENIED');
    expect(result.error).toContain('permission');
  });

  it('should handle disk space errors (QuotaExceededError)', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'granted');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    // Mock createWritable to throw QuotaExceededError
    const mockFileHandle = new MockFileSystemFileHandle('test.encrypted');
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    mockFileHandle.createWritable = vi.fn().mockRejectedValue(quotaError);

    mockHandle.getFileHandle = vi.fn().mockResolvedValue(mockFileHandle);

    const bundle = createMockBackupBundle();

    const result = await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('CONSTRAINT_VIOLATION');
    expect(result.error).toContain('disk space');
  });

  it('should handle serialization errors', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'granted');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    // Create bundle with circular reference
    const bundle: any = createMockBackupBundle();
    bundle.circular = bundle;

    const result = await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ENCRYPTION_ERROR');
    expect(result.error).toContain('prepare your backup');
  });

  it('should handle write errors and abort stream', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'granted');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    const mockFileHandle = new MockFileSystemFileHandle('test.encrypted');
    const mockWritable = {
      write: vi.fn().mockRejectedValue(new Error('Write failed')),
      close: vi.fn(),
      abort: vi.fn().mockResolvedValue(undefined),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritable as any);
    mockHandle.getFileHandle = vi.fn().mockResolvedValue(mockFileHandle);

    const bundle = createMockBackupBundle();

    const result = await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
    });

    expect(result.success).toBe(false);
    expect(mockWritable.abort).toHaveBeenCalled();
  });

  it('should handle file creation errors', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'granted');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    mockHandle.getFileHandle = vi
      .fn()
      .mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));

    const bundle = createMockBackupBundle();

    const result = await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PERMISSION_DENIED');
  });

  it('should fail on unsupported browser', async () => {
    delete (global as any).window.showDirectoryPicker;

    const bundle = createMockBackupBundle();

    const result = await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NOT_IMPLEMENTED');
  });

  it('should serialize bundle with pretty printing', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'granted');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    let writtenContent: string = '';
    const mockFileHandle = new MockFileSystemFileHandle('test.encrypted');
    const mockWritable = {
      write: vi.fn((content: string) => {
        writtenContent += content;
        return Promise.resolve();
      }),
      close: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn(),
    };

    mockFileHandle.createWritable = vi.fn().mockResolvedValue(mockWritable as any);
    mockHandle.getFileHandle = vi.fn().mockResolvedValue(mockFileHandle);

    const bundle = createMockBackupBundle();

    await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
    });

    expect(writtenContent).toContain('\n'); // Pretty printed with newlines
    expect(writtenContent).toContain('"version": "1.0"');
  });

  it('should track all progress phases in order', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'granted');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    const bundle = createMockBackupBundle();
    const phases: string[] = [];

    const onProgress: BackupProgressCallback = (progress) => {
      phases.push(progress.phase);
    };

    await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
      onProgress,
    });

    // Verify phase order
    expect(phases).toContain('preparing');
    expect(phases).toContain('serializing');
    expect(phases).toContain('writing');
    expect(phases).toContain('verifying');
    expect(phases).toContain('complete');

    // Verify phases are in correct order
    expect(phases.indexOf('preparing')).toBeLessThan(phases.indexOf('serializing'));
    expect(phases.indexOf('serializing')).toBeLessThan(phases.indexOf('writing'));
    expect(phases.indexOf('writing')).toBeLessThan(phases.indexOf('verifying'));
    expect(phases.indexOf('verifying')).toBeLessThan(phases.indexOf('complete'));
  });

  it('should include total bytes in progress updates', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'granted');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    const bundle = createMockBackupBundle();
    let totalBytes: number | undefined;

    const onProgress: BackupProgressCallback = (progress) => {
      if (progress.totalBytes && progress.totalBytes > 0) {
        totalBytes = progress.totalBytes;
      }
    };

    await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
      onProgress,
    });

    expect(totalBytes).toBeDefined();
    expect(totalBytes!).toBeGreaterThan(0);
  });

  it('should handle large backup bundles', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'granted');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    // Create large bundle
    const largeBundle = createMockBackupBundle();
    largeBundle.encryptedData.transactions = 'x'.repeat(1000000); // 1MB of data

    const result = await writeBackupToFile({
      bundle: largeBundle,
      fileName: 'large-backup.encrypted',
    });

    expect(result.success).toBe(true);
    expect(result.fileSize!).toBeGreaterThan(1000000);
  });

  it('should handle permission prompt state', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('BackupFolder', 'prompt');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    const bundle = createMockBackupBundle();

    const result = await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PERMISSION_DENIED');
    expect(result.error).toContain('re-select your backup folder');
  });
});

describe('FileSystemBackup - Integration: Full Backup Flow with Write', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      showDirectoryPicker: vi.fn(),
      isSecureContext: true,
    });

    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => {
        const mockDB = new MockIDBDatabase();
        const request = {
          result: mockDB,
          error: null,
          onsuccess: null as (() => void) | null,
          onerror: null,
          onupgradeneeded: null as ((event: { target: { result: MockIDBDatabase } }) => void) | null,
        };

        setTimeout(() => {
          if (request.onupgradeneeded) {
            request.onupgradeneeded({ target: { result: mockDB } });
          }
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should complete full backup flow from permission request to file write', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('MyBackups', 'granted');
    (global as any).window.showDirectoryPicker = vi.fn().mockResolvedValue(mockHandle);

    // Step 1: Request permission
    const permissionResult = await requestFolderPermission();
    expect(permissionResult.success).toBe(true);

    // Step 2: Store handle
    if (permissionResult.handle) {
      const storeResult = await storeDirectoryHandle(permissionResult.handle);
      expect(storeResult.success).toBe(true);
    }

    // Step 3: Write backup
    const bundle = createMockBackupBundle();
    const writeResult = await writeBackupToFile({
      bundle,
      fileName: 'audacious-backup-2026-03-29-120000.encrypted',
    });

    expect(writeResult.success).toBe(true);
    expect(writeResult.fileName).toBe('audacious-backup-2026-03-29-120000.encrypted');
    expect(writeResult.fileSize).toBeGreaterThan(0);
    expect(writeResult.filePath).toBe('MyBackups');

    // Step 4: Verify status
    const status = await getBackupDirectoryStatus();
    expect(status.configured).toBe(true);
    expect(status.permissionGranted).toBe(true);
  });

  it('should handle permission revocation during backup flow', async () => {
    const mockHandle = new MockFileSystemDirectoryHandle('MyBackups', 'granted');
    await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

    // Revoke permission
    Object.defineProperty(mockHandle, 'permissionState', {
      value: 'denied',
      writable: true,
    });

    const bundle = createMockBackupBundle();
    const writeResult = await writeBackupToFile({
      bundle,
      fileName: 'test-backup.encrypted',
    });

    expect(writeResult.success).toBe(false);
    expect(writeResult.errorCode).toBe('PERMISSION_DENIED');
  });
});
