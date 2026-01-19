/**
 * Mixed Workload Load Test
 *
 * Simulates realistic user behavior with mixed read/write operations.
 * Combines sync relay operations, CRDT conflicts, and typical user workflows.
 *
 * Requirements:
 * - I7: Load Testing Infrastructure
 *
 * Test Scenarios:
 * 1. 60% read operations (pull, dashboard, reports)
 * 2. 30% write operations (create/update entities)
 * 3. 10% heavy operations (batch imports, reconciliation)
 *
 * Realistic User Behaviors:
 * - Dashboard loading
 * - Transaction creation
 * - Invoice management
 * - Sync operations
 * - Report generation
 *
 * Metrics Tracked:
 * - Overall RPS
 * - Response time by operation type
 * - User journey completion rate
 * - Resource utilization patterns
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  generateDeviceId,
  createSyncChange,
  createPushRequest,
  createPullRequest,
  generateTransactionData,
  generateInvoiceData,
  generateAccountData,
  isSuccessfulResponse,
  randomSleep,
} from '../utils/helpers.js';

// Custom metrics
const userJourneySuccess = new Rate('user_journey_success');
const readOperations = new Counter('read_operations');
const writeOperations = new Counter('write_operations');
const heavyOperations = new Counter('heavy_operations');
const operationResponseTime = new Trend('operation_response_time');

// Test configuration - Realistic load profile
export const options = {
  scenarios: {
    // Light users - occasional usage
    light_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: __ENV.LIGHT_USERS || 20 },
        { duration: '3m', target: __ENV.LIGHT_USERS || 20 },
        { duration: '1m', target: 0 },
      ],
      tags: { user_type: 'light' },
    },
    // Active users - regular usage
    active_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: __ENV.ACTIVE_USERS || 50 },
        { duration: '3m', target: __ENV.ACTIVE_USERS || 50 },
        { duration: '1m', target: 0 },
      ],
      tags: { user_type: 'active' },
      startTime: '30s', // Stagger start
    },
    // Power users - heavy usage
    power_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: __ENV.POWER_USERS || 10 },
        { duration: '3m', target: __ENV.POWER_USERS || 10 },
        { duration: '1m', target: 0 },
      ],
      tags: { user_type: 'power' },
      startTime: '1m', // Stagger start
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    user_journey_success: ['rate>0.90'],
    operation_response_time: ['p(95)<1500'],
  },
  tags: {
    test_type: 'mixed_workload',
  },
};

// Base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;
const SYNC_API_URL = `${API_URL}/sync`;

/**
 * Setup function
 */
export function setup() {
  console.log('Starting mixed workload load test');
  console.log(`Light users: ${__ENV.LIGHT_USERS || 20}`);
  console.log(`Active users: ${__ENV.ACTIVE_USERS || 50}`);
  console.log(`Power users: ${__ENV.POWER_USERS || 10}`);

  return {
    startTime: Date.now(),
  };
}

/**
 * Main test function
 */
export default function (data) {
  const deviceId = generateDeviceId();
  const userType = __ITER % 3 === 0 ? 'light' : __ITER % 3 === 1 ? 'active' : 'power';

  // Execute user journey based on user type
  if (userType === 'light') {
    lightUserJourney(deviceId);
  } else if (userType === 'active') {
    activeUserJourney(deviceId);
  } else {
    powerUserJourney(deviceId);
  }
}

/**
 * Light user journey
 * - Quick check-in
 * - View dashboard
 * - Maybe create one transaction
 * - Sync and leave
 */
function lightUserJourney(deviceId) {
  const journeySuccess = group('Light User Journey', () => {
    let allSuccess = true;

    // 1. Pull latest changes
    group('Pull Changes', () => {
      const request = createPullRequest(deviceId, Date.now() - 3600000); // Last hour
      const startTime = Date.now();

      const response = http.post(`${SYNC_API_URL}/pull`, JSON.stringify(request), {
        headers: { 'Content-Type': 'application/json' },
        tags: { operation: 'pull' },
      });

      operationResponseTime.add(Date.now() - startTime);
      readOperations.add(1);

      allSuccess =
        allSuccess &&
        check(response, {
          'light: pull successful': (r) => isSuccessfulResponse(r),
        });
    });

    sleep(randomSleep(1000, 3000));

    // 2. Maybe create a transaction (60% chance)
    if (Math.random() < 0.6) {
      group('Create Transaction', () => {
        const change = createSyncChange(
          deviceId,
          'transaction',
          'CREATE',
          generateTransactionData()
        );
        const request = createPushRequest(deviceId, [change]);
        const startTime = Date.now();

        const response = http.post(`${SYNC_API_URL}/push`, JSON.stringify(request), {
          headers: { 'Content-Type': 'application/json' },
          tags: { operation: 'create_transaction' },
        });

        operationResponseTime.add(Date.now() - startTime);
        writeOperations.add(1);

        allSuccess =
          allSuccess &&
          check(response, {
            'light: transaction created': (r) => isSuccessfulResponse(r),
          });
      });

      sleep(randomSleep(500, 1500));
    }

    // 3. Final sync
    group('Final Sync', () => {
      const request = createPullRequest(deviceId);
      const response = http.post(`${SYNC_API_URL}/pull`, JSON.stringify(request), {
        headers: { 'Content-Type': 'application/json' },
        tags: { operation: 'pull' },
      });

      readOperations.add(1);
      allSuccess =
        allSuccess &&
        check(response, {
          'light: final sync successful': (r) => isSuccessfulResponse(r),
        });
    });

    return allSuccess;
  });

  userJourneySuccess.add(journeySuccess);

  // Light users have longer think time
  sleep(randomSleep(5000, 15000));
}

/**
 * Active user journey
 * - Regular usage pattern
 * - Multiple transactions
 * - Invoice operations
 * - Frequent syncing
 */
function activeUserJourney(deviceId) {
  const journeySuccess = group('Active User Journey', () => {
    let allSuccess = true;

    // 1. Initial sync
    group('Initial Sync', () => {
      const request = createPullRequest(deviceId, Date.now() - 3600000);
      const response = http.post(`${SYNC_API_URL}/pull`, JSON.stringify(request), {
        headers: { 'Content-Type': 'application/json' },
      });
      readOperations.add(1);
      allSuccess = allSuccess && isSuccessfulResponse(response);
    });

    sleep(randomSleep(500, 1500));

    // 2. Create multiple transactions
    group('Create Transactions', () => {
      const numTransactions = Math.floor(Math.random() * 3) + 2; // 2-4 transactions
      const changes = [];

      for (let i = 0; i < numTransactions; i++) {
        changes.push(
          createSyncChange(deviceId, 'transaction', 'CREATE', generateTransactionData())
        );
      }

      const request = createPushRequest(deviceId, changes);
      const startTime = Date.now();

      const response = http.post(`${SYNC_API_URL}/push`, JSON.stringify(request), {
        headers: { 'Content-Type': 'application/json' },
        tags: { operation: 'batch_create' },
      });

      operationResponseTime.add(Date.now() - startTime);
      writeOperations.add(numTransactions);

      allSuccess =
        allSuccess &&
        check(response, {
          'active: transactions created': (r) => isSuccessfulResponse(r),
        });
    });

    sleep(randomSleep(1000, 3000));

    // 3. Work with invoices (70% chance)
    if (Math.random() < 0.7) {
      group('Invoice Operations', () => {
        const change = createSyncChange(
          deviceId,
          'invoice',
          'CREATE',
          generateInvoiceData()
        );
        const request = createPushRequest(deviceId, [change]);

        const response = http.post(`${SYNC_API_URL}/push`, JSON.stringify(request), {
          headers: { 'Content-Type': 'application/json' },
          tags: { operation: 'create_invoice' },
        });

        writeOperations.add(1);
        allSuccess = allSuccess && isSuccessfulResponse(response);
      });

      sleep(randomSleep(500, 2000));
    }

    // 4. Sync changes
    group('Sync Changes', () => {
      const request = createPullRequest(deviceId);
      const response = http.post(`${SYNC_API_URL}/pull`, JSON.stringify(request), {
        headers: { 'Content-Type': 'application/json' },
      });
      readOperations.add(1);
      allSuccess = allSuccess && isSuccessfulResponse(response);
    });

    return allSuccess;
  });

  userJourneySuccess.add(journeySuccess);

  // Active users have moderate think time
  sleep(randomSleep(2000, 8000));
}

/**
 * Power user journey
 * - Heavy usage
 * - Batch operations
 * - Account management
 * - Complex workflows
 */
function powerUserJourney(deviceId) {
  const journeySuccess = group('Power User Journey', () => {
    let allSuccess = true;

    // 1. Pull all recent changes
    group('Pull Recent Changes', () => {
      const request = createPullRequest(deviceId, Date.now() - 86400000); // Last 24h
      const startTime = Date.now();

      const response = http.post(`${SYNC_API_URL}/pull`, JSON.stringify(request), {
        headers: { 'Content-Type': 'application/json' },
      });

      operationResponseTime.add(Date.now() - startTime);
      readOperations.add(1);
      allSuccess = allSuccess && isSuccessfulResponse(response);
    });

    sleep(randomSleep(500, 1500));

    // 2. Batch import (simulate)
    group('Batch Import', () => {
      const batchSize = Math.floor(Math.random() * 20) + 10; // 10-30 items
      const changes = [];

      for (let i = 0; i < batchSize; i++) {
        const entityType = ['transaction', 'account', 'invoice'][
          Math.floor(Math.random() * 3)
        ];
        let data;

        if (entityType === 'transaction') data = generateTransactionData();
        else if (entityType === 'account') data = generateAccountData();
        else data = generateInvoiceData();

        changes.push(createSyncChange(deviceId, entityType, 'CREATE', data));
      }

      const request = createPushRequest(deviceId, changes);
      const startTime = Date.now();

      const response = http.post(`${SYNC_API_URL}/push`, JSON.stringify(request), {
        headers: { 'Content-Type': 'application/json' },
        tags: { operation: 'batch_import' },
      });

      operationResponseTime.add(Date.now() - startTime);
      writeOperations.add(batchSize);
      heavyOperations.add(1);

      allSuccess =
        allSuccess &&
        check(response, {
          'power: batch import successful': (r) => isSuccessfulResponse(r),
          'power: batch import time acceptable': () => Date.now() - startTime < 5000,
        });
    });

    sleep(randomSleep(1000, 3000));

    // 3. Account updates
    group('Account Updates', () => {
      const numAccounts = Math.floor(Math.random() * 5) + 3; // 3-7 accounts
      const changes = [];

      for (let i = 0; i < numAccounts; i++) {
        changes.push(
          createSyncChange(deviceId, 'account', 'UPDATE', generateAccountData())
        );
      }

      const request = createPushRequest(deviceId, changes);
      const response = http.post(`${SYNC_API_URL}/push`, JSON.stringify(request), {
        headers: { 'Content-Type': 'application/json' },
      });

      writeOperations.add(numAccounts);
      allSuccess = allSuccess && isSuccessfulResponse(response);
    });

    sleep(randomSleep(500, 1500));

    // 4. Final comprehensive sync
    group('Final Sync', () => {
      const request = createPullRequest(deviceId);
      const response = http.post(`${SYNC_API_URL}/pull`, JSON.stringify(request), {
        headers: { 'Content-Type': 'application/json' },
      });
      readOperations.add(1);
      allSuccess = allSuccess && isSuccessfulResponse(response);
    });

    return allSuccess;
  });

  userJourneySuccess.add(journeySuccess);

  // Power users have shorter think time
  sleep(randomSleep(1000, 4000));
}

/**
 * Teardown function
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Mixed workload test completed in ${duration}s`);
}
