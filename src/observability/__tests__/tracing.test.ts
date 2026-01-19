/**
 * Tests for Distributed Tracing
 *
 * @module observability/__tests__/tracing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TracingService,
  SyncTracer,
  CorrelationIdManager,
  TraceSampler,
  initializeTracing,
  getTracing,
  shutdownTracing,
} from '../tracing';

describe('TracingService', () => {
  let tracing: TracingService;

  beforeEach(() => {
    tracing = new TracingService({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
      enabled: true,
    });
  });

  afterEach(async () => {
    await tracing.shutdown();
  });

  it('should initialize with config', () => {
    expect(tracing).toBeDefined();
  });

  it('should start and end a span', () => {
    const span = tracing.startSpan('test-operation');
    expect(span).toBeDefined();

    tracing.endSpan(span, true);
  });

  it('should handle span with error', () => {
    const span = tracing.startSpan('test-operation');
    const error = new Error('Test error');

    tracing.endSpan(span, false, error);
  });

  it('should add attributes to span', () => {
    const span = tracing.startSpan('test-operation');

    tracing.addSpanAttributes(span, {
      userId: 'user-123',
      operation: 'sync',
    });

    tracing.endSpan(span, true);
  });

  it('should add events to span', () => {
    const span = tracing.startSpan('test-operation');

    tracing.addSpanEvent(span, 'data-received', {
      size: 1024,
    });

    tracing.endSpan(span, true);
  });

  it('should trace synchronous function', () => {
    const result = tracing.trace('test-sync', () => {
      return 'success';
    });

    expect(result).toBe('success');
  });

  it('should trace asynchronous function', async () => {
    const result = await tracing.traceAsync('test-async', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'success';
    });

    expect(result).toBe('success');
  });

  it('should handle errors in traced function', async () => {
    await expect(
      tracing.traceAsync('test-error', async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
  });

  it('should handle disabled tracing', () => {
    const disabledTracing = new TracingService({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
      enabled: false,
    });

    const span = disabledTracing.startSpan('test-operation');
    expect(span).toBeNull();
  });
});

describe('SyncTracer', () => {
  let tracing: TracingService;
  let syncTracer: SyncTracer;

  beforeEach(() => {
    tracing = new TracingService({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
      enabled: true,
    });
    syncTracer = new SyncTracer(tracing);
  });

  afterEach(async () => {
    await tracing.shutdown();
  });

  it('should trace sync operation', async () => {
    const result = await syncTracer.traceSyncOperation(
      'test-sync',
      async () => {
        return { success: true };
      },
      {
        userId: 'user-123',
        deviceId: 'device-456',
        itemCount: 10,
      }
    );

    expect(result.success).toBe(true);
  });

  it('should trace encryption operation', async () => {
    const result = await syncTracer.traceEncryption(
      'encrypt',
      async () => {
        return 'encrypted-data';
      },
      1024
    );

    expect(result).toBe('encrypted-data');
  });

  it('should trace decryption operation', async () => {
    const result = await syncTracer.traceEncryption(
      'decrypt',
      async () => {
        return 'decrypted-data';
      },
      1024
    );

    expect(result).toBe('decrypted-data');
  });

  it('should trace conflict resolution', async () => {
    const result = await syncTracer.traceConflictResolution(
      async () => {
        return { resolved: true };
      },
      5
    );

    expect(result.resolved).toBe(true);
  });

  it('should trace database operation', async () => {
    const result = await syncTracer.traceDatabaseOperation(
      'select',
      'transactions',
      async () => {
        return [{ id: '1' }, { id: '2' }];
      }
    );

    expect(result.length).toBe(2);
  });
});

describe('CorrelationIdManager', () => {
  let manager: CorrelationIdManager;

  beforeEach(() => {
    manager = new CorrelationIdManager();
  });

  it('should generate correlation ID', () => {
    const id = manager.generateCorrelationId();
    expect(id).toMatch(/^cor-\d+-[a-z0-9]+$/);
  });

  it('should set and get correlation ID', () => {
    manager.setCorrelationId('test-correlation-id');
    expect(manager.getCorrelationId()).toBe('test-correlation-id');
  });

  it('should generate correlation ID if not set', () => {
    const id = manager.getCorrelationId();
    expect(id).toMatch(/^cor-\d+-[a-z0-9]+$/);
  });

  it('should clear correlation ID', () => {
    manager.setCorrelationId('test-correlation-id');
    manager.clearCorrelationId();

    const newId = manager.getCorrelationId();
    expect(newId).not.toBe('test-correlation-id');
  });

  it('should extract correlation ID from headers', () => {
    const headers = new Headers();
    headers.set('x-correlation-id', 'test-correlation-id');

    const id = manager.extractFromHeaders(headers);
    expect(id).toBe('test-correlation-id');
  });

  it('should add correlation ID to headers', () => {
    const headers = new Headers();
    manager.addToHeaders(headers, 'test-correlation-id');

    expect(headers.get('x-correlation-id')).toBe('test-correlation-id');
  });

  it('should add auto-generated correlation ID to headers', () => {
    const headers = new Headers();
    manager.addToHeaders(headers);

    const id = headers.get('x-correlation-id');
    expect(id).toMatch(/^cor-\d+-[a-z0-9]+$/);
  });
});

describe('TraceSampler', () => {
  it('should sample based on rate', () => {
    const sampler = new TraceSampler(1.0);

    const shouldSample = sampler.shouldSample();
    expect(shouldSample).toBe(true);
  });

  it('should not sample when rate is 0', () => {
    const sampler = new TraceSampler(0.0);

    const shouldSample = sampler.shouldSample();
    expect(shouldSample).toBe(false);
  });

  it('should always sample errors', () => {
    const sampler = new TraceSampler(0.0, true);

    const shouldSample = sampler.shouldSample(true);
    expect(shouldSample).toBe(true);
  });

  it('should update sample rate', () => {
    const sampler = new TraceSampler(0.5);

    sampler.setSampleRate(1.0);
    expect(sampler.getSampleRate()).toBe(1.0);
  });

  it('should clamp sample rate to 0-1', () => {
    const sampler = new TraceSampler(0.5);

    sampler.setSampleRate(1.5);
    expect(sampler.getSampleRate()).toBe(1.0);

    sampler.setSampleRate(-0.5);
    expect(sampler.getSampleRate()).toBe(0.0);
  });
});

describe('Global Tracing', () => {
  afterEach(async () => {
    await shutdownTracing();
  });

  it('should initialize global tracing', () => {
    const tracing = initializeTracing({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
    });

    expect(tracing).toBeDefined();
    expect(getTracing()).toBe(tracing);
  });

  it('should return same instance on multiple calls', () => {
    const tracing1 = initializeTracing({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
    });

    const tracing2 = initializeTracing({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
    });

    expect(tracing1).toBe(tracing2);
  });

  it('should shutdown global tracing', async () => {
    initializeTracing({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
    });

    await shutdownTracing();
    expect(getTracing()).toBeNull();
  });
});
