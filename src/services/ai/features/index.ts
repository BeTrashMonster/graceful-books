/**
 * AI Features Module
 *
 * All AI features with full security controls.
 *
 * @security Phase 4 - AI Feature Security
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

// Categorization Feature (Phase 4.1)
export * from './categorization';
export { default as categorizationService } from './categorization';

// Anomaly Detection Feature (Phase 4.2)
export * from './anomaly';
export { default as anomalyService } from './anomaly';

// Forecasting Feature (Phase 4.3)
export * from './forecasting';
export { default as forecastingService } from './forecasting';

// Behavioral Testing (Phase 4.4)
export * from './behavioral';
export { default as behavioralTesting } from './behavioral';
