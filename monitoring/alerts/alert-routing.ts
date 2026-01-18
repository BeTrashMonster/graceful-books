/**
 * Alert Routing Configuration
 *
 * Centralized alert routing for Slack, PagerDuty, email, and other channels.
 * Minimizes alert fatigue through intelligent routing and aggregation.
 *
 * @module monitoring/alerts
 */

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertChannel = 'pagerduty' | 'slack' | 'email' | 'webhook';

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  source: string;
  timestamp: number;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface AlertRoute {
  name: string;
  channels: AlertChannel[];
  conditions: AlertCondition[];
  throttle?: ThrottleConfig;
}

export interface AlertCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches';
  value: any;
}

export interface ThrottleConfig {
  maxAlertsPerHour: number;
  aggregationWindow: number; // seconds
  deduplicationWindow: number; // seconds
}

/**
 * Alert Router - Routes alerts to appropriate channels based on severity and conditions
 */
export class AlertRouter {
  private routes: AlertRoute[];
  private alertHistory: Map<string, number>;
  private deduplicationCache: Map<string, Alert>;

  constructor(routes: AlertRoute[]) {
    this.routes = routes;
    this.alertHistory = new Map();
    this.deduplicationCache = new Map();
  }

  /**
   * Route an alert to appropriate channels
   */
  async route(alert: Alert): Promise<void> {
    // Check for duplicate
    if (this.isDuplicate(alert)) {
      console.log(`Alert ${alert.id} is a duplicate, skipping`);
      return;
    }

    // Find matching routes
    const matchingRoutes = this.findMatchingRoutes(alert);

    if (matchingRoutes.length === 0) {
      console.warn(`No matching routes found for alert: ${alert.id}`);
      return;
    }

    // Route to each matching channel
    for (const route of matchingRoutes) {
      // Check throttling
      if (route.throttle && this.isThrottled(route, alert)) {
        console.log(`Alert ${alert.id} throttled for route ${route.name}`);
        continue;
      }

      // Send to each channel
      for (const channel of route.channels) {
        await this.sendToChannel(channel, alert);
      }

      // Record in history
      this.recordAlert(route, alert);
    }

    // Store in deduplication cache
    this.storeInDeduplicationCache(alert);
  }

  /**
   * Find routes that match the alert
   */
  private findMatchingRoutes(alert: Alert): AlertRoute[] {
    return this.routes.filter(route => {
      return route.conditions.every(condition => {
        return this.evaluateCondition(alert, condition);
      });
    });
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(alert: Alert, condition: AlertCondition): boolean {
    const value = this.getFieldValue(alert, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'matches':
        return new RegExp(condition.value).test(String(value));
      default:
        return false;
    }
  }

  /**
   * Get field value from alert
   */
  private getFieldValue(alert: Alert, field: string): any {
    const parts = field.split('.');
    let value: any = alert;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }

  /**
   * Check if alert is a duplicate
   */
  private isDuplicate(alert: Alert): boolean {
    const key = this.getDeduplicationKey(alert);
    const cached = this.deduplicationCache.get(key);

    if (!cached) return false;

    // Check if within deduplication window (default 5 minutes)
    const window = 300000; // 5 minutes in ms
    return (alert.timestamp - cached.timestamp) < window;
  }

  /**
   * Check if route is throttled
   */
  private isThrottled(route: AlertRoute, alert: Alert): boolean {
    if (!route.throttle) return false;

    const key = `${route.name}:${this.getDeduplicationKey(alert)}`;
    const count = this.alertHistory.get(key) || 0;

    return count >= route.throttle.maxAlertsPerHour;
  }

  /**
   * Record alert in history
   */
  private recordAlert(route: AlertRoute, alert: Alert): void {
    const key = `${route.name}:${this.getDeduplicationKey(alert)}`;
    const count = this.alertHistory.get(key) || 0;
    this.alertHistory.set(key, count + 1);

    // Clean up old history after 1 hour
    setTimeout(() => {
      this.alertHistory.delete(key);
    }, 3600000);
  }

  /**
   * Store alert in deduplication cache
   */
  private storeInDeduplicationCache(alert: Alert): void {
    const key = this.getDeduplicationKey(alert);
    this.deduplicationCache.set(key, alert);

    // Clean up after deduplication window
    setTimeout(() => {
      this.deduplicationCache.delete(key);
    }, 300000); // 5 minutes
  }

  /**
   * Get deduplication key
   */
  private getDeduplicationKey(alert: Alert): string {
    return `${alert.source}:${alert.title}`;
  }

  /**
   * Send alert to specific channel
   */
  private async sendToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    switch (channel) {
      case 'pagerduty':
        await this.sendToPagerDuty(alert);
        break;
      case 'slack':
        await this.sendToSlack(alert);
        break;
      case 'email':
        await this.sendToEmail(alert);
        break;
      case 'webhook':
        await this.sendToWebhook(alert);
        break;
      default:
        console.warn(`Unknown channel: ${channel}`);
    }
  }

  /**
   * Send alert to PagerDuty
   */
  private async sendToPagerDuty(alert: Alert): Promise<void> {
    const integrationKey = process.env.PAGERDUTY_INTEGRATION_KEY;
    if (!integrationKey) {
      console.error('PagerDuty integration key not configured');
      return;
    }

    const payload = {
      routing_key: integrationKey,
      event_action: 'trigger',
      dedup_key: alert.id,
      payload: {
        summary: alert.title,
        source: alert.source,
        severity: this.mapSeverityToPagerDuty(alert.severity),
        timestamp: new Date(alert.timestamp).toISOString(),
        custom_details: {
          message: alert.message,
          ...alert.metadata,
        },
      },
    };

    try {
      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.status}`);
      }

      console.log(`Alert ${alert.id} sent to PagerDuty`);
    } catch (error) {
      console.error('Failed to send alert to PagerDuty:', error);
    }
  }

  /**
   * Send alert to Slack
   */
  private async sendToSlack(alert: Alert): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_ENGINEERING;
    if (!webhookUrl) {
      console.error('Slack webhook URL not configured');
      return;
    }

    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);

    const payload = {
      text: `${emoji} *${alert.title}*`,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Source',
              value: alert.source,
              short: true,
            },
            {
              title: 'Message',
              value: alert.message,
              short: false,
            },
            {
              title: 'Time',
              value: new Date(alert.timestamp).toISOString(),
              short: true,
            },
          ],
          footer: 'Graceful Books Monitoring',
          ts: Math.floor(alert.timestamp / 1000),
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook error: ${response.status}`);
      }

      console.log(`Alert ${alert.id} sent to Slack`);
    } catch (error) {
      console.error('Failed to send alert to Slack:', error);
    }
  }

  /**
   * Send alert via email
   */
  private async sendToEmail(alert: Alert): Promise<void> {
    // Email implementation would use a service like SendGrid, AWS SES, etc.
    console.log(`Would send email alert: ${alert.title}`);
    // Placeholder - implement with actual email service
  }

  /**
   * Send alert to custom webhook
   */
  private async sendToWebhook(alert: Alert): Promise<void> {
    const webhookUrl = process.env.CUSTOM_ALERT_WEBHOOK;
    if (!webhookUrl) {
      console.error('Custom webhook URL not configured');
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
      }

      console.log(`Alert ${alert.id} sent to custom webhook`);
    } catch (error) {
      console.error('Failed to send alert to webhook:', error);
    }
  }

  /**
   * Map severity to PagerDuty severity
   */
  private mapSeverityToPagerDuty(severity: AlertSeverity): string {
    const mapping: Record<AlertSeverity, string> = {
      critical: 'critical',
      high: 'error',
      medium: 'warning',
      low: 'info',
      info: 'info',
    };
    return mapping[severity];
  }

  /**
   * Get Slack color for severity
   */
  private getSeverityColor(severity: AlertSeverity): string {
    const colors: Record<AlertSeverity, string> = {
      critical: '#D32F2F', // Red
      high: '#F57C00', // Orange
      medium: '#FBC02D', // Yellow
      low: '#1976D2', // Blue
      info: '#388E3C', // Green
    };
    return colors[severity];
  }

  /**
   * Get emoji for severity
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    const emojis: Record<AlertSeverity, string> = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️',
      info: '✅',
    };
    return emojis[severity];
  }
}

/**
 * Default alert routes configuration
 */
export const defaultAlertRoutes: AlertRoute[] = [
  // Critical alerts go to PagerDuty and Slack immediately
  {
    name: 'critical-alerts',
    channels: ['pagerduty', 'slack'],
    conditions: [
      { field: 'severity', operator: 'equals', value: 'critical' },
    ],
    throttle: {
      maxAlertsPerHour: 10,
      aggregationWindow: 300,
      deduplicationWindow: 300,
    },
  },

  // High severity alerts go to Slack
  {
    name: 'high-severity-alerts',
    channels: ['slack', 'email'],
    conditions: [
      { field: 'severity', operator: 'equals', value: 'high' },
    ],
    throttle: {
      maxAlertsPerHour: 20,
      aggregationWindow: 600,
      deduplicationWindow: 600,
    },
  },

  // Medium severity alerts go to Slack (throttled)
  {
    name: 'medium-severity-alerts',
    channels: ['slack'],
    conditions: [
      { field: 'severity', operator: 'equals', value: 'medium' },
    ],
    throttle: {
      maxAlertsPerHour: 5,
      aggregationWindow: 1800,
      deduplicationWindow: 1800,
    },
  },

  // Low/Info alerts go to email only
  {
    name: 'low-severity-alerts',
    channels: ['email'],
    conditions: [
      {
        field: 'severity',
        operator: 'equals',
        value: 'low',
      },
    ],
    throttle: {
      maxAlertsPerHour: 10,
      aggregationWindow: 3600,
      deduplicationWindow: 3600,
    },
  },

  // Database alerts always go to PagerDuty
  {
    name: 'database-alerts',
    channels: ['pagerduty', 'slack'],
    conditions: [
      { field: 'source', operator: 'contains', value: 'database' },
      { field: 'severity', operator: 'equals', value: 'critical' },
    ],
  },

  // Sync relay alerts
  {
    name: 'sync-relay-alerts',
    channels: ['slack', 'pagerduty'],
    conditions: [
      { field: 'source', operator: 'contains', value: 'sync-relay' },
      { field: 'severity', operator: 'equals', value: 'critical' },
    ],
  },
];

/**
 * Create alert
 */
export function createAlert(
  title: string,
  message: string,
  severity: AlertSeverity,
  source: string,
  metadata?: Record<string, any>
): Alert {
  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    message,
    severity,
    source,
    timestamp: Date.now(),
    metadata,
  };
}
