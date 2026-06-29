import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toZonedTime } from 'date-fns-tz';
import { getMyWorkshopEnrollment, type WorkshopEnrollment } from '../../services/workshops.api';
import { LoadingOverlay } from '../../components/feedback/Loading';
import styles from './WorkshopCountdownPage.module.css';

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function WorkshopCountdownPage() {
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState<WorkshopEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Load enrollment on mount
  useEffect(() => {
    loadEnrollment();
  }, []);

  // Update countdown every second
  useEffect(() => {
    if (!enrollment || !enrollment.workshop) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      // Use workshop's accessGrantDatetime
      const accessTime = enrollment.workshop.accessGrantDatetime || enrollment.accessGrantedAt;
      if (!accessTime) {
        // No access time set, redirect to CPG dashboard
        navigate('/cpg');
        return;
      }

      const targetTime = new Date(accessTime).getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        // Access time has arrived! Redirect to CPG dashboard
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        // Give a moment for user to see the 0:00:00:00
        setTimeout(() => {
          navigate('/cpg');
        }, 1000);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [enrollment, navigate]);

  const loadEnrollment = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const enrollmentData = await getMyWorkshopEnrollment();
      if (!enrollmentData) {
        setError('No workshop enrollment found.');
        setIsLoading(false);
        return;
      }

      // Don't redirect here - let the countdown timer handle it
      // User should always see the countdown page
      setEnrollment(enrollmentData);
    } catch (err: any) {
      console.error('Failed to load enrollment:', err);
      setError(err.message || 'Failed to load workshop enrollment');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string, timezone: string = 'America/Los_Angeles') => {
    const date = new Date(dateString);
    const zonedDate = toZonedTime(date, timezone);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    return `${monthNames[zonedDate.getMonth()]} ${zonedDate.getDate()}, ${zonedDate.getFullYear()}`;
  };

  const formatTime = (dateString: string, timezone: string = 'America/Los_Angeles') => {
    const date = new Date(dateString);
    const zonedDate = toZonedTime(date, timezone);

    const hour = zonedDate.getHours();
    const minutes = zonedDate.getMinutes();

    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayMinutes = minutes.toString().padStart(2, '0');

    return `${displayHour}:${displayMinutes} ${ampm}`;
  };

  const padZero = (num: number) => {
    return num.toString().padStart(2, '0');
  };

  if (isLoading) {
    return <LoadingOverlay message="Loading workshop information..." />;
  }

  if (error || !enrollment) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorHeader}>
            <h1 className={styles.errorTitle}>Workshop Not Found</h1>
            <p className={styles.errorMessage}>{error || 'Unable to load workshop enrollment'}</p>
          </div>
          <Link to="/login" className={styles.homeLink}>
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  // Get workshop data from enrollment
  const workshop = enrollment.workshop;
  const workshopName = workshop?.workshopName || workshop?.cohortName || 'Product Costing Workshop';
  const accessDate = workshop?.accessGrantDatetime || enrollment.accessGrantedAt || new Date().toISOString();
  const workshopLocation = workshop?.location || 'Online';
  const workshopTimezone = workshop?.primaryTimezone || 'America/Los_Angeles';

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>{workshopName}</h1>
          <p className={styles.subtitle}>Get ready for an exciting learning experience!</p>
        </div>

        {/* Countdown Timer */}
        <div className={styles.countdownSection}>
          <h2 className={styles.countdownLabel}>Your platform access unlocks in:</h2>
          <div className={styles.countdown}>
            <div className={styles.timeUnit}>
              <div className={styles.timeValue}>{padZero(timeRemaining.days)}</div>
              <div className={styles.timeLabel}>Days</div>
            </div>
            <div className={styles.timeSeparator}>:</div>
            <div className={styles.timeUnit}>
              <div className={styles.timeValue}>{padZero(timeRemaining.hours)}</div>
              <div className={styles.timeLabel}>Hours</div>
            </div>
            <div className={styles.timeSeparator}>:</div>
            <div className={styles.timeUnit}>
              <div className={styles.timeValue}>{padZero(timeRemaining.minutes)}</div>
              <div className={styles.timeLabel}>Minutes</div>
            </div>
            <div className={styles.timeSeparator}>:</div>
            <div className={styles.timeUnit}>
              <div className={styles.timeValue}>{padZero(timeRemaining.seconds)}</div>
              <div className={styles.timeLabel}>Seconds</div>
            </div>
          </div>
        </div>

        {/* Workshop Details */}
        <div className={styles.detailsSection}>
          <div className={styles.detailCard}>
            <div className={styles.detailIcon}>📅</div>
            <div className={styles.detailContent}>
              <h3 className={styles.detailLabel}>Workshop Date & Time</h3>
              <p className={styles.detailValue}>
                {workshop?.workshopStartDatetime && formatDate(workshop.workshopStartDatetime, workshopTimezone)} at {workshop?.workshopStartDatetime && formatTime(workshop.workshopStartDatetime, workshopTimezone)}
              </p>
            </div>
          </div>

          <div className={styles.detailCard}>
            <div className={styles.detailIcon}>📍</div>
            <div className={styles.detailContent}>
              <h3 className={styles.detailLabel}>Location</h3>
              <p className={styles.detailValue}>
                {workshop?.workshopType === 'online' ? (
                  workshop?.location ? (
                    <a
                      href={workshop.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.link}
                    >
                      Join Online Meeting
                    </a>
                  ) : (
                    'Online'
                  )
                ) : (
                  workshopLocation
                )}
              </p>
            </div>
          </div>

          <div className={styles.detailCard}>
            <div className={styles.detailIcon}>🔓</div>
            <div className={styles.detailContent}>
              <h3 className={styles.detailLabel}>Platform Access</h3>
              <p className={styles.detailValue}>
                Unlocks on {formatDate(accessDate, workshopTimezone)} at {formatTime(accessDate, workshopTimezone)}
              </p>
            </div>
          </div>
        </div>

        {/* Welcome Message */}
        <div className={styles.welcomeSection}>
          <h2 className={styles.welcomeTitle}>See you soon!</h2>
          <p className={styles.welcomeText}>
            We're thrilled to have you joining us. Before the workshop, think about one product
            you'd like to analyze in depth. Come ready with questions!
          </p>
          <p className={styles.welcomeText}>
            In the meantime, check your email for workshop details and a calendar invitation.
          </p>
        </div>

        {/* Worksheet Reminder */}
        {!enrollment.worksheetCompletedAt && (
          <div className={styles.worksheetReminder}>
            <div className={styles.reminderIcon}>📋</div>
            <div className={styles.reminderContent}>
              <h3 className={styles.reminderTitle}>Complete Your Worksheet</h3>
              <p className={styles.reminderText}>
                Don't forget to complete your product cost worksheet before the workshop!
              </p>
              <Link to="/workshops/worksheet" className={styles.worksheetButton}>
                Complete Worksheet
              </Link>
            </div>
          </div>
        )}

        {enrollment.worksheetCompletedAt && (
          <div className={styles.worksheetComplete}>
            <span className={styles.checkIcon}>✓</span>
            Worksheet completed! You're all set for the workshop.
          </div>
        )}

        {/* FAQ Section */}
        <div className={styles.faqSection}>
          <h2 className={styles.faqTitle}>Questions?</h2>
          <div className={styles.faqList}>
            <div className={styles.faqItem}>
              <h4 className={styles.faqQuestion}>What should I bring?</h4>
              <p className={styles.faqAnswer}>
                Bring yourself, the device you used to complete your worksheet, and any questions
                about your product costs. We'll provide everything else you need.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h4 className={styles.faqQuestion}>Can I access the platform before the workshop?</h4>
              <p className={styles.faqAnswer}>
                Your full platform access unlocks at the start of the workshop. You can complete
                your worksheet anytime before then.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h4 className={styles.faqQuestion}>Need help?</h4>
              <p className={styles.faqAnswer}>
                Contact us at{' '}
                <a href="mailto:hello@audacious.money" className={styles.link}>
                  hello@audacious.money
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
