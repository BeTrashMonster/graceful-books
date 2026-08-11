/**
 * Charity Management Tab
 *
 * CRUD operations for charities
 */

import { useState } from 'react';
import type { CharityAnalytics, CreateCharityRequest, UpdateCharityRequest, Charity } from '../../../services/charities.api';
import {
  createCharity,
  updateCharity,
  inactivateCharity,
  verifyCharity,
  rejectCharity,
  getAdminCharity,
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
  const [editingCharity, setEditingCharity] = useState<Charity | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

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

  const handleEditCharity = async (charityId: string) => {
    setLoadingEdit(true);
    try {
      const fullCharity = await getAdminCharity(charityId);
      setEditingCharity(fullCharity);
    } catch (error) {
      console.error('Error fetching charity details:', error);
      alert(error instanceof Error ? error.message : 'Failed to load charity details');
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleUpdateCharity = async (charityId: string, data: UpdateCharityRequest) => {
    try {
      await updateCharity(charityId, data);
      setEditingCharity(null);
      onRefresh();
    } catch (error) {
      console.error('Error updating charity:', error);
      alert(error instanceof Error ? error.message : 'Failed to update charity');
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
              <th>Order</th>
              <th>Name</th>
              <th>EIN</th>
              <th>Category</th>
              <th>Status</th>
              <th>Lifetime Total</th>
              <th>Total Due</th>
              <th>Active Users</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCharities.map((charity) => (
              <tr key={charity.id}>
                <td className={styles.displayOrder}>{charity.displayOrder}</td>
                <td className={styles.charityName}>{charity.name}</td>
                <td>{charity.ein}</td>
                <td>{charity.category}</td>
                <td>
                  <span className={`${styles.statusBadge} ${styles[`status${charity.status}`]}`}>
                    {charity.status}
                  </span>
                </td>
                <td className={styles.amount}>${(charity.lifetimeTotal / 100).toLocaleString()}</td>
                <td className={styles.amountDue}>${(charity.pendingDistributionAmount / 100).toLocaleString()}</td>
                <td>{charity.activeUserSelections}</td>
                <td>
                  <div className={styles.actions}>
                    <button
                      onClick={() => handleEditCharity(charity.id)}
                      className={styles.editBtn}
                      title="Edit charity"
                      disabled={loadingEdit}
                    >
                      ✏️
                    </button>
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

      {/* Edit Charity Modal */}
      {editingCharity && (
        <EditCharityModal
          charity={editingCharity}
          onUpdate={(data) => handleUpdateCharity(editingCharity.id, data)}
          onClose={() => setEditingCharity(null)}
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
    longDescription: '',
    logo: '',
    displayOrder: 999,
    brandColorBackground: '',
    brandColorTitle: '',
    brandColorDescription: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-prepend https:// if no protocol is present
    let website = formData.website.trim();
    if (website && !website.match(/^https?:\/\//i)) {
      website = `https://${website}`;
    }

    onAdd({ ...formData, website });
  };

  return (
    <div className={styles.modal}>
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
            type="text"
            placeholder="Website (e.g., redcross.org)"
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
          <textarea
            placeholder="Long Description"
            value={formData.longDescription}
            onChange={(e) => setFormData({ ...formData, longDescription: e.target.value })}
            rows={5}
          />
          <input
            type="text"
            placeholder="Logo URL (optional)"
            value={formData.logo}
            onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
          />
          <input
            type="number"
            placeholder="Display Order"
            value={formData.displayOrder}
            onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 999 })}
            min="0"
          />

          <div className={styles.colorFields}>
            <label>Brand Colors (Hex codes - optional)</label>
            <div className={styles.colorInputGroup}>
              <input
                type="text"
                placeholder="Background Color (e.g., #4BA9A0)"
                value={formData.brandColorBackground}
                onChange={(e) => setFormData({ ...formData, brandColorBackground: e.target.value })}
              />
              <div
                className={styles.colorPreview}
                style={{ backgroundColor: formData.brandColorBackground || '#ccc' }}
              />
            </div>
            <div className={styles.colorInputGroup}>
              <input
                type="text"
                placeholder="Title Color (e.g., #FFFFFF)"
                value={formData.brandColorTitle}
                onChange={(e) => setFormData({ ...formData, brandColorTitle: e.target.value })}
              />
              <div
                className={styles.colorPreview}
                style={{ backgroundColor: formData.brandColorTitle || '#ccc' }}
              />
            </div>
            <div className={styles.colorInputGroup}>
              <input
                type="text"
                placeholder="Description Color (e.g., #FFFFFF)"
                value={formData.brandColorDescription}
                onChange={(e) => setFormData({ ...formData, brandColorDescription: e.target.value })}
              />
              <div
                className={styles.colorPreview}
                style={{ backgroundColor: formData.brandColorDescription || '#ccc' }}
              />
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn}>Add Charity</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Edit Charity Modal */
interface EditCharityModalProps {
  charity: Charity;
  onUpdate: (data: UpdateCharityRequest) => void;
  onClose: () => void;
}

function EditCharityModal({ charity, onUpdate, onClose }: EditCharityModalProps) {
  const [formData, setFormData] = useState<UpdateCharityRequest>({
    name: charity.name || '',
    ein: charity.ein || '',
    website: charity.website || '',
    category: charity.category || 'EDUCATION',
    shortDescription: charity.shortDescription || '',
    longDescription: charity.longDescription || '',
    logo: charity.logo || '',
    displayOrder: charity.displayOrder || 999,
    brandColorBackground: charity.brandColorBackground || '',
    brandColorTitle: charity.brandColorTitle || '',
    brandColorDescription: charity.brandColorDescription || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-prepend https:// if no protocol is present
    let website = formData.website?.trim() || '';
    if (website && !website.match(/^https?:\/\//i)) {
      website = `https://${website}`;
    }

    onUpdate({ ...formData, website });
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>Edit {charity.name}</h2>
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
            type="text"
            placeholder="Website (e.g., redcross.org)"
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
          <textarea
            placeholder="Long Description"
            value={formData.longDescription}
            onChange={(e) => setFormData({ ...formData, longDescription: e.target.value })}
            rows={5}
          />
          <input
            type="text"
            placeholder="Logo URL (optional)"
            value={formData.logo}
            onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
          />
          <input
            type="number"
            placeholder="Display Order"
            value={formData.displayOrder}
            onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
            min="0"
          />

          <div className={styles.colorFields}>
            <label>Brand Colors (Hex codes)</label>
            <div className={styles.colorInputGroup}>
              <input
                type="text"
                placeholder="Background Color (e.g., #4BA9A0)"
                value={formData.brandColorBackground}
                onChange={(e) => setFormData({ ...formData, brandColorBackground: e.target.value })}
                pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
              />
              <div
                className={styles.colorPreview}
                style={{ backgroundColor: formData.brandColorBackground || '#ccc' }}
              />
            </div>
            <div className={styles.colorInputGroup}>
              <input
                type="text"
                placeholder="Title Color (e.g., #FFFFFF)"
                value={formData.brandColorTitle}
                onChange={(e) => setFormData({ ...formData, brandColorTitle: e.target.value })}
                pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
              />
              <div
                className={styles.colorPreview}
                style={{ backgroundColor: formData.brandColorTitle || '#ccc' }}
              />
            </div>
            <div className={styles.colorInputGroup}>
              <input
                type="text"
                placeholder="Description Color (e.g., #FFFFFF)"
                value={formData.brandColorDescription}
                onChange={(e) => setFormData({ ...formData, brandColorDescription: e.target.value })}
                pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
              />
              <div
                className={styles.colorPreview}
                style={{ backgroundColor: formData.brandColorDescription || '#ccc' }}
              />
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn}>Update Charity</button>
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
    <div className={styles.modal}>
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
