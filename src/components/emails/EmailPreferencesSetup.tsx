/**
 * Email Preferences Setup Component
 *
 * Per D3: Weekly Email Summary Setup
 * Allows users to configure weekly email summaries with preview functionality.
 */

import React, { useState, useEffect } from 'react';
import type { DayOfWeek, EmailFrequency, EmailContentSection } from '../../types/email.types';

interface EmailPreferencesSetupProps {
  userId: string;
  companyId: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export const EmailPreferencesSetup: React.FC<EmailPreferencesSetupProps> = ({
  userId,
  companyId,
  onSave,
  onCancel,
}) => {
  // Form state
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<EmailFrequency>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('monday');
  const [timeOfDay, setTimeOfDay] = useState('08:00');
  const [includeSections, setIncludeSections] = useState<EmailContentSection[]>([
    'checklist-summary',
    'foundation-tasks',
    'upcoming-deadlines',
    'quick-tips',
    'progress-update',
  ]);
  const [maxTasksToShow, setMaxTasksToShow] = useState(5);
  const [useDiscAdaptation, setUseDiscAdaptation] = useState(true);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      // Save preferences logic will be implemented in the store
      // For now, just simulate success
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (onSave) {
        onSave();
      }
    } catch (err) {
      setError('We couldn\'t save your preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: EmailContentSection) => {
    setIncludeSections((prev) => {
      if (prev.includes(section)) {
        // Don't allow removing all sections
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((s) => s !== section);
      } else {
        return [...prev, section];
      }
    });
  };

  return (
    <div className="email-preferences-setup">
      <div className="setup-header">
        <h2>Set Up Your Weekly Email Summary</h2>
        <p>Let's set up your weekly check-in. Think of it as a friendly Monday morning coffee chat.</p>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="setup-form">
        {/* Enable/Disable Toggle */}
        <div className="form-group">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              aria-label="Enable weekly email summaries"
            />
            <span>Send me weekly email summaries</span>
          </label>
        </div>

        {enabled && (
          <>
            {/* Frequency Selection */}
            <div className="form-group">
              <label htmlFor="frequency">How often?</label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as EmailFrequency)}
                className="form-select"
              >
                <option value="weekly">Every week</option>
                <option value="bi-weekly">Every two weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Day Selection */}
            <div className="form-group">
              <label htmlFor="dayOfWeek">Which day?</label>
              <select
                id="dayOfWeek"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
                className="form-select"
              >
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
              </select>
              <p className="help-text">
                Most people prefer Monday morning to plan their week ahead.
              </p>
            </div>

            {/* Time Selection */}
            <div className="form-group">
              <label htmlFor="timeOfDay">What time?</label>
              <input
                type="time"
                id="timeOfDay"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                className="form-input"
              />
              <p className="help-text">
                We'll send your email in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
              </p>
            </div>

            {/* Content Sections */}
            <div className="form-group">
              <label>What should we include?</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeSections.includes('checklist-summary')}
                    onChange={() => toggleSection('checklist-summary')}
                  />
                  <span>
                    <strong>Your task summary</strong>
                    <br />
                    <small>Active tasks and upcoming items</small>
                  </span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeSections.includes('foundation-tasks')}
                    onChange={() => toggleSection('foundation-tasks')}
                  />
                  <span>
                    <strong>Foundation tasks</strong>
                    <br />
                    <small>Core setup items for your business</small>
                  </span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeSections.includes('upcoming-deadlines')}
                    onChange={() => toggleSection('upcoming-deadlines')}
                  />
                  <span>
                    <strong>Upcoming deadlines</strong>
                    <br />
                    <small>Items due in the next 7 days</small>
                  </span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeSections.includes('quick-tips')}
                    onChange={() => toggleSection('quick-tips')}
                  />
                  <span>
                    <strong>Quick tips</strong>
                    <br />
                    <small>Helpful insights and best practices</small>
                  </span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeSections.includes('progress-update')}
                    onChange={() => toggleSection('progress-update')}
                  />
                  <span>
                    <strong>Progress update</strong>
                    <br />
                    <small>See how far you've come</small>
                  </span>
                </label>
              </div>
            </div>

            {/* Max Tasks */}
            <div className="form-group">
              <label htmlFor="maxTasks">Maximum tasks to show</label>
              <input
                type="number"
                id="maxTasks"
                value={maxTasksToShow}
                onChange={(e) => setMaxTasksToShow(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
                min="1"
                max="20"
                className="form-input"
              />
              <p className="help-text">
                We'll show your top {maxTasksToShow} most important tasks.
              </p>
            </div>

            {/* DISC Adaptation */}
            <div className="form-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={useDiscAdaptation}
                  onChange={(e) => setUseDiscAdaptation(e.target.checked)}
                />
                <span>
                  Personalize content to my communication style
                  <br />
                  <small>We'll adapt the tone and format based on your DISC profile</small>
                </span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="setup-actions">
        {enabled && (
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="btn btn-secondary"
            disabled={loading}
          >
            Preview Email
          </button>
        )}

        <div className="action-buttons-right">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-text"
              disabled={loading}
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <EmailPreviewModal
          userId={userId}
          companyId={companyId}
          preferences={{
            enabled,
            frequency,
            dayOfWeek,
            timeOfDay,
            includeSections,
            maxTasksToShow,
            useDiscAdaptation,
          }}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

/**
 * Email Preview Modal Component
 */
interface EmailPreviewModalProps {
  userId: string;
  companyId: string;
  preferences: {
    enabled: boolean;
    frequency: EmailFrequency;
    dayOfWeek: DayOfWeek;
    timeOfDay: string;
    includeSections: EmailContentSection[];
    maxTasksToShow: number;
    useDiscAdaptation: boolean;
  };
  onClose: () => void;
}

const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  userId,
  companyId,
  preferences,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [previewHTML, setPreviewHTML] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load preview
    const loadPreview = async () => {
      setLoading(true);
      setError(null);

      try {
        // This would call the preview service
        // For now, show placeholder
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setPreviewHTML('<div style="padding: 20px; text-align: center;">Email preview coming soon...</div>');
      } catch (err) {
        setError('We couldn\'t generate the preview. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [userId, companyId, preferences]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>What Your {preferences.frequency === 'weekly' ? 'Monday' : 'Weekly'} Morning Will Look Like</h3>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
            aria-label="Close preview"
          >
            &times;
          </button>
        </div>

        <div className="modal-body">
          {loading && <div className="loading-spinner">Loading preview...</div>}

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div
              className="email-preview-container"
              dangerouslySetInnerHTML={{ __html: previewHTML }}
            />
          )}
        </div>

        <div className="modal-footer">
          <p className="help-text">
            This is a preview of what you'll receive every {preferences.dayOfWeek} at {preferences.timeOfDay}.
          </p>
          <button type="button" onClick={onClose} className="btn btn-primary">
            Looks Good
          </button>
        </div>
      </div>
    </div>
  );
};
