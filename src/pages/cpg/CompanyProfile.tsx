/**
 * Company Profile Page
 *
 * Manage company information and account security settings
 */

import { useState } from 'react';
import styles from './CompanyProfile.module.css';

export default function CompanyProfile() {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // TODO: Implement save logic
    setTimeout(() => {
      setIsSaving(false);
      alert('Profile updated successfully');
    }, 1000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    setIsSaving(true);

    // TODO: Implement password change logic
    setTimeout(() => {
      setIsSaving(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Password changed successfully');
    }, 1000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Company Profile</h1>
        <p>Manage your company information and account security</p>
      </div>

      <div className={styles.sections}>
        {/* Company Information */}
        <section className={styles.section}>
          <h2>Company Information</h2>
          <form onSubmit={handleSaveProfile} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="companyName" className={styles.label}>
                Company Name
              </label>
              <input
                type="text"
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className={styles.input}
                placeholder="Enter your company name"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Company Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={styles.input}
                placeholder="company@example.com"
              />
            </div>

            <button type="submit" className={styles.button} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        {/* Account Security */}
        <section className={styles.section}>
          <h2>Account Security</h2>
          <form onSubmit={handleChangePassword} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="currentPassword" className={styles.label}>
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={styles.input}
                placeholder="Enter current password"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="newPassword" className={styles.label}>
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className={styles.input}
                placeholder="Enter new password"
              />
              <p className={styles.hint}>
                Must be 8+ characters with uppercase, lowercase, number, and special character
              </p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={styles.input}
                placeholder="Confirm new password"
              />
            </div>

            <button type="submit" className={styles.button} disabled={isSaving}>
              {isSaving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
