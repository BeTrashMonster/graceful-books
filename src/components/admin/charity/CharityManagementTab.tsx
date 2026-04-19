/**
 * Charity Management Tab
 *
 * CRUD operations for charities
 */

import { useState } from 'react';
import type { CharityAnalytics, CreateCharityRequest } from '../../../services/charities.api';
import {
  createCharity,
  updateCharity,
  inactivateCharity,
  verifyCharity,
  rejectCharity,
} from '../../../services/charities.api';
import { CharityStatus, CharityCategory } from '../../../types/database.types';
import styles from './CharityManagementTab.module.css';

interface Props {
  charities: CharityAnalytics[];
  onRefresh: () => void;
}

export function CharityManagementTab({ charities, onRefresh }: Props) {
  const [statusFilter, setStatusFilter] = useState<CharityStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCharity, setSelectedCharity] = useState<CharityAnalytics | null>(null);

  // Filter charities
  const filteredCharities = charities.filter((c) => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ein.includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const handleAddCharity = async (data: CreateCharityRequest) => {
    try {
      await createCharity(data);
      setShowAddForm(false);
      onRefresh();
    } catch (error) {
      console.error('Error creating charity:', error);
      alert(error instanceof Error ? error.message : 'Failed to create charity');
    }
  };

  const handleVerify = async (charityId: string) => {
    if (!confirm('Are you sure you want to verify this charity?')) return;
    try {
      await verifyCharity(charityId);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to verify charity');
    }
  };

  const handleReject = async (charityId: string, reason: string) => {
    try {
      await rejectCharity(charityId, reason);
      setSelectedCharity(null);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to reject charity');
    }
  };

  const handleInactivate = async (charityId: string) => {
    if (!confirm('Are you sure you want to inactivate this charity?')) return;
    try {
      await inactivateCharity(charityId);
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to inactivate charity');
    }
  };

  return (
    <div className={styles.container}>
      {/* Controls */}
      <div className={styles.controls}>
        <input
          type="search"
          placeholder="Search charities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CharityStatus | 'ALL')}
          className={styles.select}
        >
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className={styles.addButton}
        >
          + Add Charity
        </button>
      </div>

      {/* Charity Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>EIN</th>
              <th>Category</th>
              <th>Status</th>
              <th>Lifetime Total</th>
              <th>Active Users</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCharities.map((charity) => (
              <tr key={charity.id}>
                <td className={styles.charityName}>{charity.name}</td>
                <td>{charity.ein}</td>
                <td>{charity.category}</td>
                <td>
                  <span className={`${styles.statusBadge} ${styles[`status${charity.status}`]}`}>
                    {charity.status}
                  </span>
                </td>
                <td className={styles.amount}>${(charity.lifetimeTotal / 100).toLocaleString()}</td>
                <td>{charity.activeUserSelections}</td>
                <td>
                  <div className={styles.actions}>
                    {charity.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleVerify(charity.id)}
                          className={styles.verifyBtn}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setSelectedCharity(charity)}
                          className={styles.rejectBtn}
                        >
                          ✗
                        </button>
                      </>
                    )}
                    {charity.status !== 'INACTIVE' && (
                      <button
                        onClick={() => handleInactivate(charity.id)}
                        className={styles.inactivateBtn}
                      >
                        Inactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Charity Modal */}
      {showAddForm && (
        <AddCharityModal
          onAdd={handleAddCharity}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Reject Modal */}
      {selectedCharity && (
        <RejectModal
          charity={selectedCharity}
          onReject={(reason) => handleReject(selectedCharity.id, reason)}
          onClose={() => setSelectedCharity(null)}
        />
      )}
    </div>
  );
}

/* Add Charity Modal */
interface AddCharityModalProps {
  onAdd: (data: CreateCharityRequest) => void;
  onClose: () => void;
}

function AddCharityModal({ onAdd, onClose }: AddCharityModalProps) {
  const [formData, setFormData] = useState<CreateCharityRequest>({
    name: '',
    ein: '',
    website: '',
    category: 'EDUCATION',
    shortDescription: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>Add New Charity</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder="Charity Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="EIN (XX-XXXXXXX)"
            value={formData.ein}
            onChange={(e) => setFormData({ ...formData, ein: e.target.value })}
            pattern="\d{2}-\d{7}"
            required
          />
          <input
            type="url"
            placeholder="Website"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            required
          />
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as CharityCategory })}
            required
          >
            <option value="EDUCATION">Education</option>
            <option value="ENVIRONMENT">Environment</option>
            <option value="HEALTH">Health</option>
            <option value="POVERTY">Poverty</option>
            <option value="ANIMAL_WELFARE">Animal Welfare</option>
            <option value="HUMAN_RIGHTS">Human Rights</option>
            <option value="DISASTER_RELIEF">Disaster Relief</option>
            <option value="ARTS_CULTURE">Arts & Culture</option>
            <option value="COMMUNITY">Community</option>
            <option value="OTHER">Other</option>
          </select>
          <textarea
            placeholder="Short Description"
            value={formData.shortDescription}
            onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
            rows={3}
          />
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn}>Add Charity</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Reject Modal */
interface RejectModalProps {
  charity: CharityAnalytics;
  onReject: (reason: string) => void;
  onClose: () => void;
}

function RejectModal({ charity, onReject, onClose }: RejectModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      onReject(reason);
    }
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>Reject {charity.name}</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea
            placeholder="Rejection reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            required
          />
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn}>Reject</button>
          </div>
        </form>
      </div>
    </div>
  );
}
