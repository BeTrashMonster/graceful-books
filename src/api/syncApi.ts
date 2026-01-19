/**
 * Sync API
 *
 * API client for sync server operations.
 * Currently uses localStorage as a mock server for testing.
 * Will be replaced with actual HTTP client for production relay server.
 *
 * Requirements:
 * - B6: Sync Relay Client
 *
 * Security Note: This file uses Math.random() intentionally for mock API simulation.
 * These random values are NOT used for security purposes - they simulate network
 * delays and random failures for testing the sync client's error handling.
 * In production, this mock implementation will be replaced with real HTTP calls.
 */

import type {
  SyncPushRequest,
  SyncPushResponse,
  SyncPullRequest,
  SyncPullResponse,
  SyncChange,
} from '../sync/syncProtocol';
import { SYNC_PROTOCOL_VERSION } from '../sync/syncProtocol';

/**
 * Mock sync server using localStorage
 *
 * This simulates a remote relay server for testing.
 * In production, this would be replaced with actual HTTP API calls.
 */
class MockSyncServer {
  private readonly STORAGE_KEY = 'graceful_books_mock_sync_server';

  /**
   * Get stored changes from mock server
   */
  private getStoredChanges(): SyncChange[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load stored changes:', error);
    }
    return [];
  }

  /**
   * Save changes to mock server
   */
  private saveChanges(changes: SyncChange[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(changes));
    } catch (error) {
      console.error('Failed to save changes:', error);
    }
  }

  /**
   * Push changes to server
   */
  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    // Simulate network delay
    await this.delay(100 + Math.random() * 200);

    // Simulate random failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Mock network error');
    }

    const accepted: string[] = [];
    const rejected: Array<{ id: string; reason: string }> = [];

    // Get existing changes
    const existingChanges = this.getStoredChanges();

    // Process each change
    for (const change of request.changes) {
      // Simulate validation (reject 2% of changes randomly)
      if (Math.random() < 0.02) {
        rejected.push({
          id: change.id,
          reason: 'Mock validation error',
        });
        continue;
      }

      // Check for duplicates
      const isDuplicate = existingChanges.some(
        existing =>
          existing.entity_type === change.entity_type &&
          existing.entity_id === change.entity_id &&
          existing.timestamp >= change.timestamp
      );

      if (isDuplicate) {
        rejected.push({
          id: change.id,
          reason: 'Duplicate or outdated change',
        });
        continue;
      }

      // Accept the change
      accepted.push(change.id);

      // Store the change (remove old version if exists)
      const filtered = existingChanges.filter(
        existing =>
          !(
            existing.entity_type === change.entity_type &&
            existing.entity_id === change.entity_id
          )
      );
      filtered.push(change);
      this.saveChanges(filtered);
    }

    return {
      protocol_version: SYNC_PROTOCOL_VERSION,
      success: rejected.length === 0,
      accepted,
      rejected,
      timestamp: Date.now(),
    };
  }

  /**
   * Pull changes from server
   */
  async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
    // Simulate network delay
    await this.delay(150 + Math.random() * 250);

    // Simulate random failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Mock network error');
    }

    // Get all changes
    const allChanges = this.getStoredChanges();

    // Filter changes since requested timestamp
    const changes = allChanges.filter(
      change =>
        change.timestamp > request.since_timestamp &&
        change.device_id !== request.device_id // Don't return own changes
    );

    // Sort by timestamp
    changes.sort((a, b) => a.timestamp - b.timestamp);

    // Limit to 100 changes per pull
    const limitedChanges = changes.slice(0, 100);

    return {
      protocol_version: SYNC_PROTOCOL_VERSION,
      changes: limitedChanges,
      has_more: changes.length > 100,
      timestamp: Date.now(),
    };
  }

  /**
   * Clear mock server data
   */
  clear(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get server statistics
   */
  getStats(): {
    total_changes: number;
    by_type: Record<string, number>;
    by_device: Record<string, number>;
  } {
    const changes = this.getStoredChanges();

    const byType: Record<string, number> = {};
    const byDevice: Record<string, number> = {};

    for (const change of changes) {
      const entityType = change.entity_type || 'unknown';
      const deviceId = change.device_id || 'unknown';
      byType[entityType] = (byType[entityType] || 0) + 1;
      byDevice[deviceId] = (byDevice[deviceId] || 0) + 1;
    }

    return {
      total_changes: changes.length,
      by_type: byType,
      by_device: byDevice,
    };
  }

  /**
   * Simulate network delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Sync API client
 *
 * Provides methods to interact with the sync server.
 * Currently uses mock implementation, will be replaced with real HTTP client.
 */
class SyncApiClient {
  private mockServer: MockSyncServer;
  private useMock: boolean;

  constructor(useMock: boolean = true) {
    this.useMock = useMock;
    this.mockServer = new MockSyncServer();
  }

  /**
   * Push changes to server
   */
  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    if (this.useMock) {
      return this.mockServer.push(request);
    }

    // Production implementation would go here:
    // const response = await fetch('/api/sync/push', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(request),
    // });
    // return response.json();

    throw new Error('Production sync server not configured');
  }

  /**
   * Pull changes from server
   */
  async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
    if (this.useMock) {
      return this.mockServer.pull(request);
    }

    // Production implementation would go here:
    // const response = await fetch('/api/sync/pull', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(request),
    // });
    // return response.json();

    throw new Error('Production sync server not configured');
  }

  /**
   * Check server health
   */
  async health(): Promise<{ status: 'ok' | 'error'; timestamp: number }> {
    if (this.useMock) {
      return {
        status: 'ok',
        timestamp: Date.now(),
      };
    }

    // Production implementation would go here:
    // const response = await fetch('/api/sync/health');
    // return response.json();

    throw new Error('Production sync server not configured');
  }

  /**
   * Get mock server stats (for testing only)
   */
  getMockStats() {
    if (!this.useMock) {
      throw new Error('Not using mock server');
    }
    return this.mockServer.getStats();
  }

  /**
   * Clear mock server (for testing only)
   */
  clearMock(): void {
    if (!this.useMock) {
      throw new Error('Not using mock server');
    }
    this.mockServer.clear();
  }

  /**
   * Switch between mock and production
   */
  setUseMock(useMock: boolean): void {
    this.useMock = useMock;
  }
}

/**
 * Singleton sync API client instance
 */
export const syncApi = new SyncApiClient(true);

/**
 * Create a new sync API client
 */
export function createSyncApi(useMock: boolean = true): SyncApiClient {
  return new SyncApiClient(useMock);
}
