/**
 * Forbidden (403) Page
 *
 * Displayed when a user attempts to access admin-only routes without proper permissions.
 *
 * Requirements:
 * - IC3: Admin Panel - Charity Management (403 error for non-admin users)
 * - WCAG 2.1 AA compliant
 */

import { Link } from 'react-router-dom';
import styles from './Forbidden.module.css';

export default function Forbidden() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.errorCode}>403</h1>
        <h2 className={styles.title}>Access Denied</h2>
        <p className={styles.message}>
          You don't have permission to access this page. This area is restricted to
          administrators only.
        </p>
        <div className={styles.actions}>
          <Link to="/dashboard" className={styles.primaryButton}>
            Go to Dashboard
          </Link>
          <Link to="/settings" className={styles.secondaryButton}>
            Account Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
