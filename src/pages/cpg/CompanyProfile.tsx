/**
 * Company Profile Page
 *
 * Manage company information and account security settings
 * Moved from CPGSettings.tsx for better organization
 */

import { useState, useEffect } from 'react';
import { Button } from '../../components/core/Button';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db';
import { CPGSettingsService } from '../../services/cpg/cpgSettings.service';
import type { CPGSettings } from '../../db/schema/cpg.schema';
import styles from './CPGSettings.module.css'; // Reuse Settings styles

export default function CompanyProfile() {
  const { companyId, deviceId } = useAuth();

  const [settings, setSettings] = useState<CPGSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Company Profile state
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [companyAddressLine1, setCompanyAddressLine1] = useState('');
  const [companyAddressLine2, setCompanyAddressLine2] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [companyPostalCode, setCompanyPostalCode] = useState('');
  const [companyCountry, setCompanyCountry] = useState('US');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');

  // Collapsible section state
  const [companySectionExpanded, setCompanySectionExpanded] = useState(true);
  const [accountSectionExpanded, setAccountSectionExpanded] = useState(true);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  /**
   * Load settings on mount
   */
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const service = new CPGSettingsService(db);
        const loadedSettings = await service.getOrCreateSettings(
          companyId,
          deviceId
        );

        setSettings(loadedSettings);

        // Company Profile
        setCompanyName(loadedSettings.company_name);
        setCompanyLogoUrl(loadedSettings.company_logo_url || '');
        setCompanyAddressLine1(loadedSettings.company_address_line1);
        setCompanyAddressLine2(loadedSettings.company_address_line2 || '');
        setCompanyCity(loadedSettings.company_city);
        setCompanyState(loadedSettings.company_state);
        setCompanyPostalCode(loadedSettings.company_postal_code);
        setCompanyCountry(loadedSettings.company_country);
        setCompanyPhone(loadedSettings.company_phone || '');
        setCompanyEmail(loadedSettings.company_email || '');
        setCompanyWebsite(loadedSettings.company_website || '');
      } catch (error) {
        console.error('Failed to load company profile:', error);
        setErrorMessage(`Failed to load profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [companyId, deviceId]);

  /**
   * Save company profile
   */
  const handleSave = async () => {
    if (!settings || !deviceId) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const service = new CPGSettingsService(db);
      const updated = await service.updateSettings(
        settings.id,
        {
          company_name: companyName,
          company_logo_url: companyLogoUrl || null,
          company_address_line1: companyAddressLine1,
          company_address_line2: companyAddressLine2 || null,
          company_city: companyCity,
          company_state: companyState,
          company_postal_code: companyPostalCode,
          company_country: companyCountry,
          company_phone: companyPhone || null,
          company_email: companyEmail || null,
          company_website: companyWebsite || null,
        },
        deviceId
      );

      setSettings(updated);

      // Update session storage with new company name
      const session = sessionStorage.getItem('graceful_books_session');
      if (session) {
        try {
          const sessionData = JSON.parse(session);
          sessionData.user.companyName = companyName;
          sessionStorage.setItem('graceful_books_session', JSON.stringify(sessionData));

          // Dispatch event to notify CPGLayout to update company name display
          window.dispatchEvent(new CustomEvent('company-name-updated', { detail: { companyName } }));
        } catch (err) {
          console.error('Failed to update session:', err);
        }
      }

      setSuccessMessage('Your changes have been saved successfully!');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save company profile:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to save profile'
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Change password
   */
  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    // Validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('All password fields are required');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setPasswordError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setPasswordError('Password must contain at least one number');
      return;
    }

    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setPasswordError('Password must contain at least one special character');
      return;
    }

    setIsChangingPassword(true);

    try {
      const API_URL = 'https://api.audacious.money';
      const session = sessionStorage.getItem('graceful_books_session');
      if (!session) {
        setPasswordError('Not authenticated. Please log in again.');
        return;
      }

      const { token } = JSON.parse(session);

      const response = await fetch(`${API_URL}/users/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to change password');
      }

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (error) {
      console.error('Password change error:', error);
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingIcon}>⚙️</div>
          <p className={styles.loadingText}>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Company Profile</h1>
        <p className={styles.subtitle}>
          Manage your company information and account security
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className={styles.successMessage}>
          <span className={styles.messageIcon}>✓</span>
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className={styles.errorMessage}>
          <span className={styles.messageIcon}>✕</span>
          {errorMessage}
        </div>
      )}

      {/* Company Profile Section */}
      <div className={styles.settingsSection}>
        <div
          className={styles.sectionHeader}
          onClick={() => setCompanySectionExpanded(!companySectionExpanded)}
        >
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Company Information</h2>
              <p className={styles.sectionSubtitle}>
                Company details for reports and documents
              </p>
            </div>
          </div>
          <span className={`${styles.expandIcon} ${companySectionExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </div>

        <div className={`${styles.sectionContent} ${companySectionExpanded ? styles.expanded : ''}`}>
          <div className={styles.sectionInner}>
            <p className={styles.sectionDescription}>
              Your company information will appear on printed reports and documents.
            </p>

            <div className={styles.formGrid}>
              {/* Company Name */}
              <div className={styles.formFieldFull}>
                <label className={styles.label} htmlFor="company-name">
                  Company Name
                </label>
                <input
                  id="company-name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={styles.input}
                  placeholder="Your Company Name"
                />
              </div>

              {/* Address Line 1 */}
              <div className={styles.formFieldFull}>
                <label className={styles.label} htmlFor="address-1">
                  Address Line 1
                </label>
                <input
                  id="address-1"
                  type="text"
                  value={companyAddressLine1}
                  onChange={(e) => setCompanyAddressLine1(e.target.value)}
                  className={styles.input}
                  placeholder="123 Main Street"
                />
              </div>

              {/* Address Line 2 */}
              <div className={styles.formFieldFull}>
                <label className={styles.label} htmlFor="address-2">
                  Address Line 2 (optional)
                </label>
                <input
                  id="address-2"
                  type="text"
                  value={companyAddressLine2}
                  onChange={(e) => setCompanyAddressLine2(e.target.value)}
                  className={styles.input}
                  placeholder="Suite 200"
                />
              </div>

              {/* City */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  value={companyCity}
                  onChange={(e) => setCompanyCity(e.target.value)}
                  className={styles.input}
                  placeholder="City"
                />
              </div>

              {/* State */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="state">
                  State/Province
                </label>
                <input
                  id="state"
                  type="text"
                  value={companyState}
                  onChange={(e) => setCompanyState(e.target.value)}
                  className={styles.input}
                  placeholder="CA"
                  maxLength={2}
                />
              </div>

              {/* Postal Code */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="postal-code">
                  Postal Code
                </label>
                <input
                  id="postal-code"
                  type="text"
                  value={companyPostalCode}
                  onChange={(e) => setCompanyPostalCode(e.target.value)}
                  className={styles.input}
                  placeholder="90210"
                />
              </div>

              {/* Country */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="country">
                  Country
                </label>
                <select
                  id="country"
                  value={companyCountry}
                  onChange={(e) => setCompanyCountry(e.target.value)}
                  className={styles.select}
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="MX">Mexico</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                </select>
              </div>

              {/* Phone */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="phone">
                  Phone (optional)
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className={styles.input}
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Email */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="email">
                  Email (optional)
                </label>
                <input
                  id="email"
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className={styles.input}
                  placeholder="contact@company.com"
                />
              </div>

              {/* Website */}
              <div className={styles.formFieldFull}>
                <label className={styles.label} htmlFor="website">
                  Website (optional)
                </label>
                <input
                  id="website"
                  type="url"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  className={styles.input}
                  placeholder="https://www.company.com"
                />
              </div>

              {/* Logo Upload - Future implementation */}
              <div className={styles.formFieldFull}>
                <label className={styles.label}>
                  Company Logo
                </label>
                <div className={styles.logoUpload}>
                  <p className={styles.logoPlaceholder}>
                    Logo upload coming soon
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <Button
                variant="purple"
                size="md"
                onClick={handleSave}
                loading={isSaving}
                disabled={isSaving}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Account Security Section */}
      <div className={styles.settingsSection}>
        <div
          className={styles.sectionHeader}
          onClick={() => setAccountSectionExpanded(!accountSectionExpanded)}
        >
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Account Security</h2>
              <p className={styles.sectionSubtitle}>
                Change your password
              </p>
            </div>
          </div>
          <span className={`${styles.expandIcon} ${accountSectionExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </div>

        <div className={`${styles.sectionContent} ${accountSectionExpanded ? styles.expanded : ''}`}>
          <div className={styles.sectionInner}>
            <p className={styles.sectionDescription}>
              Update your account password. Make sure it's strong and unique.
            </p>

            {/* Password Success Message */}
            {passwordSuccess && (
              <div className={styles.successMessage} style={{ marginBottom: '1rem' }}>
                <span className={styles.messageIcon}>✓</span>
                {passwordSuccess}
              </div>
            )}

            {/* Password Error Message */}
            {passwordError && (
              <div className={styles.errorMessage} style={{ marginBottom: '1rem' }}>
                <span className={styles.messageIcon}>✕</span>
                {passwordError}
              </div>
            )}

            <div className={styles.formGrid}>
              {/* Current Password */}
              <div className={styles.formFieldFull}>
                <label className={styles.label} htmlFor="current-password">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                />
              </div>

              {/* New Password */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="new-password">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                />
                <p className={styles.fieldHint}>
                  Must include uppercase, lowercase, number, and special character
                </p>
              </div>

              {/* Confirm New Password */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="confirm-new-password">
                  Confirm New Password
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Change Password Button */}
            <div className={styles.actions}>
              <Button
                variant="purple"
                size="md"
                onClick={handleChangePassword}
                loading={isChangingPassword}
                disabled={isChangingPassword}
              >
                Change Password
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
