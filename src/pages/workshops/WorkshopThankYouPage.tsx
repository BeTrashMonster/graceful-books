import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getWorkshopBySlug, type Workshop } from '../../services/workshops.api';
import { LoadingOverlay } from '../../components/feedback/Loading';
import styles from './WorkshopThankYouPage.module.css';

export default function WorkshopThankYouPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Load workshop on mount
  useEffect(() => {
    if (!slug) {
      setError('Invalid workshop URL');
      setIsLoading(false);
      return;
    }

    loadWorkshop();
  }, [slug]);

  // Show confetti on mount
  useEffect(() => {
    if (workshop) {
      setShowConfetti(true);
      // Trigger confetti animation
      triggerConfetti();
    }
  }, [workshop]);

  const loadWorkshop = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const workshopData = await getWorkshopBySlug(slug!);
      setWorkshop(workshopData);
    } catch (err: any) {
      console.error('Failed to load workshop:', err);
      setError(err.message || 'Workshop not found');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerConfetti = () => {
    // Simple confetti effect using CSS animation
    // For production, consider using canvas-confetti library
    const confettiContainer = document.querySelector(`.${styles.confettiContainer}`);
    if (confettiContainer) {
      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = styles.confetti;
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.backgroundColor = [
          '#4b006e',
          '#D4AF37',
          '#5a0082',
          '#ff6b9d',
          '#c084fc',
        ][Math.floor(Math.random() * 5)];
        confettiContainer.appendChild(confetti);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string, timezone?: string) => {
    const date = new Date(dateString);
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || 'America/Los_Angeles',
    });
    return timeStr;
  };

  const getTimezoneAbbr = (timezone: string) => {
    const tzMap: Record<string, string> = {
      'America/Los_Angeles': 'PST',
      'America/New_York': 'EST',
      'America/Chicago': 'CST',
      'America/Denver': 'MST',
    };
    return tzMap[timezone] || timezone;
  };

  const formatAccessDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <LoadingOverlay message="Loading workshop details..." />;
  }

  if (error || !workshop) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorHeader}>
            <h1 className={styles.errorTitle}>Workshop Not Found</h1>
            <p className={styles.errorMessage}>{error || 'Unable to load workshop details'}</p>
          </div>
          <Link to="/" className={styles.homeLink}>
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.confettiContainer} />

      <div className={styles.card}>
        {/* Success Icon */}
        <div className={styles.iconWrapper}>
          <div className={styles.successIcon}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>You're All Set!</h1>
          <p className={styles.subtitle}>
            Thank you for enrolling in <strong>{workshop.cohortName}</strong>
          </p>
        </div>

        {/* Workshop Details */}
        <div className={styles.detailsSection}>
          <div className={styles.detailCard}>
            <div className={styles.detailIcon}>📅</div>
            <div className={styles.detailContent}>
              <h3 className={styles.detailLabel}>Workshop Date & Time</h3>
              <p className={styles.detailValue}>
                {formatDate(workshop.workshopStartDatetime)}
              </p>
              <p className={styles.detailSubvalue}>
                {formatTime(workshop.workshopStartDatetime, workshop.primaryTimezone)}{' '}
                {getTimezoneAbbr(workshop.primaryTimezone)}
                {workshop.secondaryTimezone && (
                  <>
                    {' '}
                    / {formatTime(workshop.workshopStartDatetime, workshop.secondaryTimezone)}{' '}
                    {getTimezoneAbbr(workshop.secondaryTimezone)}
                  </>
                )}
              </p>
            </div>
          </div>

          {workshop.location && (
            <div className={styles.detailCard}>
              <div className={styles.detailIcon}>
                {workshop.workshopType === 'online' ? '💻' : '📍'}
              </div>
              <div className={styles.detailContent}>
                <h3 className={styles.detailLabel}>Location</h3>
                <p className={styles.detailValue}>
                  {workshop.workshopType === 'online' ? (
                    <a
                      href={workshop.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.link}
                    >
                      Join Online Meeting
                    </a>
                  ) : (
                    workshop.location
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* What Happens Next */}
        <div className={styles.nextStepsSection}>
          <h2 className={styles.sectionTitle}>What happens next:</h2>
          <ul className={styles.stepsList}>
            <li className={styles.step}>
              <span className={styles.stepIcon}>✓</span>
              <span className={styles.stepText}>
                You'll receive a welcome email shortly with all the details
              </span>
            </li>
            <li className={styles.step}>
              <span className={styles.stepIcon}>✓</span>
              <span className={styles.stepText}>
                We'll send a reminder {workshop.reminderHoursBefore} hours before the workshop
              </span>
            </li>
            <li className={styles.step}>
              <span className={styles.stepIcon}>✓</span>
              <span className={styles.stepText}>
                Your full platform access begins on{' '}
                {formatAccessDate(workshop.accessGrantDatetime)}
              </span>
            </li>
            <li className={styles.step}>
              <span className={styles.stepIcon}>✓</span>
              <span className={styles.stepText}>
                Your {workshop.trialDurationDays}-day free trial starts on{' '}
                {formatAccessDate(workshop.trialStartDatetime)}
              </span>
            </li>
          </ul>
        </div>

        {/* Custom Welcome Message */}
        {workshop.welcomeMessage && (
          <div className={styles.welcomeSection}>
            <div className={styles.welcomeMessage}>{workshop.welcomeMessage}</div>
          </div>
        )}

        {/* Call to Action */}
        <div className={styles.ctaSection}>
          <p className={styles.ctaText}>
            You can log in anytime to see your countdown to the workshop.
          </p>
          <Link to="/login" className={styles.primaryButton}>
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
