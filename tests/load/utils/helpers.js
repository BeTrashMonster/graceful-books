/**
 * Load Testing Helper Utilities
 *
 * Shared utilities for k6 load tests.
 * Provides device ID generation, encryption simulation, and test data generators.
 *
 * Requirements:
 * - I7: Load Testing Infrastructure
 */

import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * Generate a mock device ID
 */
export function generateDeviceId() {
  return `device_${randomString(16)}`;
}

/**
 * Generate a mock entity ID
 */
export function generateEntityId() {
  return `entity_${randomString(16)}`;
}

/**
 * Generate a mock version vector
 */
export function generateVersionVector(deviceId, clock = 1) {
  return {
    [deviceId]: clock,
  };
}

/**
 * Simulate encrypted payload
 * In real usage, this would be AES-256 encrypted data
 */
export function createMockEncryptedPayload(data) {
  // Base64 encode to simulate encryption
  const jsonString = JSON.stringify(data);
  return btoa(jsonString);
}

/**
 * Create a sync change object
 */
export function createSyncChange(deviceId, entityType, operation, data = {}) {
  const entityId = generateEntityId();
  const timestamp = Date.now();
  const versionVector = generateVersionVector(deviceId);

  return {
    id: `change_${randomString(16)}`,
    entity_type: entityType,
    entity_id: entityId,
    operation: operation,
    encrypted_payload: createMockEncryptedPayload({
      ...data,
      entity_id: entityId,
      version_vector: versionVector,
      updated_at: timestamp,
    }),
    version_vector: versionVector,
    timestamp: timestamp,
    device_id: deviceId,
  };
}

/**
 * Create a push request
 */
export function createPushRequest(deviceId, changes) {
  return {
    protocol_version: '1.0.0',
    device_id: deviceId,
    timestamp: Date.now(),
    changes: changes,
  };
}

/**
 * Create a pull request
 */
export function createPullRequest(deviceId, sinceTimestamp = 0, syncVector = {}) {
  return {
    protocol_version: '1.0.0',
    device_id: deviceId,
    since_timestamp: sinceTimestamp,
    sync_vector: syncVector,
  };
}

/**
 * Generate realistic transaction data
 */
export function generateTransactionData() {
  return {
    amount: Math.floor(Math.random() * 100000) / 100, // $0.00 - $1000.00
    description: `Transaction ${randomString(8)}`,
    category: ['Income', 'Expense', 'Transfer'][Math.floor(Math.random() * 3)],
    date: new Date().toISOString(),
  };
}

/**
 * Generate realistic account data
 */
export function generateAccountData() {
  return {
    name: `Account ${randomString(6)}`,
    type: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'][
      Math.floor(Math.random() * 5)
    ],
    balance: Math.floor(Math.random() * 1000000) / 100,
  };
}

/**
 * Generate realistic invoice data
 */
export function generateInvoiceData() {
  return {
    invoice_number: `INV-${randomString(8)}`,
    customer_name: `Customer ${randomString(6)}`,
    amount: Math.floor(Math.random() * 500000) / 100,
    status: ['draft', 'sent', 'paid', 'overdue'][Math.floor(Math.random() * 4)],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Check if response is successful
 */
export function isSuccessfulResponse(response) {
  return response.status >= 200 && response.status < 300;
}

/**
 * Calculate response time threshold
 * Returns threshold in ms based on operation type
 */
export function getResponseTimeThreshold(operation) {
  const thresholds = {
    push: 500, // 500ms for push operations
    pull: 500, // 500ms for pull operations
    health: 100, // 100ms for health checks
    sync: 1000, // 1s for full sync
  };

  return thresholds[operation] || 1000;
}

/**
 * Create concurrent conflict scenario
 * Generates multiple changes to the same entity
 */
export function createConflictScenario(numDevices, entityId, entityType) {
  const changes = [];

  for (let i = 0; i < numDevices; i++) {
    const deviceId = generateDeviceId();
    const change = {
      id: `change_${randomString(16)}`,
      entity_type: entityType,
      entity_id: entityId, // Same entity ID for all
      operation: 'UPDATE',
      encrypted_payload: createMockEncryptedPayload({
        entity_id: entityId,
        version_vector: generateVersionVector(deviceId, i + 1),
        updated_at: Date.now() + i, // Slightly different timestamps
        data: { value: `Updated by device ${i}` },
      }),
      version_vector: generateVersionVector(deviceId, i + 1),
      timestamp: Date.now() + i,
      device_id: deviceId,
    };
    changes.push(change);
  }

  return changes;
}

/**
 * Validate sync response structure
 */
export function validateSyncResponse(response, expectedType) {
  const body = response.json();

  // Check protocol version
  if (body.protocol_version !== '1.0.0') {
    return false;
  }

  // Type-specific validation
  if (expectedType === 'push') {
    return (
      typeof body.success === 'boolean' &&
      Array.isArray(body.accepted) &&
      Array.isArray(body.rejected) &&
      typeof body.timestamp === 'number'
    );
  }

  if (expectedType === 'pull') {
    return (
      Array.isArray(body.changes) &&
      typeof body.has_more === 'boolean' &&
      typeof body.timestamp === 'number'
    );
  }

  return false;
}

/**
 * Sleep for a random duration
 * Simulates realistic user think time
 */
export function randomSleep(minMs = 1000, maxMs = 5000) {
  const duration = minMs + Math.random() * (maxMs - minMs);
  return duration / 1000; // k6 sleep() expects seconds
}
