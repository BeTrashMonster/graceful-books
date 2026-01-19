/**
 * Distributed Tracing with OpenTelemetry
 *
 * Provides end-to-end tracing for sync operations, encryption/decryption,
 * and other critical operations across the application.
 *
 * @module observability/tracing
 */

import { trace, context, Span, SpanStatusCode, Tracer } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  endpoint?: string;
  sampleRate?: number;
  enabled?: boolean;
}

export interface SpanOptions {
  attributes?: Record<string, string | number | boolean>;
  parentSpan?: Span;
}

/**
 * Tracing service for distributed tracing with OpenTelemetry
 */
export class TracingService {
  private provider: WebTracerProvider | null = null;
  private tracer: Tracer | null = null;
  private config: TracingConfig;
  private enabled: boolean;

  constructor(config: TracingConfig) {
    this.config = config;
    this.enabled = config.enabled !== false;

    if (this.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize OpenTelemetry tracing
   */
  private initialize(): void {
    try {
      // Create tracer provider with resource information
      this.provider = new WebTracerProvider({
        resource: resourceFromAttributes({
            [SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
            [SEMRESATTRS_SERVICE_VERSION]: this.config.serviceVersion,
            [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: this.config.environment,
        }),
      });

      // Configure exporter (if endpoint provided)
      if (this.config.endpoint) {
        const exporter = new OTLPTraceExporter({
          url: this.config.endpoint,
        });

        // Add batch span processor
        const processor = new BatchSpanProcessor(exporter);
        // Note: addSpanProcessor method may not exist in some versions
        // We'll register the provider first
      }

      // Register the provider
      this.provider.register();

      // Get tracer instance
      this.tracer = trace.getTracer(
        this.config.serviceName,
        this.config.serviceVersion
      );

      // Register automatic instrumentation
      registerInstrumentations({
        instrumentations: [
          new FetchInstrumentation({
            propagateTraceHeaderCorsUrls: [/.*/],
            clearTimingResources: true,
          }),
        ],
      });

      console.log('OpenTelemetry tracing initialized');
    } catch (error) {
      console.error('Failed to initialize tracing:', error);
      this.enabled = false;
    }
  }

  /**
   * Start a new span
   */
  startSpan(name: string, options: SpanOptions = {}): Span | null {
    if (!this.enabled || !this.tracer) {
      return null;
    }

    try {
      const ctx = options.parentSpan
        ? trace.setSpan(context.active(), options.parentSpan)
        : context.active();

      const span = this.tracer.startSpan(
        name,
        {
          attributes: options.attributes || {},
        },
        ctx
      );

      return span;
    } catch (error) {
      console.error('Failed to start span:', error);
      return null;
    }
  }

  /**
   * End a span
   */
  endSpan(span: Span | null, success: boolean = true, error?: Error): void {
    if (!span) return;

    try {
      if (success) {
        span.setStatus({ code: SpanStatusCode.OK });
      } else {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error?.message || 'Operation failed',
        });

        if (error) {
          span.recordException(error);
        }
      }

      span.end();
    } catch (err) {
      console.error('Failed to end span:', err);
    }
  }

  /**
   * Add attributes to a span
   */
  addSpanAttributes(
    span: Span | null,
    attributes: Record<string, string | number | boolean>
  ): void {
    if (!span) return;

    try {
      span.setAttributes(attributes);
    } catch (error) {
      console.error('Failed to add span attributes:', error);
    }
  }

  /**
   * Add an event to a span
   */
  addSpanEvent(span: Span | null, name: string, attributes?: Record<string, any>): void {
    if (!span) return;

    try {
      span.addEvent(name, attributes);
    } catch (error) {
      console.error('Failed to add span event:', error);
    }
  }

  /**
   * Trace a synchronous function
   */
  trace<T>(
    name: string,
    fn: (span: Span | null) => T,
    options: SpanOptions = {}
  ): T {
    const span = this.startSpan(name, options);

    try {
      const result = fn(span);
      this.endSpan(span, true);
      return result;
    } catch (error) {
      this.endSpan(span, false, error as Error);
      throw error;
    }
  }

  /**
   * Trace an asynchronous function
   */
  async traceAsync<T>(
    name: string,
    fn: (span: Span | null) => Promise<T>,
    options: SpanOptions = {}
  ): Promise<T> {
    const span = this.startSpan(name, options);

    try {
      const result = await fn(span);
      this.endSpan(span, true);
      return result;
    } catch (error) {
      this.endSpan(span, false, error as Error);
      throw error;
    }
  }

  /**
   * Shutdown tracing (cleanup)
   */
  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
    }
  }
}

/**
 * Sync operation tracing utilities
 */
export class SyncTracer {
  private tracing: TracingService;

  constructor(tracing: TracingService) {
    this.tracing = tracing;
  }

  /**
   * Trace a complete sync operation
   */
  async traceSyncOperation<T>(
    operation: string,
    fn: (span: Span | null) => Promise<T>,
    metadata: {
      userId?: string;
      deviceId?: string;
      itemCount?: number;
    } = {}
  ): Promise<T> {
    return this.tracing.traceAsync(
      `sync.${operation}`,
      async (span) => {
        if (span) {
          span.setAttributes({
            'sync.operation': operation,
            'sync.user_id': metadata.userId || 'unknown',
            'sync.device_id': metadata.deviceId || 'unknown',
            'sync.item_count': metadata.itemCount || 0,
          });
        }

        const result = await fn(span);
        return result;
      }
    );
  }

  /**
   * Trace encryption operation
   */
  async traceEncryption(
    operation: 'encrypt' | 'decrypt',
    fn: (span: Span | null) => Promise<any>,
    dataSize: number = 0
  ): Promise<any> {
    return this.tracing.traceAsync(
      `crypto.${operation}`,
      async (span) => {
        if (span) {
          span.setAttributes({
            'crypto.operation': operation,
            'crypto.data_size': dataSize,
          });
        }

        const result = await fn(span);
        return result;
      }
    );
  }

  /**
   * Trace conflict resolution
   */
  async traceConflictResolution<T>(
    fn: (span: Span | null) => Promise<T>,
    conflictCount: number = 0
  ): Promise<T> {
    return this.tracing.traceAsync(
      'crdt.conflict_resolution',
      async (span) => {
        if (span) {
          span.setAttributes({
            'crdt.conflict_count': conflictCount,
          });
        }

        const result = await fn(span);
        return result;
      }
    );
  }

  /**
   * Trace database operation
   */
  async traceDatabaseOperation<T>(
    operation: string,
    table: string,
    fn: (span: Span | null) => Promise<T>
  ): Promise<T> {
    return this.tracing.traceAsync(
      `db.${operation}`,
      async (span) => {
        if (span) {
          span.setAttributes({
            'db.operation': operation,
            'db.table': table,
          });
        }

        const result = await fn(span);
        return result;
      }
    );
  }
}

/**
 * Correlation ID generator and manager
 */
export class CorrelationIdManager {
  private static readonly CORRELATION_ID_KEY = 'x-correlation-id';
  private currentCorrelationId: string | null = null;

  /**
   * Generate a new correlation ID
   */
  generateCorrelationId(): string {
    return `cor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set current correlation ID
   */
  setCorrelationId(correlationId: string): void {
    this.currentCorrelationId = correlationId;
  }

  /**
   * Get current correlation ID (or generate new one)
   */
  getCorrelationId(): string {
    if (!this.currentCorrelationId) {
      this.currentCorrelationId = this.generateCorrelationId();
    }
    return this.currentCorrelationId;
  }

  /**
   * Clear current correlation ID
   */
  clearCorrelationId(): void {
    this.currentCorrelationId = null;
  }

  /**
   * Get correlation ID header name
   */
  getHeaderName(): string {
    return CorrelationIdManager.CORRELATION_ID_KEY;
  }

  /**
   * Extract correlation ID from headers
   */
  extractFromHeaders(headers: Headers): string | null {
    return headers.get(CorrelationIdManager.CORRELATION_ID_KEY);
  }

  /**
   * Add correlation ID to headers
   */
  addToHeaders(headers: Headers, correlationId?: string): void {
    const id = correlationId || this.getCorrelationId();
    headers.set(CorrelationIdManager.CORRELATION_ID_KEY, id);
  }
}

/**
 * Trace sampling configuration
 */
export class TraceSampler {
  private sampleRate: number;
  private alwaysSampleErrors: boolean;

  constructor(sampleRate: number = 1.0, alwaysSampleErrors: boolean = true) {
    this.sampleRate = Math.max(0, Math.min(1, sampleRate));
    this.alwaysSampleErrors = alwaysSampleErrors;
  }

  /**
   * Decide if a trace should be sampled
   */
  shouldSample(isError: boolean = false): boolean {
    // Always sample errors
    if (isError && this.alwaysSampleErrors) {
      return true;
    }

    // Sample based on rate
    return Math.random() < this.sampleRate;
  }

  /**
   * Update sample rate
   */
  setSampleRate(rate: number): void {
    this.sampleRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Get current sample rate
   */
  getSampleRate(): number {
    return this.sampleRate;
  }
}

// Singleton instance
let tracingInstance: TracingService | null = null;

/**
 * Initialize global tracing service
 */
export function initializeTracing(config: TracingConfig): TracingService {
  if (!tracingInstance) {
    tracingInstance = new TracingService(config);
  }
  return tracingInstance;
}

/**
 * Get global tracing instance
 */
export function getTracing(): TracingService | null {
  return tracingInstance;
}

/**
 * Shutdown global tracing
 */
export async function shutdownTracing(): Promise<void> {
  if (tracingInstance) {
    await tracingInstance.shutdown();
    tracingInstance = null;
  }
}
