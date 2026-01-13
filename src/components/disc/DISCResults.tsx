/**
 * DISC Results Component
 *
 * Displays DISC assessment results with visual representation
 * and personalized interpretation.
 */

import type { DISCProfile, DISCType } from '../../db/schema/discProfile.schema';
import {
  getDISCTypeDisplay,
  getDISCTypeDescription,
  getCommunicationPreferences,
} from '../../db/schema/discProfile.schema';
import { getScoreInterpretation } from '../../features/disc/scoring';

export interface DISCResultsProps {
  profile: DISCProfile;
  showDetails?: boolean;
  onRetake?: () => void;
  className?: string;
}

export function DISCResults({
  profile,
  showDetails = true,
  onRetake,
  className = '',
}: DISCResultsProps) {
  const { scores, primary_type, secondary_type } = profile;

  const primaryDisplay = getDISCTypeDisplay(primary_type);
  const primaryDescription = getDISCTypeDescription(primary_type);
  const primaryPreferences = getCommunicationPreferences(primary_type);

  const scoreEntries: Array<{ type: DISCType; label: string; score: number }> = [
    { type: 'D' as DISCType, label: 'Dominance', score: scores.dominance },
    { type: 'I' as DISCType, label: 'Influence', score: scores.influence },
    { type: 'S' as DISCType, label: 'Steadiness', score: scores.steadiness },
    { type: 'C' as DISCType, label: 'Conscientiousness', score: scores.conscientiousness },
  ];

  return (
    <div className={`disc-results ${className}`} data-testid="disc-results">
      {/* Primary Type Header */}
      <div className="disc-results__header">
        <h2 className="disc-results__title">Your DISC Profile</h2>
        <div className="disc-results__primary-type">
          <span className="disc-results__primary-label">Primary Type:</span>
          <span className="disc-results__primary-value">{primaryDisplay}</span>
          {secondary_type && (
            <span className="disc-results__secondary-value">
              (with {getDISCTypeDisplay(secondary_type)})
            </span>
          )}
        </div>
      </div>

      {/* Score Bars */}
      <div className="disc-results__scores">
        <h3 className="disc-results__scores-title">Your Scores</h3>
        {scoreEntries.map(({ type, label, score }) => (
          <div
            key={type}
            className={`disc-results__score-item ${
              type === primary_type ? 'disc-results__score-item--primary' : ''
            }`}
          >
            <div className="disc-results__score-label">
              <span className="disc-results__score-type">{label}</span>
              <span className="disc-results__score-value">{score}%</span>
              <span className="disc-results__score-interpretation">
                ({getScoreInterpretation(score)})
              </span>
            </div>
            <div className="disc-results__score-bar">
              <div
                className={`disc-results__score-fill disc-results__score-fill--${type.toLowerCase()}`}
                style={{ width: `${score}%` }}
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${label} score: ${score}%`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div className="disc-results__details">
          {/* Description */}
          <div className="disc-results__section">
            <h3 className="disc-results__section-title">About Your Type</h3>
            <p className="disc-results__description">{primaryDescription}</p>
          </div>

          {/* Communication Preferences */}
          <div className="disc-results__section">
            <h3 className="disc-results__section-title">Communication Preferences</h3>
            <dl className="disc-results__preferences">
              <div className="disc-results__preference-item">
                <dt className="disc-results__preference-label">Tone:</dt>
                <dd className="disc-results__preference-value">{primaryPreferences.tone}</dd>
              </div>
              <div className="disc-results__preference-item">
                <dt className="disc-results__preference-label">Message Length:</dt>
                <dd className="disc-results__preference-value">
                  {primaryPreferences.length.charAt(0).toUpperCase() +
                    primaryPreferences.length.slice(1)}
                </dd>
              </div>
              <div className="disc-results__preference-item">
                <dt className="disc-results__preference-label">Emphasis:</dt>
                <dd className="disc-results__preference-value">{primaryPreferences.emphasis}</dd>
              </div>
              <div className="disc-results__preference-item">
                <dt className="disc-results__preference-label">Avoid:</dt>
                <dd className="disc-results__preference-value">{primaryPreferences.avoid}</dd>
              </div>
            </dl>
          </div>

          {/* What This Means */}
          <div className="disc-results__section">
            <h3 className="disc-results__section-title">What This Means For You</h3>
            <p className="disc-results__meaning">
              We'll adapt our communication style to match your preferences. Messages will be{' '}
              {primaryPreferences.length}, with a {primaryPreferences.tone.toLowerCase()} tone,
              focusing on {primaryPreferences.emphasis.toLowerCase()}.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="disc-results__actions">
        {onRetake && (
          <button
            type="button"
            className="disc-results__retake-button"
            onClick={onRetake}
          >
            Retake Assessment
          </button>
        )}
      </div>

      {/* Assessment Info */}
      <div className="disc-results__info">
        <p className="disc-results__info-text">
          Assessment taken on {new Date(profile.assessment_date).toLocaleDateString()}
        </p>
        <p className="disc-results__info-text">
          Assessment version: {profile.assessment_version}
        </p>
      </div>
    </div>
  );
}
