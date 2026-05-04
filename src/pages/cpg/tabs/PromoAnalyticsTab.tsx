/**
 * Promo Analytics Tab
 *
 * Visual analytics for promo performance:
 * - Seasonality: Revenue patterns by month with demo indicators
 * - Demo Impact: How demos affect results
 * - Performance by Person: Visual ranking of demo performers
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db';
import type { CPGSalesPromo } from '../../../db/schema/cpg.schema';
import { useCPGSettingsContext } from '../../../contexts/CPGSettingsContext';
import styles from './PromoAnalyticsTab.module.css';

interface MonthDataPoint {
  month: string;
  monthNum: number;
  year: number;
  promos: CPGSalesPromo[];
  totalRevenue: number;
  avgSellThrough: number;
  avgMargin: number;
  hasDemo: boolean;
  retailers: string[];
}

interface DemoImpactData {
  withDemo: {
    count: number;
    avgSellThrough: number;
    avgMargin: number;
    totalRevenue: number;
  };
  withoutDemo: {
    count: number;
    avgSellThrough: number;
    avgMargin: number;
    totalRevenue: number;
  };
}

interface PersonPerformance {
  name: string;
  promoCount: number;
  totalHours: number;
  avgSellThrough: number;
  avgMargin: number;
  totalRevenue: number;
}

export function PromoAnalyticsTab() {
  const { companyId } = useAuth();
  const { formatCurrency } = useCPGSettingsContext();

  const [isLoading, setIsLoading] = useState(true);
  const [allCompletedPromos, setAllCompletedPromos] = useState<CPGSalesPromo[]>([]);

  // Visualization mode
  const [vizMode, setVizMode] = useState<'timeline' | 'heatmap' | 'line'>('timeline');

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [compareYearEnabled, setCompareYearEnabled] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState<string>('all');
  const [availableRetailers, setAvailableRetailers] = useState<string[]>([]);

  // Computed data
  const [currentYearData, setCurrentYearData] = useState<MonthDataPoint[]>([]);
  const [previousYearData, setPreviousYearData] = useState<MonthDataPoint[]>([]);
  const [demoImpact, setDemoImpact] = useState<DemoImpactData | null>(null);
  const [personPerformance, setPersonPerformance] = useState<PersonPerformance[]>([]);

  useEffect(() => {
    loadAllPromos();

    const handleDataUpdate = () => {
      loadAllPromos();
    };

    window.addEventListener('cpg-data-updated', handleDataUpdate);
    return () => window.removeEventListener('cpg-data-updated', handleDataUpdate);
  }, [companyId]);

  useEffect(() => {
    if (allCompletedPromos.length > 0) {
      // Set default date range to last 12 months
      if (!startDate && !endDate) {
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        setStartDate(oneYearAgo.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
      }

      // Extract retailers
      const retailers = Array.from(
        new Set(allCompletedPromos.map(p => p.retailer_name).filter(Boolean))
      ).sort() as string[];
      setAvailableRetailers(retailers);
    }
  }, [allCompletedPromos]);

  useEffect(() => {
    if (allCompletedPromos.length > 0 && startDate && endDate) {
      calculateAnalytics();
    }
  }, [allCompletedPromos, startDate, endDate, selectedRetailer, compareYearEnabled]);

  const loadAllPromos = async () => {
    if (!companyId) return;

    try {
      setIsLoading(true);

      const promos = await db.cpgSalesPromos
        .where('company_id')
        .equals(companyId)
        .and((p) => p.status === 'completed' && !p.deleted_at)
        .toArray();

      setAllCompletedPromos(promos);
    } catch (error) {
      console.error('Failed to load promo analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredPromos = (): CPGSalesPromo[] => {
    let filtered = allCompletedPromos;

    // Filter by retailer
    if (selectedRetailer !== 'all') {
      filtered = filtered.filter(p => p.retailer_name === selectedRetailer);
    }

    // Filter by date range
    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      filtered = filtered.filter(p => {
        if (!p.promo_start_date) return false;
        return p.promo_start_date >= start && p.promo_start_date <= end;
      });
    }

    return filtered;
  };

  const calculateAnalytics = () => {
    const filteredPromos = getFilteredPromos();

    // Calculate seasonality data
    const monthData: Record<string, MonthDataPoint> = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    filteredPromos.forEach(promo => {
      if (!promo.promo_start_date) return;

      const date = new Date(promo.promo_start_date);
      const monthNum = date.getMonth();
      const year = date.getFullYear();
      const key = `${year}-${monthNum}`;

      if (!monthData[key]) {
        monthData[key] = {
          month: monthNames[monthNum],
          monthNum,
          year,
          promos: [],
          totalRevenue: 0,
          avgSellThrough: 0,
          avgMargin: 0,
          hasDemo: false,
          retailers: [],
        };
      }

      monthData[key].promos.push(promo);
      monthData[key].totalRevenue += parseFloat(promo.actual_payback || '0');

      if (promo.demo_hours_entries && promo.demo_hours_entries.length > 0) {
        monthData[key].hasDemo = true;
      }

      if (promo.retailer_name && !monthData[key].retailers.includes(promo.retailer_name)) {
        monthData[key].retailers.push(promo.retailer_name);
      }
    });

    // Calculate averages
    Object.values(monthData).forEach(data => {
      const count = data.promos.length;
      data.avgSellThrough = data.promos.reduce((sum, p) => sum + calculateSellThrough(p), 0) / count;
      data.avgMargin = data.promos.reduce((sum, p) => sum + calculateMargin(p), 0) / count;
    });

    // Sort by month
    const sortedData = Object.values(monthData).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthNum - b.monthNum;
    });

    setCurrentYearData(sortedData);

    // If year-over-year comparison enabled, calculate previous year
    if (compareYearEnabled && startDate && endDate) {
      const prevStart = new Date(startDate);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      const prevEnd = new Date(endDate);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);

      const prevYearPromos = allCompletedPromos.filter(p => {
        if (!p.promo_start_date) return false;
        if (selectedRetailer !== 'all' && p.retailer_name !== selectedRetailer) return false;
        return p.promo_start_date >= prevStart.getTime() && p.promo_start_date <= prevEnd.getTime();
      });

      const prevMonthData: Record<string, MonthDataPoint> = {};
      prevYearPromos.forEach(promo => {
        if (!promo.promo_start_date) return;

        const date = new Date(promo.promo_start_date);
        const monthNum = date.getMonth();
        const year = date.getFullYear();
        const key = `${year}-${monthNum}`;

        if (!prevMonthData[key]) {
          prevMonthData[key] = {
            month: monthNames[monthNum],
            monthNum,
            year,
            promos: [],
            totalRevenue: 0,
            avgSellThrough: 0,
            avgMargin: 0,
            hasDemo: false,
            retailers: [],
          };
        }

        prevMonthData[key].promos.push(promo);
        prevMonthData[key].totalRevenue += parseFloat(promo.actual_payback || '0');

        if (promo.demo_hours_entries && promo.demo_hours_entries.length > 0) {
          prevMonthData[key].hasDemo = true;
        }

        if (promo.retailer_name && !prevMonthData[key].retailers.includes(promo.retailer_name)) {
          prevMonthData[key].retailers.push(promo.retailer_name);
        }
      });

      Object.values(prevMonthData).forEach(data => {
        const count = data.promos.length;
        data.avgSellThrough = data.promos.reduce((sum, p) => sum + calculateSellThrough(p), 0) / count;
        data.avgMargin = data.promos.reduce((sum, p) => sum + calculateMargin(p), 0) / count;
      });

      setPreviousYearData(Object.values(prevMonthData).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.monthNum - b.monthNum;
      }));
    }

    // Calculate demo impact
    calculateDemoImpact(filteredPromos);

    // Calculate person performance
    calculatePersonPerformance(filteredPromos);
  };

  const calculateDemoImpact = (promos: CPGSalesPromo[]) => {
    const withDemo: CPGSalesPromo[] = [];
    const withoutDemo: CPGSalesPromo[] = [];

    promos.forEach((promo) => {
      const hasDemo = promo.demo_hours_entries && promo.demo_hours_entries.length > 0;
      if (hasDemo) {
        withDemo.push(promo);
      } else {
        withoutDemo.push(promo);
      }
    });

    const calculateStats = (promoList: CPGSalesPromo[]) => ({
      count: promoList.length,
      avgSellThrough: promoList.reduce((sum, p) => sum + calculateSellThrough(p), 0) / (promoList.length || 1),
      avgMargin: promoList.reduce((sum, p) => sum + calculateMargin(p), 0) / (promoList.length || 1),
      totalRevenue: promoList.reduce((sum, p) => sum + parseFloat(p.actual_payback || '0'), 0),
    });

    setDemoImpact({
      withDemo: calculateStats(withDemo),
      withoutDemo: calculateStats(withoutDemo),
    });
  };

  const calculatePersonPerformance = (promos: CPGSalesPromo[]) => {
    const personMap: Record<string, {
      promos: CPGSalesPromo[];
      totalHours: number;
    }> = {};

    promos.forEach((promo) => {
      if (!promo.demo_hours_entries) return;

      promo.demo_hours_entries.forEach((entry) => {
        if (!personMap[entry.role_name]) {
          personMap[entry.role_name] = {
            promos: [],
            totalHours: 0,
          };
        }

        if (!personMap[entry.role_name].promos.find(p => p.id === promo.id)) {
          personMap[entry.role_name].promos.push(promo);
        }

        personMap[entry.role_name].totalHours += parseFloat(entry.hours || '0');
      });
    });

    const result = Object.entries(personMap).map(([name, data]) => ({
      name,
      promoCount: data.promos.length,
      totalHours: data.totalHours,
      avgSellThrough: data.promos.reduce((sum, p) => sum + calculateSellThrough(p), 0) / (data.promos.length || 1),
      avgMargin: data.promos.reduce((sum, p) => sum + calculateMargin(p), 0) / (data.promos.length || 1),
      totalRevenue: data.promos.reduce((sum, p) => sum + parseFloat(p.actual_payback || '0'), 0),
    }));

    // Sort by total revenue
    result.sort((a, b) => b.totalRevenue - a.totalRevenue);

    setPersonPerformance(result);
  };

  const calculateSellThrough = (promo: CPGSalesPromo): number => {
    if (!promo.actual_units_sold || !promo.variant_promo_data) return 0;

    const totalUnits = Object.values(promo.variant_promo_data).reduce((total, variant) => {
      return total + parseFloat(variant.units_available || '0');
    }, 0);

    if (totalUnits === 0) return 0;
    return (parseFloat(promo.actual_units_sold) / totalUnits) * 100;
  };

  const calculateMargin = (promo: CPGSalesPromo): number => {
    if (!promo.variant_promo_results) return 0;

    const margins = Object.values(promo.variant_promo_results).map(
      (variant) => parseFloat(variant.net_profit_margin_with_demo || '0')
    );

    if (margins.length === 0) return 0;
    return margins.reduce((sum, m) => sum + m, 0) / margins.length;
  };

  const getMaxRevenue = (): number => {
    const allData = compareYearEnabled ? [...currentYearData, ...previousYearData] : currentYearData;
    if (allData.length === 0) return 1;
    const max = Math.max(...allData.map(d => d.totalRevenue));
    return max || 1;
  };

  const getMaxPerformanceRevenue = (): number => {
    if (personPerformance.length === 0) return 1;
    const max = Math.max(...personPerformance.map(p => p.totalRevenue));
    return max || 1;
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (allCompletedPromos.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2>No Completed Promos Yet</h2>
        <p>
          Complete some promos to see analytics about seasonality, demo impact, and performance.
          Mark promos as "Complete" from the Table view to track actual results.
        </p>
      </div>
    );
  }

  const maxRevenue = getMaxRevenue();
  const maxPerformanceRevenue = getMaxPerformanceRevenue();

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
          <label htmlFor="retailer">Retailer</label>
          <select
            id="retailer"
            value={selectedRetailer}
            onChange={(e) => setSelectedRetailer(e.target.value)}
            className={styles.filterInput}
          >
            <option value="all">All Retailers</option>
            {availableRetailers.map(retailer => (
              <option key={retailer} value={retailer}>{retailer}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>
            <input
              type="checkbox"
              checked={compareYearEnabled}
              onChange={(e) => setCompareYearEnabled(e.target.checked)}
              className={styles.checkbox}
            />
            Compare Year-over-Year
          </label>
        </div>
      </div>

      {/* Visualization Mode Selector */}
      <div className={styles.vizModeSelector}>
        <button
          className={vizMode === 'timeline' ? styles.vizModeActive : styles.vizMode}
          onClick={() => setVizMode('timeline')}
        >
          Timeline
        </button>
        <button
          className={vizMode === 'heatmap' ? styles.vizModeActive : styles.vizMode}
          onClick={() => setVizMode('heatmap')}
        >
          Heat Map
        </button>
        <button
          className={vizMode === 'line' ? styles.vizModeActive : styles.vizMode}
          onClick={() => setVizMode('line')}
        >
          Line Graph
        </button>
      </div>

      {/* Seasonality Visualization */}
      <section className={styles.section}>
        <h2>Revenue Patterns from Promo Sales</h2>
        <p className={styles.sectionDescription}>
          {vizMode === 'timeline' && 'Horizontal bars show monthly revenue - gold means demo was performed'}
          {vizMode === 'heatmap' && 'Darker colors mean higher revenue - stars show where demos were performed'}
          {vizMode === 'line' && 'Track your revenue trend over time - highlighted dots show demos'}
        </p>

        {/* Timeline Bars */}
        {vizMode === 'timeline' && (
          <div className={styles.timelineContainer}>
            {currentYearData.map((dataPoint, index) => {
              const prevYearData = compareYearEnabled && previousYearData[index] ? previousYearData[index] : null;
              const widthPercent = maxRevenue > 0 ? (dataPoint.totalRevenue / maxRevenue) * 100 : 0;
              const prevWidthPercent = prevYearData && maxRevenue > 0 ? (prevYearData.totalRevenue / maxRevenue) * 100 : 0;

              return (
                <div key={`timeline-${index}`} className={styles.timelineRow}>
                  <div className={styles.timelineMonth}>{dataPoint.month}</div>
                  <div className={styles.timelineBars}>
                    {compareYearEnabled && prevYearData && (
                      <div className={styles.timelineBarWrapper}>
                        <div
                          className={styles.timelineBarPrev}
                          style={{ width: `${prevWidthPercent}%` }}
                        />
                        <span className={styles.timelineValue}>{formatCurrency(prevYearData.totalRevenue)}</span>
                      </div>
                    )}
                    <div className={styles.timelineBarWrapper}>
                      <div
                        className={`${styles.timelineBar} ${dataPoint.hasDemo ? styles.withDemo : ''}`}
                        style={{ width: `${widthPercent}%` }}
                      />
                      <span className={styles.timelineValue}>
                        {formatCurrency(dataPoint.totalRevenue)}
                        {dataPoint.hasDemo && <span className={styles.demoTag}>Demo</span>}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Heat Map Calendar */}
        {vizMode === 'heatmap' && (() => {
          // Calculate overall max revenue across ALL months for consistent color scaling
          const allPromoRevenues: number[] = [];
          currentYearData.forEach(monthData => {
            monthData.promos.forEach(promo => {
              if (promo.promo_start_date && promo.actual_payback) {
                allPromoRevenues.push(parseFloat(promo.actual_payback));
              }
            });
          });
          const overallMaxRevenue = Math.max(...allPromoRevenues, 1);

          return (
            <div className={styles.heatmapContainer}>
              <div className={styles.calendarsWrapper}>
                {currentYearData.map((monthData, monthIndex) => {
                  if (monthData.promos.length === 0) return null;

                  const year = monthData.year;
                  const monthNum = monthData.monthNum;
                  const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
                  const firstDayOfWeek = new Date(year, monthNum, 1).getDay();

                  // Map promos to their dates (mark entire promo period, not just start date)
                  const promosByDate: Record<number, { revenue: number; hasDemo: boolean }> = {};
                  monthData.promos.forEach(promo => {
                    if (promo.promo_start_date && promo.promo_end_date) {
                      const startDate = new Date(promo.promo_start_date);
                      const endDate = new Date(promo.promo_end_date);
                      const revenue = parseFloat(promo.actual_payback || '0');
                      const hasDemo = promo.demo_hours_entries && promo.demo_hours_entries.length > 0;

                      // Get all days in this month that fall within the promo period
                      const promoStartDay = startDate.getMonth() === monthNum && startDate.getFullYear() === year ? startDate.getDate() : 1;
                      const promoEndDay = endDate.getMonth() === monthNum && endDate.getFullYear() === year ? endDate.getDate() : daysInMonth;

                      // Mark all days in the promo period
                      for (let day = promoStartDay; day <= promoEndDay; day++) {
                        if (!promosByDate[day]) {
                          promosByDate[day] = { revenue: 0, hasDemo: false };
                        }
                        // Use FULL promo revenue for each day (don't divide)
                        // This way a $4000 promo shows as $4000 heat on every day
                        promosByDate[day].revenue += revenue;
                        if (hasDemo) promosByDate[day].hasDemo = true;
                      }
                    }
                  });

              return (
                <div key={`month-${monthIndex}`} className={styles.monthCalendar}>
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
                    {/* Empty cells for days before month starts */}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className={styles.calendarDayEmpty} />
                    ))}

                    {/* Actual days of the month */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const promoData = promosByDate[day];
                      const hasPromo = !!promoData;

                      let bgColor = '#f5f5f5';
                      if (hasPromo) {
                        const intensity = promoData.revenue / overallMaxRevenue;
                        if (intensity >= 0.8) bgColor = '#B8941F';
                        else if (intensity >= 0.6) bgColor = '#D4AF37';
                        else if (intensity >= 0.4) bgColor = '#f3d97a';
                        else if (intensity >= 0.2) bgColor = '#fde68a';
                        else bgColor = '#fef3c7'; // Lightest is now light yellow, not white
                      }

                      return (
                        <div
                          key={`day-${day}`}
                          className={`${styles.calendarDayCell} ${hasPromo ? styles.hasPromo : ''}`}
                          style={{ backgroundColor: bgColor }}
                          title={hasPromo ? `${formatCurrency(promoData.revenue)}${promoData.hasDemo ? ' - Demo' : ''}` : ''}
                        >
                          <div className={styles.calendarDayNumber}>{day}</div>
                          {hasPromo && promoData.hasDemo && (
                            <div className={styles.calendarDayStar}>★</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
              </div>
              <div className={styles.heatmapLegend}>
                <div className={styles.legendItem}>
                  <span style={{ fontSize: '1.25rem', color: '#22c55e' }}>★</span>
                  <span>Demo Performed</span>
                </div>
                <div className={styles.legendItem}>
                  <span>Color intensity:</span>
                  <div className={styles.heatmapGradient} />
                  <span>Higher Revenue</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Line Graph */}
        {vizMode === 'line' && (
          <div className={styles.lineGraphContainer}>
            <div className={styles.lineGraphArea}>
              <svg className={styles.lineGraphSvg} viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <line
                    key={`grid-${i}`}
                    x1="50"
                    y1={50 + i * 75}
                    x2="950"
                    y2={50 + i * 75}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                ))}

                {/* Previous year line (if enabled) */}
                {compareYearEnabled && previousYearData.length > 0 && (
                  <polyline
                    points={previousYearData.map((d, i) => {
                      const x = 50 + (i / Math.max(previousYearData.length - 1, 1)) * 900;
                      const y = 350 - (maxRevenue > 0 ? (d.totalRevenue / maxRevenue) * 300 : 0);
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#9333ea"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.4"
                  />
                )}

                {/* Current year line */}
                <polyline
                  points={currentYearData.map((d, i) => {
                    const x = 50 + (i / Math.max(currentYearData.length - 1, 1)) * 900;
                    const y = 350 - (maxRevenue > 0 ? (d.totalRevenue / maxRevenue) * 300 : 0);
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#D4AF37"
                  strokeWidth="3"
                />

                {/* Data points */}
                {currentYearData.map((d, i) => {
                  const x = 50 + (i / Math.max(currentYearData.length - 1, 1)) * 900;
                  const y = 350 - (maxRevenue > 0 ? (d.totalRevenue / maxRevenue) * 300 : 0);
                  return (
                    <g key={`point-${i}`}>
                      <circle
                        cx={x}
                        cy={y}
                        r={d.hasDemo ? 8 : 5}
                        fill={d.hasDemo ? '#22c55e' : '#D4AF37'}
                        stroke="white"
                        strokeWidth="2"
                      />
                      <text
                        x={x}
                        y={380}
                        textAnchor="middle"
                        fontSize="12"
                        fill="#666"
                      >
                        {d.month}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className={styles.lineGraphLegend}>
              <div className={styles.legendItem}>
                <div className={styles.lineLegendDot} style={{ backgroundColor: '#D4AF37' }} />
                <span>Revenue</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.lineLegendDot} style={{ backgroundColor: '#22c55e' }} />
                <span>Demo Performed</span>
              </div>
              {compareYearEnabled && (
                <div className={styles.legendItem}>
                  <div className={styles.lineLegendLine} />
                  <span>Previous Year</span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Demo Impact */}
      {demoImpact && (
        <section className={styles.section}>
          <h2>Demo Impact Analysis</h2>
          <p className={styles.sectionDescription}>
            Comparing promos with demos vs without demos
          </p>

          <div className={styles.comparisonContainer}>
            <div className={styles.comparisonCard}>
              <h3>With Demos ({demoImpact.withDemo.count})</h3>
              <div className={styles.statGrid}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Avg Sell-Through</div>
                  <div className={styles.statValue}>{demoImpact.withDemo.avgSellThrough.toFixed(1)}%</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Avg Margin</div>
                  <div className={styles.statValue}>{demoImpact.withDemo.avgMargin.toFixed(1)}%</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Total Revenue</div>
                  <div className={styles.statValue}>{formatCurrency(demoImpact.withDemo.totalRevenue)}</div>
                </div>
              </div>
            </div>

            <div className={styles.comparisonCard}>
              <h3>Without Demos ({demoImpact.withoutDemo.count})</h3>
              <div className={styles.statGrid}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Avg Sell-Through</div>
                  <div className={styles.statValue}>{demoImpact.withoutDemo.avgSellThrough.toFixed(1)}%</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Avg Margin</div>
                  <div className={styles.statValue}>{demoImpact.withoutDemo.avgMargin.toFixed(1)}%</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Total Revenue</div>
                  <div className={styles.statValue}>{formatCurrency(demoImpact.withoutDemo.totalRevenue)}</div>
                </div>
              </div>
            </div>
          </div>

          {demoImpact.withDemo.count > 0 && demoImpact.withoutDemo.count > 0 && (
            <div className={styles.impactSummary}>
              <strong>Impact:</strong> Demos show{' '}
              {demoImpact.withDemo.avgSellThrough > demoImpact.withoutDemo.avgSellThrough
                ? `${(demoImpact.withDemo.avgSellThrough - demoImpact.withoutDemo.avgSellThrough).toFixed(1)}% higher sell-through`
                : 'similar sell-through'}
              {' and '}
              {demoImpact.withDemo.avgMargin > demoImpact.withoutDemo.avgMargin
                ? `${(demoImpact.withDemo.avgMargin - demoImpact.withoutDemo.avgMargin).toFixed(1)}% better margins`
                : 'similar margins'}
            </div>
          )}
        </section>
      )}

      {/* Performance by Person */}
      {personPerformance.length > 0 && (
        <section className={styles.section}>
          <h2>Demo Performance by Person</h2>
          <p className={styles.sectionDescription}>
            Revenue contribution and effectiveness metrics for demo performers
          </p>

          <div className={styles.performanceChart}>
            {personPerformance.map((person, index) => (
              <div key={person.name} className={styles.performanceBar}>
                <div className={styles.performanceRank}>{index + 1}</div>
                <div className={styles.performanceName}>
                  <strong>{person.name}</strong>
                  <div className={styles.performanceSubtext}>
                    {person.promoCount} promo{person.promoCount !== 1 ? 's' : ''} • {person.totalHours.toFixed(0)} hours
                  </div>
                </div>
                <div className={styles.performanceMetrics}>
                  <div className={styles.metricBar}>
                    <div className={styles.metricLabel}>Revenue</div>
                    <div className={styles.metricBarContainer}>
                      <div
                        className={styles.metricBarFill}
                        style={{
                          width: `${(person.totalRevenue / maxPerformanceRevenue) * 100}%`,
                          backgroundColor: '#D4AF37',
                        }}
                      />
                      <span className={styles.metricValue}>{formatCurrency(person.totalRevenue)}</span>
                    </div>
                  </div>
                  <div className={styles.metricBar}>
                    <div className={styles.metricLabel}>Avg Sell-Through</div>
                    <div className={styles.metricBarContainer}>
                      <div
                        className={styles.metricBarFill}
                        style={{
                          width: `${person.avgSellThrough}%`,
                          backgroundColor: person.avgSellThrough >= 70 ? '#22c55e' : person.avgSellThrough >= 50 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                      <span className={styles.metricValue}>{person.avgSellThrough.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className={styles.metricBar}>
                    <div className={styles.metricLabel}>Avg Margin</div>
                    <div className={styles.metricBarContainer}>
                      <div
                        className={styles.metricBarFill}
                        style={{
                          width: `${person.avgMargin}%`,
                          backgroundColor: '#9333ea',
                        }}
                      />
                      <span className={styles.metricValue}>{person.avgMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
