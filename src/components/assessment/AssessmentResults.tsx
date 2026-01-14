/**
 * Assessment Results Component
 *
 * Displays assessment results with celebration, summary, and next steps.
 * Features subtle confetti animation and personalized recommendations.
 *
 * Per Requirements: Results summary page with "What this means" explanations
 */

import { useEffect, useState } from 'react';
import { Button } from '../core/Button';
import styles from './AssessmentResults.module.css';

export interface AssessmentResultsProps {
  /**
   * Assessment results data
   */
  results: {
    phase: 'stabilize' | 'organize' | 'build' | 'grow';
    phaseDescription: string;
    businessType: string;
    literacyLevel: string;
    nextSteps: string[];
  };
  /**
   * Callback to continue to dashboard
   */
  onContinue: () => void;
  /**
   * Optional callback to retake assessment
   */
  onRetake?: () => void;
}

/**
 * Phase information with colors and icons
 */
const PHASE_INFO = {
  stabilize: {
    title: 'Stabilize Phase',
    color: '#ff6b6b',
    icon: '🌱',
    tagline: 'Building Your Foundation',
  },
  organize: {
    title: 'Organize Phase',
    color: '#4a90e2',
    icon: '📋',
    tagline: 'Creating Structure',
  },
  build: {
    title: 'Build Phase',
    color: '#51cf66',
    icon: '🏗️',
    tagline: 'Growing Strategically',
  },
  grow: {
    title: 'Grow Phase',
    color: '#845ef7',
    icon: '🚀',
    tagline: 'Scaling with Confidence',
  },
};

/**
 * Confetti particle component
 */
function ConfettiParticle({ delay, duration }: { delay: number; duration: number }) {
  const colors = ['#4a90e2', '#ff6b6b', '#51cf66', '#845ef7', '#ffd43b'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const left = Math.random() * 100;
  const rotation = Math.random() * 360;

  return (
    <div
      className={styles.confetti}
      style={{
        left: `${left}%`,
        backgroundColor: color,
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`,
        transform: `rotate(${rotation}deg)`,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * AssessmentResults component
 *
 * Features:
 * - Subtle confetti celebration
 * - Phase visualization
 * - Next steps recommendations
 * - WCAG 2.1 AA compliance
 * - Reduced motion support
 */
export function AssessmentResults({
  results,
  onContinue,
  onRetake,
}: AssessmentResultsProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  const phaseInfo = PHASE_INFO[results.phase];

  // Hide confetti after animation completes
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.resultsContainer} data-testid="assessment-results">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className={styles.confettiContainer} aria-hidden="true">
          {Array.from({ length: 30 }).map((_, i) => (
            <ConfettiParticle
              key={i}
              delay={i * 100}
              duration={2000 + Math.random() * 1000}
            />
          ))}
        </div>
      )}

      {/* Results Content */}
      <div className={styles.resultsContent}>
        {/* Celebration Header */}
        <div className={styles.celebrationHeader}>
          <div
            className={styles.phaseIcon}
            style={{ backgroundColor: phaseInfo.color }}
            aria-hidden="true"
          >
            <span className={styles.icon}>{phaseInfo.icon}</span>
          </div>
          <h1 className={styles.welcomeTitle}>
            Welcome to Graceful Books!
          </h1>
          <p className={styles.welcomeSubtitle}>
            We've prepared a personalized path just for you.
          </p>
        </div>

        {/* Phase Card */}
        <div className={styles.phaseCard}>
          <div className={styles.phaseHeader}>
            <h2 className={styles.phaseTitle}>{phaseInfo.title}</h2>
            <span className={styles.phaseTagline}>{phaseInfo.tagline}</span>
          </div>
          <div className={styles.phaseBadge} style={{ backgroundColor: `${phaseInfo.color}15`, color: phaseInfo.color }}>
            Your personalized phase
          </div>
        </div>

        {/* What This Means Section */}
        <div className={styles.meaningSection}>
          <h3 className={styles.sectionTitle}>What this means for you</h3>
          <p className={styles.phaseDescription}>{results.phaseDescription}</p>
        </div>

        {/* Profile Summary */}
        <div className={styles.profileSummary}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Business Type</span>
              <span className={styles.summaryValue}>{results.businessType}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Financial Literacy</span>
              <span className={styles.summaryValue}>{results.literacyLevel}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Communication Style</span>
              <span className={styles.summaryValue}>Steadiness</span>
            </div>
          </div>
          <p className={styles.communicationNote}>
            We use a patient, step-by-step communication style for all users to ensure clarity and support.
          </p>
        </div>

        {/* Next Steps */}
        <div className={styles.nextStepsSection}>
          <h3 className={styles.sectionTitle}>Your next steps</h3>
          <ul className={styles.nextStepsList}>
            {results.nextSteps.map((step, index) => (
              <li key={index} className={styles.nextStepItem}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.stepText}>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            onClick={onContinue}
            fullWidth
            className={styles.continueButton}
          >
            Get Started
          </Button>
          {onRetake && (
            <button
              type="button"
              className={styles.retakeButton}
              onClick={onRetake}
            >
              Retake Assessment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

AssessmentResults.displayName = 'AssessmentResults';
