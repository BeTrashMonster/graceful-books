/**
 * Admin Workshop Form Page
 *
 * Create or edit educational workshop cohorts
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import styles from './WorkshopFormPage.module.css';
import {
  EmailType,
  EmailTemplate,
  EmailTemplates,
  DEFAULT_EMAIL_TEMPLATES,
} from '../../utils/emailTemplates';
import EmailTemplateSection, { EmailSchedule, EmailScheduleConfig } from '../../components/admin/workshops/EmailTemplateSection';
import { RichTextEditor } from '../../components/common/RichTextEditor';

const API_URL = 'https://api.audacious.money';

interface WorkshopFormData {
  cohortName: string;
  workshopName: string;
  slug: string;
  description: string;
  workshopType: 'in_person' | 'online';
  location: string;
  primaryTimezone: string;
  secondaryTimezone: string;
  stripePriceId: string;
  trialDurationDays: number;
  accessGrantDatetime: string;
  workshopStartDatetime: string;
  workshopEndDatetime: string;
  registrationDeadline: string;
  maxEnrollment: string;
  welcomeMessage: string;
  sendReminder: boolean;
  reminderHoursBefore: number;
  status: 'draft' | 'open_registration' | 'registration_closed' | 'in_progress' | 'completed' | 'archived';
  // Email template customization
  customizedEmails: EmailType[];
  emailTemplateContent: EmailTemplates;
  emailSchedule: EmailSchedule;
}

export default function WorkshopFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState<WorkshopFormData>({
    cohortName: '',
    workshopName: '',
    slug: '',
    description: '',
    workshopType: 'in_person',
    location: '',
    primaryTimezone: 'America/Los_Angeles',
    secondaryTimezone: '',
    stripePriceId: '',
    trialDurationDays: 30,
    accessGrantDatetime: '',
    workshopStartDatetime: '',
    workshopEndDatetime: '',
    registrationDeadline: '',
    maxEnrollment: '',
    welcomeMessage: '',
    sendReminder: true,
    reminderHoursBefore: 24,
    status: 'draft',
    customizedEmails: [],
    emailTemplateContent: {},
    emailSchedule: {
      welcome: { enabled: true, when: 'immediate' },
      reminder: { enabled: true, when: { hours_before: 24 } },
      week1: { enabled: true, when: { days_after_workshop: 7 } },
      week2: { enabled: true, when: { days_after_workshop: 14 } },
      week3: { enabled: true, when: { days_after_workshop: 21 } },
      week4: { enabled: true, when: { days_after_workshop: 28 } },
      wrapUp: { enabled: true, when: { days_after_workshop: 30 } },
    },
  });

  const [selectedEmailType, setSelectedEmailType] = useState<EmailType>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing) {
      loadWorkshop();
    }
  }, [id]);

  const loadWorkshop = async () => {
    setLoading(true);
    try {
      // Get admin token from sessionStorage
      const sessionData = sessionStorage.getItem('graceful_books_admin_session');
      const token = sessionData ? JSON.parse(sessionData).token : null;

      if (!token) {
        setError('Admin session expired. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/workshops/${id}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load workshop');
      }

      const data = await response.json();
      const workshop = data.data.workshop; // Backend wraps in { data: { workshop: {...} } }

      // Helper to convert timezone-aware ISO datetime to datetime-local format
      // We extract the time in the workshop's timezone for display in the form
      const toDatetimeLocal = (isoString: string, timezone: string) => {
        if (!isoString) return '';
        // Convert the ISO timestamp to the workshop's timezone and format for datetime-local
        // Format: YYYY-MM-DDTHH:mm
        return formatInTimeZone(new Date(isoString), timezone, "yyyy-MM-dd'T'HH:mm");
      };

      const workshopTimezone = workshop.primaryTimezone || 'America/Los_Angeles';

      // Determine which emails are customized based on customEmailTemplates from API
      const customTemplates = workshop.customEmailTemplates || {};
      const customizedEmailTypes: EmailType[] = [];

      (['welcome', 'reminder', 'week1', 'week2', 'week3', 'week4', 'wrapUp'] as EmailType[]).forEach(emailType => {
        if (customTemplates[emailType]) {
          customizedEmailTypes.push(emailType);
        }
      });

      // Parse email schedule or use defaults
      const emailSchedule: EmailSchedule = workshop.customEmailSchedule || {
        welcome: { enabled: true, when: 'immediate' },
        reminder: { enabled: true, when: { hours_before: 24 } },
        week1: { enabled: true, when: { days_after_workshop: 7 } },
        week2: { enabled: true, when: { days_after_workshop: 14 } },
        week3: { enabled: true, when: { days_after_workshop: 21 } },
        week4: { enabled: true, when: { days_after_workshop: 28 } },
        wrapUp: { enabled: true, when: { days_after_workshop: 30 } },
      };

      // Convert API response to form data
      setFormData({
        cohortName: workshop.cohortName || '',
        workshopName: workshop.workshopName || workshop.cohortName || '',
        slug: workshop.slug || '',
        description: workshop.description || '',
        workshopType: workshop.workshopType || 'in_person',
        location: workshop.location || '',
        primaryTimezone: workshopTimezone,
        secondaryTimezone: workshop.secondaryTimezone || '',
        stripePriceId: workshop.stripePriceId || '',
        trialDurationDays: workshop.trialDurationDays || 30,
        accessGrantDatetime: toDatetimeLocal(workshop.accessGrantDatetime, workshopTimezone),
        workshopStartDatetime: toDatetimeLocal(workshop.workshopStartDatetime, workshopTimezone),
        workshopEndDatetime: toDatetimeLocal(workshop.workshopEndDatetime, workshopTimezone),
        registrationDeadline: toDatetimeLocal(workshop.registrationDeadline, workshopTimezone),
        maxEnrollment: workshop.maxEnrollment?.toString() || '',
        welcomeMessage: workshop.welcomeMessage || '',
        sendReminder: workshop.sendReminder ?? true,
        reminderHoursBefore: workshop.reminderHoursBefore || 24,
        status: workshop.status || 'draft',
        customizedEmails: customizedEmailTypes,
        emailTemplateContent: customTemplates,
        emailSchedule,
      });
    } catch (err) {
      console.error('Error loading workshop:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workshop');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = isEditing ? `${API_URL}/api/workshops/${id}` : `${API_URL}/api/workshops`;
      const method = isEditing ? 'PUT' : 'POST';

      // Get admin token from sessionStorage
      const sessionData = sessionStorage.getItem('graceful_books_admin_session');
      const token = sessionData ? JSON.parse(sessionData).token : null;

      if (!token) {
        setError('Admin session expired. Please log in again.');
        setLoading(false);
        return;
      }

      console.log('🔐 Submitting workshop with token:', token.substring(0, 20) + '...');
      console.log('📍 URL:', url);
      console.log('🔧 Method:', method);

      // Helper to convert datetime-local to ISO 8601 WITHOUT timezone conversion
      //
      // IMPORTANT DISTINCTION:
      // - Event datetimes (workshop start/end, registration deadline): Literal times in workshop timezone
      //   Example: "11:00 AM PST" is stored as 11:00 and displayed as 11:00
      //
      // - Audit timestamps (created_at, updated_at, enrolled_at): Proper UTC timestamps
      //   These are handled by the database automatically and track WHEN actions occurred
      //   for security compliance and audit logging
      //
      // This function handles EVENT datetimes only. Audit timestamps are managed by
      // the backend/database and always use proper UTC with timezone tracking.
      const toISO = (dateTimeLocal: string, timezone: string) => {
        if (!dateTimeLocal) return undefined;
        // datetime-local gives us a string like "2026-06-30T14:00"
        // We interpret this as the EXACT time in the workshop's timezone
        // Format with timezone offset (e.g., "2026-06-30T14:00:00-07:00" for PST)
        return formatInTimeZone(
          new Date(dateTimeLocal),
          timezone,
          "yyyy-MM-dd'T'HH:mm:ssXXX"
        );
      };

      // Build customEmailTemplates object for API (only include customized emails)
      const customEmailTemplates: EmailTemplates = {};
      formData.customizedEmails.forEach(emailType => {
        const template = formData.emailTemplateContent[emailType];
        if (template) {
          customEmailTemplates[emailType] = template;
        }
      });

      const requestBody = {
        cohortName: formData.cohortName,
        workshopName: formData.workshopName,
        slug: formData.slug,
        description: formData.description,
        workshopType: formData.workshopType,
        location: formData.location,
        primaryTimezone: formData.primaryTimezone,
        secondaryTimezone: formData.secondaryTimezone || undefined,
        stripePriceId: formData.stripePriceId,
        trialDurationDays: formData.trialDurationDays,
        accessGrantDatetime: toISO(formData.accessGrantDatetime, formData.primaryTimezone),
        workshopStartDatetime: toISO(formData.workshopStartDatetime, formData.primaryTimezone),
        workshopEndDatetime: toISO(formData.workshopEndDatetime, formData.primaryTimezone),
        registrationDeadline: formData.registrationDeadline ? toISO(formData.registrationDeadline, formData.primaryTimezone) : undefined,
        maxEnrollment: formData.maxEnrollment ? parseInt(formData.maxEnrollment) : undefined,
        welcomeMessage: formData.welcomeMessage || undefined,
        sendReminder: formData.sendReminder,
        reminderHoursBefore: formData.reminderHoursBefore,
        status: formData.status,
        customEmailTemplates: Object.keys(customEmailTemplates).length > 0
          ? customEmailTemplates
          : undefined,
        customEmailSchedule: formData.emailSchedule,
      };

      console.log('📦 Request body:', requestBody);

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = 'Failed to save workshop';
        try {
          const errorData = await response.json();
          console.log('❌ Error response:', errorData);

          // Handle different error formats
          if (errorData.error) {
            if (typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            } else if (errorData.error.message) {
              errorMessage = errorData.error.message;
              // If there are validation details, show them
              if (errorData.error.details) {
                console.log('🔍 Validation details:', errorData.error.details);
                errorMessage += '\n\nValidation errors:\n' + JSON.stringify(errorData.error.details, null, 2);
              }
            } else {
              errorMessage = JSON.stringify(errorData.error);
            }
          }
        } catch (parseError) {
          // Response wasn't JSON - use status text
          console.error('Failed to parse error response:', parseError);
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Success - navigate back to workshops list
      navigate('/admin/workshops');
    } catch (err) {
      console.error('Error saving workshop:', err);

      // Better error handling
      let errorMessage = 'Failed to save workshop';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = JSON.stringify(err, null, 2);
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Auto-generate slug from cohort name
  const handleCohortNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cohortName = e.target.value;
    const slug = cohortName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setFormData(prev => ({ ...prev, cohortName, slug }));
  };

  // Email template customization handlers
  const toggleEmailCustomization = (emailType: EmailType) => {
    const isCustomized = formData.customizedEmails.includes(emailType);

    if (isCustomized) {
      // Switch to "Use Default" - remove from customized list
      setFormData(prev => ({
        ...prev,
        customizedEmails: prev.customizedEmails.filter(e => e !== emailType),
        emailTemplateContent: {
          ...prev.emailTemplateContent,
          [emailType]: undefined,
        },
      }));
    } else {
      // Switch to "Customize" - add to list and load default template as starting point
      setFormData(prev => ({
        ...prev,
        customizedEmails: [...prev.customizedEmails, emailType],
        emailTemplateContent: {
          ...prev.emailTemplateContent,
          [emailType]: { ...DEFAULT_EMAIL_TEMPLATES[emailType] },
        },
      }));
    }
  };

  const updateEmailTemplate = (emailType: EmailType, template: EmailTemplate) => {
    setFormData(prev => ({
      ...prev,
      emailTemplateContent: {
        ...prev.emailTemplateContent,
        [emailType]: template,
      },
    }));
  };

  const updateEmailSchedule = (emailType: EmailType, config: EmailScheduleConfig) => {
    setFormData(prev => ({
      ...prev,
      emailSchedule: {
        ...prev.emailSchedule,
        [emailType]: config,
      },
    }));
  };

  if (loading && isEditing) {
    return <div className={styles.loading}>Loading workshop...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{isEditing ? 'Edit Workshop' : 'Create Workshop'}</h1>
        <button
          type="button"
          onClick={() => navigate('/admin/workshops')}
          className={styles.backButton}
        >
          ← Back to Workshops
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <section className={styles.section}>
          <h2>Basic Information</h2>

          <div className={styles.field}>
            <label htmlFor="workshopName">
              Workshop Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="workshopName"
              name="workshopName"
              value={formData.workshopName}
              onChange={handleChange}
              required
              placeholder="e.g., Understanding Your True Costs"
            />
            <small>This is the name participants will see on the signup page</small>
          </div>

          <div className={styles.field}>
            <label htmlFor="cohortName">
              Cohort Name (Admin Identifier) <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="cohortName"
              name="cohortName"
              value={formData.cohortName}
              onChange={handleCohortNameChange}
              required
              placeholder="e.g., July 2026 - True Costs Workshop"
            />
            <small>Internal name for tracking this workshop cohort</small>
          </div>

          <div className={styles.field}>
            <label htmlFor="slug">
              URL Slug <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="slug"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              required
              placeholder="e.g., july-2026-costing"
            />
            {formData.slug && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.375rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.875rem', color: '#16a34a' }}>Workshop Signup URL:</strong>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://app.audacious.money/workshops/${formData.slug}`);
                      alert('URL copied to clipboard!');
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Copy URL
                  </button>
                </div>
                <code style={{ display: 'block', fontSize: '0.875rem', color: '#15803d', wordBreak: 'break-all' }}>
                  https://app.audacious.money/workshops/{formData.slug}
                </code>
                <small style={{ display: 'block', marginTop: '0.5rem', color: '#166534' }}>
                  Share this URL with potential participants to enroll in this workshop.
                </small>
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="description">Description</label>
            <RichTextEditor
              id="description"
              value={formData.description}
              onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
              placeholder="Workshop description shown on signup page"
              minHeight={150}
              aria-label="Workshop description"
            />
            <small>Use the toolbar to add formatting like bold, italics, lists, and links.</small>
          </div>

          <div className={styles.field}>
            <label htmlFor="status">Status <span className={styles.required}>*</span></label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
            >
              <option value="draft">Draft (not visible to public)</option>
              <option value="open_registration">Open for Registration</option>
              <option value="registration_closed">Registration Closed</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Workshop Details</h2>

          <div className={styles.field}>
            <label htmlFor="workshopType">
              Workshop Type <span className={styles.required}>*</span>
            </label>
            <select
              id="workshopType"
              name="workshopType"
              value={formData.workshopType}
              onChange={handleChange}
              required
            >
              <option value="in_person">In Person</option>
              <option value="online">Online</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="location">
              Location {formData.workshopType === 'in_person' && <span className={styles.required}>*</span>}
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required={formData.workshopType === 'in_person'}
              placeholder="e.g., 2130 SW 5th Ave, Portland, OR 97201"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="workshopStartDatetime">
              Workshop Start <span className={styles.required}>*</span>
            </label>
            <input
              type="datetime-local"
              id="workshopStartDatetime"
              name="workshopStartDatetime"
              value={formData.workshopStartDatetime}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="workshopEndDatetime">
              Workshop End <span className={styles.required}>*</span>
            </label>
            <input
              type="datetime-local"
              id="workshopEndDatetime"
              name="workshopEndDatetime"
              value={formData.workshopEndDatetime}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="accessGrantDatetime">
              Platform Access Granted <span className={styles.required}>*</span>
            </label>
            <input
              type="datetime-local"
              id="accessGrantDatetime"
              name="accessGrantDatetime"
              value={formData.accessGrantDatetime}
              onChange={handleChange}
              required
            />
            <small>When users can first access the platform (usually ~1 week before workshop)</small>
          </div>

          <div className={styles.field}>
            <label htmlFor="registrationDeadline">Registration Deadline</label>
            <input
              type="datetime-local"
              id="registrationDeadline"
              name="registrationDeadline"
              value={formData.registrationDeadline}
              onChange={handleChange}
            />
            <small>Optional - closes registration at this time</small>
            {formData.registrationDeadline && formData.workshopStartDatetime &&
             new Date(formData.registrationDeadline) > new Date(formData.workshopStartDatetime) && (
              <div className={styles.lateRegistrationWarning}>
                <strong>Replay Mode:</strong> Registration deadline is after workshop start.
                Late registrants will skip the countdown and go directly to:
                signup → charity selection → worksheet → workshop access.
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="maxEnrollment">Maximum Enrollment</label>
            <input
              type="number"
              id="maxEnrollment"
              name="maxEnrollment"
              value={formData.maxEnrollment}
              onChange={handleChange}
              min="1"
              placeholder="Leave empty for unlimited"
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2>Stripe & Trial Settings</h2>

          <div className={styles.field}>
            <label htmlFor="stripePriceId">
              Stripe Price ID <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="stripePriceId"
              name="stripePriceId"
              value={formData.stripePriceId}
              onChange={handleChange}
              required
              placeholder="price_1ABC123xyz"
            />
            <small>Get this from Stripe Dashboard → Products → Prices</small>
          </div>

          <div className={styles.field}>
            <label htmlFor="trialDurationDays">
              Trial Duration (days) <span className={styles.required}>*</span>
            </label>
            <input
              type="number"
              id="trialDurationDays"
              name="trialDurationDays"
              value={formData.trialDurationDays}
              onChange={handleChange}
              required
              min="1"
              max="90"
            />
            <small>Trial begins when workshop starts and runs for this many days. Participants go through enrollment → charity selection → worksheet → countdown → access grant → workshop (trial starts here) → trial period → conversion to paid.</small>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Email Settings</h2>

          <div className={styles.field}>
            <label>
              <input
                type="checkbox"
                name="sendReminder"
                checked={formData.sendReminder}
                onChange={handleChange}
              />
              {' '}Send reminder email before workshop
            </label>
          </div>

          {formData.sendReminder && (
            <div className={styles.field}>
              <label htmlFor="reminderHoursBefore">Hours Before Workshop</label>
              <input
                type="number"
                id="reminderHoursBefore"
                name="reminderHoursBefore"
                value={formData.reminderHoursBefore}
                onChange={handleChange}
                min="1"
                max="168"
              />
              <small>Default: 24 hours</small>
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="welcomeMessage">Custom Welcome Message</label>
            <textarea
              id="welcomeMessage"
              name="welcomeMessage"
              value={formData.welcomeMessage}
              onChange={handleChange}
              rows={3}
              placeholder="Optional custom message shown to participants"
            />
          </div>
        </section>

        {/* Email Templates Section - Full Width */}
      </form>

      <div className={styles.emailTemplatesSection}>
        <h2>Email Templates</h2>
        <p className={styles.emailTemplatesDescription}>
          Customize the automated emails sent to workshop participants, or use the default templates.
        </p>

        <div className={styles.emailTemplatesSectionInner}>
          <EmailTemplateSection
            workshopId={id}
            workshopName={formData.workshopName || formData.cohortName}
            selectedEmailType={selectedEmailType}
            onSelectEmailType={setSelectedEmailType}
            customizedEmails={formData.customizedEmails}
            emailTemplateContent={formData.emailTemplateContent}
            emailSchedule={formData.emailSchedule}
            onToggleCustomization={toggleEmailCustomization}
            onUpdateTemplate={updateEmailTemplate}
            onUpdateSchedule={updateEmailSchedule}
          />
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>

        <section className={styles.section}>
          <h2>Timezone Display</h2>

          <div className={styles.field}>
            <label htmlFor="primaryTimezone">
              Primary Timezone <span className={styles.required}>*</span>
            </label>
            <select
              id="primaryTimezone"
              name="primaryTimezone"
              value={formData.primaryTimezone}
              onChange={handleChange}
              required
            >
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/New_York">Eastern (ET)</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="secondaryTimezone">Secondary Timezone (optional)</label>
            <select
              id="secondaryTimezone"
              name="secondaryTimezone"
              value={formData.secondaryTimezone}
              onChange={handleChange}
            >
              <option value="">None</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/New_York">Eastern (ET)</option>
            </select>
          </div>
        </section>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => navigate('/admin/workshops')}
            className={styles.cancelButton}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Saving...' : (isEditing ? 'Update Workshop' : 'Create Workshop')}
          </button>
        </div>
      </form>
    </div>
  );
}
