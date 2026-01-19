/**
 * Sync Relay Load Test
 *
 * Tests the sync relay server under concurrent load.
 * Simulates multiple users pushing and pulling changes.
 *
 * Requirements:
 * - I7: Load Testing Infrastructure
 * - H8: Sync Relay
 *
 * Test Scenarios:
 * 1. Concurrent push operations
 * 2. Concurrent pull operations
 * 3. Mixed push/pull workload
 * 4. Sustained load over time
 *
 * Metrics Tracked:
 * - Requests per second (RPS)
 * - Response time (p50, p95, p99)
 * - Error rate
 * - Throughput
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  generateDeviceId,
  createSyncChange,
  createPushRequest,
  createPullRequest,
  generateTransactionData,
  generateAccountData,
  generateInvoiceData,
  isSuccessfulResponse,
  randomSleep,
} from '../utils/helpers.js';

// Custom metrics
const pushSuccessRate = new Rate('push_success_rate');
const pullSuccessRate = new Rate('pull_success_rate');
const pushResponseTime = new Trend('push_response_time');
const pullResponseTime = new Trend('pull_response_time');
const changesAccepted = new Counter('changes_accepted');
const changesRejected = new Counter('changes_rejected');
const changesPulled = new Counter('changes_pulled');

// Test configuration (can be overridden via environment variables)
export const options = {
  stages: [
    { duration: '30s', target: __ENV.VUS_START || 10 }, // Ramp up
    { duration: '2m', target: __ENV.VUS_PEAK || 50 }, // Sustained load
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.05'], // Error rate under 5%
    push_success_rate: ['rate>0.95'], // Push success rate over 95%
    pull_success_rate: ['rate>0.95'], // Pull success rate over 95%
    push_response_time: ['p(95)<500', 'p(99)<1000'], // Push latency targets
    pull_response_time: ['p(95)<500', 'p(99)<1000'], // Pull latency targets
  },
  tags: {
    test_type: 'sync_relay',
  },
};

// Base URL (can be overridden via environment variables)
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SYNC_API_URL = `${BASE_URL}/api/sync`;

/**
 * Setup function - runs once per VU
 */
export function setup() {
  console.log('Starting sync relay load test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`VUs: ${__ENV.VUS_PEAK || 50}`);

  // Check if server is healthy
  const healthResponse = http.get(`${BASE_URL}/api/health`);
  if (!isSuccessfulResponse(healthResponse)) {
    throw new Error(`Server health check failed: ${healthResponse.status}`);
  }

  return {
    startTime: Date.now(),
  };
}

/**
 * Main test function - runs for each VU iteration
 */
export default function (data) {
  // Each VU gets its own device ID
  const deviceId = generateDeviceId();

  // Randomly choose operation type to simulate realistic workload
  const operation = Math.random();

  if (operation < 0.4) {
    // 40% push operations
    testPushOperation(deviceId);
  } else if (operation < 0.7) {
    // 30% pull operations
    testPullOperation(deviceId);
  } else {
    // 30% full sync (push then pull)
    testFullSync(deviceId);
  }

  // Realistic user think time
  sleep(randomSleep(1000, 5000));
}

/**
 * Test push operation
 */
function testPushOperation(deviceId) {
  // Generate batch of changes
  const changes = [];
  const batchSize = Math.floor(Math.random() * 5) + 1; // 1-5 changes

  for (let i = 0; i < batchSize; i++) {
    // Mix different entity types
    const entityType = ['transaction', 'account', 'invoice'][
      Math.floor(Math.random() * 3)
    ];

    let data;
    if (entityType === 'transaction') {
      data = generateTransactionData();
    } else if (entityType === 'account') {
      data = generateAccountData();
    } else {
      data = generateInvoiceData();
    }

    const change = createSyncChange(deviceId, entityType, 'CREATE', data);
    changes.push(change);
  }

  // Create push request
  const request = createPushRequest(deviceId, changes);

  // Send push request
  const startTime = Date.now();
  const response = http.post(`${SYNC_API_URL}/push`, JSON.stringify(request), {
    headers: { 'Content-Type': 'application/json' },
    tags: { operation: 'push' },
  });
  const duration = Date.now() - startTime;

  // Record metrics
  pushResponseTime.add(duration);
  pushSuccessRate.add(isSuccessfulResponse(response));

  // Validate response
  const success = check(response, {
    'push: status is 200': (r) => r.status === 200,
    'push: response has correct structure': (r) => {
      const body = r.json();
      return (
        body.protocol_version === '1.0.0' &&
        Array.isArray(body.accepted) &&
        Array.isArray(body.rejected)
      );
    },
    'push: response time acceptable': () => duration < 1000,
  });

  if (success && isSuccessfulResponse(response)) {
    const body = response.json();
    changesAccepted.add(body.accepted.length);
    changesRejected.add(body.rejected.length);
  }
}

/**
 * Test pull operation
 */
function testPullOperation(deviceId) {
  // Create pull request (get changes since 0 = all changes)
  const sinceTimestamp = Date.now() - 60000; // Last minute
  const request = createPullRequest(deviceId, sinceTimestamp);

  // Send pull request
  const startTime = Date.now();
  const response = http.post(`${SYNC_API_URL}/pull`, JSON.stringify(request), {
    headers: { 'Content-Type': 'application/json' },
    tags: { operation: 'pull' },
  });
  const duration = Date.now() - startTime;

  // Record metrics
  pullResponseTime.add(duration);
  pullSuccessRate.add(isSuccessfulResponse(response));

  // Validate response
  const success = check(response, {
    'pull: status is 200': (r) => r.status === 200,
    'pull: response has correct structure': (r) => {
      const body = r.json();
      return (
        body.protocol_version === '1.0.0' &&
        Array.isArray(body.changes) &&
        typeof body.has_more === 'boolean'
      );
    },
    'pull: response time acceptable': () => duration < 1000,
  });

  if (success && isSuccessfulResponse(response)) {
    const body = response.json();
    changesPulled.add(body.changes.length);
  }
}

/**
 * Test full sync operation (push + pull)
 */
function testFullSync(deviceId) {
  // First push local changes
  testPushOperation(deviceId);

  // Brief pause
  sleep(0.1);

  // Then pull remote changes
  testPullOperation(deviceId);
}

/**
 * Teardown function - runs once at the end
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Test completed in ${duration}s`);
}
