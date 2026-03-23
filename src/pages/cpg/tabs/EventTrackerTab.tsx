/**
 * Event Tracker Tab
 *
 * View and track historical event performance with comprehensive filtering,
 * actions, and export capabilities.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db';
import type { CPGEvent } from '../../../db/schema/cpg.schema';
import { MarkEventCompleteModal } from '../../../components/cpg/modals/MarkEventCompleteModal';
import { eventExportService } from '../../../services/cpg/eventExport.service';
import styles from './EventTrackerTab.module.css';

type EventStatus = 'all' | 'upcoming' | 'pending' | 'completed';
type MarginQuality = 'all' | 'gutCheck' | 'good' | 'better' | 'best';

export function EventTrackerTab() {
  const navigate = useNavigate();
  const { companyId } = useAuth();

  // Filters
  const [statusFilter, setStatusFilter] = useState<EventStatus>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [nameSearch, setNameSearch] = useState<string>('');
  const [marginQualityFilter, setMarginQualityFilter] = useState<MarginQuality>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');

  // Data
  const [events, setEvents] = useState<CPGEvent[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedEventForComplete, setSelectedEventForComplete] = useState<CPGEvent | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Load events on mount
  useEffect(() => {
    loadEvents();
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

  const loadEvents = async () => {
    if (!companyId) return;

    try {
      setIsLoading(true);
      const allEvents = await db.cpgEvents
        .where('company_id')
        .equals(companyId)
        .and((event) => !event.deleted_at)
        .reverse()
        .sortBy('created_at');

      setEvents(allEvents);

      // Extract unique locations for filter
      const uniqueLocations = Array.from(
        new Set(allEvents.map((e) => e.location).filter(Boolean))
      ).sort();
      setLocations(uniqueLocations as string[]);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredEvents = (): CPGEvent[] => {
    let filtered = [...events];

    // Filter by status using smart status logic
    if (statusFilter !== 'all') {
      const now = Date.now();
      filtered = filtered.filter((event) => {
        if (statusFilter === 'completed') {
          return event.status === 'completed';
        } else if (statusFilter === 'upcoming') {
          // Upcoming: planned events that haven't ended yet
          return event.status === 'planned' && event.event_end_date >= now;
        } else if (statusFilter === 'pending') {
          // Pending (How'd it go?!): planned events that have ended but not marked complete
          return event.status === 'planned' && event.event_end_date < now;
        }
        return false;
      });
    }

    // Filter by location
    if (locationFilter !== 'all') {
      filtered = filtered.filter((event) => event.location === locationFilter);
    }

    // Filter by name search
    if (nameSearch.trim()) {
      const search = nameSearch.toLowerCase();
      filtered = filtered.filter((event) =>
        event.event_name.toLowerCase().includes(search)
      );
    }

    // Filter by margin quality
    if (marginQualityFilter !== 'all') {
      filtered = filtered.filter((event) => {
        const quality = getMarginQuality(event.recommendation || 'neutral');
        return quality === marginQualityFilter;
      });
    }

    // Filter by date range
    if (dateRangeFilter !== 'all') {
      const now = Date.now();
      const ranges: Record<string, number> = {
        '3mo': 90 * 24 * 60 * 60 * 1000,
        '6mo': 180 * 24 * 60 * 60 * 1000,
        '1yr': 365 * 24 * 60 * 60 * 1000,
      };

      const rangeMs = ranges[dateRangeFilter];
      if (rangeMs) {
        filtered = filtered.filter((event) => {
          if (!event.event_start_date) return false;
          return now - event.event_start_date <= rangeMs;
        });
      }
    }

    return filtered;
  };

  const getMarginQuality = (recommendation: string): MarginQuality => {
    switch (recommendation) {
      case 'participate':
        return 'best';
      case 'neutral':
        return 'good';
      case 'decline':
        return 'gutCheck';
      default:
        return 'good';
    }
  };

  const getMarginQualityBadge = (event: CPGEvent): JSX.Element | null => {
    if (!event.recommendation) return null;

    const quality = getMarginQuality(event.recommendation);
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

  const getStatusLabel = (event: CPGEvent): string => {
    if (event.status === 'completed') {
      return 'Completed';
    }

    // Check if event has ended
    const now = Date.now();
    if (event.event_end_date < now) {
      return "How'd it go?!";
    }

    return 'Upcoming';
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'completed':
        return styles.statusCompleted;
      case 'planned':
        return styles.statusPlanned;
      default:
        return styles.statusPlanned;
    }
  };

  const getStatusBadgeClassForEvent = (event: CPGEvent): string => {
    if (event.status === 'completed') {
      return styles.statusCompleted;
    }

    // Check if event has ended
    const now = Date.now();
    if (event.event_end_date < now) {
      return styles.statusPending;
    }

    return styles.statusUpcoming;
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

  const handleEdit = (eventId: string) => {
    navigate(`/cpg/events-analysis?edit=${eventId}`);
    setActionMenuOpen(null);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }

    try {
      await db.cpgEvents.update(eventId, {
        deleted_at: Date.now(),
      });

      await loadEvents();
      setActionMenuOpen(null);
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Failed to delete event. Please try again.');
    }
  };

  const handleMarkComplete = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    setSelectedEventForComplete(event);
    setCompleteModalOpen(true);
    setActionMenuOpen(null);
  };

  const handleCompleteSubmit = async (
    totalRevenue: string,
    totalProfit: string,
    roi: string,
    variantSold: Record<string, number>,
    variantDamaged: Record<string, number>,
    variantDemo: Record<string, number>
  ) => {
    if (!selectedEventForComplete) return;

    try {
      await db.cpgEvents.update(selectedEventForComplete.id, {
        status: 'completed',
        actual_total_revenue: totalRevenue,
        actual_total_profit: totalProfit,
        actual_roi: roi,
        variant_actual_units_sold: variantSold,
        variant_units_damaged: variantDamaged,
        variant_units_demo: variantDemo,
        updated_at: Date.now(),
      });

      await loadEvents();
      setCompleteModalOpen(false);
      setSelectedEventForComplete(null);
    } catch (error) {
      console.error('Failed to mark event as complete:', error);
      throw error;
    }
  };

  const getTotalUnitsBrought = (event: CPGEvent): number => {
    if (!event.variant_event_data) return 0;
    return Object.values(event.variant_event_data).reduce((total, variant) => {
      return total + parseFloat(variant.units_bringing || '0');
    }, 0);
  };

  const getTotalUnitsSold = (event: CPGEvent): number => {
    if (!event.variant_actual_units_sold) return 0;
    return Object.values(event.variant_actual_units_sold).reduce((total, units) => {
      return total + units;
    }, 0);
  };

  const calculateSellThrough = (event: CPGEvent): number => {
    const totalBrought = getTotalUnitsBrought(event);
    const totalSold = getTotalUnitsSold(event);
    if (totalBrought === 0) return 0;
    return (totalSold / totalBrought) * 100;
  };

  const calculateVariance = (event: CPGEvent): number => {
    if (!event.actual_total_profit || event.status !== 'completed') return 0;
    // Variance is actual profit minus projected (total cost is investment, profit is return)
    const projectedProfit = 0; // For planned events, we don't have a profit projection
    return parseFloat(event.actual_total_profit) - projectedProfit;
  };

  const getSellThroughColor = (percentage: number): string => {
    if (percentage >= 90) return styles.sellThroughExcellent;
    if (percentage >= 70) return styles.sellThroughGood;
    if (percentage >= 50) return styles.sellThroughModerate;
    return styles.sellThroughLow;
  };

  const toggleActionMenu = (eventId: string) => {
    setActionMenuOpen(actionMenuOpen === eventId ? null : eventId);
  };

  const handleExport = async (type: 'summary' | 'detail', format: 'csv' | 'pdf') => {
    try {
      if (type === 'summary' && format === 'csv') {
        eventExportService.exportSummaryCSV(filteredEvents);
      } else if (type === 'summary' && format === 'pdf') {
        eventExportService.exportSummaryPDF(filteredEvents);
      } else if (type === 'detail' && format === 'csv') {
        eventExportService.exportDetailCSV(filteredEvents);
      } else if (type === 'detail' && format === 'pdf') {
        eventExportService.exportDetailPDF(filteredEvents);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const filteredEvents = getFilteredEvents();

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <p>Loading event history...</p>
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
            onChange={(e) => setStatusFilter(e.target.value as EventStatus)}
            className={styles.filterSelect}
          >
            <option value="all">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="pending">How'd it go?!</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="location-filter" className={styles.filterLabel}>
            Location
          </label>
          <select
            id="location-filter"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Locations</option>
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="name-search" className={styles.filterLabel}>
            Event Name
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
          <label htmlFor="date-filter" className={styles.filterLabel}>
            Date Range
          </label>
          <select
            id="date-filter"
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value)}
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
            disabled={filteredEvents.length === 0}
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

      {/* Events Table */}
      <div className={styles.tableContainer}>
        {filteredEvents.length === 0 ? (
          <div className={styles.noData}>
            {events.length === 0
              ? 'No events found. Create your first event using the Decision Tool tab!'
              : 'No events match your filters. Try adjusting your search criteria.'}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Total Cost</th>
                <th>Units Brought</th>
                <th>Units Sold</th>
                <th>Revenue</th>
                <th>Profit</th>
                <th>ROI</th>
                <th>Sell-Through</th>
                <th>Margin Quality</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => {
                const isCompleted = event.status === 'completed';
                const totalBrought = getTotalUnitsBrought(event);
                const totalSold = getTotalUnitsSold(event);
                const sellThrough = isCompleted ? calculateSellThrough(event) : 0;

                return (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.event_name}</strong>
                    </td>
                    <td>{event.location || '—'}</td>
                    <td>
                      <span className={getStatusBadgeClassForEvent(event)}>
                        {getStatusLabel(event)}
                      </span>
                    </td>
                    <td>{event.event_start_date ? formatDate(event.event_start_date) : 'N/A'}</td>
                    <td>{event.event_end_date ? formatDate(event.event_end_date) : 'N/A'}</td>
                    <td>{formatCurrency(event.total_event_cost)}</td>
                    <td>{totalBrought}</td>
                    <td>{isCompleted ? totalSold : '—'}</td>
                    <td>
                      {isCompleted && event.actual_total_revenue
                        ? formatCurrency(event.actual_total_revenue)
                        : '—'}
                    </td>
                    <td>
                      {isCompleted && event.actual_total_profit
                        ? formatCurrency(event.actual_total_profit)
                        : '—'}
                    </td>
                    <td>
                      {isCompleted && event.actual_roi
                        ? `${parseFloat(event.actual_roi).toFixed(1)}%`
                        : '—'}
                    </td>
                    <td>
                      {isCompleted && totalSold > 0 ? (
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
                    <td>{getMarginQualityBadge(event)}</td>
                    <td>
                      <div className={styles.actionCell}>
                        <button
                          className={styles.actionButton}
                          onClick={() => toggleActionMenu(event.id)}
                          aria-label="Open actions menu"
                        >
                          ⋮
                        </button>
                        {actionMenuOpen === event.id && (
                          <div className={styles.actionMenu}>
                            <button
                              className={styles.actionMenuItem}
                              onClick={() => handleEdit(event.id)}
                            >
                              Edit
                            </button>
                            {event.status === 'planned' && (
                              <button
                                className={styles.actionMenuItem}
                                onClick={() => handleMarkComplete(event.id)}
                              >
                                Mark Complete
                              </button>
                            )}
                            <button
                              className={`${styles.actionMenuItem} ${styles.actionMenuItemDanger}`}
                              onClick={() => handleDelete(event.id)}
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
      {selectedEventForComplete && (
        <MarkEventCompleteModal
          isOpen={completeModalOpen}
          onClose={() => {
            setCompleteModalOpen(false);
            setSelectedEventForComplete(null);
          }}
          onSubmit={handleCompleteSubmit}
          eventName={selectedEventForComplete.event_name}
          totalEventCost={selectedEventForComplete.total_event_cost}
          variants={
            selectedEventForComplete.variant_event_data
              ? Object.keys(selectedEventForComplete.variant_event_data).map((variantName) => ({
                  name: variantName,
                  unitsBrought: parseFloat(
                    selectedEventForComplete.variant_event_data![variantName].units_bringing || '0'
                  ),
                  retailPrice: parseFloat(
                    selectedEventForComplete.variant_event_data![variantName].retail_price || '0'
                  ),
                  baseCPU: parseFloat(
                    selectedEventForComplete.variant_event_data![variantName].base_cpu || '0'
                  ),
                }))
              : []
          }
        />
      )}
    </div>
  );
}
