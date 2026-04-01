import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db';
import type { CPGSalesPromo } from '../../../db/schema/cpg.schema';
import { MarkPromoCompleteModal } from '../../../components/cpg/modals/MarkPromoCompleteModal';
import { promoExportService } from '../../../services/cpg/promoExport.service';
import styles from './PromoTrackerTab.module.css';

type PromoStatus = 'all' | 'draft' | 'approved' | 'declined' | 'active' | 'completed';
type MarginQuality = 'all' | 'gutCheck' | 'good' | 'better' | 'best';

export function PromoTrackerTab() {
  const navigate = useNavigate();
  const { companyId } = useAuth();

  // Filters
  const [statusFilter, setStatusFilter] = useState<PromoStatus>('all');
  const [retailerFilter, setRetailerFilter] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');
  const [marginQualityFilter, setMarginQualityFilter] = useState<MarginQuality>('all');
  const [promoDateRangeFilter, setPromoDateRangeFilter] = useState<string>('all');

  // Data
  const [promos, setPromos] = useState<CPGSalesPromo[]>([]);
  const [retailers, setRetailers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedPromoForComplete, setSelectedPromoForComplete] = useState<CPGSalesPromo | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Load promos on mount and when companyId changes
  useEffect(() => {
    loadPromos();

    // Listen for data updates (e.g., when promos are added/edited or features toggled)
    const handleDataUpdate = () => {
      console.log('🔔 PromoTrackerTab: Heard cpg-data-updated event, reloading promos');
      loadPromos();
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate);
  }, [companyId]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuOpen && !(event.target as Element).closest(`.${styles.exportButtonContainer}`)) {
        setExportMenuOpen(false);
      }
    };

    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportMenuOpen]);

  const loadPromos = async () => {
    console.log('📊 PromoTrackerTab: loadPromos called, companyId:', companyId);

    if (!companyId) {
      console.warn('⚠️ PromoTrackerTab: No companyId, skipping load');
      return;
    }

    try {
      setIsLoading(true);
      console.log('🔍 PromoTrackerTab: Querying cpgSalesPromos table...');

      // Load all promos for this company
      const allPromos = await db.cpgSalesPromos
        .where('company_id')
        .equals(companyId)
        .and((promo) => !promo.deleted_at)
        .reverse()
        .sortBy('created_at');

      console.log(`✅ PromoTrackerTab: Loaded ${allPromos.length} promos`);
      setPromos(allPromos);

      // Extract unique retailers for filter
      const uniqueRetailers = Array.from(
        new Set(allPromos.map((p) => p.retailer_name).filter(Boolean))
      ).sort();
      setRetailers(uniqueRetailers as string[]);
    } catch (error) {
      console.error('❌ PromoTrackerTab: Failed to load promos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredPromos = (): CPGSalesPromo[] => {
    let filtered = [...promos];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((promo) => promo.status === statusFilter);
    }

    // Filter by retailer
    if (retailerFilter !== 'all') {
      filtered = filtered.filter((promo) => promo.retailer_name === retailerFilter);
    }

    // Filter by name search
    if (nameSearch.trim()) {
      const search = nameSearch.toLowerCase();
      filtered = filtered.filter((promo) =>
        promo.promo_name.toLowerCase().includes(search)
      );
    }

    // Filter by margin quality
    if (marginQualityFilter !== 'all') {
      filtered = filtered.filter((promo) => {
        const quality = getMarginQuality(promo.recommendation || 'neutral');
        return quality === marginQualityFilter;
      });
    }

    // Filter by date range
    if (promoDateRangeFilter !== 'all') {
      const now = Date.now();
      const ranges: Record<string, number> = {
        '3mo': 90 * 24 * 60 * 60 * 1000,
        '6mo': 180 * 24 * 60 * 60 * 1000,
        '1yr': 365 * 24 * 60 * 60 * 1000,
      };

      const rangeMs = ranges[promoDateRangeFilter];
      if (rangeMs) {
        filtered = filtered.filter((promo) => {
          if (!promo.promo_start_date) return false;
          return now - promo.promo_start_date <= rangeMs;
        });
      }
    }

    return filtered;
  };

  const getMarginQuality = (recommendation: string): MarginQuality => {
    switch (recommendation) {
      case 'approve':
      case 'strong-approve':
        return 'best';
      case 'neutral':
        return 'good';
      case 'caution':
        return 'gutCheck';
      case 'decline':
        return 'gutCheck';
      default:
        return 'good';
    }
  };

  const getMarginQualityBadge = (promo: CPGSalesPromo): JSX.Element | null => {
    if (!promo.recommendation) return null;

    const quality = getMarginQuality(promo.recommendation);
    const badges: Record<MarginQuality, { text: string; className: string }> = {
      best: { text: 'Best', className: styles.marginBest },
      better: { text: 'Better', className: styles.marginBetter },
      good: { text: 'Good', className: styles.marginGood },
      gutCheck: { text: 'Gut Check', className: styles.marginGutCheck },
      all: { text: '', className: '' },
    };

    const badge = badges[quality];
    if (!badge || !badge.text) return null;

    return <span className={badge.className}>{badge.text}</span>;
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'approved':
        return styles.statusApproved;
      case 'declined':
        return styles.statusDeclined;
      case 'draft':
        return styles.statusDraft;
      case 'active':
        return styles.statusActive;
      case 'completed':
        return styles.statusCompleted;
      default:
        return styles.statusDraft;
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const handleEdit = (promoId: string) => {
    navigate(`/cpg/promo-decision?edit=${promoId}`);
    setActionMenuOpen(null);
  };

  const handleDelete = async (promoId: string) => {
    if (!confirm('Are you sure you want to delete this promo? This action cannot be undone.')) {
      return;
    }

    try {
      await db.cpgSalesPromos.update(promoId, {
        deleted_at: Date.now(),
      });

      await loadPromos();
      setActionMenuOpen(null);
    } catch (error) {
      console.error('Failed to delete promo:', error);
      alert('Failed to delete promo. Please try again.');
    }
  };

  const handleMarkComplete = (promoId: string) => {
    const promo = promos.find(p => p.id === promoId);
    if (!promo) return;

    setSelectedPromoForComplete(promo);
    setCompleteModalOpen(true);
    setActionMenuOpen(null);
  };

  const handleCompleteSubmit = async (
    actualPayback: string,
    actualUnitsSold: string,
    variantBreakdown: Record<string, number>
  ) => {
    if (!selectedPromoForComplete) return;

    try {
      await db.cpgSalesPromos.update(selectedPromoForComplete.id, {
        status: 'completed',
        actual_payback: actualPayback,
        actual_units_sold: actualUnitsSold,
        variant_actual_units_sold: variantBreakdown,
        updated_at: Date.now(),
      });

      await loadPromos();
      setCompleteModalOpen(false);
      setSelectedPromoForComplete(null);
    } catch (error) {
      console.error('Failed to mark promo as complete:', error);
      throw error;
    }
  };

  const getTotalUnitsAvailable = (promo: CPGSalesPromo): number => {
    if (!promo.variant_promo_data) return 0;
    return Object.values(promo.variant_promo_data).reduce((total, variant) => {
      return total + parseFloat(variant.units_available || '0');
    }, 0);
  };

  const calculateSellThrough = (promo: CPGSalesPromo): number => {
    if (!promo.actual_units_sold) return 0;
    const totalUnits = getTotalUnitsAvailable(promo);
    if (totalUnits === 0) return 0;
    return (parseFloat(promo.actual_units_sold) / totalUnits) * 100;
  };

  const getSellThroughColor = (percentage: number): string => {
    if (percentage >= 90) return styles.sellThroughExcellent;
    if (percentage >= 70) return styles.sellThroughGood;
    if (percentage >= 50) return styles.sellThroughModerate;
    return styles.sellThroughLow;
  };

  const toggleActionMenu = (promoId: string) => {
    setActionMenuOpen(actionMenuOpen === promoId ? null : promoId);
  };

  const handleExport = async (type: 'summary' | 'detail', format: 'csv' | 'pdf') => {
    try {
      if (type === 'summary' && format === 'csv') {
        promoExportService.exportSummaryCSV(filteredPromos);
      } else if (type === 'summary' && format === 'pdf') {
        promoExportService.exportSummaryPDF(filteredPromos);
      } else if (type === 'detail' && format === 'csv') {
        promoExportService.exportDetailCSV(filteredPromos);
      } else if (type === 'detail' && format === 'pdf') {
        promoExportService.exportDetailPDF(filteredPromos);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const filteredPromos = getFilteredPromos();

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <p>Loading promo history...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="status-filter" className={styles.filterLabel}>
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PromoStatus)}
            className={styles.filterSelect}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="retailer-filter" className={styles.filterLabel}>
            Retailer
          </label>
          <select
            id="retailer-filter"
            value={retailerFilter}
            onChange={(e) => setRetailerFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Retailers</option>
            {retailers.map((retailer) => (
              <option key={retailer} value={retailer}>
                {retailer}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="name-search" className={styles.filterLabel}>
            Promo Name
          </label>
          <input
            id="name-search"
            type="text"
            placeholder="Search by name..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className={styles.filterSelect}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="margin-filter" className={styles.filterLabel}>
            Margin Quality
          </label>
          <select
            id="margin-filter"
            value={marginQualityFilter}
            onChange={(e) => setMarginQualityFilter(e.target.value as MarginQuality)}
            className={styles.filterSelect}
          >
            <option value="all">All Qualities</option>
            <option value="best">Best</option>
            <option value="better">Better</option>
            <option value="good">Good</option>
            <option value="gutCheck">Gut Check</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="promo-date-filter" className={styles.filterLabel}>
            Date Range
          </label>
          <select
            id="promo-date-filter"
            value={promoDateRangeFilter}
            onChange={(e) => setPromoDateRangeFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Time</option>
            <option value="3mo">Last 3 Months</option>
            <option value="6mo">Last 6 Months</option>
            <option value="1yr">Last Year</option>
          </select>
        </div>

        {/* Export Button */}
        <div className={styles.exportButtonContainer}>
          <button
            className={styles.exportButton}
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={filteredPromos.length === 0}
          >
            Export
          </button>
          {exportMenuOpen && (
            <div className={styles.exportMenu}>
              <button
                className={styles.exportMenuItem}
                onClick={() => {
                  handleExport('summary', 'csv');
                  setExportMenuOpen(false);
                }}
              >
                Summary (CSV)
              </button>
              <button
                className={styles.exportMenuItem}
                onClick={() => {
                  handleExport('summary', 'pdf');
                  setExportMenuOpen(false);
                }}
              >
                Summary (PDF)
              </button>
              <button
                className={styles.exportMenuItem}
                onClick={() => {
                  handleExport('detail', 'csv');
                  setExportMenuOpen(false);
                }}
              >
                Detail (CSV)
              </button>
              <button
                className={styles.exportMenuItem}
                onClick={() => {
                  handleExport('detail', 'pdf');
                  setExportMenuOpen(false);
                }}
              >
                Detail (PDF)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Promo Table */}
      <div className={styles.tableContainer}>
        {filteredPromos.length === 0 ? (
          <div className={styles.noData}>
            {promos.length === 0
              ? 'No promos found. Create your first promo using the Decision Tool tab!'
              : 'No promos match your filters. Try adjusting your search criteria.'}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Promo Name</th>
                <th>Retailer</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Projected Payback</th>
                <th>Actual Payback</th>
                <th>Variance</th>
                <th>Sell-Through</th>
                <th>Margin Quality</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPromos.map((promo) => {
                const isCompleted = promo.status === 'completed';
                const sellThrough = isCompleted ? calculateSellThrough(promo) : 0;
                const variance = isCompleted && promo.actual_payback
                  ? parseFloat(promo.total_promo_cost) - parseFloat(promo.actual_payback)
                  : 0;

                return (
                  <tr key={promo.id}>
                    <td>
                      <strong>{promo.promo_name}</strong>
                    </td>
                    <td>{promo.retailer_name || 'N/A'}</td>
                    <td>
                      <span className={getStatusBadgeClass(promo.status)}>
                        {promo.status}
                      </span>
                    </td>
                    <td>{promo.promo_start_date ? formatDate(promo.promo_start_date) : 'N/A'}</td>
                    <td>{promo.promo_end_date ? formatDate(promo.promo_end_date) : 'N/A'}</td>
                    <td>{formatCurrency(promo.total_promo_cost)}</td>
                    <td>
                      {isCompleted && promo.actual_payback
                        ? formatCurrency(promo.actual_payback)
                        : '—'}
                    </td>
                    <td>
                      {isCompleted && promo.actual_payback
                        ? formatCurrency(variance)
                        : '—'}
                    </td>
                    <td>
                      {isCompleted && promo.actual_units_sold ? (
                        <div className={styles.sellThroughCell}>
                          <div className={styles.sellThroughText}>
                            {sellThrough.toFixed(1)}%
                          </div>
                          <div className={styles.sellThroughBar}>
                            <div
                              className={`${styles.sellThroughFill} ${getSellThroughColor(sellThrough)}`}
                              style={{ width: `${Math.min(sellThrough, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{getMarginQualityBadge(promo)}</td>
                    <td>
                      <div className={styles.actionCell}>
                        <button
                          className={styles.actionButton}
                          onClick={() => toggleActionMenu(promo.id)}
                          aria-label="Open actions menu"
                        >
                          ⋮
                        </button>
                        {actionMenuOpen === promo.id && (
                          <div className={styles.actionMenu}>
                            <button
                              className={styles.actionMenuItem}
                              onClick={() => handleEdit(promo.id)}
                            >
                              Edit
                            </button>
                            {promo.status === 'approved' && (
                              <button
                                className={styles.actionMenuItem}
                                onClick={() => handleMarkComplete(promo.id)}
                              >
                                Mark Complete
                              </button>
                            )}
                            <button
                              className={`${styles.actionMenuItem} ${styles.actionMenuItemDanger}`}
                              onClick={() => handleDelete(promo.id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mark Complete Modal */}
      {selectedPromoForComplete && (
        <MarkPromoCompleteModal
          isOpen={completeModalOpen}
          onClose={() => {
            setCompleteModalOpen(false);
            setSelectedPromoForComplete(null);
          }}
          onSubmit={handleCompleteSubmit}
          promoName={selectedPromoForComplete.promo_name}
          projectedPayback={selectedPromoForComplete.total_promo_cost}
          projectedUnits={getTotalUnitsAvailable(selectedPromoForComplete).toString()}
          variants={
            selectedPromoForComplete.variant_promo_data && selectedPromoForComplete.variant_promo_results
              ? Object.keys(selectedPromoForComplete.variant_promo_data).map((variantName) => ({
                  name: variantName,
                  projectedUnits: parseFloat(
                    selectedPromoForComplete.variant_promo_data![variantName].units_available || '0'
                  ),
                  promoCostPerUnit: parseFloat(
                    selectedPromoForComplete.variant_promo_results![variantName]?.sales_promo_cost_per_unit || '0'
                  ),
                }))
              : []
          }
        />
      )}
    </div>
  );
}
