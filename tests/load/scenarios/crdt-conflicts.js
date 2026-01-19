/**
 * CRDT Conflict Resolution Load Test
 *
 * Tests CRDT conflict resolution under concurrent modification.
 * Simulates multiple devices editing the same entities simultaneously.
 *
 * Requirements:
 * - I7: Load Testing Infrastructure
 * - I1: CRDT Conflict Resolution
 *
 * Test Scenarios:
 * 1. Concurrent updates to same entity
 * 2. Divergent version vectors
 * 3. High conflict rate scenarios
 * 4. Conflict resolution latency
 *
 * Metrics Tracked:
 * - Conflict detection rate
 * - Conflict resolution time
 * - Merge success rate
 * - Data consistency
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  generateDeviceId,
  generateEntityId,
  createSyncChange,
  createPushRequest,
  createConflictScenario,
  generateTransactionData,
  isSuccessfulResponse,
  randomSleep,
} from '../utils/helpers.js';

// Custom metrics
const conflictDetectionRate = new Rate('conflict_detection_rate');
const conflictResolutionTime = new Trend('conflict_resolution_time');
const mergeSuccessRate = new Rate('merge_success_rate');
const concurrentModifications = new Counter('concurrent_modifications');
const conflictsResolved = new Counter('conflicts_resolved');

// Test configuration
export const options = {
  scenarios: {
    // High conflict scenario - many VUs editing same entities
    high_conflict: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: __ENV.CONFLICT_VUS || 20 },
        { duration: '1m', target: __ENV.CONFLICT_VUS || 20 },
        { duration: '30s', target: 0 },
      ],
      tags: { scenario: 'high_conflict' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% under 1s (conflicts take longer)
    http_req_failed: ['rate<0.10'], // Error rate under 10% (conflicts may cause retries)
    conflict_detection_rate: ['rate>0'], // At least some conflicts detected
    merge_success_rate: ['rate>0.90'], // 90% successful merges
    conflict_resolution_time: ['p(95)<2000'], // Conflict resolution under 2s
  },
  tags: {
    test_type: 'crdt_conflicts',
  },
};

// Base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SYNC_API_URL = `${BASE_URL}/api/sync`;

// Shared entity IDs for creating conflicts
const SHARED_ENTITY_IDS = [
  generateEntityId(),
  generateEntityId(),
  generateEntityId(),
  generateEntityId(),
  generateEntityId(),
];

/**
 * Setup function
 */
export function setup() {
  console.log('Starting CRDT conflict resolution load test');
  console.log(`Shared entities: ${SHARED_ENTITY_IDS.length}`);
  console.log(`Conflict VUs: ${__ENV.CONFLICT_VUS || 20}`);

  // Pre-populate with some data
  const deviceId = generateDeviceId();
  for (const entityId of SHARED_ENTITY_IDS) {
    const change = {
      id: `initial_${entityId}`,
      entity_type: 'transaction',
      entity_id: entityId,
      operation: 'CREATE',
      encrypted_payload: btoa(
        JSON.stringify({
          entity_id: entityId,
          ...generateTransactionData(),
          version_vector: { [deviceId]: 1 },
          updated_at: Date.now(),
        })
      ),
      version_vector: { [deviceId]: 1 },
      timestamp: Date.now(),
      device_id: deviceId,
    };

    const request = createPushRequest(deviceId, [change]);
    http.post(`${SYNC_API_URL}/push`, JSON.stringify(request), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return {
    sharedEntityIds: SHARED_ENTITY_IDS,
    startTime: Date.now(),
  };
}

/**
 * Main test function
 */
export default function (data) {
  const deviceId = generateDeviceId();

  // Randomly choose test scenario
  const scenario = Math.random();

  if (scenario < 0.5) {
    // 50% - Create concurrent modifications to same entity
    testConcurrentModification(deviceId, data.sharedEntityIds);
  } else if (scenario < 0.8) {
    // 30% - Create conflicting updates
    testConflictingUpdates(deviceId, data.sharedEntityIds);
  } else {
    // 20% - Test rapid sequential updates
    testRapidSequentialUpdates(deviceId, data.sharedEntityIds);
  }

  // Brief pause between operations
  sleep(randomSleep(500, 2000));
}

/**
 * Test concurrent modification to same entity
 */
function testConcurrentModification(deviceId, sharedEntityIds) {
  // Pick a random shared entity
  const entityId = sharedEntityIds[Math.floor(Math.random() * sharedEntityIds.length)];

  // Create an update to this entity
  const change = createSyncChange(deviceId, 'transaction', 'UPDATE', {
    ...generateTransactionData(),
    entity_id: entityId,
    modified_by: deviceId,
    modification_time: Date.now(),
  });

  // Force the same entity ID
  change.entity_id = entityId;

  const request = createPushRequest(deviceId, [change]);

  // Track concurrent modification attempt
  concurrentModifications.add(1);

  // Send request
  const startTime = Date.now();
  const response = http.post(`${SYNC_API_URL}/push`, JSON.stringify(request), {
    headers: { 'Content-Type': 'application/json' },
    tags: { operation: 'concurrent_modification' },
  });
  const duration = Date.now() - startTime;

  // Check if conflict was detected
  const body = isSuccessfulResponse(response) ? response.json() : null;
  const conflictDetected = body && body.rejected && body.rejected.length > 0;

  if (conflictDetected) {
    conflictDetectionRate.add(1);
    conflictResolutionTime.add(duration);

    // Check if the rejection reason indicates a conflict
    const hasConflictReason = body.rejected.some((r) =>
      r.reason.toLowerCase().includes('conflict')
    );
    check(response, {
      'concurrent: conflict properly detected': () => hasConflictReason,
    });
  } else {
    conflictDetectionRate.add(0);
  }

  // Validate response
  check(response, {
    'concurrent: response received': (r) => r.status !== 0,
    'concurrent: valid response structure': (r) => {
      if (!isSuccessfulResponse(r)) return false;
      const b = r.json();
      return Array.isArray(b.accepted) && Array.isArray(b.rejected);
    },
  });
}

/**
 * Test conflicting updates scenario
 */
function testConflictingUpdates(deviceId, sharedEntityIds) {
  // Pick a shared entity
  const entityId = sharedEntityIds[Math.floor(Math.random() * sharedEntityIds.length)];

  // Create multiple conflicting changes
  const numConflicts = Math.floor(Math.random() * 3) + 2; // 2-4 conflicts
  const changes = createConflictScenario(numConflicts, entityId, 'transaction');

  // Use changes from this device
  const myChange = changes[0];
  myChange.device_id = deviceId;

  const request = createPushRequest(deviceId, [myChange]);

  // Send request and measure conflict resolution
  const startTime = Date.now();
  const response = http.post(`${SYNC_API_URL}/push`, JSON.stringify(request), {
    headers: { 'Content-Type': 'application/json' },
    tags: { operation: 'conflicting_update' },
  });
  const duration = Date.now() - startTime;

  conflictResolutionTime.add(duration);

  // Check merge success
  const success = isSuccessfulResponse(response);
  mergeSuccessRate.add(success);

  if (success) {
    const body = response.json();
    if (body.accepted.length > 0) {
      conflictsResolved.add(1);
    }

    check(response, {
      'conflict: successfully merged': () => body.accepted.length > 0,
      'conflict: resolution time acceptable': () => duration < 3000,
    });
  }
}

/**
 * Test rapid sequential updates
 */
function testRapidSequentialUpdates(deviceId, sharedEntityIds) {
  const entityId = sharedEntityIds[Math.floor(Math.random() * sharedEntityIds.length)];

  // Perform 3 rapid updates
  for (let i = 0; i < 3; i++) {
    const change = createSyncChange(deviceId, 'transaction', 'UPDATE', {
      ...generateTransactionData(),
      entity_id: entityId,
      sequence: i,
    });
    change.entity_id = entityId;

    const request = createPushRequest(deviceId, [change]);

    const response = http.post(`${SYNC_API_URL}/push`, JSON.stringify(request), {
      headers: { 'Content-Type': 'application/json' },
      tags: { operation: 'rapid_update' },
    });

    check(response, {
      'rapid: update accepted': (r) => {
        if (!isSuccessfulResponse(r)) return false;
        const body = r.json();
        return body.accepted.length > 0;
      },
    });

    // Very brief pause
    sleep(0.05); // 50ms
  }
}

/**
 * Teardown function
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`CRDT conflict test completed in ${duration}s`);
  console.log(`Tested with ${data.sharedEntityIds.length} shared entities`);
}
