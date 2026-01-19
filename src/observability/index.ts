/**
 * Observability Module
 *
 * Exports distributed tracing, structured logging, and custom metrics
 * for comprehensive observability across Graceful Books.
 *
 * @module observability
 */

// Tracing
export {
  TracingService,
  SyncTracer,
  CorrelationIdManager,
  TraceSampler,
  initializeTracing,
  getTracing,
  shutdownTracing,
  type TracingConfig,
  type SpanOptions,
} from './tracing';

// Logging
export {
  StructuredLogger,
  LogBuffer,
  LogFilter,
  createAggregatedLogger,
  initializeLogger,
  getLogger,
  setLogger,
  type LogLevel,
  type LogEntry,
  type LoggerConfig,
} from './logger';

// Metrics
export {
  ObservabilityMetrics,
  ConflictRateTracker,
  SyncLatencyTracker,
  UserActivityTracker,
  FeatureAdoptionTracker,
  ApiErrorRateTracker,
  initializeMetrics,
  getMetrics,
  type ConflictMetric,
  type SyncLatencyMetric,
  type UserActivityMetric,
  type FeatureAdoptionMetric,
} from './metrics';
