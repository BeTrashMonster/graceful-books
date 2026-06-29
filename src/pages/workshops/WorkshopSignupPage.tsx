import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toZonedTime } from 'date-fns-tz';
import { CharitySelector } from '../../components/charity';
import type { Charity } from '../../types/database.types';
import { getWorkshopBySlug, enrollInWorkshop, type Workshop } from '../../services/workshops.api';
import { LoadingOverlay } from '../../components/feedback/Loading';
import styles from './WorkshopSignupPage.module.css';

type SignupStep = 'credentials' | 'charity' | 'confirmation';

export default function WorkshopSignupPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState<SignupStep>('credentials');
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [enrollmentCount, setEnrollmentCount] = useState<number>(0);

  // Load workshop on mount
  useEffect(() => {
    if (!slug) {
      setError('Invalid workshop URL');
      setIsLoading(false);
      return;
    }

    loadWorkshop();
  }, [slug]);

  const loadWorkshop = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const workshopData = await getWorkshopBySlug(slug!);
      console.log('📊 Workshop data received from API:', workshopData);
      console.log('📅 Workshop dates:', {
        start: workshopData.workshopStartDatetime,
        end: workshopData.workshopEndDatetime,
        registrationDeadline: workshopData.registrationDeadline,
        status: workshopData.status,
        timezone: workshopData.primaryTimezone
      });
      setWorkshop(workshopData);
      // TODO: Get actual enrollment count from backend
      setEnrollmentCount(workshopData.enrollmentCount || 0);
    } catch (err: any) {
      console.error('Failed to load workshop:', err);
      setError(err.message || 'Workshop not found');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name');
      return;
    }

    // Clear error when moving to next step
    setError(null);
    setStep('charity');
  };

  const handleCharitySelect = (charity: Charity) => {
    setSelectedCharity(charity);
  };

  const handleCharityContinue = async () => {
    if (!selectedCharity) {
      setError('Please select a charity to support');
      return;
    }

    if (!workshop) {
      setError('Workshop data not loaded');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Enroll in workshop
      const response = await enrollInWorkshop(workshop.id, {
        email,
        password,
        firstName,
        lastName,
        companyName: companyName || undefined,
        charityId: selectedCharity.id,
      });

      // Store session data (response is wrapped in { data: { ... } })
      sessionStorage.setItem(
        'graceful_books_session',
        JSON.stringify({
          token: response.data.token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          userEmail: response.data.user.email,
          userId: response.data.user.id,
          products: response.data.products || [], // Include products for ProtectedRoute access control
        })
      );

      // Trigger auth context to reload
      window.dispatchEvent(new Event('graceful_books_login'));

      // Navigate to worksheet page
      navigate('/workshops/worksheet');
    } catch (err: any) {
      console.error('Enrollment error:', err);
      setError(
        err.message || 'Something unexpected happened. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string | undefined, timezone: string = 'America/Los_Angeles') => {
    if (!dateString) return 'Date TBD';

    try {
      // Parse the timezone-aware datetime and format in the workshop's timezone
      const date = new Date(dateString);
      const zonedDate = toZonedTime(date, timezone);

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];

      return `${monthNames[zonedDate.getMonth()]} ${zonedDate.getDate()}, ${zonedDate.getFullYear()}`;
    } catch (err) {
      console.error('Error formatting date:', err, dateString);
      return 'Date TBD';
    }
  };

  const formatTime = (dateString: string | undefined, timezone: string = 'America/Los_Angeles') => {
    if (!dateString) return 'Time TBD';

    try {
      // Parse the timezone-aware datetime and format in the workshop's timezone
      const date = new Date(dateString);
      const zonedDate = toZonedTime(date, timezone);

      const hour = zonedDate.getHours();
      const minutes = zonedDate.getMinutes();

      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const displayMinutes = minutes.toString().padStart(2, '0');

      return `${displayHour}:${displayMinutes} ${ampm}`;
    } catch (err) {
      console.error('Error formatting time:', err, dateString);
      return 'Time TBD';
    }
  };

  const getTimezoneAbbr = (timezone: string) => {
    // Simple mapping for common timezones
    const tzMap: Record<string, string> = {
      'America/Los_Angeles': 'PST',
      'America/New_York': 'EST',
      'America/Chicago': 'CST',
      'America/Denver': 'MST',
    };
    return tzMap[timezone] || timezone;
  };

  // Check if workshop is accepting enrollments
  const isWorkshopOpen = () => {
    if (!workshop) return false;

    console.log('Workshop status check:', {
      status: workshop.status,
      registrationDeadline: workshop.registrationDeadline,
      enrollmentCount,
      maxEnrollment: workshop.maxEnrollment,
    });

    // Check if status is open_registration (note: old data might still have 'open' status)
    if (workshop.status !== 'open_registration' && workshop.status !== 'open') {
      console.log('Status not open:', workshop.status);
      return false;
    }

    // Check registration deadline using TIMEZONE-AWARE comparison
    // The deadline is stored as a literal time in the workshop's timezone
    if (workshop.registrationDeadline) {
      try {
        const timezone = workshop.primaryTimezone || 'America/Los_Angeles';

        // Get current time in the workshop's timezone
        const nowInWorkshopTz = toZonedTime(new Date(), timezone);

        // Parse the deadline as a literal time in the workshop's timezone
        // The stored value "2026-07-15T11:00:00.000Z" means "11:00 AM in workshop timezone"
        const deadlineParts = workshop.registrationDeadline.split('T');
        const [datePart, timePart] = deadlineParts;
        const [year, month, day] = datePart.split('-');
        const [hours, minutes] = (timePart?.split(':') || ['0', '0']);

        // Create a Date object representing the deadline time in the workshop's timezone
        const deadlineDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours),
          parseInt(minutes),
          0
        );

        console.log('Timezone-aware deadline check:', {
          timezone,
          nowInWorkshopTz,
          deadlineDate,
          isPast: nowInWorkshopTz > deadlineDate
        });

        if (nowInWorkshopTz > deadlineDate) {
          console.log('Registration deadline has passed in workshop timezone');
          return false;
        }
      } catch (err) {
        console.error('Error parsing deadline:', err);
      }
    }

    // Check enrollment capacity
    if (workshop.maxEnrollment && enrollmentCount >= workshop.maxEnrollment) {
      console.log('Workshop full');
      return false;
    }

    console.log('Workshop is open!');
    return true;
  };

  if (isLoading) {
    return <LoadingOverlay message="Loading workshop details..." />;
  }

  if (error && !workshop) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.errorTitle}>Workshop Not Found</h1>
            <p className={styles.errorMessage}>{error}</p>
          </div>
          <Link to="/" className={styles.homeLink}>
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!workshop) {
    return null;
  }

  return (
    <div className={styles.container}>
      {isSubmitting && <LoadingOverlay message="Enrolling you in the workshop..." />}

      <div className={styles.card}>
        {/* Workshop Header */}
        <div className={styles.workshopHeader}>
          <h1 className={styles.workshopTitle}>{workshop.workshopName || workshop.cohortName}</h1>
          {workshop.description && (
            <p className={styles.workshopDescription}>{workshop.description}</p>
          )}
          <div className={styles.workshopMeta}>
            <div className={styles.metaItem}>
              <strong>Date:</strong> {formatDate(workshop.workshopStartDatetime, workshop.primaryTimezone)}
            </div>
            <div className={styles.metaItem}>
              <strong>Time:</strong>{' '}
              {formatTime(workshop.workshopStartDatetime, workshop.primaryTimezone)}{' '}
              {getTimezoneAbbr(workshop.primaryTimezone)}
              {workshop.secondaryTimezone && (
                <> / {formatTime(workshop.workshopStartDatetime, workshop.secondaryTimezone)}{' '}
                {getTimezoneAbbr(workshop.secondaryTimezone)}</>
              )}
            </div>
            {workshop.maxEnrollment && (
              <div className={styles.metaItem}>
                <strong>Enrolled:</strong> {enrollmentCount} / {workshop.maxEnrollment} participants
              </div>
            )}
          </div>
        </div>

        <div className={styles.divider} />

        {/* Check if workshop is closed */}
        {!isWorkshopOpen() && (
          <div className={styles.closedMessage}>
            <h2>Registration Closed</h2>
            <p>
              {workshop.status === 'registration_closed' || workshop.status === 'in_progress'
                ? 'This workshop is no longer accepting enrollments.'
                : workshop.maxEnrollment && enrollmentCount >= workshop.maxEnrollment
                ? 'This workshop has reached maximum capacity.'
                : 'Registration has ended.'}
            </p>
            <Link to="/" className={styles.homeLink}>
              Return to Home
            </Link>
          </div>
        )}

        {/* Signup Form */}
        {isWorkshopOpen() && (
          <>
            {/* Step 1: Credentials */}
            {step === 'credentials' && (
              <>
                <div className={styles.header}>
                  <h2 className={styles.title}>Create Your Account</h2>
                  <p className={styles.subtitle}>
                    Step 1 of 2: Enter your information
                  </p>
                </div>

                {error && <div className={styles.errorAlert}>{error}</div>}

                <form onSubmit={handleCredentialsSubmit} className={styles.form}>
                  <div className={styles.nameRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="firstName">
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={styles.input}
                        required
                        autoFocus
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="lastName">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={styles.input}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="email">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={styles.input}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="companyName">
                      Company Name (optional)
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="password">
                      Password *
                    </label>
                    <div className={styles.passwordWrapper}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={styles.input}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={styles.passwordToggle}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className={styles.hint}>At least 8 characters</p>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="confirmPassword">
                      Confirm Password *
                    </label>
                    <div className={styles.passwordWrapper}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={styles.input}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className={styles.passwordToggle}
                        aria-label={
                          showConfirmPassword ? 'Hide password' : 'Show password'
                        }
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className={styles.primaryButton}>
                    Continue
                  </button>
                </form>

                <div className={styles.footer}>
                  <p>
                    Already have an account?{' '}
                    <Link to="/login" className={styles.link}>
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            )}

            {/* Step 2: Charity Selection */}
            {step === 'charity' && (
              <>
                <div className={styles.header}>
                  <h2 className={styles.title}>Choose Your Charity</h2>
                  <p className={styles.subtitle}>
                    Step 2 of 2: Select a charity to support with $5/month
                  </p>
                </div>

                {error && <div className={styles.errorAlert}>{error}</div>}

                <div className={styles.charitySection}>
                  <CharitySelector
                    selectedCharityId={selectedCharity?.id}
                    onSelect={handleCharitySelect}
                    showSearch={true}
                    showFilters={true}
                  />
                </div>

                <div className={styles.buttonRow}>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep('credentials');
                    }}
                    className={styles.secondaryButton}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCharityContinue}
                    disabled={!selectedCharity}
                    className={styles.primaryButton}
                  >
                    Complete Enrollment
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
