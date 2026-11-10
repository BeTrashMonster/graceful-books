/**
 * AI Kill Switch Service
 *
 * Emergency shutdown mechanism for AI features.
 * Allows immediate disabling of AI operations when:
 * - Security incidents occur
 * - Anomalous AI behavior detected
 * - Manual admin intervention needed
 *
 * Kill switch states:
 * - ACTIVE: AI features enabled
 * - KILLED: AI features disabled
 * - DEGRADED: Limited AI features (e.g., read-only)
 *
 * @security Phase 3.3 - AI Monitoring Infrastructure
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

/**
 * Kill switch state
 */
export enum KillSwitchState {
  ACTIVE = 'active',
  KILLED = 'killed',
  DEGRADED = 'degraded',
}

/**
 * Kill switch trigger reason
 */
export enum KillTriggerReason {
  MANUAL = 'manual',
  ANOMALY_DETECTED = 'anomaly_detected',
  HIGH_ERROR_RATE = 'high_error_rate',
  SECURITY_INCIDENT = 'security_incident',
  SCHEDULED_MAINTENANCE = 'scheduled_maintenance',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CONFIDENCE_DROP = 'confidence_drop',
}

/**
 * Kill switch configuration
 */
interface KillSwitchConfig {
  // Auto-trigger thresholds
  errorRateThreshold: number; // Trigger if error rate exceeds this (0-1)
  confidenceDropThreshold: number; // Trigger if avg confidence drops below
  anomalyCountThreshold: number; // Trigger after this many anomalies in window
  rateLimitPerMinute: number; // Max operations per minute

  // Auto-recovery settings
  autoRecoveryEnabled: boolean;
  autoRecoveryDelayMs: number;
  maxAutoRecoveries: number; // Max recoveries before requiring manual reset
}

const DEFAULT_CONFIG: KillSwitchConfig = {
  errorRateThreshold: 0.2, // 20% error rate triggers kill
  confidenceDropThreshold: 0.3, // Confidence below 30% triggers kill
  anomalyCountThreshold: 5, // 5 anomalies in window triggers kill
  rateLimitPerMinute: 100, // 100 operations per minute max
  autoRecoveryEnabled: true,
  autoRecoveryDelayMs: 5 * 60 * 1000, // 5 minutes
  maxAutoRecoveries: 3,
};

/**
 * Kill switch event record
 */
interface KillSwitchEvent {
  id: string;
  timestamp: string;
  previous_state: KillSwitchState;
  new_state: KillSwitchState;
  reason: KillTriggerReason;
  triggered_by: string;
  message?: string;
  auto_recovery_scheduled?: string;
}

/**
 * Current kill switch status
 */
interface KillSwitchStatus {
  state: KillSwitchState;
  reason?: KillTriggerReason;
  triggered_at?: string;
  triggered_by?: string;
  message?: string;
  auto_recovery_at?: string;
  recovery_count: number;
}

// Current status
let currentStatus: KillSwitchStatus = {
  state: KillSwitchState.ACTIVE,
  recovery_count: 0,
};

// Event history
const eventHistory: KillSwitchEvent[] = [];
const MAX_EVENT_HISTORY = 100;

// Rate limiting
let operationTimestamps: number[] = [];

// Auto-recovery timer
let autoRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

// Configuration
let config = { ...DEFAULT_CONFIG };

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `ks_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Record kill switch event
 */
function recordEvent(event: KillSwitchEvent): void {
  eventHistory.push(event);

  if (eventHistory.length > MAX_EVENT_HISTORY) {
    eventHistory.shift();
  }

  // Log to console for monitoring
  console.warn(
    `[KillSwitch] State change: ${event.previous_state} -> ${event.new_state} (${event.reason})`
  );
}

/**
 * Check if AI operations are allowed
 */
export function isEnabled(): boolean {
  return currentStatus.state === KillSwitchState.ACTIVE;
}

/**
 * Check if AI is in degraded mode
 */
export function isDegraded(): boolean {
  return currentStatus.state === KillSwitchState.DEGRADED;
}

/**
 * Check if AI is completely killed
 */
export function isKilled(): boolean {
  return currentStatus.state === KillSwitchState.KILLED;
}

/**
 * Get current kill switch status
 */
export function getStatus(): KillSwitchStatus {
  return { ...currentStatus };
}

/**
 * Kill AI operations
 */
export function kill(
  reason: KillTriggerReason,
  triggeredBy: string,
  message?: string
): KillSwitchStatus {
  const previousState = currentStatus.state;

  // Cancel any pending auto-recovery
  if (autoRecoveryTimer) {
    clearTimeout(autoRecoveryTimer);
    autoRecoveryTimer = null;
  }

  // Update status
  currentStatus = {
    state: KillSwitchState.KILLED,
    reason,
    triggered_at: new Date().toISOString(),
    triggered_by: triggeredBy,
    message,
    recovery_count: currentStatus.recovery_count,
  };

  // Schedule auto-recovery if enabled and under limit
  if (
    config.autoRecoveryEnabled &&
    currentStatus.recovery_count < config.maxAutoRecoveries &&
    reason !== KillTriggerReason.SECURITY_INCIDENT // Never auto-recover from security incidents
  ) {
    const recoveryTime = new Date(
      Date.now() + config.autoRecoveryDelayMs
    ).toISOString();
    currentStatus.auto_recovery_at = recoveryTime;

    autoRecoveryTimer = setTimeout(() => {
      autoRecover();
    }, config.autoRecoveryDelayMs);
  }

  // Record event
  recordEvent({
    id: generateEventId(),
    timestamp: currentStatus.triggered_at!,
    previous_state: previousState,
    new_state: KillSwitchState.KILLED,
    reason,
    triggered_by: triggeredBy,
    message,
    auto_recovery_scheduled: currentStatus.auto_recovery_at,
  });

  return { ...currentStatus };
}

/**
 * Degrade AI operations (limited functionality)
 */
export function degrade(
  reason: KillTriggerReason,
  triggeredBy: string,
  message?: string
): KillSwitchStatus {
  const previousState = currentStatus.state;

  // Update status
  currentStatus = {
    state: KillSwitchState.DEGRADED,
    reason,
    triggered_at: new Date().toISOString(),
    triggered_by: triggeredBy,
    message,
    recovery_count: currentStatus.recovery_count,
  };

  // Record event
  recordEvent({
    id: generateEventId(),
    timestamp: currentStatus.triggered_at!,
    previous_state: previousState,
    new_state: KillSwitchState.DEGRADED,
    reason,
    triggered_by: triggeredBy,
    message,
  });

  return { ...currentStatus };
}

/**
 * Manually recover/re-enable AI operations
 */
export function recover(recoveredBy: string, message?: string): KillSwitchStatus {
  const previousState = currentStatus.state;

  if (previousState === KillSwitchState.ACTIVE) {
    return { ...currentStatus };
  }

  // Cancel any pending auto-recovery
  if (autoRecoveryTimer) {
    clearTimeout(autoRecoveryTimer);
    autoRecoveryTimer = null;
  }

  // Update status
  currentStatus = {
    state: KillSwitchState.ACTIVE,
    recovery_count: 0, // Reset recovery count on manual recovery
  };

  // Record event
  recordEvent({
    id: generateEventId(),
    timestamp: new Date().toISOString(),
    previous_state: previousState,
    new_state: KillSwitchState.ACTIVE,
    reason: KillTriggerReason.MANUAL,
    triggered_by: recoveredBy,
    message: message || 'Manual recovery',
  });

  return { ...currentStatus };
}

/**
 * Auto-recover (called by timer)
 */
function autoRecover(): void {
  const previousState = currentStatus.state;

  currentStatus = {
    state: KillSwitchState.ACTIVE,
    recovery_count: currentStatus.recovery_count + 1,
  };

  autoRecoveryTimer = null;

  recordEvent({
    id: generateEventId(),
    timestamp: new Date().toISOString(),
    previous_state: previousState,
    new_state: KillSwitchState.ACTIVE,
    reason: KillTriggerReason.MANUAL,
    triggered_by: 'system:auto-recovery',
    message: `Auto-recovery (attempt ${currentStatus.recovery_count} of ${config.maxAutoRecoveries})`,
  });
}

/**
 * Record an operation for rate limiting
 */
export function recordOperation(): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  // Remove old timestamps
  operationTimestamps = operationTimestamps.filter((t) => t > windowStart);

  // Check rate limit
  if (operationTimestamps.length >= config.rateLimitPerMinute) {
    // Auto-trigger kill if rate limit exceeded
    if (currentStatus.state === KillSwitchState.ACTIVE) {
      kill(
        KillTriggerReason.RATE_LIMIT_EXCEEDED,
        'system:rate-limiter',
        `Rate limit exceeded: ${operationTimestamps.length} operations in last minute`
      );
    }

    const oldestInWindow = Math.min(...operationTimestamps);
    return {
      allowed: false,
      remaining: 0,
      resetIn: oldestInWindow + 60000 - now,
    };
  }

  // Record this operation
  operationTimestamps.push(now);

  return {
    allowed: true,
    remaining: config.rateLimitPerMinute - operationTimestamps.length,
    resetIn: 60000,
  };
}

/**
 * Check error rate and trigger if threshold exceeded
 */
export function checkErrorRate(
  totalOperations: number,
  errorCount: number
): { triggered: boolean; rate: number } {
  if (totalOperations === 0) {
    return { triggered: false, rate: 0 };
  }

  const rate = errorCount / totalOperations;

  if (rate > config.errorRateThreshold && currentStatus.state === KillSwitchState.ACTIVE) {
    kill(
      KillTriggerReason.HIGH_ERROR_RATE,
      'system:error-monitor',
      `Error rate ${(rate * 100).toFixed(1)}% exceeds threshold ${(config.errorRateThreshold * 100).toFixed(1)}%`
    );
    return { triggered: true, rate };
  }

  return { triggered: false, rate };
}

/**
 * Check confidence drop and trigger if threshold exceeded
 */
export function checkConfidenceDrop(averageConfidence: number): {
  triggered: boolean;
  confidence: number;
} {
  if (
    averageConfidence < config.confidenceDropThreshold &&
    currentStatus.state === KillSwitchState.ACTIVE
  ) {
    degrade(
      KillTriggerReason.CONFIDENCE_DROP,
      'system:confidence-monitor',
      `Average confidence ${(averageConfidence * 100).toFixed(1)}% below threshold ${(config.confidenceDropThreshold * 100).toFixed(1)}%`
    );
    return { triggered: true, confidence: averageConfidence };
  }

  return { triggered: false, confidence: averageConfidence };
}

/**
 * Get event history
 */
export function getEventHistory(limit: number = 50): KillSwitchEvent[] {
  return eventHistory.slice(-limit);
}

/**
 * Get kill switch statistics
 */
export function getStats(): {
  current_state: KillSwitchState;
  total_events: number;
  kills: number;
  degrades: number;
  recoveries: number;
  auto_recoveries: number;
  operations_last_minute: number;
} {
  return {
    current_state: currentStatus.state,
    total_events: eventHistory.length,
    kills: eventHistory.filter((e) => e.new_state === KillSwitchState.KILLED).length,
    degrades: eventHistory.filter((e) => e.new_state === KillSwitchState.DEGRADED).length,
    recoveries: eventHistory.filter((e) => e.new_state === KillSwitchState.ACTIVE).length,
    auto_recoveries: eventHistory.filter(
      (e) =>
        e.new_state === KillSwitchState.ACTIVE &&
        e.triggered_by === 'system:auto-recovery'
    ).length,
    operations_last_minute: operationTimestamps.filter(
      (t) => t > Date.now() - 60000
    ).length,
  };
}

/**
 * Update configuration
 */
export function updateConfig(newConfig: Partial<KillSwitchConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current configuration
 */
export function getConfig(): KillSwitchConfig {
  return { ...config };
}

/**
 * Reset kill switch (for testing)
 */
export function reset(): void {
  if (autoRecoveryTimer) {
    clearTimeout(autoRecoveryTimer);
    autoRecoveryTimer = null;
  }

  currentStatus = {
    state: KillSwitchState.ACTIVE,
    recovery_count: 0,
  };

  eventHistory.length = 0;
  operationTimestamps.length = 0;
  config = { ...DEFAULT_CONFIG };
}

export default {
  isEnabled,
  isDegraded,
  isKilled,
  getStatus,
  kill,
  degrade,
  recover,
  recordOperation,
  checkErrorRate,
  checkConfidenceDrop,
  getEventHistory,
  getStats,
  updateConfig,
  getConfig,
  reset,
};
