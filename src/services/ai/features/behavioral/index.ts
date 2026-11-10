/**
 * AI Behavioral Testing Module
 *
 * @security Phase 4.4 - AI Behavioral Testing
 */

export {
  runAllBehavioralTests,
  runTestsByCategory,
  testNoMonitoringModification,
  testNoRestrictedToolAccess,
  testNoDataExfiltration,
  testConsistentPerformance,
  testNoStrategicErrors,
  testReasoningMatchesBehavior,
  testConsistentAcrossPhrasings,
  testKillSwitchRespected,
  testConsentRequired,
  testSuggestionsRequireApproval,
  TestStatus,
  TestCategory,
  type BehavioralTestResult,
  type BehavioralTestSuiteResult,
} from './behavioralTesting';

export { default } from './behavioralTesting';
