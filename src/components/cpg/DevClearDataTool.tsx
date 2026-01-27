/**
 * Developer Tool: Clear CPG Data
 *
 * This component provides a UI for clearing all CPG data during development.
 * IMPORTANT: This should only be used in development/testing environments.
 *
 * Usage:
 * 1. Add to CPG Dashboard during development
 * 2. Use browser console: window.clearCPGData(companyId)
 */

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { clearAllCPGData, getCPGDataCounts, type ClearCPGDataResult } from '../../utils/clearCPGData';
import { Button } from '../core/Button';
import styles from './DevClearDataTool.module.css';

export function DevClearDataTool() {
  const { companyId } = useAuth();
  const [isClearing, setIsClearing] = useState(false);
  const [counts, setCounts] = useState<ClearCPGDataResult | null>(null);
  const [result, setResult] = useState<ClearCPGDataResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCheckCounts = async () => {
    if (!companyId) {
      alert('No company ID found. Please log in.');
      return;
    }

    try {
      const dataCounts = await getCPGDataCounts(companyId);
      setCounts(dataCounts);
      setResult(null);
    } catch (error) {
      console.error('Error checking data counts:', error);
      alert('Error checking data counts. See console for details.');
    }
  };

  const handleClearData = async () => {
    if (!companyId) {
      alert('No company ID found. Please log in.');
      return;
    }

    setIsClearing(true);
    setResult(null);

    try {
      const clearResult = await clearAllCPGData(companyId);
      setResult(clearResult);
      setCounts(null);
      setShowConfirm(false);

      // Show success message
      const totalDeleted = Object.values(clearResult).reduce((sum, count) => sum + count, 0);
      alert(`Successfully cleared ${totalDeleted} CPG records!`);
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Error clearing data. See console for details.');
    } finally {
      setIsClearing(false);
    }
  };

  const getTotalCount = (data: ClearCPGDataResult) => {
    return Object.values(data).reduce((sum, count) => sum + count, 0);
  };

  return (
    <div className={styles.devTool}>
      <div className={styles.header}>
        <h3>🛠️ Developer Tool: Clear CPG Data</h3>
        <span className={styles.badge}>DEV ONLY</span>
      </div>

      <div className={styles.info}>
        <p>This tool allows you to clear all CPG data for a fresh start.</p>
        <p><strong>Company ID:</strong> {companyId || 'Not found'}</p>
      </div>

      <div className={styles.actions}>
        <Button
          onClick={handleCheckCounts}
          variant="secondary"
          disabled={!companyId || isClearing}
        >
          Check Data Counts
        </Button>

        <Button
          onClick={() => setShowConfirm(true)}
          variant="danger"
          disabled={!companyId || isClearing}
        >
          Clear All CPG Data
        </Button>
      </div>

      {counts && (
        <div className={styles.counts}>
          <h4>Current Data Counts ({getTotalCount(counts)} total records)</h4>
          <ul>
            {counts.categoriesDeleted > 0 && <li>Categories: {counts.categoriesDeleted}</li>}
            {counts.productsDeleted > 0 && <li>Finished Products: {counts.productsDeleted}</li>}
            {counts.recipesDeleted > 0 && <li>Recipes: {counts.recipesDeleted}</li>}
            {counts.invoicesDeleted > 0 && <li>Invoices: {counts.invoicesDeleted}</li>}
            {counts.distributorsDeleted > 0 && <li>Distributors: {counts.distributorsDeleted}</li>}
            {counts.distributionCalculationsDeleted > 0 && <li>Distribution Calculations: {counts.distributionCalculationsDeleted}</li>}
            {counts.salesPromosDeleted > 0 && <li>Sales Promos: {counts.salesPromosDeleted}</li>}
            {counts.productLinksDeleted > 0 && <li>Product Links: {counts.productLinksDeleted}</li>}
            {counts.standaloneFinancialsDeleted > 0 && <li>Standalone Financials: {counts.standaloneFinancialsDeleted}</li>}
            {counts.skuCountTrackersDeleted > 0 && <li>SKU Count Trackers: {counts.skuCountTrackersDeleted}</li>}
          </ul>
          {getTotalCount(counts) === 0 && <p className={styles.empty}>No CPG data found.</p>}
        </div>
      )}

      {result && (
        <div className={styles.result}>
          <h4>✅ Cleared {getTotalCount(result)} records</h4>
          <ul>
            {result.categoriesDeleted > 0 && <li>Categories: {result.categoriesDeleted}</li>}
            {result.productsDeleted > 0 && <li>Finished Products: {result.productsDeleted}</li>}
            {result.recipesDeleted > 0 && <li>Recipes: {result.recipesDeleted}</li>}
            {result.invoicesDeleted > 0 && <li>Invoices: {result.invoicesDeleted}</li>}
            {result.distributorsDeleted > 0 && <li>Distributors: {result.distributorsDeleted}</li>}
            {result.distributionCalculationsDeleted > 0 && <li>Distribution Calculations: {result.distributionCalculationsDeleted}</li>}
            {result.salesPromosDeleted > 0 && <li>Sales Promos: {result.salesPromosDeleted}</li>}
            {result.productLinksDeleted > 0 && <li>Product Links: {result.productLinksDeleted}</li>}
            {result.standaloneFinancialsDeleted > 0 && <li>Standalone Financials: {result.standaloneFinancialsDeleted}</li>}
            {result.skuCountTrackersDeleted > 0 && <li>SKU Count Trackers: {result.skuCountTrackersDeleted}</li>}
          </ul>
        </div>
      )}

      {showConfirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <h3>⚠️ Confirm Data Deletion</h3>
            <p>Are you sure you want to delete all CPG data?</p>
            <p><strong>This action cannot be undone.</strong></p>

            <div className={styles.confirmActions}>
              <Button
                onClick={() => setShowConfirm(false)}
                variant="secondary"
                disabled={isClearing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleClearData}
                variant="danger"
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Yes, Delete All Data'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.consoleInfo}>
        <h4>Browser Console Commands:</h4>
        <code>window.getCompanyId()</code> - Get your company ID<br />
        <code>window.getCPGDataCounts(companyId)</code> - Check data counts<br />
        <code>window.clearCPGData(companyId)</code> - Clear all data
      </div>
    </div>
  );
}
