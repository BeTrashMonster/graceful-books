/**
 * TESTING GATE 6.3: Security Dashboard
 *
 * ALL TESTS MUST PASS TO COMPLETE PHASE 6
 *
 * Tests the Security Dashboard component for all required
 * functionality including metrics display, kill switch,
 * and admin access control.
 *
 * @security Phase 6.3 - Continuous Monitoring Dashboard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  SecurityDashboard,
  useSecurityMetrics,
  useSecurityAlerts,
  useCurrentUser,
  type DashboardMetrics,
  type SecurityAlert,
} from '../SecurityDashboard';

// Helper to render with router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Default mock metrics (AI not active)
const defaultMetrics: DashboardMetrics = {
  ai_enabled: false,
  ai_active: false,
  ai_accuracy_7d: null,
  ai_rejection_rate_7d: null,
  proof_gate_failure_rate_7d: null,
  injection_attempts_24h: 2,
  suspicious_imports_24h: 1,
  quarantined_transactions: 3,
  integration_errors_24h: 0,
  token_expirations_upcoming: 2,
  rate_limit_warnings_24h: 0,
  audit_chain_integrity: 'valid',
  last_audit_verification: new Date().toISOString(),
  permission_violations_24h: 0,
};

// Default mock alerts
const defaultAlerts: SecurityAlert[] = [];

describe('GATE 6.3: Security Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/metrics')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(defaultMetrics),
        });
      }
      if (url.includes('/alerts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(defaultAlerts),
        });
      }
      return Promise.resolve({ ok: true });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 6.3.T.1: AI Health Metrics
  // ============================================================================

  describe('6.3.T.1: AI Health Metrics', () => {
    it('displays AI enabled/disabled status', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/AI System Status/i)).toBeInTheDocument();
    });

    it('displays AI accuracy metric', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/AI Accuracy/i)).toBeInTheDocument();
    });

    it('displays rejection rate metric in panel', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/Rejection Rate/i)).toBeInTheDocument();
    });

    it('displays proof gate failure rate', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/Proof Gate Failures/i)).toBeInTheDocument();
    });

    it('shows AI Health panel', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText('AI Health')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 6.3.T.2: Threat Detection Metrics
  // ============================================================================

  describe('6.3.T.2: Threat Detection Metrics', () => {
    it('displays injection attempts count', () => {
      renderWithRouter(<SecurityDashboard />);
      // Multiple elements may show injection attempts (card + panel)
      const elements = screen.getAllByText(/Injection Attempts/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('displays quarantined transactions count', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/Quarantined/i)).toBeInTheDocument();
    });

    it('shows Threat Detection panel', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText('Threat Detection')).toBeInTheDocument();
    });

    it('displays suspicious imports count', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/Suspicious Imports/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 6.3.T.3: Audit Chain Status
  // ============================================================================

  describe('6.3.T.3: Audit Chain Status', () => {
    it('displays audit chain integrity status', () => {
      renderWithRouter(<SecurityDashboard />);
      // Multiple elements may show audit chain (card + panel)
      const elements = screen.getAllByText(/Audit Chain/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('shows valid/broken/unknown status', () => {
      renderWithRouter(<SecurityDashboard />);
      // Multiple elements may show the status (card value + panel text)
      const elements = screen.getAllByText(/valid/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('displays last verification time', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/Last Verification/i)).toBeInTheDocument();
    });

    it('shows Audit Status panel', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText('Audit Status')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 6.3.T.4: Kill Switch Accessibility
  // ============================================================================

  describe('6.3.T.4: Kill Switch Accessibility', () => {
    it('renders kill switch control', () => {
      renderWithRouter(<SecurityDashboard />);
      const killSwitchButton = screen.getByRole('button', { name: /Disable AI/i });
      expect(killSwitchButton).toBeInTheDocument();
    });

    it('kill switch is disabled when no AI features active', () => {
      renderWithRouter(<SecurityDashboard />);

      const killSwitchButton = screen.getByRole('button', { name: /Disable AI/i });
      expect(killSwitchButton).toBeDisabled();
    });

    it('shows message that no AI features are active', () => {
      renderWithRouter(<SecurityDashboard />);

      expect(screen.getByText(/No AI features active yet/i)).toBeInTheDocument();
    });

    it('displays info banner about AI features coming soon', () => {
      renderWithRouter(<SecurityDashboard />);

      expect(screen.getByText(/AI features are not yet implemented/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 6.3.T.5: Alert System
  // ============================================================================

  describe('6.3.T.5: Alert System', () => {
    it('displays alert banner', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByTestId('alert-banner')).toBeInTheDocument();
    });

    it('shows "No active alerts" when no alerts', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/No active alerts/i)).toBeInTheDocument();
    });

    it('shows alert count when alerts present', async () => {
      const alertsWithData: SecurityAlert[] = [
        { id: '1', type: 'high_rejection_rate', severity: 'warning', message: 'High rejection rate detected', timestamp: new Date().toISOString(), acknowledged: false },
      ];

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/alerts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(alertsWithData),
          });
        }
        if (url.includes('/metrics')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(defaultMetrics),
          });
        }
        return Promise.resolve({ ok: true });
      });

      renderWithRouter(<SecurityDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/1 alert/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // 6.3.T.6: Admin Access Control
  // ============================================================================

  describe('6.3.T.6: Admin Access Control', () => {
    it('shows dashboard for admin users', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Security Dashboard/i)).toBeInTheDocument();
    });

    it('dashboard renders main sections', () => {
      renderWithRouter(<SecurityDashboard />);

      // Check for main sections
      expect(screen.getByText('AI Health')).toBeInTheDocument();
      expect(screen.getByText('Threat Detection')).toBeInTheDocument();
      expect(screen.getByText('Integration Health')).toBeInTheDocument();
      expect(screen.getByText('Audit Status')).toBeInTheDocument();
    });

    it('has Back to Dashboard button', () => {
      renderWithRouter(<SecurityDashboard />);

      expect(screen.getByRole('button', { name: /Back to Dashboard/i })).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 6.3.T.7: Export and Verification
  // ============================================================================

  describe('6.3.T.7: Export and Verification', () => {
    it('has audit verification button', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByRole('button', { name: /Verify Audit/i })).toBeInTheDocument();
    });

    it('has export logs button', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByRole('button', { name: /Export/i })).toBeInTheDocument();
    });

    it('audit verification button is clickable', async () => {
      renderWithRouter(<SecurityDashboard />);

      const verifyButton = screen.getByRole('button', { name: /Verify Audit/i });
      fireEvent.click(verifyButton);

      // Should call the API
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/audit/verify'),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  // ============================================================================
  // 6.3.T.8: Real-time Updates
  // ============================================================================

  describe('6.3.T.8: Real-time Updates', () => {
    it('fetches metrics on mount', async () => {
      renderWithRouter(<SecurityDashboard />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/metrics')
        );
      });
    });

    it('fetches alerts on mount', async () => {
      renderWithRouter(<SecurityDashboard />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/alerts')
        );
      });
    });

    it('sets up periodic refresh', async () => {
      vi.useFakeTimers();

      const { unmount } = renderWithRouter(<SecurityDashboard />);

      // Initial fetch happens
      expect(mockFetch).toHaveBeenCalled();

      const initialCallCount = mockFetch.mock.calls.length;

      // Advance time by 30 seconds (the refresh interval)
      await vi.advanceTimersByTimeAsync(30000);

      // Should have fetched again
      expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);

      // Cleanup
      unmount();
      vi.useRealTimers();
    });
  });

  // ============================================================================
  // 6.3.T.9: Overall Status Indicator
  // ============================================================================

  describe('6.3.T.9: Overall Status Indicator', () => {
    it('shows system status indicator', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/All Systems Operational|Attention Required|Critical/i)).toBeInTheDocument();
    });

    it('shows attention status when AI not active', () => {
      renderWithRouter(<SecurityDashboard />);
      // Shows "Attention Required" because AI is not yet active
      expect(screen.getByText(/Attention Required/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 6.3.T.10: Integration Health Panel
  // ============================================================================

  describe('6.3.T.10: Integration Health Panel', () => {
    it('displays Integration Health panel', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText('Integration Health')).toBeInTheDocument();
    });

    it('shows integration errors count', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/Errors/i)).toBeInTheDocument();
    });

    it('shows expiring tokens count', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/Expiring Tokens/i)).toBeInTheDocument();
    });

    it('shows rate limit warnings count', () => {
      renderWithRouter(<SecurityDashboard />);
      expect(screen.getByText(/Rate Limit Warnings/i)).toBeInTheDocument();
    });
  });
});
