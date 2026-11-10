/**
 * Security Dashboard
 *
 * Administrative dashboard for monitoring AI security metrics,
 * managing the kill switch, and viewing audit status.
 *
 * @security Phase 6.3 - Continuous Monitoring Dashboard
 * @see docs/governance/NIST_AI_RMF_IMPLEMENTATION.md
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Dashboard metrics interface
 */
export interface DashboardMetrics {
  // AI Health
  ai_enabled: boolean;
  ai_accuracy_7d: number;
  ai_rejection_rate_7d: number;
  proof_gate_failure_rate_7d: number;

  // Threat Detection
  injection_attempts_24h: number;
  suspicious_imports_24h: number;
  quarantined_transactions: number;

  // Integration Health
  integration_errors_24h: number;
  token_expirations_upcoming: number;
  rate_limit_warnings_24h: number;

  // Audit
  audit_chain_integrity: 'valid' | 'broken' | 'unknown';
  last_audit_verification: string;
  permission_violations_24h: number;

  // Historical data for trends
  ai_accuracy_7d_history?: number[];
}

/**
 * Security alert interface
 */
export interface SecurityAlert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

/**
 * User context interface
 */
interface UserContext {
  role: 'admin' | 'member' | 'viewer';
  id: string;
  name: string;
}

/**
 * Hook to fetch security metrics
 */
export function useSecurityMetrics(): DashboardMetrics {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    ai_enabled: true,
    ai_accuracy_7d: 0.92,
    ai_rejection_rate_7d: 0.15,
    proof_gate_failure_rate_7d: 0.02,
    injection_attempts_24h: 0,
    suspicious_imports_24h: 0,
    quarantined_transactions: 0,
    integration_errors_24h: 0,
    token_expirations_upcoming: 0,
    rate_limit_warnings_24h: 0,
    audit_chain_integrity: 'valid',
    last_audit_verification: new Date().toISOString(),
    permission_violations_24h: 0,
  });

  useEffect(() => {
    // Fetch initial metrics
    fetchMetrics().then(setMetrics);

    // Set up periodic refresh (every 30 seconds)
    const interval = setInterval(() => {
      fetchMetrics().then(setMetrics);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

/**
 * Fetch metrics from API
 */
async function fetchMetrics(): Promise<DashboardMetrics> {
  try {
    const response = await fetch('/api/admin/security/metrics');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch security metrics:', error);
  }

  // Return defaults if fetch fails
  return {
    ai_enabled: true,
    ai_accuracy_7d: 0.92,
    ai_rejection_rate_7d: 0.15,
    proof_gate_failure_rate_7d: 0.02,
    injection_attempts_24h: 0,
    suspicious_imports_24h: 0,
    quarantined_transactions: 0,
    integration_errors_24h: 0,
    token_expirations_upcoming: 0,
    rate_limit_warnings_24h: 0,
    audit_chain_integrity: 'valid',
    last_audit_verification: new Date().toISOString(),
    permission_violations_24h: 0,
  };
}

/**
 * Hook to fetch security alerts
 */
export function useSecurityAlerts(): SecurityAlert[] {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);

  useEffect(() => {
    fetchAlerts().then(setAlerts);

    const interval = setInterval(() => {
      fetchAlerts().then(setAlerts);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return alerts;
}

/**
 * Fetch alerts from API
 */
async function fetchAlerts(): Promise<SecurityAlert[]> {
  try {
    const response = await fetch('/api/admin/security/alerts');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch security alerts:', error);
  }
  return [];
}

/**
 * Hook to get current user context
 */
export function useCurrentUser(): UserContext {
  // In production, this would fetch from auth context
  return {
    role: 'admin',
    id: 'user-admin',
    name: 'Administrator',
  };
}

/**
 * Get overall system status based on metrics
 */
function getOverallStatus(metrics: DashboardMetrics): 'good' | 'warning' | 'critical' {
  if (!metrics.ai_enabled) return 'warning';
  if (metrics.audit_chain_integrity === 'broken') return 'critical';
  if (metrics.proof_gate_failure_rate_7d > 0.1) return 'critical';
  if (metrics.injection_attempts_24h > 10) return 'warning';
  if (metrics.ai_accuracy_7d < 0.85) return 'warning';
  return 'good';
}

/**
 * Calculate trend from historical data
 */
function calculateTrend(history?: number[]): 'up' | 'down' | 'stable' {
  if (!history || history.length < 2) return 'stable';
  const recent = history.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const older = history.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  if (recent > older * 1.05) return 'up';
  if (recent < older * 0.95) return 'down';
  return 'stable';
}

/**
 * System status indicator component
 */
function SystemStatus({ status }: { status: 'good' | 'warning' | 'critical' }) {
  const statusConfig = {
    good: { label: 'All Systems Operational', color: '#276749' },
    warning: { label: 'Attention Required', color: '#92400e' },
    critical: { label: 'Critical Issues Detected', color: '#9b2c2c' },
  };

  const config = statusConfig[status];

  return (
    <div
      className="system-status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '4px',
        backgroundColor: `${config.color}20`,
        color: config.color,
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: config.color,
        }}
      />
      {config.label}
    </div>
  );
}

/**
 * Alert banner component
 */
function AlertBanner({ alerts }: { alerts: SecurityAlert[] }) {
  const activeAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <div data-testid="alert-banner" className="alert-banner">
      {activeAlerts.length > 0 ? (
        <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '4px' }}>
          <strong>{activeAlerts.length} alert{activeAlerts.length !== 1 ? 's' : ''}</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
            {activeAlerts.slice(0, 3).map((alert) => (
              <li key={alert.id}>{alert.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div style={{ padding: '12px', backgroundColor: '#d1fae5', borderRadius: '4px' }}>
          No active alerts
        </div>
      )}
    </div>
  );
}

/**
 * Metric card component
 */
interface MetricCardProps {
  title: string;
  value: string | number;
  status: 'good' | 'warning' | 'error';
  trend?: 'up' | 'down' | 'stable';
}

function MetricCard({ title, value, status, trend }: MetricCardProps) {
  const statusColors = {
    good: '#276749',
    warning: '#92400e',
    error: '#9b2c2c',
  };

  return (
    <div
      className="metric-card"
      style={{
        padding: '16px',
        borderRadius: '8px',
        border: `1px solid ${statusColors[status]}40`,
        backgroundColor: `${statusColors[status]}10`,
      }}
    >
      <div style={{ fontSize: '14px', color: '#64748b' }}>{title}</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: statusColors[status] }}>
        {value}
        {trend && trend !== 'stable' && (
          <span style={{ fontSize: '14px', marginLeft: '4px' }}>
            {trend === 'up' ? '\u2191' : '\u2193'}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * AI Health Panel component
 */
function AIHealthPanel({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="panel ai-health-panel">
      <h3>AI Health</h3>
      <div style={{ display: 'grid', gap: '16px' }}>
        <div>
          <strong>Accuracy (7d):</strong> {(metrics.ai_accuracy_7d * 100).toFixed(1)}%
        </div>
        <div>
          <strong>Rejection Rate:</strong> {(metrics.ai_rejection_rate_7d * 100).toFixed(1)}%
        </div>
        <div>
          <strong>Proof Gate Failures:</strong> {(metrics.proof_gate_failure_rate_7d * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

/**
 * Threat Detection Panel component
 */
function ThreatDetectionPanel({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="panel threat-detection-panel">
      <h3>Threat Detection</h3>
      <div style={{ display: 'grid', gap: '16px' }}>
        <div>
          <strong>Injection Attempts (24h):</strong> {metrics.injection_attempts_24h}
        </div>
        <div>
          <strong>Suspicious Imports:</strong> {metrics.suspicious_imports_24h}
        </div>
        <div>
          <strong>Quarantined Transactions:</strong> {metrics.quarantined_transactions}
        </div>
      </div>
    </div>
  );
}

/**
 * Integration Health Panel component
 */
function IntegrationHealthPanel({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="panel integration-health-panel">
      <h3>Integration Health</h3>
      <div style={{ display: 'grid', gap: '16px' }}>
        <div>
          <strong>Errors (24h):</strong> {metrics.integration_errors_24h}
        </div>
        <div>
          <strong>Expiring Tokens:</strong> {metrics.token_expirations_upcoming}
        </div>
        <div>
          <strong>Rate Limit Warnings:</strong> {metrics.rate_limit_warnings_24h}
        </div>
      </div>
    </div>
  );
}

/**
 * Audit Panel component
 */
function AuditPanel({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="panel audit-panel">
      <h3>Audit Status</h3>
      <div style={{ display: 'grid', gap: '16px' }}>
        <div>
          <strong>Chain Integrity:</strong>{' '}
          <span
            style={{
              color: metrics.audit_chain_integrity === 'valid' ? '#276749' : '#9b2c2c',
            }}
          >
            {metrics.audit_chain_integrity}
          </span>
        </div>
        <div>
          <strong>Last Verification:</strong>{' '}
          {new Date(metrics.last_audit_verification).toLocaleString()}
        </div>
        <div>
          <strong>Permission Violations (24h):</strong> {metrics.permission_violations_24h}
        </div>
      </div>
    </div>
  );
}

/**
 * Kill Switch Control component
 */
function KillSwitchControl() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);

  const handleToggle = useCallback(() => {
    if (aiEnabled) {
      setShowConfirm(true);
    } else {
      // Re-enable requires additional confirmation
      setShowConfirm(true);
    }
  }, [aiEnabled]);

  const handleConfirm = useCallback(async () => {
    try {
      const action = aiEnabled ? 'disable' : 'enable';
      await fetch(`/api/admin/ai/${action}`, { method: 'POST' });
      setAiEnabled(!aiEnabled);
    } catch (error) {
      console.error('Failed to toggle AI:', error);
    }
    setShowConfirm(false);
  }, [aiEnabled]);

  return (
    <div className="kill-switch-control">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <button
          onClick={handleToggle}
          aria-label={aiEnabled ? 'Disable AI' : 'Enable AI'}
          className="kill-switch-button"
          style={{
            padding: '12px 24px',
            backgroundColor: aiEnabled ? '#9b2c2c' : '#276749',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: 0.6,
          }}
          disabled
        >
          {aiEnabled ? 'Disable AI' : 'Enable AI'}
        </button>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          (No AI features active yet)
        </span>
      </div>

      {showConfirm && (
        <div
          className="confirm-dialog"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}
        >
          <h3>Confirm {aiEnabled ? 'Disable' : 'Enable'} AI</h3>
          <p>
            Are you sure you want to {aiEnabled ? 'disable' : 'enable'} all AI features?
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button onClick={handleConfirm}>Confirm</button>
            <button onClick={() => setShowConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Audit Verification Button component
 */
function AuditVerificationButton() {
  const [verifying, setVerifying] = useState(false);

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    try {
      await fetch('/api/admin/audit/verify', { method: 'POST' });
    } catch (error) {
      console.error('Audit verification failed:', error);
    }
    setVerifying(false);
  }, []);

  return (
    <button
      onClick={handleVerify}
      disabled={verifying}
      aria-label="Verify Audit Chain"
      style={{
        padding: '12px 24px',
        backgroundColor: '#2c5282',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: verifying ? 'not-allowed' : 'pointer',
        opacity: verifying ? 0.7 : 1,
      }}
    >
      {verifying ? 'Verifying...' : 'Verify Audit Chain'}
    </button>
  );
}

/**
 * Export Logs Button component
 */
function ExportLogsButton() {
  const handleExport = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/logs/export', { method: 'POST' });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-logs-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, []);

  return (
    <button
      onClick={handleExport}
      aria-label="Export Security Logs"
      style={{
        padding: '12px 24px',
        backgroundColor: '#475569',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      Export Logs
    </button>
  );
}

/**
 * Access Denied component
 */
function AccessDenied() {
  return (
    <div
      className="access-denied"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        textAlign: 'center',
      }}
    >
      <h2>Access Denied</h2>
      <p>You do not have permission to view this dashboard.</p>
      <p>Please contact an administrator if you need access.</p>
    </div>
  );
}

/**
 * Main Security Dashboard component
 */
export function SecurityDashboard() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const metrics = useSecurityMetrics();
  const alerts = useSecurityAlerts();

  // Check admin access
  if (user.role !== 'admin') {
    return <AccessDenied />;
  }

  const overallStatus = getOverallStatus(metrics);

  return (
    <div
      className="security-dashboard"
      style={{
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#475569',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Back to Dashboard
          </button>
          <h1 style={{ margin: 0 }}>Security Dashboard</h1>
        </div>
        <SystemStatus status={overallStatus} />
      </header>

      {/* Info banner about AI features */}
      <div
        style={{
          padding: '16px',
          backgroundColor: '#1e3a5f20',
          border: '1px solid #1e3a5f40',
          borderRadius: '8px',
          marginBottom: '24px',
          color: '#1e3a5f',
        }}
      >
        <strong>Note:</strong> AI features are not yet implemented. This dashboard shows the security
        framework that will monitor AI-powered features (transaction categorization, anomaly detection,
        forecasting) when they are added. Current metrics display placeholder values.
      </div>

      <AlertBanner alerts={alerts} />

      <section
        className="metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          marginTop: '24px',
        }}
      >
        <MetricCard
          title="AI System Status"
          value={metrics.ai_enabled ? 'Enabled' : 'Disabled'}
          status={metrics.ai_enabled ? 'good' : 'warning'}
        />

        <MetricCard
          title="AI Accuracy (7d)"
          value={`${(metrics.ai_accuracy_7d * 100).toFixed(1)}%`}
          status={metrics.ai_accuracy_7d > 0.9 ? 'good' : metrics.ai_accuracy_7d > 0.8 ? 'warning' : 'error'}
          trend={calculateTrend(metrics.ai_accuracy_7d_history)}
        />

        <MetricCard
          title="Injection Attempts (24h)"
          value={metrics.injection_attempts_24h}
          status={metrics.injection_attempts_24h < 5 ? 'good' : metrics.injection_attempts_24h < 20 ? 'warning' : 'error'}
        />

        <MetricCard
          title="Audit Chain"
          value={metrics.audit_chain_integrity}
          status={metrics.audit_chain_integrity === 'valid' ? 'good' : 'error'}
        />
      </section>

      <section
        className="detailed-panels"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginTop: '32px',
        }}
      >
        <AIHealthPanel metrics={metrics} />
        <ThreatDetectionPanel metrics={metrics} />
        <IntegrationHealthPanel metrics={metrics} />
        <AuditPanel metrics={metrics} />
      </section>

      <section
        className="actions"
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '32px',
          flexWrap: 'wrap',
        }}
      >
        <KillSwitchControl />
        <AuditVerificationButton />
        <ExportLogsButton />
      </section>
    </div>
  );
}

export default SecurityDashboard;
