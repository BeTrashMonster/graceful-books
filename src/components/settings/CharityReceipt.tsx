/**
 * CharityReceipt Component
 *
 * User-facing component for viewing and downloading annual charity contribution receipts.
 * Generates a printable/PDF-ready receipt for tax purposes.
 *
 * Requirements:
 * - IC2.5: Charity Payment Distribution System
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect, useRef } from 'react';
import { getUserAnnualContribution, type UserAnnualContribution } from '../../services/admin/charityDistribution.service';
import styles from './CharityReceipt.module.css';

interface CharityReceiptProps {
  userId: string;
  userName?: string;
  userAddress?: string;
}

export function CharityReceipt({ userId, userName, userAddress }: CharityReceiptProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [contribution, setContribution] = useState<UserAnnualContribution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Load contribution data when year changes
  useEffect(() => {
    loadContribution();
  }, [selectedYear, userId]);

  const loadContribution = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getUserAnnualContribution(userId, selectedYear);
      setContribution(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contribution data');
      console.error('Error loading contribution:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedYear(parseInt(e.target.value));
  };

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    { length: 5 },
    (_, i) => currentYear - i
  );

  return (
    <div className={styles.container}>
      {/* Controls (hide when printing) */}
      <div className={styles.controls}>
        <div className={styles.header}>
          <h2 className={styles.title}>Charitable Contribution Receipt</h2>
          <p className={styles.subtitle}>
            Download your annual contribution receipt for tax purposes
          </p>
        </div>

        <div className={styles.yearSelector}>
          <label htmlFor="year-select" className={styles.label}>
            Select Year
          </label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={handleYearChange}
            className={styles.select}
            disabled={loading}
          >
            {availableYears.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {contribution && (
          <button
            type="button"
            onClick={handlePrint}
            className={styles.printButton}
            aria-label="Print or save as PDF"
          >
            Print / Save as PDF
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorMessage} role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={styles.loading} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true"></div>
          <span>Loading receipt...</span>
        </div>
      )}

      {/* Receipt Content */}
      {contribution && !loading && (
        <div ref={receiptRef} className={styles.receipt}>
          {/* Receipt Header */}
          <header className={styles.receiptHeader}>
            <div className={styles.logoSection}>
              <div className={styles.logo} aria-hidden="true">GB</div>
              <div>
                <h1 className={styles.receiptTitle}>Graceful Books</h1>
                <p className={styles.receiptSubtitle}>Charitable Contribution Receipt</p>
              </div>
            </div>
            <div className={styles.dateSection}>
              <p className={styles.receiptDate}>
                <strong>Receipt Date:</strong> {new Date().toLocaleDateString()}
              </p>
              <p className={styles.receiptYear}>
                <strong>Tax Year:</strong> {selectedYear}
              </p>
            </div>
          </header>

          {/* Donor Information */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Donor Information</h2>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Name:</span>
                <span className={styles.infoValue}>{userName || 'User'}</span>
              </div>
              {userAddress && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Address:</span>
                  <span className={styles.infoValue}>{userAddress}</span>
                </div>
              )}
            </div>
          </section>

          {/* Charity Information */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Charity Information</h2>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Organization:</span>
                <span className={styles.infoValue}>{contribution.charity_name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>EIN:</span>
                <span className={styles.infoValue}>{contribution.charity_ein}</span>
              </div>
            </div>
          </section>

          {/* Contribution Details */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Contribution Details</h2>
            <div className={styles.contributionDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Months Contributed:</span>
                <span className={styles.detailValue}>{contribution.months_contributed}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Monthly Contribution:</span>
                <span className={styles.detailValue}>$5.00</span>
              </div>
              <div className={`${styles.detailRow} ${styles.totalRow}`}>
                <span className={styles.detailLabel}>Total Contribution:</span>
                <span className={styles.detailValue}>
                  {formatCurrency(contribution.total_amount)}
                </span>
              </div>
            </div>
          </section>

          {/* Tax Notice */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Tax Information</h2>
            <div className={styles.taxNotice}>
              <p className={styles.taxText}>
                This letter confirms that you contributed{' '}
                <strong>{formatCurrency(contribution.total_amount)}</strong> to{' '}
                <strong>{contribution.charity_name}</strong> through Graceful Books during
                the {selectedYear} tax year.
              </p>
              <p className={styles.taxText}>
                No goods or services were provided in exchange for your contribution.
              </p>
              <p className={styles.taxText}>
                <strong>Important:</strong> Please consult with a tax professional to
                determine the deductibility of this contribution for your specific tax
                situation.
              </p>
            </div>
          </section>

          {/* Footer */}
          <footer className={styles.receiptFooter}>
            <div className={styles.footerSection}>
              <h3 className={styles.footerTitle}>Graceful Books Contact Information</h3>
              <p className={styles.footerText}>Email: support@gracefulbooks.com</p>
              <p className={styles.footerText}>Website: www.gracefulbooks.com</p>
            </div>
            <div className={styles.footerSection}>
              <p className={styles.disclaimer}>
                This receipt is for informational purposes only and should not be
                construed as tax advice. Please retain this receipt for your records.
              </p>
            </div>
          </footer>
        </div>
      )}

      {/* No Contribution State */}
      {!contribution && !loading && !error && (
        <div className={styles.noContribution}>
          <h3 className={styles.noContributionTitle}>
            No Contributions Found
          </h3>
          <p className={styles.noContributionText}>
            You did not have an active subscription with a selected charity during{' '}
            {selectedYear}.
          </p>
          <p className={styles.noContributionSubtext}>
            Your monthly $5 charity contribution is included with your Graceful Books
            subscription. To select a charity, visit your account settings.
          </p>
        </div>
      )}
    </div>
  );
}
