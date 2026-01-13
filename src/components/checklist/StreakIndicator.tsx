/**
 * StreakIndicator Component
 *
 * Per CHECK-002: Display streak tracking with encouraging messages like
 * "5 weeks in a row! You're building real momentum."
 *
 * Features:
 * - Visual streak display with flame icon
 * - Current and longest streak
 * - Encouraging messages
 * - Milestone celebrations for streaks
 * - Accessible streak information
 */

import clsx from 'clsx'
import type { StreakData } from '../../types/checklist.types'
import styles from './StreakIndicator.module.css'

export interface StreakIndicatorProps {
  /**
   * Streak data to display
   */
  streaks: StreakData
  /**
   * Which streak type to show
   */
  type?: 'weekly' | 'monthly' | 'both'
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Whether to show encouragement message
   */
  showEncouragement?: boolean
  /**
   * Additional class name
   */
  className?: string
}

/**
 * Streak tracking display component
 */
export const StreakIndicator = ({
  streaks,
  type = 'both',
  size = 'md',
  showEncouragement = true,
  className,
}: StreakIndicatorProps) => {
  const showWeekly = type === 'weekly' || type === 'both'
  const showMonthly = type === 'monthly' || type === 'both'

  return (
    <div
      className={clsx(styles.streakContainer, styles[size], className)}
      role="region"
      aria-label="Streak tracking"
    >
      <div className={styles.streakHeader}>
        <h3 className={styles.streakTitle}>Your Streak</h3>
        {(streaks.weekly.current > 0 || streaks.monthly.current > 0) && (
          <div className={styles.flameIcon} aria-hidden="true">
            🔥
          </div>
        )}
      </div>

      <div className={styles.streakContent}>
        {/* Weekly Streak */}
        {showWeekly && (
          <StreakCard
            label="Weekly"
            current={streaks.weekly.current}
            longest={streaks.weekly.longest}
            isActive={streaks.weekly.isActiveThisWeek}
            lastCompleted={streaks.weekly.lastCompleted}
            size={size}
          />
        )}

        {/* Monthly Streak */}
        {showMonthly && (
          <StreakCard
            label="Monthly"
            current={streaks.monthly.current}
            longest={streaks.monthly.longest}
            isActive={streaks.monthly.isActiveThisMonth}
            lastCompleted={streaks.monthly.lastCompleted}
            size={size}
          />
        )}
      </div>

      {/* Encouragement Message */}
      {showEncouragement && streaks.encouragement && (
        <div className={styles.encouragement} role="status" aria-live="polite">
          <p className={styles.encouragementText}>{streaks.encouragement}</p>
        </div>
      )}

      {/* Milestone Badge */}
      {getMilestoneBadge(streaks.weekly.current, streaks.monthly.current)}
    </div>
  )
}

StreakIndicator.displayName = 'StreakIndicator'

// =============================================================================
// StreakCard Component
// =============================================================================

interface StreakCardProps {
  label: string
  current: number
  longest: number
  isActive: boolean
  lastCompleted: Date | null
  size: 'sm' | 'md' | 'lg'
}

const StreakCard = ({ label, current, longest, isActive, lastCompleted, size: _size }: StreakCardProps) => {
  // Format last completed date
  const formatLastCompleted = () => {
    if (!lastCompleted) return 'Never'
    const now = new Date()
    const diff = now.getTime() - lastCompleted.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    return `${Math.floor(days / 30)} months ago`
  }

  return (
    <div className={clsx(styles.streakCard, isActive && styles.streakCardActive)}>
      <div className={styles.streakCardHeader}>
        <span className={styles.streakLabel}>{label}</span>
        {isActive && (
          <span className={styles.activeBadge} aria-label="Active streak">
            Active
          </span>
        )}
      </div>

      <div className={styles.streakNumbers}>
        <div className={styles.streakNumber}>
          <div className={clsx(styles.numberValue, styles.current)}>
            {current}
          </div>
          <div className={styles.numberLabel}>Current</div>
        </div>

        <div className={styles.streakDivider} aria-hidden="true">
          /
        </div>

        <div className={styles.streakNumber}>
          <div className={clsx(styles.numberValue, styles.longest)}>
            {longest}
          </div>
          <div className={styles.numberLabel}>Longest</div>
        </div>
      </div>

      {lastCompleted && (
        <div className={styles.lastCompleted}>
          Last completed: {formatLastCompleted()}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get milestone badge for significant streak achievements
 */
function getMilestoneBadge(weeklyStreak: number, _monthlyStreak: number) {
  const milestones = [
    { weeks: 52, label: '1 Year Streak!', icon: '🏆' },
    { weeks: 26, label: '6 Month Streak!', icon: '🎖️' },
    { weeks: 12, label: '3 Month Streak!', icon: '⭐' },
    { weeks: 4, label: '1 Month Streak!', icon: '🌟' },
  ]

  const milestone = milestones.find((m) => weeklyStreak >= m.weeks)

  if (!milestone) return null

  return (
    <div className={styles.milestoneBadge} role="status" aria-live="polite">
      <span className={styles.milestoneIcon} aria-hidden="true">
        {milestone.icon}
      </span>
      <span className={styles.milestoneLabel}>{milestone.label}</span>
    </div>
  )
}
