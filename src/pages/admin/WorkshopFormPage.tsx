/**
 * Admin Workshop Form Page
 *
 * Create or edit educational workshop cohorts
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './WorkshopFormPage.module.css';

const API_URL = 'https://api.audacious.money';

interface WorkshopFormData {
  cohortName: string;
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
  status: 'draft' | 'open' | 'closed' | 'in_progress' | 'completed' | 'archived';
}

export default function WorkshopFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState<WorkshopFormData>({
    cohortName: '',
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
  });

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

      // Convert API response to form data
      setFormData({
        cohortName: data.workshop.cohortName || '',
        slug: data.workshop.slug || '',
        description: data.workshop.description || '',
        workshopType: data.workshop.workshopType || 'in_person',
        location: data.workshop.location || '',
        primaryTimezone: data.workshop.primaryTimezone || 'America/Los_Angeles',
        secondaryTimezone: data.workshop.secondaryTimezone || '',
        stripePriceId: data.workshop.stripePriceId || '',
        trialDurationDays: data.workshop.trialDurationDays || 30,
        accessGrantDatetime: data.workshop.accessGrantDatetime || '',
        workshopStartDatetime: data.workshop.workshopStartDatetime || '',
        workshopEndDatetime: data.workshop.workshopEndDatetime || '',
        registrationDeadline: data.workshop.registrationDeadline || '',
        maxEnrollment: data.workshop.maxEnrollment?.toString() || '',
        welcomeMessage: data.workshop.welcomeMessage || '',
        sendReminder: data.workshop.sendReminder ?? true,
        reminderHoursBefore: data.workshop.reminderHoursBefore || 24,
        status: data.workshop.status || 'draft',
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

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          cohortName: formData.cohortName,
          slug: formData.slug,
          description: formData.description,
          workshopType: formData.workshopType,
          location: formData.location,
          primaryTimezone: formData.primaryTimezone,
          secondaryTimezone: formData.secondaryTimezone || null,
          stripePriceId: formData.stripePriceId,
          trialDurationDays: formData.trialDurationDays,
          accessGrantDatetime: formData.accessGrantDatetime,
          workshopStartDatetime: formData.workshopStartDatetime,
          workshopEndDatetime: formData.workshopEndDatetime,
          registrationDeadline: formData.registrationDeadline || null,
          maxEnrollment: formData.maxEnrollment ? parseInt(formData.maxEnrollment) : null,
          welcomeMessage: formData.welcomeMessage || null,
          sendReminder: formData.sendReminder,
          reminderHoursBefore: formData.reminderHoursBefore,
          status: formData.status,
        }),
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
            <label htmlFor="cohortName">
              Cohort Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="cohortName"
              name="cohortName"
              value={formData.cohortName}
              onChange={handleCohortNameChange}
              required
              placeholder="e.g., Understanding Your True Costs - July 2026"
            />
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
            <small>Used in URL: /workshops/{formData.slug || 'your-slug'}</small>
          </div>

          <div className={styles.field}>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Workshop description shown on signup page"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="draft">Draft (not visible)</option>
              <option value="open">Open for Registration</option>
              <option value="closed">Registration Closed</option>
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
            <small>Default: 30 days (workshop participants get longer trials)</small>
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
