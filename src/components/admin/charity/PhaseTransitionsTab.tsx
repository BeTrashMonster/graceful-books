/**
 * Phase Transitions Tab
 *
 * Manage charity phase-in/phase-out transitions
 */

import { useState } from 'react';
import type {
  CharityPhaseTransition,
  CharityAnalytics,
  CreatePhaseTransitionRequest,
} from '../../../services/charities.api';
import {
  createPhaseTransition,
  updatePhaseTransition,
  notifyPhaseTransitionUsers,
} from '../../../services/charities.api';
import styles from './PhaseTransitionsTab.module.css';

interface Props {
  transitions: CharityPhaseTransition[];
  charities: CharityAnalytics[];
  onRefresh: () => void;
}

export function PhaseTransitionsTab({ transitions, charities, onRefresh }: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreate = async (data: CreatePhaseTransitionRequest) => {
    try {
      await createPhaseTransition(data);
      setShowCreateForm(false);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create transition');
    }
  };

  const handleNotify = async (transitionId: string) => {
    if (!confirm('Send notifications to all affected users?')) return;
    try {
      const result = await notifyPhaseTransitionUsers(transitionId);
      alert(`Notifications sent to ${result.affectedUsersCount} users`);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to send notifications');
    }
  };

  const handleCancel = async (transitionId: string) => {
    if (!confirm('Cancel this transition?')) return;
    try {
      await updatePhaseTransition(transitionId, { status: 'cancelled' });
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to cancel transition');
    }
  };

  // Separate active and completed transitions
  const activeTransitions = transitions.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTransitions = transitions.filter(t => t.status === 'completed' || t.status === 'cancelled');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Phase Transitions</h2>
          <p>Manage charity phase-in and phase-out schedules</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className={styles.createBtn}
        >
          + Schedule Transition
        </button>
      </div>

      {/* Active Transitions */}
      <section className={styles.section}>
        <h3>Active Transitions ({activeTransitions.length})</h3>
        {activeTransitions.length === 0 ? (
          <p className={styles.empty}>No active transitions</p>
        ) : (
          <div className={styles.transitionsList}>
            {activeTransitions.map((transition) => (
              <TransitionCard
                key={transition.id}
                transition={transition}
                onNotify={() => handleNotify(transition.id)}
                onCancel={() => handleCancel(transition.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Completed Transitions */}
      <section className={styles.section}>
        <details>
          <summary>Completed Transitions ({completedTransitions.length})</summary>
          <div className={styles.transitionsList}>
            {completedTransitions.map((transition) => (
              <TransitionCard key={transition.id} transition={transition} />
            ))}
          </div>
        </details>
      </section>

      {/* Create Form Modal */}
      {showCreateForm && (
        <CreateTransitionModal
          charities={charities.filter(c => c.status === 'VERIFIED')}
          onCreate={handleCreate}
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}

interface TransitionCardProps {
  transition: CharityPhaseTransition;
  onNotify?: () => void;
  onCancel?: () => void;
}

function TransitionCard({ transition, onNotify, onCancel }: TransitionCardProps) {
  const formatDate = (date: string) => new Date(date).toLocaleDateString();
  const isActive = transition.status !== 'completed' && transition.status !== 'cancelled';

  return (
    <div className={styles.transitionCard}>
      <div className={styles.cardHeader}>
        <span className={`${styles.statusBadge} ${styles[`status${transition.status}`]}`}>
          {transition.status}
        </span>
        <span className={styles.date}>Phase out: {formatDate(transition.phaseOutDate)}</span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.charityInfo}>
          <div>
            <strong>Phasing Out:</strong> {transition.charityOut.name}
          </div>
          {transition.replacementCharity && (
            <div>
              <strong>Replacement:</strong> {transition.replacementCharity.name}
            </div>
          )}
        </div>

        <div className={styles.reason}>
          <strong>Reason:</strong> {transition.reason}
        </div>

        <div className={styles.stats}>
          <span>{transition.affectedUsersCount} affected users</span>
          <span>{transition.usersAcknowledgedCount} acknowledged</span>
        </div>
      </div>

      {isActive && (onNotify || onCancel) && (
        <div className={styles.cardActions}>
          {transition.status === 'scheduled' && onNotify && (
            <button onClick={onNotify} className={styles.notifyBtn}>
              Send Notifications
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} className={styles.cancelBtn}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface CreateTransitionModalProps {
  charities: CharityAnalytics[];
  onCreate: (data: CreatePhaseTransitionRequest) => void;
  onClose: () => void;
}

function CreateTransitionModal({ charities, onCreate, onClose }: CreateTransitionModalProps) {
  const [formData, setFormData] = useState<CreatePhaseTransitionRequest>({
    charityId: '',
    replacementCharityId: '',
    phaseOutDate: '',
    reason: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>Schedule Phase Transition</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Charity to Phase Out:
            <select
              value={formData.charityId}
              onChange={(e) => setFormData({ ...formData, charityId: e.target.value })}
              required
            >
              <option value="">Select charity...</option>
              {charities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Replacement Charity (Optional):
            <select
              value={formData.replacementCharityId}
              onChange={(e) => setFormData({ ...formData, replacementCharityId: e.target.value })}
            >
              <option value="">None (just removing)</option>
              {charities
                .filter((c) => c.id !== formData.charityId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Phase Out Date:
            <input
              type="date"
              value={formData.phaseOutDate}
              onChange={(e) => setFormData({ ...formData, phaseOutDate: e.target.value + 'T00:00:00Z' })}
              required
            />
          </label>

          <label>
            Reason:
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Explain why this charity is being phased out..."
              rows={4}
              required
            />
          </label>

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn}>
              Schedule Transition
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
