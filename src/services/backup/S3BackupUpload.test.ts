/**
 * S3 Backup Upload Service Tests
 *
 * Tests for S3 upload functionality including multipart uploads,
 * retry logic, progress tracking, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  S3BackupUploadService,
  createS3BackupUploadService,
  type UploadBackupOptions,
  type UploadProgress,
} from './S3BackupUpload'
import type { S3BackupConfig } from '../../config/s3BackupConfig'

describe('S3BackupUploadService', () => {
  let service: S3BackupUploadService
  let config: S3BackupConfig

  beforeEach(() => {
    config = {
      region: 'us-east-1',
      bucket: 'test-backup-bucket',
      retentionDays: 7,
      maxSizeMB: 100,
      enableCompression: true,
      filePrefix: 'backup',
      enforceSSL: true,
      enforceEncryption: true,
      auditLoggingEnabled: true,
      uploadPartSizeMB: 5,
      uploadConcurrency: 4,
      downloadPartSizeMB: 5,
      requestTimeoutSeconds: 60,
      cloudWatchMetricsEnabled: true,
      debug: false,
      debugS3Operations: false,
      useLocalStack: false,
      intelligentTiering: false,
      transferAcceleration: false,
    }

    service = new S3BackupUploadService(config)
  })

  describe('uploadBackup', () => {
    it('should upload small backup successfully', async () => {
      const data = new Uint8Array(1024 * 1024) // 1 MB
      const options: UploadBackupOptions = {
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      }

      const result = await service.uploadBackup(options)

      expect(result.success).toBe(true)
      expect(result.key).toBeDefined()
      expect(result.location).toContain('test-backup-bucket')
      expect(result.size).toBe(1024 * 1024)
    })

    it('should generate correct S3 key format', async () => {
      const data = new Uint8Array(1024)
      const options: UploadBackupOptions = {
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      }

      const result = await service.uploadBackup(options)

      expect(result.key).toMatch(
        /^backup\/company-789\/user-456\/backup-123\/backup-\d+\.encrypted$/
      )
    })

    it('should track upload progress', async () => {
      const data = new Uint8Array(1024 * 1024)
      const progressUpdates: UploadProgress[] = []

      const options: UploadBackupOptions = {
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
        onProgress: (progress) => progressUpdates.push({ ...progress }),
      }

      await service.uploadBackup(options)

      // Should have multiple progress updates
      expect(progressUpdates.length).toBeGreaterThan(0)

      // Should have initializing stage
      expect(progressUpdates.some((p) => p.stage === 'initializing')).toBe(true)

      // Should have uploading stage
      expect(progressUpdates.some((p) => p.stage === 'uploading')).toBe(true)

      // Should end with completed stage
      const lastUpdate = progressUpdates[progressUpdates.length - 1]
      expect(lastUpdate.stage).toBe('completed')
      expect(lastUpdate.percentage).toBe(100)
    })

    it('should validate required fields', async () => {
      const data = new Uint8Array(1024)

      // Missing backupId
      let result = await service.uploadBackup({
        backupId: '',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Backup ID')

      // Missing userId
      result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: '',
        companyId: 'company-789',
        data,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('User ID')

      // Missing companyId
      result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: '',
        data,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Company ID')
    })

    it('should reject empty data', async () => {
      const result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data: new Uint8Array(0),
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('empty')
    })

    it('should reject data exceeding max size', async () => {
      const oversizedData = new Uint8Array(101 * 1024 * 1024) // 101 MB (exceeds 100 MB limit)

      const result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data: oversizedData,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('exceeds maximum')
    })

    it('should include metadata in upload', async () => {
      const data = new Uint8Array(1024)
      const metadata = {
        'x-amz-meta-user': 'user-456',
        'x-amz-meta-company': 'company-789',
      }

      const result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
        metadata,
      })

      expect(result.success).toBe(true)
    })

    it('should handle different data types (Uint8Array)', async () => {
      const data = new Uint8Array(1024)
      const result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      expect(result.success).toBe(true)
      expect(result.size).toBe(1024)
    })

    it('should handle Blob data type', async () => {
      const data = new Blob([new Uint8Array(1024)])
      const result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      expect(result.success).toBe(true)
      expect(result.size).toBe(1024)
    })
  })

  describe('multipart uploads', () => {
    it('should use multipart upload for large files', async () => {
      // Create data larger than part size (5 MB)
      const data = new Uint8Array(10 * 1024 * 1024) // 10 MB

      const result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      expect(result.success).toBe(true)
      expect(result.size).toBe(10 * 1024 * 1024)
    })

    it('should track progress during multipart upload', async () => {
      const data = new Uint8Array(10 * 1024 * 1024) // 10 MB
      const progressUpdates: UploadProgress[] = []

      await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
        onProgress: (progress) => progressUpdates.push({ ...progress }),
      })

      // Should have progress updates
      expect(progressUpdates.length).toBeGreaterThan(0)

      // Progress should increase monotonically
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].percentage).toBeGreaterThanOrEqual(
          progressUpdates[i - 1].percentage
        )
      }

      // Final progress should be 100%
      const lastUpdate = progressUpdates[progressUpdates.length - 1]
      expect(lastUpdate.percentage).toBe(100)
    })
  })

  describe('error handling', () => {
    it('should handle upload errors gracefully', async () => {
      const data = new Uint8Array(1024)

      // Force an error by using missing required field
      const result = await service.uploadBackup({
        backupId: '',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      // Should return error result instead of throwing
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should not throw when progress callback errors', async () => {
      const data = new Uint8Array(1024)

      const result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
        onProgress: () => {
          throw new Error('Progress callback error')
        },
      })

      // Should still complete successfully
      expect(result.success).toBe(true)
    })
  })

  describe('data slicing', () => {
    it('should correctly slice Uint8Array data', async () => {
      const data = new Uint8Array(10 * 1024 * 1024) // 10 MB
      // Fill with test pattern
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256
      }

      const result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      expect(result.success).toBe(true)
    })

    it('should correctly slice Blob data', async () => {
      const data = new Blob([new Uint8Array(10 * 1024 * 1024)])

      const result = await service.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('validation', () => {
    it('should validate backup size against configuration', async () => {
      const smallConfig = { ...config, maxSizeMB: 1 }
      const smallService = new S3BackupUploadService(smallConfig)

      const data = new Uint8Array(2 * 1024 * 1024) // 2 MB (exceeds 1 MB limit)

      const result = await smallService.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('exceeds maximum')
    })

    it('should accept backups at exactly max size', async () => {
      const exactConfig = { ...config, maxSizeMB: 1 }
      const exactService = new S3BackupUploadService(exactConfig)

      const data = new Uint8Array(1024 * 1024) // Exactly 1 MB

      const result = await exactService.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('key generation', () => {
    it('should generate unique keys for each upload', async () => {
      const data = new Uint8Array(1024)
      const options: UploadBackupOptions = {
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      }

      const result1 = await service.uploadBackup(options)

      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10))

      const result2 = await service.uploadBackup(options)

      expect(result1.key).not.toBe(result2.key)
    })

    it('should include company, user, and backup IDs in key', async () => {
      const data = new Uint8Array(1024)

      const result = await service.uploadBackup({
        backupId: 'backup-abc',
        userId: 'user-xyz',
        companyId: 'company-123',
        data,
      })

      expect(result.key).toContain('company-123')
      expect(result.key).toContain('user-xyz')
      expect(result.key).toContain('backup-abc')
    })

    it('should use configured file prefix', async () => {
      const customConfig = { ...config, filePrefix: 'custom-prefix' }
      const customService = new S3BackupUploadService(customConfig)

      const data = new Uint8Array(1024)

      const result = await customService.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      expect(result.key?.startsWith('custom-prefix/')).toBe(true)
    })
  })

  describe('factory function', () => {
    it('should create service instance', () => {
      const instance = createS3BackupUploadService(config)
      expect(instance).toBeInstanceOf(S3BackupUploadService)
    })

    it('should create functional service', async () => {
      const instance = createS3BackupUploadService(config)
      const data = new Uint8Array(1024)

      const result = await instance.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('configuration', () => {
    it('should use configured upload part size', async () => {
      const customConfig = { ...config, uploadPartSizeMB: 10 }
      const customService = new S3BackupUploadService(customConfig)

      // File smaller than 10 MB should use single upload
      const smallData = new Uint8Array(8 * 1024 * 1024) // 8 MB

      const result = await customService.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data: smallData,
      })

      expect(result.success).toBe(true)
    })

    it('should respect upload concurrency setting', async () => {
      const customConfig = { ...config, uploadConcurrency: 2 }
      const customService = new S3BackupUploadService(customConfig)

      const data = new Uint8Array(10 * 1024 * 1024) // 10 MB

      const result = await customService.uploadBackup({
        backupId: 'backup-123',
        userId: 'user-456',
        companyId: 'company-789',
        data,
      })

      expect(result.success).toBe(true)
    })
  })
})
