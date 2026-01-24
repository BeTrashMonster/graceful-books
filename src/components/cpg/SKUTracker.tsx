/**
 * SKU Tracker Component
 *
 * Displays current SKU count and calculates monthly cost for standalone CPG users.
 * Pricing: $5 per SKU, capped at $50/month.
 *
 * Features:
 * - Current SKU count display
 * - Monthly cost calculation
 * - Visual pricing breakdown
 * - Link to product management
 * - Steadiness communication style
 *
 * Requirements:
 * - WCAG 2.1 AA compliance
 * - Mobile responsive
 * - Clear, encouraging messaging
 */

import { useState, useEffect } from 'react';
import { Button } from '../core/Button';
import { HelpTooltip } from '../help/HelpTooltip';
import { calculateMonthlyCost } from '../../db/schema/standaloneFinancials.schema';
import styles from './SKUTracker.module.css';

export interface SKUTrackerProps {
  companyId: string;
  skuCount: number;
  onManageProducts?: () => void;
}

export function SKUTracker({ companyId: _companyId, skuCount, onManageProducts }: SKUTrackerProps) {
  const [monthlyCost, setMonthlyCost] = useState<string>('0.00');
  const [isAtCap, setIsAtCap] = useState(false);

  useEffect(() => {
    const cost = calculateMonthlyCost(skuCount);
    setMonthlyCost(cost);
    setIsAtCap(parseFloat(cost) >= 50);
  }, [skuCount]);

  const baseCost = skuCount * 5;
  const cappedAmount = baseCost > 50 ? baseCost - 50 : 0;

  return (
    <div className={styles.tracker}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          Your CPG Pricing
          <HelpTooltip content="As a standalone CPG user, your monthly cost is $5 per product SKU, with a maximum of $50/month (unlimited SKUs beyond 10)." />
        </h3>
      </div>

      <div className={styles.content}>
        {/* SKU Count */}
        <div className={styles.skuCount}>
          <div className={styles.countCircle}>
            <span className={styles.countNumber}>{skuCount}</span>
            <span className={styles.countLabel}>SKU{skuCount !== 1 ? 's' : ''}</span>
          </div>
          <p className={styles.countDescription}>
            {skuCount === 0
              ? "You haven't added any products yet."
              : skuCount === 1
              ? 'You have 1 product SKU.'
              : `You have ${skuCount} product SKUs.`}
          </p>
        </div>

        {/* Pricing Breakdown */}
        <div className={styles.pricingBreakdown}>
          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>SKU Count:</span>
            <span className={styles.breakdownValue}>{skuCount}</span>
          </div>

          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>Rate per SKU:</span>
            <span className={styles.breakdownValue}>$5.00</span>
          </div>

          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>Base Cost:</span>
            <span className={styles.breakdownValue}>${baseCost.toFixed(2)}</span>
          </div>

          {isAtCap && (
            <>
              <div className={styles.breakdownRow}>
                <span className={styles.breakdownLabel}>Monthly Cap:</span>
                <span className={styles.breakdownValue}>$50.00</span>
              </div>
              <div className={styles.breakdownRow + ' ' + styles.savings}>
                <span className={styles.breakdownLabel}>You Save:</span>
                <span className={styles.breakdownValue}>-${cappedAmount.toFixed(2)}</span>
              </div>
            </>
          )}

          <div className={styles.breakdownDivider} />

          <div className={styles.breakdownRow + ' ' + styles.total}>
            <span className={styles.breakdownLabel}>Your Monthly Cost:</span>
            <span className={styles.breakdownValue}>${monthlyCost}</span>
          </div>
        </div>

        {/* Messaging */}
        <div className={styles.messaging}>
          {skuCount === 0 && (
            <div className={styles.messageCard + ' ' + styles.info}>
              <p className={styles.messageText}>
                Get started by adding your first product. We'll help you track costs and analyze profitability!
              </p>
            </div>
          )}

          {skuCount > 0 && skuCount < 10 && (
            <div className={styles.messageCard + ' ' + styles.info}>
              <p className={styles.messageText}>
                Your cost is ${monthlyCost}/month for {skuCount} SKU{skuCount !== 1 ? 's' : ''}. Add more products to get the most value from CPG analysis.
              </p>
            </div>
          )}

          {isAtCap && (
            <div className={styles.messageCard + ' ' + styles.success}>
              <p className={styles.messageText}>
                <strong>Great news!</strong> You've reached the monthly cap. Add as many products as you need at no extra cost!
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {onManageProducts && (
          <div className={styles.actions}>
            <Button variant="primary" onClick={onManageProducts}>
              {skuCount === 0 ? 'Add Your First Product' : 'Manage Products'}
            </Button>
          </div>
        )}

        {/* Pricing Info */}
        <div className={styles.pricingInfo}>
          <h4 className={styles.infoTitle}>How Pricing Works</h4>
          <ul className={styles.infoList}>
            <li className={styles.infoItem}>
              <strong>$5 per SKU</strong> - Pay only for the products you track
            </li>
            <li className={styles.infoItem}>
              <strong>$50 monthly cap</strong> - Never pay more than $50/month, no matter how many SKUs
            </li>
            <li className={styles.infoItem}>
              <strong>No hidden fees</strong> - What you see is what you pay
            </li>
          </ul>
        </div>

        {/* Upgrade Option */}
        <div className={styles.upgradeCard}>
          <h4 className={styles.upgradeTitle}>Need Full Accounting?</h4>
          <p className={styles.upgradeText}>
            Upgrade to Audacious Money's full accounting platform for $40/month. Get all CPG features plus complete bookkeeping, invoicing, and financial reporting.
          </p>
          <Button variant="secondary" size="sm">
            Learn About Full Platform
          </Button>
        </div>
      </div>
    </div>
  );
}
