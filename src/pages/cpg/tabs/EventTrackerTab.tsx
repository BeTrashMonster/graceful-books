/**
 * Event Tracker Tab
 *
 * View and track historical event performance
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db';
import type { CPGEvent } from '../../../db/schema/cpg.schema';
import styles from './EventTrackerTab.module.css';

export function EventTrackerTab() {
  const { companyId } = useAuth();

  const [events, setEvents] = useState<CPGEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'completed'>('all');
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    loadEvents();
  }, [companyId]);

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

      // Extract unique locations
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

    if (locationFilter !== 'all') {
      filtered = filtered.filter((event) => event.location === locationFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((event) => event.status === statusFilter);
    }

    return filtered;
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

  const filteredEvents = getFilteredEvents();

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading events...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Location</label>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className={styles.select}
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
          <label>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={styles.select}
          >
            <option value="all">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
          </select>
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
                <th>Date</th>
                <th>Status</th>
                <th>Total Cost</th>
                <th>Revenue</th>
                <th>Profit</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.id}>
                  <td><strong>{event.event_name}</strong></td>
                  <td>{event.location}</td>
                  <td>
                    {formatDate(event.event_start_date)}
                    {event.event_start_date !== event.event_end_date && (
                      <> - {formatDate(event.event_end_date)}</>
                    )}
                  </td>
                  <td>
                    <span className={event.status === 'completed' ? styles.statusCompleted : styles.statusPlanned}>
                      {event.status}
                    </span>
                  </td>
                  <td>{formatCurrency(event.total_event_cost)}</td>
                  <td>
                    {event.actual_total_revenue
                      ? formatCurrency(event.actual_total_revenue)
                      : '—'}
                  </td>
                  <td>
                    {event.actual_total_profit
                      ? formatCurrency(event.actual_total_profit)
                      : '—'}
                  </td>
                  <td>
                    {event.actual_roi
                      ? `${parseFloat(event.actual_roi).toFixed(1)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
