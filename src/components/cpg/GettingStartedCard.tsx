/**
 * Getting Started Card - Guides new CPG users through initial setup
 *
 * Shows on dashboard when user is brand new. Tracks progress through:
 * 1. Add Categories (Ingredients, Packaging, Labels)
 * 2. Add Your Products (What you sell)
 * 3. Define Recipes (How products are made)
 * 4. Enter First Invoice (Raw materials)
 * 5. Add Distributors (optional)
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db/database';
import { Button } from '../core/Button';
import styles from './GettingStartedCard.module.css';

export interface GettingStartedCardProps {
  onAction: (action: string) => void;
}

export function GettingStartedCard({ onAction }: GettingStartedCardProps) {
  const { companyId } = useAuth();
  const [steps, setSteps] = useState({
    hasCategories: false,
    hasProducts: false,
    hasRecipes: false,
    hasDistributors: false,
    hasInvoices: false,
  });
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    const checkProgress = async () => {
      try {
        const categories = await db.cpgCategories
          .where('company_id')
          .equals(companyId)
          .filter(c => c.active && !c.deleted_at)
          .count();

        const products = await db.cpgFinishedProducts
          .where('company_id')
          .equals(companyId)
          .filter(p => p.active && !p.deleted_at)
          .count();

        const recipes = await db.cpgRecipes
          .where('company_id')
          .equals(companyId)
          .filter(r => r.active && !r.deleted_at)
          .count();

        const distributors = await db.cpgDistributors
          .where('company_id')
          .equals(companyId)
          .filter(d => d.active && !d.deleted_at)
          .count();

        const invoices = await db.cpgInvoices
          .where('company_id')
          .equals(companyId)
          .filter(i => i.active && !i.deleted_at)
          .count();

        setSteps({
          hasCategories: categories > 0,
          hasProducts: products > 0,
          hasRecipes: recipes > 0,
          hasDistributors: distributors > 0,
          hasInvoices: invoices > 0,
        });

        setIsLoading(false);
      } catch (error) {
        console.error('Error checking progress:', error);
        setIsLoading(false);
      }
    };

    checkProgress();

    // Re-check when data changes (user might add data in another tab/window)
    const interval = setInterval(checkProgress, 2000);
    return () => clearInterval(interval);
  }, [companyId]);

  // Don't show if dismissed
  if (isDismissed) return null;

  // Check if essential steps are complete
  // Essential steps: categories, products, recipes, invoices
  const essentialComplete = steps.hasCategories && steps.hasProducts && steps.hasRecipes && steps.hasInvoices;
  const allComplete = essentialComplete && steps.hasDistributors;

  const completedCount = Object.values(steps).filter(Boolean).length;
  const totalSteps = 5;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.icon}>🎯</div>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Let's Get You Started!</h2>
          <p className={styles.subtitle}>
            {completedCount === 0 && "Set up your product cost tracking in 5 quick steps"}
            {completedCount > 0 && completedCount < 3 && "Great start! Keep going..."}
            {completedCount >= 3 && completedCount < totalSteps && "You're almost there!"}
          </p>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className={styles.dismissButton}
          aria-label="Dismiss getting started guide"
        >
          ✕
        </button>
      </div>

      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${(completedCount / totalSteps) * 100}%` }}
        />
      </div>

      <div className={styles.steps}>
        {/* Step 1: Add Categories */}
        <div className={`${styles.step} ${steps.hasCategories ? styles.complete : ''}`}>
          <div className={styles.stepNumber}>
            {steps.hasCategories ? '✓' : '📦'}
          </div>
          <div className={styles.stepContent}>
            <div className={styles.stepTitle}>Add Categories</div>
            <div className={styles.stepDescription}>
              Your product components - like Ingredients, Packaging, Labels
            </div>
            {!steps.hasCategories && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onAction('add-category')}
                className={styles.stepButton}
              >
                Add First Category
              </Button>
            )}
            {steps.hasCategories && (
              <button
                onClick={() => onAction('manage-categories')}
                className={styles.stepManageLink}
                aria-label="Manage categories"
              >
                Need more? Manage Categories →
              </button>
            )}
          </div>
        </div>

        {/* Step 2: Add Your Products */}
        <div className={`${styles.step} ${steps.hasProducts ? styles.complete : ''}`}>
          <div className={styles.stepNumber}>
            {steps.hasProducts ? '✓' : '🎁'}
          </div>
          <div className={styles.stepContent}>
            <div className={styles.stepTitle}>Add Your Products</div>
            <div className={styles.stepDescription}>
              The finished items you make and sell - like 1oz Body Oil, 5oz Body Oil
            </div>
            {!steps.hasProducts && steps.hasCategories && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onAction('add-product')}
                className={styles.stepButton}
              >
                Add First Product
              </Button>
            )}
            {!steps.hasProducts && !steps.hasCategories && (
              <div className={styles.stepDisabled}>
                Complete Step 1 first
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Define Recipes */}
        <div className={`${styles.step} ${steps.hasRecipes ? styles.complete : ''}`}>
          <div className={styles.stepNumber}>
            {steps.hasRecipes ? '✓' : '📋'}
          </div>
          <div className={styles.stepContent}>
            <div className={styles.stepTitle}>Define Recipes</div>
            <div className={styles.stepDescription}>
              How much of each ingredient goes into making your products
            </div>
            {!steps.hasRecipes && steps.hasProducts && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onAction('view-products')}
                className={styles.stepButton}
              >
                Create First Recipe
              </Button>
            )}
            {!steps.hasRecipes && !steps.hasProducts && (
              <div className={styles.stepDisabled}>
                Complete Step 2 first
              </div>
            )}
          </div>
        </div>

        {/* Step 4: Enter First Invoice */}
        <div className={`${styles.step} ${steps.hasInvoices ? styles.complete : ''}`}>
          <div className={styles.stepNumber}>
            {steps.hasInvoices ? '✓' : '📄'}
          </div>
          <div className={styles.stepContent}>
            <div className={styles.stepTitle}>Enter Your First Invoice</div>
            <div className={styles.stepDescription}>
              Track raw material costs and calculate CPU for your products
            </div>
            {!steps.hasInvoices && steps.hasCategories && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onAction('add-invoice')}
                className={styles.stepButton}
              >
                Add First Invoice
              </Button>
            )}
            {!steps.hasInvoices && !steps.hasCategories && (
              <div className={styles.stepDisabled}>
                Complete Step 1 first
              </div>
            )}
          </div>
        </div>

        {/* Step 5: Add Distributors (optional) */}
        <div className={`${styles.step} ${steps.hasDistributors ? styles.complete : ''}`}>
          <div className={styles.stepNumber}>
            {steps.hasDistributors ? '✓' : '🚚'}
          </div>
          <div className={styles.stepContent}>
            <div className={styles.stepTitle}>Add Distributors <span className={styles.optional}>(optional)</span></div>
            <div className={styles.stepDescription}>
              Your distribution partners and their fee structures
            </div>
            {!steps.hasDistributors && steps.hasCategories && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction('add-distributor')}
                className={styles.stepButton}
              >
                Add Distributor
              </Button>
            )}
            {steps.hasDistributors && (
              <button
                onClick={() => onAction('manage-distributors')}
                className={styles.stepManageLink}
                aria-label="Manage distributors"
              >
                Need more? Manage Distributors →
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        {essentialComplete && !steps.hasDistributors ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p className={styles.footerText} style={{ marginBottom: 0 }}>
              🎉 Great job! You've completed the essential setup steps.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'center' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction('add-distributor')}
              >
                Add Distributors (Optional)
              </Button>
              <button
                onClick={() => setIsDismissed(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '0.25rem'
                }}
              >
                I'm all set - hide this
              </button>
            </div>
          </div>
        ) : allComplete ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            <p className={styles.footerText} style={{ marginBottom: 0 }}>
              🎉 Excellent! You've completed all setup steps!
            </p>
            <button
              onClick={() => setIsDismissed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.875rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '0.25rem'
              }}
            >
              Hide this card
            </button>
          </div>
        ) : (
          <p className={styles.footerText}>
            {completedCount === 0 && "Just 5 quick steps to start tracking your product costs"}
            {completedCount > 0 && completedCount < totalSteps && `${completedCount} of ${totalSteps} steps complete. You're making great progress!`}
          </p>
        )}
      </div>
    </div>
  );
}
