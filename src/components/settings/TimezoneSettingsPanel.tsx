/**
 * Timezone Settings Panel
 *
 * Allows users to view and change their timezone preference.
 * Timezone is auto-detected from billing address but can be overridden here.
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../core/Button';
import { Alert } from '../feedback/ErrorMessage';
import { db } from '../../db/database';
import { useAuth } from '../../contexts/AuthContext';
import styles from './TimezoneSettingsPanel.module.css';

// Common US timezones
const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', example: 'New York, Miami' },
  { value: 'America/Chicago', label: 'Central Time (CT)', example: 'Chicago, Dallas' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', example: 'Denver, Phoenix' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', example: 'Los Angeles, Seattle' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', example: 'Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)', example: 'Honolulu' },
];

export function TimezoneSettingsPanel() {
  const { userIdentifier } = useAuth();
  const [currentTimezone, setCurrentTimezone] = useState<string>('');
  const [selectedTimezone, setSelectedTimezone] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current timezone
  useEffect(() => {
    loadCurrentTimezone();
  }, [userIdentifier]);

  const loadCurrentTimezone = async () => {
    try {
      const users = await db.users.where('email').equals(userIdentifier).toArray();
      if (users.length > 0 && users[0].preferences?.timezone) {
        const tz = users[0].preferences.timezone;
        setCurrentTimezone(tz);
        setSelectedTimezone(tz);
      } else {
        // Default to browser-detected timezone if not set
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setCurrentTimezone(detected);
        setSelectedTimezone(detected);
      }
    } catch (err) {
      console.error('[TimezoneSettings] Error loading timezone:', err);
      setError('Failed to load timezone settings');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Update user preferences in database
      const users = await db.users.where('email').equals(userIdentifier).toArray();
      if (users.length === 0) {
        throw new Error('User not found');
      }

      const user = users[0];
      await db.users.update(user.id, {
        preferences: {
          ...user.preferences,
          timezone: selectedTimezone,
        },
        updated_at: Date.now(),
      });

      setCurrentTimezone(selectedTimezone);
      setSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update timezone';
      setError(message);
      console.error('[TimezoneSettings] Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selectedTimezone !== currentTimezone;

  // Get current time in selected timezone for preview
  const getCurrentTimePreview = () => {
    try {
      const now = new Date();
      return now.toLocaleTimeString('en-US', {
        timeZone: selectedTimezone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Invalid timezone';
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2>Regional Settings</h2>
      </CardHeader>
      <CardBody>
        <div className={styles.section}>
          <h3>Timezone</h3>
          <p className={styles.description}>
            Your timezone is used for timestamps, audit logs, and date filters throughout the application.
            It was automatically detected from your billing address, but you can change it here if needed.
          </p>

          <div className={styles.formGroup}>
            <label htmlFor="timezone-select" className={styles.label}>
              Current Timezone
            </label>
            <select
              id="timezone-select"
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
              className={styles.select}
            >
              {US_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} - {tz.example}
                </option>
              ))}
            </select>
          </div>

          {selectedTimezone && (
            <div className={styles.preview}>
              <strong>Current time in this timezone:</strong> {getCurrentTimePreview()}
            </div>
          )}

          {error && (
            <Alert variant="error" style={{ marginTop: '1rem' }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" style={{ marginTop: '1rem' }}>
              Timezone updated successfully!
            </Alert>
          )}

          <div className={styles.actions}>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            {hasChanges && (
              <Button
                variant="secondary"
                onClick={() => setSelectedTimezone(currentTimezone)}
                disabled={saving}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
