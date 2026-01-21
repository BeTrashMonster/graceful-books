/**
 * Interest Split Settings Component
 *
 * Allows users to configure interest split detection preferences.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 * - WCAG 2.1 AA Compliance
 */

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../core/Button';
import { Checkbox } from '../forms/Checkbox';
import { Input } from '../forms/Input';
import { Label } from '../forms/Label';
import type { InterestSplitPreferences } from '../../types/loanAmortization.types';

export interface InterestSplitSettingsProps {
  /**
   * Current preferences
   */
  preferences: InterestSplitPreferences;

  /**
   * Callback when preferences are saved
   */
  onSave: (preferences: InterestSplitPreferences) => void;

  /**
   * Whether save operation is in progress
   */
  isSaving?: boolean;
}

/**
 * Interest Split Settings Component
 */
export const InterestSplitSettings = ({
  preferences,
  onSave,
  isSaving = false,
}: InterestSplitSettingsProps) => {
  const [localPreferences, setLocalPreferences] =
    useState<InterestSplitPreferences>(preferences);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when preferences change
  useEffect(() => {
    setLocalPreferences(preferences);
    setHasChanges(false);
  }, [preferences]);

  /**
   * Update a preference value
   */
  const updatePreference = <K extends keyof InterestSplitPreferences>(
    key: K,
    value: InterestSplitPreferences[K]
  ) => {
    setLocalPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  /**
   * Handle save
   */
  const handleSave = () => {
    onSave({
      ...localPreferences,
      updated_at: Date.now(),
    });
  };

  /**
   * Reset to original preferences
   */
  const handleReset = () => {
    setLocalPreferences(preferences);
    setHasChanges(false);
  };

  return (
    <div className="interest-split-settings">
      <Card>
        <div className="settings-section">
          <h3>Detection Settings</h3>

          <div className="setting-item">
            <Checkbox
              id="enable-auto-detection"
              name="enableAutoDetection"
              label="Enable automatic loan payment detection"
              checked={localPreferences.enable_auto_detection}
              onChange={(e) =>
                updatePreference('enable_auto_detection', e.target.checked)
              }
              disabled={isSaving}
            />
            <p className="help-text">
              Automatically analyze transactions to identify loan payments
            </p>
          </div>

          <div className="setting-item">
            <Label htmlFor="confidence-threshold">
              Minimum confidence threshold ({localPreferences.confidence_threshold}%)
            </Label>
            <Input
              id="confidence-threshold"
              name="confidenceThreshold"
              type="range"
              min="40"
              max="100"
              step="5"
              value={localPreferences.confidence_threshold}
              onChange={(e) =>
                updatePreference('confidence_threshold', parseInt(e.target.value))
              }
              disabled={!localPreferences.enable_auto_detection || isSaving}
            />
            <p className="help-text">
              Only show prompts when confidence is above this threshold
            </p>
          </div>
        </div>

        <div className="settings-section">
          <h3>Prompt Behavior</h3>

          <div className="setting-item">
            <Checkbox
              id="show-prompts"
              name="showPrompts"
              label="Show interest split prompts"
              checked={localPreferences.show_prompts}
              onChange={(e) => updatePreference('show_prompts', e.target.checked)}
              disabled={isSaving}
            />
            <p className="help-text">
              Display a prompt when a loan payment is detected
            </p>
          </div>

          <div className="setting-item">
            <Checkbox
              id="defer-by-default"
              name="deferByDefault"
              label="Defer to checklist by default"
              checked={localPreferences.defer_by_default}
              onChange={(e) => updatePreference('defer_by_default', e.target.checked)}
              disabled={!localPreferences.show_prompts || isSaving}
            />
            <p className="help-text">
              Automatically add detected payments to checklist without prompting
            </p>
          </div>
        </div>

        <div className="settings-section">
          <h3>Notifications</h3>

          <div className="setting-item">
            <Checkbox
              id="notify-on-detection"
              name="notifyOnDetection"
              label="Notify me when loan payments are detected"
              checked={localPreferences.notify_on_detection}
              onChange={(e) => updatePreference('notify_on_detection', e.target.checked)}
              disabled={isSaving}
            />
            <p className="help-text">
              Receive notifications about detected loan payments
            </p>
          </div>

          {localPreferences.notify_on_detection && (
            <div className="setting-item indent">
              <Label>Notification methods:</Label>
              <Checkbox
                id="notify-in-app"
                name="notifyInApp"
                label="In-app notifications"
                checked={localPreferences.notification_methods.includes('in_app')}
                onChange={(e) => {
                  const methods = e.target.checked
                    ? [...localPreferences.notification_methods, 'in_app' as const]
                    : localPreferences.notification_methods.filter((m) => m !== 'in_app');
                  updatePreference('notification_methods', methods);
                }}
                disabled={isSaving}
              />
              <Checkbox
                id="notify-email"
                name="notifyEmail"
                label="Email notifications"
                checked={localPreferences.notification_methods.includes('email')}
                onChange={(e) => {
                  const methods = e.target.checked
                    ? [...localPreferences.notification_methods, 'email' as const]
                    : localPreferences.notification_methods.filter((m) => m !== 'email');
                  updatePreference('notification_methods', methods);
                }}
                disabled={isSaving}
              />
            </div>
          )}
        </div>

        <div className="settings-section">
          <h3>Account Overrides</h3>
          <p className="section-description">
            Manage accounts where automatic detection should be disabled or always applied.
          </p>

          <div className="account-lists">
            <div className="account-list">
              <Label>Never prompt for these accounts:</Label>
              <div className="account-badges">
                {localPreferences.never_prompt_accounts.length === 0 ? (
                  <p className="empty-state">No accounts excluded</p>
                ) : (
                  localPreferences.never_prompt_accounts.map((accountId) => (
                    <span key={accountId} className="account-badge">
                      Account {accountId.substring(0, 8)}...
                      <button
                        type="button"
                        onClick={() => {
                          const updated = localPreferences.never_prompt_accounts.filter(
                            (id) => id !== accountId
                          );
                          updatePreference('never_prompt_accounts', updated);
                        }}
                        disabled={isSaving}
                        aria-label="Remove account"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="account-list">
              <Label>Always auto-split for these accounts:</Label>
              <div className="account-badges">
                {localPreferences.always_auto_split_accounts.length === 0 ? (
                  <p className="empty-state">No accounts set for auto-split</p>
                ) : (
                  localPreferences.always_auto_split_accounts.map((accountId) => (
                    <span key={accountId} className="account-badge">
                      Account {accountId.substring(0, 8)}...
                      <button
                        type="button"
                        onClick={() => {
                          const updated =
                            localPreferences.always_auto_split_accounts.filter(
                              (id) => id !== accountId
                            );
                          updatePreference('always_auto_split_accounts', updated);
                        }}
                        disabled={isSaving}
                        aria-label="Remove account"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <Button variant="secondary" onClick={handleReset} disabled={!hasChanges || isSaving}>
            Reset
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Card>

      <style>{`
        .interest-split-settings {
          max-width: 800px;
        }

        .settings-section {
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .settings-section:last-of-type {
          border-bottom: none;
        }

        .settings-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
        }

        .section-description {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .setting-item {
          margin-bottom: 1.5rem;
        }

        .setting-item.indent {
          margin-left: 1.5rem;
        }

        .help-text {
          margin: 0.5rem 0 0 0;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .account-lists {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .account-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .account-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .account-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background-color: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .account-badge button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.25rem;
          height: 1.25rem;
          padding: 0;
          background-color: transparent;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.25rem;
          line-height: 1;
          color: #6b7280;
          transition: background-color 0.2s, color 0.2s;
        }

        .account-badge button:hover {
          background-color: #e5e7eb;
          color: #111827;
        }

        .account-badge button:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .empty-state {
          font-size: 0.875rem;
          color: #9ca3af;
          font-style: italic;
        }

        .settings-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          padding-top: 1.5rem;
        }

        @media (prefers-reduced-motion: reduce) {
          .account-badge button {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};
