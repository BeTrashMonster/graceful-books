/**
 * Event Analytics Tab
 *
 * Visual analytics for event performance:
 * - Seasonality: Cost and revenue patterns by month with labor indicators
 * - Labor Impact: How paid vs sweat equity affects results
 * - Performance by Location: Visual ranking of venues
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db';
import type { CPGEvent } from '../../../db/schema/cpg.schema';
import { useCPGSettingsContext } from '../../../contexts/CPGSettingsContext';
import styles from './EventAnalyticsTab.module.css';

interface MonthDataPoint {
  month: string;
  monthNum: number;
  year: number;
  events: CPGEvent[];
  totalRevenue: number;
  totalCost: number;
  avgProfit: number;
  avgROI: number;
  hasLabor: boolean;
  hasPaidLabor: boolean;
  locations: string[];
  totalDemoUnits: number;
  totalDamagedUnits: number;
}

interface LaborImpactData {
  withPaidLabor: {
    count: number;
    avgProfit: number;
    avgROI: number;
    totalRevenue: number;
  };
  withSweatEquity: {
    count: number;
    avgProfit: number;
    avgROI: number;
    totalRevenue: number;
  };
  withoutLabor: {
    count: number;
    avgProfit: number;
    avgROI: number;
    totalRevenue: number;
  };
}

interface LocationPerformance {
  name: string;
  eventCount: number;
  avgProfit: number;
  avgROI: number;
  totalRevenue: number;
}

export function EventAnalyticsTab() {
  const { companyId } = useAuth();
  const { formatCurrency } = useCPGSettingsContext();

  const [isLoading, setIsLoading] = useState(true);
  const [allCompletedEvents, setAllCompletedEvents] = useState<CPGEvent[]>([]);

  // Visualization mode
  const [vizMode, setVizMode] = useState<'timeline' | 'heatmap' | 'line'>('timeline');

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [compareYearEnabled, setCompareYearEnabled] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);

  // Computed data
  const [currentYearData, setCurrentYearData] = useState<MonthDataPoint[]>([]);
  const [previousYearData, setPreviousYearData] = useState<MonthDataPoint[]>([]);
  const [laborImpact, setLaborImpact] = useState<LaborImpactData | null>(null);
  const [locationPerformance, setLocationPerformance] = useState<LocationPerformance[]>([]);

  useEffect(() => {
    loadAllEvents();

    const handleDataUpdate = () => {
      loadAllEvents();
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate);
  }, [companyId]);

  useEffect(() => {
    if (allCompletedEvents.length > 0) {
      // Set default date range to last 12 months
      if (!startDate && !endDate) {
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        setStartDate(oneYearAgo.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
      }

      // Extract locations
      const locations = Array.from(
        new Set(allCompletedEvents.map(e => e.location).filter(Boolean))
      ).sort() as string[];
      setAvailableLocations(locations);
    }
  }, [allCompletedEvents]);

  useEffect(() => {
    if (allCompletedEvents.length > 0 && startDate && endDate) {
      calculateAnalytics();
    }
  }, [allCompletedEvents, startDate, endDate, selectedLocation, compareYearEnabled]);

  const loadAllEvents = async () => {
    if (!companyId) return;

    try {
      setIsLoading(true);

      const events = await db.cpgEvents
        .where('company_id')
        .equals(companyId)
        .and((e) => e.status === 'completed' && !e.deleted_at)
        .toArray();

      setAllCompletedEvents(events);
    } catch (error) {
      console.error('Failed to load event analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredEvents = (): CPGEvent[] => {
    let filtered = allCompletedEvents;

    // Filter by location
    if (selectedLocation !== 'all') {
      filtered = filtered.filter(e => e.location === selectedLocation);
    }

    // Filter by date range
    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      filtered = filtered.filter(e => {
        if (!e.event_start_date) return false;
        return e.event_start_date >= start && e.event_start_date <= end;
      });
    }

    return filtered;
  };

  const calculateTotalLabor = (event: CPGEvent): { actual: number; opportunity: number } => {
    if (!event.labor_entries || event.labor_entries.length === 0) {
      return { actual: 0, opportunity: 0 };
    }

    const actual = event.labor_entries
      .filter(entry => entry.cost_type === 'actual')
      .reduce((sum, entry) => sum + (parseFloat(entry.hours) * parseFloat(entry.hourly_rate)), 0);

    const opportunity = event.labor_entries
      .filter(entry => entry.cost_type === 'opportunity')
      .reduce((sum, entry) => sum + (parseFloat(entry.hours) * parseFloat(entry.hourly_rate)), 0);

    return { actual, opportunity };
  };

  const calculateDemoUnits = (event: CPGEvent): number => {
    if (!event.variant_units_demo) return 0;
    return Object.values(event.variant_units_demo).reduce((sum, units) => sum + units, 0);
  };

  const calculateDamagedUnits = (event: CPGEvent): number => {
    if (!event.variant_units_damaged) return 0;
    return Object.values(event.variant_units_damaged).reduce((sum, units) => sum + units, 0);
  };

  const calculateAnalytics = () => {
    const filteredEvents = getFilteredEvents();

    // Group by month
    const monthlyData = new Map<string, MonthDataPoint>();
    const previousYearMonthlyData = new Map<string, MonthDataPoint>();

    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();

    // Calculate year boundaries for comparison
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const previousYearStart = startTimestamp - oneYearMs;
    const previousYearEnd = endTimestamp - oneYearMs;

    // Process all completed events
    allCompletedEvents.forEach((event) => {
      if (!event.event_start_date) return;

      const eventDate = new Date(event.event_start_date);
      const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      const monthNum = eventDate.getMonth();
      const year = eventDate.getFullYear();

      const revenue = parseFloat(event.actual_total_revenue || '0');
      const totalCost = parseFloat(event.total_event_cost);
      const profit = revenue - totalCost;
      const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

      const labor = calculateTotalLabor(event);
      const hasLabor = labor.actual > 0 || labor.opportunity > 0;
      const hasPaidLabor = labor.actual > 0;
      const demoUnits = calculateDemoUnits(event);
      const damagedUnits = calculateDamagedUnits(event);

      // Determine if this event is in current year range or previous year range
      const isInCurrentRange = event.event_start_date >= startTimestamp && event.event_start_date <= endTimestamp;
      const isInPreviousRange = compareYearEnabled && event.event_start_date >= previousYearStart && event.event_start_date <= previousYearEnd;

      // Add to appropriate year data
      if (isInCurrentRange && selectedLocation === 'all' || event.location === selectedLocation) {
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, {
            month: eventDate.toLocaleDateString('en-US', { month: 'short' }),
            monthNum,
            year,
            events: [],
            totalRevenue: 0,
            totalCost: 0,
            avgProfit: 0,
            avgROI: 0,
            hasLabor: false,
            hasPaidLabor: false,
            locations: [],
            totalDemoUnits: 0,
            totalDamagedUnits: 0,
          });
        }

        const monthData = monthlyData.get(monthKey)!;
        monthData.events.push(event);
        monthData.totalRevenue += revenue;
        monthData.totalCost += totalCost;
        monthData.totalDemoUnits += demoUnits;
        monthData.totalDamagedUnits += damagedUnits;
        if (hasLabor) monthData.hasLabor = true;
        if (hasPaidLabor) monthData.hasPaidLabor = true;
        if (event.location && !monthData.locations.includes(event.location)) {
          monthData.locations.push(event.location);
        }
      }

      if (isInPreviousRange && selectedLocation === 'all' || event.location === selectedLocation) {
        const prevDate = new Date(event.event_start_date + oneYearMs);
        const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        const prevMonthNum = prevDate.getMonth();
        const prevYear = prevDate.getFullYear();

        if (!previousYearMonthlyData.has(prevMonthKey)) {
          previousYearMonthlyData.set(prevMonthKey, {
            month: prevDate.toLocaleDateString('en-US', { month: 'short' }),
            monthNum: prevMonthNum,
            year: prevYear,
            events: [],
            totalRevenue: 0,
            totalCost: 0,
            avgProfit: 0,
            avgROI: 0,
            hasLabor: false,
            hasPaidLabor: false,
            locations: [],
            totalDemoUnits: 0,
            totalDamagedUnits: 0,
          });
        }

        const monthData = previousYearMonthlyData.get(prevMonthKey)!;
        monthData.events.push(event);
        monthData.totalRevenue += revenue;
        monthData.totalCost += totalCost;
        monthData.totalDemoUnits += demoUnits;
        monthData.totalDamagedUnits += damagedUnits;
        if (hasLabor) monthData.hasLabor = true;
        if (hasPaidLabor) monthData.hasPaidLabor = true;
      }
    });

    // Calculate averages
    monthlyData.forEach(monthData => {
      if (monthData.events.length > 0) {
        const totalProfit = monthData.events.reduce((sum, e) => {
          const revenue = parseFloat(e.actual_total_revenue || '0');
          const cost = parseFloat(e.total_event_cost);
          return sum + (revenue - cost);
        }, 0);
        const totalROI = monthData.events.reduce((sum, e) => {
          const revenue = parseFloat(e.actual_total_revenue || '0');
          const cost = parseFloat(e.total_event_cost);
          return sum + (cost > 0 ? ((revenue - cost) / cost) * 100 : 0);
        }, 0);
        monthData.avgProfit = totalProfit / monthData.events.length;
        monthData.avgROI = totalROI / monthData.events.length;
      }
    });

    previousYearMonthlyData.forEach(monthData => {
      if (monthData.events.length > 0) {
        const totalProfit = monthData.events.reduce((sum, e) => {
          const revenue = parseFloat(e.actual_total_revenue || '0');
          const cost = parseFloat(e.total_event_cost);
          return sum + (revenue - cost);
        }, 0);
        const totalROI = monthData.events.reduce((sum, e) => {
          const revenue = parseFloat(e.actual_total_revenue || '0');
          const cost = parseFloat(e.total_event_cost);
          return sum + (cost > 0 ? ((revenue - cost) / cost) * 100 : 0);
        }, 0);
        monthData.avgProfit = totalProfit / monthData.events.length;
        monthData.avgROI = totalROI / monthData.events.length;
      }
    });

    // Convert to sorted arrays
    const currentData = Array.from(monthlyData.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthNum - b.monthNum;
    });

    const previousData = Array.from(previousYearMonthlyData.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthNum - b.monthNum;
    });

    setCurrentYearData(currentData);
    setPreviousYearData(previousData);

    // Calculate labor impact
    const withPaidLabor: CPGEvent[] = [];
    const withSweatEquity: CPGEvent[] = [];
    const withoutLabor: CPGEvent[] = [];

    filteredEvents.forEach(event => {
      const labor = calculateTotalLabor(event);
      if (labor.actual > 0) {
        withPaidLabor.push(event);
      } else if (labor.opportunity > 0) {
        withSweatEquity.push(event);
      } else {
        withoutLabor.push(event);
      }
    });

    const calcAvg = (events: CPGEvent[], key: 'profit' | 'roi' | 'revenue') => {
      if (events.length === 0) return 0;
      const sum = events.reduce((total, e) => {
        const revenue = parseFloat(e.actual_total_revenue || '0');
        const cost = parseFloat(e.total_event_cost);
        if (key === 'profit') return total + (revenue - cost);
        if (key === 'roi') return total + (cost > 0 ? ((revenue - cost) / cost) * 100 : 0);
        return total + revenue;
      }, 0);
      return sum / events.length;
    };

    setLaborImpact({
      withPaidLabor: {
        count: withPaidLabor.length,
        avgProfit: calcAvg(withPaidLabor, 'profit'),
        avgROI: calcAvg(withPaidLabor, 'roi'),
        totalRevenue: withPaidLabor.reduce((sum, e) => sum + parseFloat(e.actual_total_revenue || '0'), 0),
      },
      withSweatEquity: {
        count: withSweatEquity.length,
        avgProfit: calcAvg(withSweatEquity, 'profit'),
        avgROI: calcAvg(withSweatEquity, 'roi'),
        totalRevenue: withSweatEquity.reduce((sum, e) => sum + parseFloat(e.actual_total_revenue || '0'), 0),
      },
      withoutLabor: {
        count: withoutLabor.length,
        avgProfit: calcAvg(withoutLabor, 'profit'),
        avgROI: calcAvg(withoutLabor, 'roi'),
        totalRevenue: withoutLabor.reduce((sum, e) => sum + parseFloat(e.actual_total_revenue || '0'), 0),
      },
    });

    // Calculate location performance
    const locationMap = new Map<string, {
      events: CPGEvent[];
      totalRevenue: number;
    }>();

    filteredEvents.forEach(event => {
      if (!event.location) return;

      if (!locationMap.has(event.location)) {
        locationMap.set(event.location, { events: [], totalRevenue: 0 });
      }

      const locationData = locationMap.get(event.location)!;
      locationData.events.push(event);
      locationData.totalRevenue += parseFloat(event.actual_total_revenue || '0');
    });

    const locationPerf = Array.from(locationMap.entries()).map(([name, data]) => ({
      name,
      eventCount: data.events.length,
      avgProfit: calcAvg(data.events, 'profit'),
      avgROI: calcAvg(data.events, 'roi'),
      totalRevenue: data.totalRevenue,
    })).sort((a, b) => b.avgProfit - a.avgProfit);

    setLocationPerformance(locationPerf);
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading event analytics...</p>
      </div>
    );
  }

  if (allCompletedEvents.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2>No Completed Events Yet</h2>
        <p>Complete some events to see analytics about your performance over time.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="start-date">Start Date</label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={styles.filterInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="end-date">End Date</label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={styles.filterInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="location-filter">Location</label>
          <select
            id="location-filter"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className={styles.filterInput}
          >
            <option value="all">All Locations</option>
            {availableLocations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="compare-year">
            <input
              id="compare-year"
              type="checkbox"
              checked={compareYearEnabled}
              onChange={(e) => setCompareYearEnabled(e.target.checked)}
              className={styles.checkbox}
            />
            Compare with Previous Year
          </label>
        </div>
      </div>

      {/* Revenue Patterns Section */}
      <div className={styles.section}>
        <h2>Revenue Patterns from Events</h2>
        <p className={styles.sectionDescription}>
          Visualize when events generate the most revenue and identify seasonal trends.
        </p>

        {/* Visualization Mode Selector */}
        <div className={styles.vizModeSelector}>
          <button
            className={vizMode === 'timeline' ? styles.vizModeActive : styles.vizMode}
            onClick={() => setVizMode('timeline')}
          >
            Timeline Bars
          </button>
          <button
            className={vizMode === 'heatmap' ? styles.vizModeActive : styles.vizMode}
            onClick={() => setVizMode('heatmap')}
          >
            Heat Map Calendar
          </button>
          <button
            className={vizMode === 'line' ? styles.vizModeActive : styles.vizMode}
            onClick={() => setVizMode('line')}
          >
            Line Graph
          </button>
        </div>

        {/* Timeline Visualization */}
        {vizMode === 'timeline' && (
          <div className={styles.timelineContainer}>
            {currentYearData.map((monthData) => {
              const maxRevenue = Math.max(...currentYearData.map(m => m.totalRevenue), 1);
              const widthPercentage = (monthData.totalRevenue / maxRevenue) * 100;

              // Find corresponding previous year data
              const prevMonthData = previousYearData.find(
                m => m.monthNum === monthData.monthNum
              );
              const prevWidthPercentage = prevMonthData
                ? (prevMonthData.totalRevenue / maxRevenue) * 100
                : 0;

              return (
                <div key={`${monthData.year}-${monthData.monthNum}`} className={styles.timelineRow}>
                  <div className={styles.timelineMonth}>
                    {monthData.month} {monthData.year}
                  </div>
                  <div className={styles.timelineBars}>
                    {/* Current Year Bar */}
                    <div className={styles.timelineBarWrapper}>
                      {compareYearEnabled && prevMonthData && (
                        <div
                          className={styles.timelineBarPrev}
                          style={{ width: `${prevWidthPercentage}%` }}
                        />
                      )}
                      <div
                        className={`${styles.timelineBar} ${monthData.hasPaidLabor ? styles.withPaidLabor : ''}`}
                        style={{ width: `${widthPercentage}%` }}
                      >
                        <span className={styles.timelineValue}>
                          {formatCurrency(monthData.totalRevenue)}
                          {monthData.hasPaidLabor && <span className={styles.laborTag}>$</span>}
                          {monthData.hasLabor && !monthData.hasPaidLabor && <span className={styles.sweatTag}>⚡</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Heat Map Calendar Visualization */}
        {vizMode === 'heatmap' && (
          <div className={styles.heatmapContainer}>
            <div className={styles.calendarsWrapper}>
              {(() => {
                // Calculate overall max revenue across ALL months for consistent color scaling
                const allEventRevenues: number[] = [];
                currentYearData.forEach(monthData => {
                  monthData.events.forEach(event => {
                    if (event.event_start_date && event.actual_total_revenue) {
                      allEventRevenues.push(parseFloat(event.actual_total_revenue));
                    }
                  });
                });
                const overallMaxRevenue = Math.max(...allEventRevenues, 1);

                // Get unique months from current year data
                const uniqueMonths = currentYearData.map(m => ({ monthNum: m.monthNum, year: m.year }));

                return uniqueMonths.map(({ monthNum, year }) => {
                  const monthData = currentYearData.find(m => m.monthNum === monthNum && m.year === year);
                  if (!monthData) return null;

                  const firstDay = new Date(year, monthNum, 1);
                  const lastDay = new Date(year, monthNum + 1, 0);
                  const daysInMonth = lastDay.getDate();
                  const startingDayOfWeek = firstDay.getDay();

                  // Map events to their dates (mark entire event period)
                  const eventsByDate: Record<number, { revenue: number; hasPaidLabor: boolean; hasSweatEquity: boolean }> = {};
                  monthData.events.forEach(event => {
                    if (event.event_start_date && event.event_end_date) {
                      const startDate = new Date(event.event_start_date);
                      const endDate = new Date(event.event_end_date);
                      const revenue = parseFloat(event.actual_total_revenue || '0');
                      const labor = calculateTotalLabor(event);
                      const hasPaidLabor = labor.actual > 0;
                      const hasSweatEquity = labor.opportunity > 0;

                      // Get all days in this month that fall within the event period
                      const eventStartDay = startDate.getMonth() === monthNum && startDate.getFullYear() === year ? startDate.getDate() : 1;
                      const eventEndDay = endDate.getMonth() === monthNum && endDate.getFullYear() === year ? endDate.getDate() : daysInMonth;

                      // Mark all days in the event period
                      for (let day = eventStartDay; day <= eventEndDay; day++) {
                        if (!eventsByDate[day]) {
                          eventsByDate[day] = { revenue: 0, hasPaidLabor: false, hasSweatEquity: false };
                        }
                        // Use FULL event revenue for each day (don't divide)
                        eventsByDate[day].revenue += revenue;
                        if (hasPaidLabor) eventsByDate[day].hasPaidLabor = true;
                        if (hasSweatEquity) eventsByDate[day].hasSweatEquity = true;
                      }
                    }
                  });

                  // Render calendar
                  const calendarDays = [];

                  // Add empty cells for days before the month starts
                  for (let i = 0; i < startingDayOfWeek; i++) {
                    calendarDays.push(<div key={`empty-${i}`} className={styles.calendarDayEmpty} />);
                  }

                  // Add actual days
                  for (let day = 1; day <= daysInMonth; day++) {
                    const eventData = eventsByDate[day];
                    const hasEvent = !!eventData;

                    let bgColor = '#f5f5f5';
                    if (hasEvent) {
                      const intensity = eventData.revenue / overallMaxRevenue;
                      if (intensity >= 0.8) bgColor = '#B8941F';
                      else if (intensity >= 0.6) bgColor = '#D4AF37';
                      else if (intensity >= 0.4) bgColor = '#f3d97a';
                      else if (intensity >= 0.2) bgColor = '#fde68a';
                      else bgColor = '#fef3c7';
                    }

                    calendarDays.push(
                      <div
                        key={day}
                        className={`${styles.calendarDayCell} ${hasEvent ? styles.hasEvent : ''}`}
                        style={{ backgroundColor: bgColor }}
                      >
                        <span className={styles.calendarDayNumber}>{day}</span>
                        {hasEvent && eventData.hasPaidLabor && (
                          <span className={styles.calendarDayIcon}>$</span>
                        )}
                        {hasEvent && eventData.hasSweatEquity && !eventData.hasPaidLabor && (
                          <span className={styles.calendarDayIcon}>⚡</span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={`${year}-${monthNum}`} className={styles.monthCalendar}>
                      <div className={styles.monthCalendarHeader}>
                        {monthData.month} {year}
                      </div>
                      <div className={styles.calendarWeekdays}>
                        <div>Sun</div>
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                      </div>
                      <div className={styles.calendarDaysGrid}>
                        {calendarDays}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className={styles.heatmapLegend}>
              <span>Less Revenue</span>
              <div className={styles.heatmapGradient} />
              <span>More Revenue</span>
              <span style={{ marginLeft: '2rem' }}><span style={{ color: '#22c55e', fontWeight: 700 }}>$</span> = Paid Labor</span>
              <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>⚡</span> = Sweat Equity</span>
            </div>
          </div>
        )}

        {/* Line Graph Visualization */}
        {vizMode === 'line' && currentYearData.length > 0 && (
          <div className={styles.lineGraphContainer}>
            <div className={styles.lineGraphArea}>
              <svg className={styles.lineGraphSvg} viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
                {/* Grid lines */}
                <line x1="50" y1="350" x2="750" y2="350" stroke="#e0e0e0" strokeWidth="2" />
                <line x1="50" y1="50" x2="50" y2="350" stroke="#e0e0e0" strokeWidth="2" />

                {/* Data lines */}
                {(() => {
                  const maxRevenue = Math.max(...currentYearData.map(m => m.totalRevenue), 1);
                  const xStep = 700 / (currentYearData.length - 1 || 1);

                  const currentPath = currentYearData.map((m, i) => {
                    const x = 50 + i * xStep;
                    const y = 350 - (m.totalRevenue / maxRevenue) * 300;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');

                  const previousPath = compareYearEnabled && previousYearData.length > 0
                    ? previousYearData.map((m, i) => {
                        const x = 50 + i * xStep;
                        const y = 350 - (m.totalRevenue / maxRevenue) * 300;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')
                    : null;

                  return (
                    <>
                      {/* Previous year line */}
                      {previousPath && (
                        <path
                          d={previousPath}
                          fill="none"
                          stroke="#9333ea"
                          strokeWidth="3"
                          opacity="0.4"
                          strokeDasharray="5,5"
                        />
                      )}

                      {/* Current year line */}
                      <path
                        d={currentPath}
                        fill="none"
                        stroke="#D4AF37"
                        strokeWidth="3"
                      />

                      {/* Current year points */}
                      {currentYearData.map((m, i) => {
                        const x = 50 + i * xStep;
                        const y = 350 - (m.totalRevenue / maxRevenue) * 300;
                        return (
                          <g key={i}>
                            <circle
                              cx={x}
                              cy={y}
                              r="6"
                              fill={m.hasPaidLabor ? '#22c55e' : m.hasLabor ? '#f59e0b' : '#D4AF37'}
                              stroke="white"
                              strokeWidth="2"
                            />
                            <text x={x} y={370} textAnchor="middle" fontSize="12" fill="#666">
                              {m.month}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>

            <div className={styles.lineGraphLegend}>
              <div className={styles.legendItem}>
                <div className={styles.lineLegendDot} style={{ backgroundColor: '#D4AF37' }} />
                <span>Current Year</span>
              </div>
              {compareYearEnabled && (
                <div className={styles.legendItem}>
                  <div className={styles.lineLegendLine} />
                  <span>Previous Year</span>
                </div>
              )}
              <div className={styles.legendItem}>
                <div className={styles.lineLegendDot} style={{ backgroundColor: '#22c55e' }} />
                <span>Paid Labor</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.lineLegendDot} style={{ backgroundColor: '#f59e0b' }} />
                <span>Sweat Equity</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Labor Impact Section */}
      {laborImpact && (
        <div className={styles.section}>
          <h2>Labor Impact Comparison</h2>
          <p className={styles.sectionDescription}>
            Compare how paid labor vs sweat equity affects your event profitability.
          </p>

          <div className={styles.comparisonContainer}>
            <div className={styles.comparisonCard}>
              <h3>With Paid Labor</h3>
              <div className={styles.statGrid}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Events</span>
                  <span className={styles.statValue}>{laborImpact.withPaidLabor.count}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Avg Profit</span>
                  <span className={styles.statValue}>{formatCurrency(laborImpact.withPaidLabor.avgProfit)}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Avg ROI</span>
                  <span className={styles.statValue}>{laborImpact.withPaidLabor.avgROI.toFixed(1)}%</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Total Revenue</span>
                  <span className={styles.statValue}>{formatCurrency(laborImpact.withPaidLabor.totalRevenue)}</span>
                </div>
              </div>
            </div>

            <div className={styles.comparisonCard}>
              <h3>With Sweat Equity</h3>
              <div className={styles.statGrid}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Events</span>
                  <span className={styles.statValue}>{laborImpact.withSweatEquity.count}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Avg Profit</span>
                  <span className={styles.statValue}>{formatCurrency(laborImpact.withSweatEquity.avgProfit)}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Avg ROI</span>
                  <span className={styles.statValue}>{laborImpact.withSweatEquity.avgROI.toFixed(1)}%</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Total Revenue</span>
                  <span className={styles.statValue}>{formatCurrency(laborImpact.withSweatEquity.totalRevenue)}</span>
                </div>
              </div>
            </div>
          </div>

          {laborImpact.withPaidLabor.count > 0 && laborImpact.withSweatEquity.count > 0 && (
            <div className={styles.impactSummary}>
              Events with <strong>paid labor</strong> show{' '}
              {laborImpact.withPaidLabor.avgROI > laborImpact.withSweatEquity.avgROI ? 'higher' : 'lower'} average ROI
              ({laborImpact.withPaidLabor.avgROI.toFixed(1)}% vs {laborImpact.withSweatEquity.avgROI.toFixed(1)}%).
            </div>
          )}
        </div>
      )}

      {/* Demo and Damaged Units Section */}
      {currentYearData.length > 0 && (
        <div className={styles.section}>
          <h2>Demo & Damaged Units Tracking</h2>
          <p className={styles.sectionDescription}>
            Track units used for demos and damaged units across all your events.
          </p>

          <div className={styles.comparisonContainer}>
            <div className={styles.comparisonCard}>
              <h3>Demo Units</h3>
              <div className={styles.statGrid}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Total Demo Units</span>
                  <span className={styles.statValue}>
                    {currentYearData.reduce((sum, m) => sum + m.totalDemoUnits, 0)}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Events with Demos</span>
                  <span className={styles.statValue}>
                    {currentYearData.reduce((sum, m) => {
                      return sum + m.events.filter(e => calculateDemoUnits(e) > 0).length;
                    }, 0)}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Avg per Event</span>
                  <span className={styles.statValue}>
                    {(() => {
                      const totalDemos = currentYearData.reduce((sum, m) => sum + m.totalDemoUnits, 0);
                      const eventsWithDemos = currentYearData.reduce((sum, m) => {
                        return sum + m.events.filter(e => calculateDemoUnits(e) > 0).length;
                      }, 0);
                      return eventsWithDemos > 0 ? (totalDemos / eventsWithDemos).toFixed(1) : '0';
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.comparisonCard}>
              <h3>Damaged Units</h3>
              <div className={styles.statGrid}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Total Damaged Units</span>
                  <span className={styles.statValue}>
                    {currentYearData.reduce((sum, m) => sum + m.totalDamagedUnits, 0)}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Events with Damage</span>
                  <span className={styles.statValue}>
                    {currentYearData.reduce((sum, m) => {
                      return sum + m.events.filter(e => calculateDamagedUnits(e) > 0).length;
                    }, 0)}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Avg per Event</span>
                  <span className={styles.statValue}>
                    {(() => {
                      const totalDamaged = currentYearData.reduce((sum, m) => sum + m.totalDamagedUnits, 0);
                      const eventsWithDamage = currentYearData.reduce((sum, m) => {
                        return sum + m.events.filter(e => calculateDamagedUnits(e) > 0).length;
                      }, 0);
                      return eventsWithDamage > 0 ? (totalDamaged / eventsWithDamage).toFixed(1) : '0';
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {(() => {
            const totalDemos = currentYearData.reduce((sum, m) => sum + m.totalDemoUnits, 0);
            const totalDamaged = currentYearData.reduce((sum, m) => sum + m.totalDamagedUnits, 0);
            const totalUnits = totalDemos + totalDamaged;
            if (totalUnits > 0) {
              return (
                <div className={styles.impactSummary}>
                  Out of {totalUnits} non-sale units, <strong>{totalDemos}</strong> were used for demos
                  ({((totalDemos / totalUnits) * 100).toFixed(1)}%) and <strong>{totalDamaged}</strong> were damaged
                  ({((totalDamaged / totalUnits) * 100).toFixed(1)}%).
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Location Performance Section */}
      {locationPerformance.length > 0 && (
        <div className={styles.section}>
          <h2>Top Performing Locations</h2>
          <p className={styles.sectionDescription}>
            See which venues deliver the best results for your events.
          </p>

          <div className={styles.performanceChart}>
            {locationPerformance.slice(0, 10).map((location, index) => {
              const maxProfit = Math.max(...locationPerformance.map(l => l.avgProfit), 1);
              const profitWidth = (location.avgProfit / maxProfit) * 100;
              const maxROI = Math.max(...locationPerformance.map(l => l.avgROI), 1);
              const roiWidth = (location.avgROI / maxROI) * 100;

              return (
                <div key={location.name} className={styles.performanceBar}>
                  <div className={styles.performanceRank}>{index + 1}</div>
                  <div className={styles.performanceName}>
                    <strong>{location.name}</strong>
                    <span className={styles.performanceSubtext}>{location.eventCount} events</span>
                  </div>
                  <div className={styles.performanceMetrics}>
                    <div className={styles.metricBar}>
                      <span className={styles.metricLabel}>Avg Profit:</span>
                      <div className={styles.metricBarContainer}>
                        <div
                          className={styles.metricBarFill}
                          style={{
                            width: `${profitWidth}%`,
                            background: 'linear-gradient(90deg, #D4AF37 0%, #B8941F 100%)',
                          }}
                        />
                        <span className={styles.metricValue}>{formatCurrency(location.avgProfit)}</span>
                      </div>
                    </div>
                    <div className={styles.metricBar}>
                      <span className={styles.metricLabel}>Avg ROI:</span>
                      <div className={styles.metricBarContainer}>
                        <div
                          className={styles.metricBarFill}
                          style={{
                            width: `${roiWidth}%`,
                            background: 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)',
                          }}
                        />
                        <span className={styles.metricValue}>{location.avgROI.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
