/**
 * Workshop Form Component
 *
 * Create/edit workshop with all configuration fields including:
 * - Basic info (name, slug, type, location)
 * - Dates & times (workshop, access grant, trial settings)
 * - Timezone configuration
 * - Registration settings (deadline, capacity)
 * - Customization (welcome message, email templates)
 * - Post-trial behavior
 *
 * Requirements:
 * - C2: Create/Edit Workshop Form
 * - Multi-section form with validation
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect, FormEvent } from 'react';
import { EmailTemplateEditor } from './EmailTemplateEditor';
import styles from './WorkshopForm.module.css';

// Types (will be imported from API service when backend is integrated)
interface EmailTemplate {
  subject: string;
  preheader?: string;
  htmlBody: string;
  plainTextBody?: string;
  fromName?: string;
}

interface EmailTemplates {
  welcome?: EmailTemplate;
  reminder?: EmailTemplate;
  week1?: EmailTemplate;
  week2?: EmailTemplate;
  week3?: EmailTemplate;
  week4?: EmailTemplate;
  wrapUp?: EmailTemplate;
}

interface WorkshopResource {
  title: string;
  url: string;
  type?: 'recording' | 'slides' | 'worksheet' | 'other';
  description?: string;
}

interface Workshop {
  id: string;
  cohortName: string;
  slug: string;
  description?: string;
  workshopType: 'in_person' | 'online';
  location?: string;
  primaryTimezone: string;
  secondaryTimezone?: string;
  accessGrantDatetime: Date;
  trialStartDatetime: Date;
  trialDurationDays: number;
  workshopStartDatetime: Date;
  workshopEndDatetime: Date;
  registrationDeadline?: Date;
  maxEnrollment?: number;
  welcomeMessage?: string;
  customEmailTemplates?: EmailTemplates;
  postWorkshopResources?: WorkshopResource[];
  postTrialAction: 'upgrade_prompt' | 'auto_convert' | 'account_freeze';
  sendReminder: boolean;
  reminderHoursBefore: number;
  status: 'draft' | 'open_registration' | 'registration_closed' | 'in_progress' | 'completed' | 'archived';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkshopFormProps {
  workshopId?: string;
  onSave: (workshop: Partial<Workshop>) => Promise<void>;
  onCancel: () => void;
}

type FormSection = 'basic' | 'schedule' | 'registration' | 'customization' | 'emails' | 'review';

export function WorkshopForm({ workshopId, onSave, onCancel }: WorkshopFormProps) {
  const [activeSection, setActiveSection] = useState<FormSection>('basic');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [cohortName, setCohortName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [workshopType, setWorkshopType] = useState<'in_person' | 'online'>('in_person');
  const [location, setLocation] = useState('');

  const [workshopStartDatetime, setWorkshopStartDatetime] = useState('');
  const [workshopEndDatetime, setWorkshopEndDatetime] = useState('');
  const [accessGrantDatetime, setAccessGrantDatetime] = useState('');
  const [trialStartDatetime, setTrialStartDatetime] = useState('');
  const [trialDurationDays, setTrialDurationDays] = useState(30);
  const [primaryTimezone, setPrimaryTimezone] = useState('America/Los_Angeles');
  const [secondaryTimezone, setSecondaryTimezone] = useState('');

  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [maxEnrollment, setMaxEnrollment] = useState('');

  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [postTrialAction, setPostTrialAction] = useState<'upgrade_prompt' | 'auto_convert' | 'account_freeze'>('upgrade_prompt');
  const [sendReminder, setSendReminder] = useState(true);
  const [reminderHoursBefore, setReminderHoursBefore] = useState(24);
  const [postWorkshopResources, setPostWorkshopResources] = useState<WorkshopResource[]>([]);

  const [customEmailTemplates, setCustomEmailTemplates] = useState<EmailTemplates>({});

  useEffect(() => {
    if (workshopId) {
      loadWorkshop();
    }
  }, [workshopId]);

  // Auto-generate slug from cohort name
  useEffect(() => {
    if (!workshopId && cohortName) {
      const generatedSlug = cohortName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(generatedSlug);
    }
  }, [cohortName, workshopId]);

  const loadWorkshop = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const workshop = await getWorkshopById(workshopId);
      // Populate form fields from workshop data
    } catch (err) {
      console.error('Error loading workshop:', err);
      setError('Failed to load workshop');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const workshopData: Partial<Workshop> = {
        cohortName,
        slug,
        description: description || undefined,
        workshopType,
        location: location || undefined,
        workshopStartDatetime: new Date(workshopStartDatetime),
        workshopEndDatetime: new Date(workshopEndDatetime),
        accessGrantDatetime: new Date(accessGrantDatetime),
        trialStartDatetime: new Date(trialStartDatetime),
        trialDurationDays,
        primaryTimezone,
        secondaryTimezone: secondaryTimezone || undefined,
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : undefined,
        maxEnrollment: maxEnrollment ? parseInt(maxEnrollment, 10) : undefined,
        welcomeMessage: welcomeMessage || undefined,
        customEmailTemplates: Object.keys(customEmailTemplates).length > 0 ? customEmailTemplates : undefined,
        postWorkshopResources: postWorkshopResources.length > 0 ? postWorkshopResources : undefined,
        postTrialAction,
        sendReminder,
        reminderHoursBefore,
        status: saveAsDraft ? 'draft' : 'open_registration',
      };

      await onSave(workshopData);
    } catch (err) {
      console.error('Error saving workshop:', err);
      setError(err instanceof Error ? err.message : 'Failed to save workshop');
    } finally {
      setSaving(false);
    }
  };

  const addResource = () => {
    setPostWorkshopResources([
      ...postWorkshopResources,
      { title: '', url: '', type: 'other' },
    ]);
  };

  const removeResource = (index: number) => {
    setPostWorkshopResources(postWorkshopResources.filter((_, i) => i !== index));
  };

  const updateResource = (index: number, field: keyof WorkshopResource, value: string) => {
    const updated = [...postWorkshopResources];
    updated[index] = { ...updated[index], [field]: value };
    setPostWorkshopResources(updated);
  };

  const sections: { id: FormSection; label: string }[] = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'schedule', label: 'Schedule & Access' },
    { id: 'registration', label: 'Registration' },
    { id: 'customization', label: 'Customization' },
    { id: 'emails', label: 'Email Templates' },
    { id: 'review', label: 'Review' },
  ];

  if (loading) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <div className={styles.spinner} aria-hidden="true"></div>
        <span>Loading workshop...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {workshopId ? 'Edit Workshop' : 'Create Workshop'}
        </h1>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Section Tabs */}
      <nav className={styles.tabs} role="tablist" aria-label="Workshop form sections">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={activeSection === section.id}
            aria-controls={`section-${section.id}`}
            id={`tab-${section.id}`}
            className={`${styles.tab} ${activeSection === section.id ? styles.tabActive : ''}`}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Basic Info Section */}
        {activeSection === 'basic' && (
          <div
            role="tabpanel"
            id="section-basic"
            aria-labelledby="tab-basic"
            className={styles.section}
          >
            <h2 className={styles.sectionTitle}>Basic Information</h2>

            <div className={styles.field}>
              <label htmlFor="cohort-name" className={styles.label}>
                Cohort Name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="cohort-name"
                value={cohortName}
                onChange={(e) => setCohortName(e.target.value)}
                className={styles.input}
                required
                aria-required="true"
                placeholder="e.g., Spring 2026 Small Business Bootcamp"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="slug" className={styles.label}>
                URL Slug <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className={styles.input}
                required
                aria-required="true"
                pattern="[a-z0-9-]+"
                placeholder="spring-2026"
              />
              <p className={styles.helperText}>
                Used in workshop URL: /workshop/{slug || 'your-slug'}
              </p>
            </div>

            <div className={styles.field}>
              <label htmlFor="description" className={styles.label}>
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={styles.textarea}
                rows={4}
                placeholder="Brief description of the workshop..."
              />
            </div>

            <div className={styles.field}>
              <fieldset className={styles.radioGroup}>
                <legend className={styles.label}>
                  Workshop Type <span className={styles.required}>*</span>
                </legend>
                <div className={styles.radioOptions}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="workshop-type"
                      value="in_person"
                      checked={workshopType === 'in_person'}
                      onChange={(e) => setWorkshopType(e.target.value as 'in_person')}
                      className={styles.radio}
                    />
                    <span>In Person</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="workshop-type"
                      value="online"
                      checked={workshopType === 'online'}
                      onChange={(e) => setWorkshopType(e.target.value as 'online')}
                      className={styles.radio}
                    />
                    <span>Online</span>
                  </label>
                </div>
              </fieldset>
            </div>

            <div className={styles.field}>
              <label htmlFor="location" className={styles.label}>
                {workshopType === 'in_person' ? 'Physical Address' : 'Meeting URL'}{' '}
                <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={styles.input}
                required
                aria-required="true"
                placeholder={
                  workshopType === 'in_person'
                    ? '123 Main St, City, ST 12345'
                    : 'https://zoom.us/j/...'
                }
              />
              <p className={styles.helperText}>
                {workshopType === 'in_person'
                  ? 'Full address where the workshop will be held'
                  : 'Zoom, Google Meet, or other online meeting link'}
              </p>
            </div>
          </div>
        )}

        {/* Schedule & Access Section */}
        {activeSection === 'schedule' && (
          <div
            role="tabpanel"
            id="section-schedule"
            aria-labelledby="tab-schedule"
            className={styles.section}
          >
            <h2 className={styles.sectionTitle}>Schedule & Access</h2>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="workshop-start" className={styles.label}>
                  Workshop Start Date/Time <span className={styles.required}>*</span>
                </label>
                <input
                  type="datetime-local"
                  id="workshop-start"
                  value={workshopStartDatetime}
                  onChange={(e) => setWorkshopStartDatetime(e.target.value)}
                  className={styles.input}
                  required
                  aria-required="true"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="workshop-end" className={styles.label}>
                  Workshop End Date/Time <span className={styles.required}>*</span>
                </label>
                <input
                  type="datetime-local"
                  id="workshop-end"
                  value={workshopEndDatetime}
                  onChange={(e) => setWorkshopEndDatetime(e.target.value)}
                  className={styles.input}
                  required
                  aria-required="true"
                />
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="access-grant" className={styles.label}>
                  Access Grant Date/Time <span className={styles.required}>*</span>
                </label>
                <input
                  type="datetime-local"
                  id="access-grant"
                  value={accessGrantDatetime}
                  onChange={(e) => setAccessGrantDatetime(e.target.value)}
                  className={styles.input}
                  required
                  aria-required="true"
                />
                <p className={styles.helperText}>
                  When should participants gain full platform access?
                </p>
              </div>

              <div className={styles.field}>
                <label htmlFor="trial-start" className={styles.label}>
                  Trial Start Date/Time <span className={styles.required}>*</span>
                </label>
                <input
                  type="datetime-local"
                  id="trial-start"
                  value={trialStartDatetime}
                  onChange={(e) => setTrialStartDatetime(e.target.value)}
                  className={styles.input}
                  required
                  aria-required="true"
                />
                <p className={styles.helperText}>
                  When should the trial period countdown begin?
                </p>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="trial-duration" className={styles.label}>
                Trial Duration (Days) <span className={styles.required}>*</span>
              </label>
              <input
                type="number"
                id="trial-duration"
                value={trialDurationDays}
                onChange={(e) => setTrialDurationDays(parseInt(e.target.value, 10))}
                className={styles.input}
                required
                aria-required="true"
                min="1"
                max="365"
              />
            </div>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="primary-timezone" className={styles.label}>
                  Primary Timezone <span className={styles.required}>*</span>
                </label>
                <select
                  id="primary-timezone"
                  value={primaryTimezone}
                  onChange={(e) => setPrimaryTimezone(e.target.value)}
                  className={styles.select}
                  required
                  aria-required="true"
                >
                  <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                  <option value="America/Denver">Mountain Time (MST/MDT)</option>
                  <option value="America/Chicago">Central Time (CST/CDT)</option>
                  <option value="America/New_York">Eastern Time (EST/EDT)</option>
                  <option value="America/Phoenix">Arizona (MST)</option>
                  <option value="America/Anchorage">Alaska (AKST/AKDT)</option>
                  <option value="Pacific/Honolulu">Hawaii (HST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="secondary-timezone" className={styles.label}>
                  Secondary Timezone (Optional)
                </label>
                <select
                  id="secondary-timezone"
                  value={secondaryTimezone}
                  onChange={(e) => setSecondaryTimezone(e.target.value)}
                  className={styles.select}
                >
                  <option value="">None</option>
                  <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                  <option value="America/Denver">Mountain Time (MST/MDT)</option>
                  <option value="America/Chicago">Central Time (CST/CDT)</option>
                  <option value="America/New_York">Eastern Time (EST/EDT)</option>
                  <option value="America/Phoenix">Arizona (MST)</option>
                  <option value="America/Anchorage">Alaska (AKST/AKDT)</option>
                  <option value="Pacific/Honolulu">Hawaii (HST)</option>
                  <option value="UTC">UTC</option>
                </select>
                <p className={styles.helperText}>
                  Show times in multiple zones (e.g., "10am PST / 1pm EST")
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Registration Section */}
        {activeSection === 'registration' && (
          <div
            role="tabpanel"
            id="section-registration"
            aria-labelledby="tab-registration"
            className={styles.section}
          >
            <h2 className={styles.sectionTitle}>Registration Settings</h2>

            <div className={styles.field}>
              <label htmlFor="registration-deadline" className={styles.label}>
                Registration Deadline (Optional)
              </label>
              <input
                type="datetime-local"
                id="registration-deadline"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className={styles.input}
              />
              <p className={styles.helperText}>
                Stop accepting signups before workshop
              </p>
            </div>

            <div className={styles.field}>
              <label htmlFor="max-enrollment" className={styles.label}>
                Maximum Enrollment (Optional)
              </label>
              <input
                type="number"
                id="max-enrollment"
                value={maxEnrollment}
                onChange={(e) => setMaxEnrollment(e.target.value)}
                className={styles.input}
                min="1"
                placeholder="Leave blank for unlimited"
              />
              <p className={styles.helperText}>
                Leave blank for unlimited capacity
              </p>
            </div>
          </div>
        )}

        {/* Customization Section */}
        {activeSection === 'customization' && (
          <div
            role="tabpanel"
            id="section-customization"
            aria-labelledby="tab-customization"
            className={styles.section}
          >
            <h2 className={styles.sectionTitle}>Customization</h2>

            <div className={styles.field}>
              <label htmlFor="welcome-message" className={styles.label}>
                Welcome Message
              </label>
              <textarea
                id="welcome-message"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className={styles.textarea}
                rows={6}
                placeholder="This appears on the countdown page participants see before the workshop. You can use Markdown for formatting."
              />
              <p className={styles.helperText}>
                This appears on the countdown page participants see before the workshop
              </p>
            </div>

            <div className={styles.field}>
              <fieldset className={styles.radioGroup}>
                <legend className={styles.label}>
                  Post-Trial Action <span className={styles.required}>*</span>
                </legend>
                <div className={styles.radioOptionsVertical}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="post-trial-action"
                      value="upgrade_prompt"
                      checked={postTrialAction === 'upgrade_prompt'}
                      onChange={(e) => setPostTrialAction(e.target.value as 'upgrade_prompt')}
                      className={styles.radio}
                    />
                    <span>
                      <strong>Upgrade Prompt</strong> - Show subscription purchase modal
                    </span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="post-trial-action"
                      value="auto_convert"
                      checked={postTrialAction === 'auto_convert'}
                      onChange={(e) => setPostTrialAction(e.target.value as 'auto_convert')}
                      className={styles.radio}
                    />
                    <span>
                      <strong>Auto Convert</strong> - Automatically start paid subscription
                    </span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="post-trial-action"
                      value="account_freeze"
                      checked={postTrialAction === 'account_freeze'}
                      onChange={(e) => setPostTrialAction(e.target.value as 'account_freeze')}
                      className={styles.radio}
                    />
                    <span>
                      <strong>Account Freeze</strong> - Lock account until user upgrades
                    </span>
                  </label>
                </div>
              </fieldset>
            </div>

            <div className={styles.field}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={sendReminder}
                  onChange={(e) => setSendReminder(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Send reminder email before workshop</span>
              </label>
            </div>

            {sendReminder && (
              <div className={styles.field}>
                <label htmlFor="reminder-hours" className={styles.label}>
                  Send reminder (hours before workshop)
                </label>
                <input
                  type="number"
                  id="reminder-hours"
                  value={reminderHoursBefore}
                  onChange={(e) => setReminderHoursBefore(parseInt(e.target.value, 10))}
                  className={styles.input}
                  min="1"
                  max="168"
                />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Post-Workshop Resources</label>
              {postWorkshopResources.map((resource, index) => (
                <div key={index} className={styles.resourceRow}>
                  <input
                    type="text"
                    value={resource.title}
                    onChange={(e) => updateResource(index, 'title', e.target.value)}
                    className={styles.input}
                    placeholder="Resource title"
                    aria-label={`Resource ${index + 1} title`}
                  />
                  <input
                    type="url"
                    value={resource.url}
                    onChange={(e) => updateResource(index, 'url', e.target.value)}
                    className={styles.input}
                    placeholder="URL"
                    aria-label={`Resource ${index + 1} URL`}
                  />
                  <button
                    type="button"
                    onClick={() => removeResource(index)}
                    className={styles.removeButton}
                    aria-label={`Remove resource ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addResource}
                className={styles.addButton}
              >
                + Add Resource
              </button>
            </div>
          </div>
        )}

        {/* Email Templates Section */}
        {activeSection === 'emails' && (
          <div
            role="tabpanel"
            id="section-emails"
            aria-labelledby="tab-emails"
            className={styles.section}
          >
            <h2 className={styles.sectionTitle}>Email Templates</h2>
            <p className={styles.sectionDescription}>
              Customize the automated email sequence sent to workshop participants.
              Use the rich text editor to add formatting, emojis, and personalization.
            </p>

            <EmailTemplateEditor
              templates={customEmailTemplates}
              onChange={setCustomEmailTemplates}
            />
          </div>
        )}

        {/* Review Section */}
        {activeSection === 'review' && (
          <div
            role="tabpanel"
            id="section-review"
            aria-labelledby="tab-review"
            className={styles.section}
          >
            <h2 className={styles.sectionTitle}>Review & Publish</h2>
            <p className={styles.sectionDescription}>
              Review your workshop settings before publishing.
            </p>

            <div className={styles.reviewGrid}>
              <div className={styles.reviewSection}>
                <h3 className={styles.reviewHeading}>Basic Info</h3>
                <dl className={styles.reviewList}>
                  <dt>Cohort Name:</dt>
                  <dd>{cohortName || <em>Not set</em>}</dd>
                  <dt>Slug:</dt>
                  <dd>{slug || <em>Not set</em>}</dd>
                  <dt>Type:</dt>
                  <dd>{workshopType === 'in_person' ? 'In Person' : 'Online'}</dd>
                  <dt>Location:</dt>
                  <dd>{location || <em>Not set</em>}</dd>
                </dl>
              </div>

              <div className={styles.reviewSection}>
                <h3 className={styles.reviewHeading}>Schedule</h3>
                <dl className={styles.reviewList}>
                  <dt>Workshop Start:</dt>
                  <dd>{workshopStartDatetime || <em>Not set</em>}</dd>
                  <dt>Access Grant:</dt>
                  <dd>{accessGrantDatetime || <em>Not set</em>}</dd>
                  <dt>Trial Duration:</dt>
                  <dd>{trialDurationDays} days</dd>
                </dl>
              </div>

              <div className={styles.reviewSection}>
                <h3 className={styles.reviewHeading}>Registration</h3>
                <dl className={styles.reviewList}>
                  <dt>Deadline:</dt>
                  <dd>{registrationDeadline || <em>None</em>}</dd>
                  <dt>Max Enrollment:</dt>
                  <dd>{maxEnrollment || <em>Unlimited</em>}</dd>
                </dl>
              </div>

              <div className={styles.reviewSection}>
                <h3 className={styles.reviewHeading}>Customization</h3>
                <dl className={styles.reviewList}>
                  <dt>Post-Trial Action:</dt>
                  <dd>{postTrialAction.replace('_', ' ')}</dd>
                  <dt>Send Reminder:</dt>
                  <dd>{sendReminder ? `Yes (${reminderHoursBefore}h before)` : 'No'}</dd>
                  <dt>Resources:</dt>
                  <dd>{postWorkshopResources.length} resource(s)</dd>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            onClick={onCancel}
            className={styles.cancelButton}
            disabled={saving}
          >
            Cancel
          </button>
          <div className={styles.saveButtons}>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className={styles.draftButton}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="submit"
              className={styles.publishButton}
              disabled={saving}
            >
              {saving ? 'Publishing...' : 'Publish Workshop'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
