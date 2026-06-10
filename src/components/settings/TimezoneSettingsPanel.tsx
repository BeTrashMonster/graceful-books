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

// All timezones grouped by region
const TIMEZONES = [
  // North America
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (MT - No DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Toronto', label: 'Toronto (ET)' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  { value: 'America/Mexico_City', label: 'Mexico City (CT)' },

  // Europe
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Brussels', label: 'Brussels (CET/CEST)' },
  { value: 'Europe/Vienna', label: 'Vienna (CET/CEST)' },
  { value: 'Europe/Athens', label: 'Athens (EET/EEST)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },

  // Asia
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },

  // Australia & Pacific
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },

  // South America
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT/BRST)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { value: 'America/Santiago', label: 'Santiago (CLT/CLST)' },

  // Africa
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
  { value: 'Africa/Cairo', label: 'Cairo (EET/EEST)' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
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
    if (userIdentifier) {
      loadCurrentTimezone();
    } else {
      // Set browser timezone as fallback
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setCurrentTimezone(detected);
      setSelectedTimezone(detected);
    }
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
      // Still set a default timezone so the component doesn't break
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setCurrentTimezone(detected);
      setSelectedTimezone(detected);
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

      // Notify other components that timezone has changed
      window.dispatchEvent(new CustomEvent('timezone-updated', {
        detail: { timezone: selectedTimezone }
      }));

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

  // Safety check: if no timezone is set yet, show loading state
  if (!selectedTimezone && !currentTimezone) {
    return (
      <Card>
        <CardHeader>
          <h2>Regional Settings</h2>
        </CardHeader>
        <CardBody>
          <div className={styles.section}>
            <p>Loading timezone settings...</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: '2rem' }}>
      <CardHeader>
        <h2>Regional Settings</h2>
      </CardHeader>
      <CardBody>
        <div className={styles.section}>
          <div className={styles.compactRow}>
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
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={styles.saveButton}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

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
        </div>
      </CardBody>
    </Card>
  );
}
