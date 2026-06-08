/**
 * Workshop Analytics Component
 *
 * Analytics dashboard showing key metrics for a workshop.
 * Displays enrollment trends, conversion rates, and engagement metrics.
 *
 * Features:
 * - Total enrollments and active participants
 * - Trial conversion rate with visual charts
 * - Worksheet completion metrics
 * - Status breakdown (pie chart)
 * - Enrollments over time (line chart)
 * - Date range selector
 * - Export data to CSV
 * - WCAG 2.1 AA compliant
 */

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getWorkshopAnalytics,
  exportAnalyticsCSV,
  type WorkshopAnalyticsData,
} from '../../../services/workshops.api';
import styles from './WorkshopAnalytics.module.css';

interface WorkshopAnalyticsProps {
  workshopId: string;
}

// Chart colors
const STATUS_COLORS = {
  enrolled: '#818cf8',
  active: '#34d399',
  trial_active: '#60a5fa',
  trial_expired: '#f87171',
  converted: '#10b981',
  cancelled: '#9ca3af',
};

export default function WorkshopAnalytics({ workshopId }: WorkshopAnalyticsProps) {
  const [analytics, setAnalytics] = useState<WorkshopAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadAnalytics();
  }, [workshopId, dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getWorkshopAnalytics(
        workshopId,
        dateRange.startDate && dateRange.endDate
          ? {
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
            }
          : undefined
      );
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!analytics) return;
    exportAnalyticsCSV(workshopId, analytics);
  };

  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClearDateRange = () => {
    setDateRange({
      startDate: '',
      endDate: '',
    });
  };

  if (loading && !analytics) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <div className={styles.spinner} aria-hidden="true"></div>
        <span>Loading analytics...</span>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className={styles.error} role="alert">
        <h3>Error Loading Analytics</h3>
        <p>{error}</p>
        <button type="button" onClick={loadAnalytics} className={styles.retryButton}>
          Try Again
        </button>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  // Prepare data for charts
  const statusBreakdownData = Object.entries(analytics.statusBreakdown).map(([status, count]) => ({
    name: status.replace('_', ' '),
    value: count,
    color: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
  }));

  const enrollmentsOverTimeData = analytics.enrollmentsOverTime.map(item => ({
    date: new Date(item.date).toLocaleDateString(),
    enrollments: item.count,
  }));

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Workshop Analytics</h2>
        <button
          type="button"
          onClick={handleExport}
          className={styles.exportButton}
          aria-label="Export analytics to CSV"
        >
          Export CSV
        </button>
      </div>

      {/* Date Range Filter */}
      <div className={styles.dateRangeFilter}>
        <div className={styles.dateInputGroup}>
          <label htmlFor="start-date" className={styles.dateLabel}>
            Start Date
          </label>
          <input
            type="date"
            id="start-date"
            value={dateRange.startDate}
            onChange={e => handleDateRangeChange('startDate', e.target.value)}
            className={styles.dateInput}
          />
        </div>
        <div className={styles.dateInputGroup}>
          <label htmlFor="end-date" className={styles.dateLabel}>
            End Date
          </label>
          <input
            type="date"
            id="end-date"
            value={dateRange.endDate}
            onChange={e => handleDateRangeChange('endDate', e.target.value)}
            className={styles.dateInput}
          />
        </div>
        {(dateRange.startDate || dateRange.endDate) && (
          <button
            type="button"
            onClick={handleClearDateRange}
            className={styles.clearDateButton}
          >
            Clear
          </button>
        )}
      </div>

      {/* Key Metrics */}
      <div className={styles.metricsGrid}>
        <MetricCard
          label="Total Enrollments"
          value={analytics.totalEnrollments}
          color="blue"
          icon="👥"
        />
        <MetricCard
          label="Active Participants"
          value={analytics.activeParticipants}
          color="green"
          icon="✅"
        />
        <MetricCard
          label="Trial Conversions"
          value={analytics.trialConversions}
          color="purple"
          icon="💎"
        />
        <MetricCard
          label="Conversion Rate"
          value={`${analytics.trialConversionRate.toFixed(1)}%`}
          color="orange"
          icon="📈"
        />
        <MetricCard
          label="Worksheet Completion"
          value={`${analytics.worksheetCompletionRate.toFixed(1)}%`}
          color="indigo"
          icon="📝"
        />
        {analytics.averageTimeToConversion && (
          <MetricCard
            label="Avg. Time to Convert"
            value={`${Math.round(analytics.averageTimeToConversion)} days`}
            color="teal"
            icon="⏱️"
          />
        )}
      </div>

      {/* Charts Section */}
      <div className={styles.chartsGrid}>
        {/* Status Breakdown Pie Chart */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusBreakdownData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusBreakdownData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Enrollments Over Time Line Chart */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Enrollments Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={enrollmentsOverTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="enrollments"
                stroke="#4f46e5"
                strokeWidth={2}
                name="Enrollments"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Breakdown Bar Chart */}
      <div className={styles.chartCardWide}>
        <h3 className={styles.chartTitle}>Status Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={statusBreakdownData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" name="Count">
              {statusBreakdownData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Email Engagement (if available) */}
      {analytics.emailEngagement && (
        <div className={styles.emailEngagement}>
          <h3 className={styles.sectionTitle}>Email Engagement</h3>
          <div className={styles.engagementGrid}>
            {analytics.emailEngagement.welcomeEmailOpenRate !== undefined && (
              <div className={styles.engagementMetric}>
                <span className={styles.engagementLabel}>Welcome Email Open Rate</span>
                <span className={styles.engagementValue}>
                  {analytics.emailEngagement.welcomeEmailOpenRate.toFixed(1)}%
                </span>
              </div>
            )}
            {analytics.emailEngagement.reminderEmailOpenRate !== undefined && (
              <div className={styles.engagementMetric}>
                <span className={styles.engagementLabel}>Reminder Email Open Rate</span>
                <span className={styles.engagementValue}>
                  {analytics.emailEngagement.reminderEmailOpenRate.toFixed(1)}%
                </span>
              </div>
            )}
            {analytics.emailEngagement.weeklyEmailOpenRates &&
              Object.entries(analytics.emailEngagement.weeklyEmailOpenRates).map(([week, rate]) => (
                <div key={week} className={styles.engagementMetric}>
                  <span className={styles.engagementLabel}>{week} Open Rate</span>
                  <span className={styles.engagementValue}>{rate.toFixed(1)}%</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'teal';
  icon?: string;
}

function MetricCard({ label, value, color, icon }: MetricCardProps) {
  return (
    <div className={`${styles.metricCard} ${styles[`metricCard${capitalize(color)}`]}`}>
      <div className={styles.metricIcon} aria-hidden="true">
        {icon}
      </div>
      <div className={styles.metricContent}>
        <div className={styles.metricLabel}>{label}</div>
        <div className={styles.metricValue}>{value}</div>
      </div>
    </div>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
