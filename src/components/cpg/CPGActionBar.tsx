/**
 * CPG Action Bar - Context-aware quick actions
 * 
 * Shows at top of content area with relevant actions for current page
 */

import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../core/Button';
import styles from './CPGActionBar.module.css';

export interface CPGActionBarProps {
  onAction: (action: string) => void;
}

export function CPGActionBar({ onAction }: CPGActionBarProps) {
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get primary action based on current page
  const getPrimaryAction = () => {
    if (location.pathname.includes('products')) {
      return { label: '+ Add Product', action: 'add-product', showButton: true };
    }
    if (location.pathname.includes('cpu-tracker')) {
      return { label: '+ Add Invoice', action: 'add-invoice', showButton: true };
    }
    if (location.pathname.includes('distribution-cost')) {
      return { label: '+ Add Distributor', action: 'add-distributor', showButton: true };
    }
    if (location.pathname.includes('promo-decision')) {
      return { label: '+ New Promo Analysis', action: 'add-promo', showButton: true };
    }
    if (location.pathname.includes('financial-entry')) {
      return { label: '+ Add Financial Data', action: 'add-financial', showButton: true };
    }
    if (location.pathname.includes('analytics')) {
      return { label: '+ Add Data Point', action: 'add-data', showButton: true };
    }
    if (location.pathname.includes('scenario-planning')) {
      return { label: '+ New Scenario', action: 'add-scenario', showButton: true };
    }
    // Dashboard and reports - no primary button, just dropdown
    return { label: '', action: '', showButton: false };
  };

  const primaryAction = getPrimaryAction();

  const quickActions = [
    { label: 'Add Invoice', action: 'add-invoice', icon: '📄' },
    { label: 'Add Product', action: 'add-product', icon: '📦' },
    { label: 'Add Distributor', action: 'add-distributor', icon: '🚚' },
    { label: 'Add Category', action: 'add-category', icon: '🏷️' },
  ];

  return (
    <div className={styles.actionBar}>
      <div className={styles.primaryActions}>
        {primaryAction.showButton && (
          <Button
            variant="primary"
            size="md"
            onClick={() => onAction(primaryAction.action)}
            className={styles.primaryButton}
          >
            {primaryAction.label}
          </Button>
        )}

        <div className={styles.dropdown} ref={dropdownRef}>
          <button
            className={styles.dropdownButton}
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label="More actions"
          >
            ⚡ Quick Add ▼
          </button>

          {showDropdown && (
            <div className={styles.dropdownMenu}>
              {quickActions.map((item) => (
                <button
                  key={item.action}
                  className={styles.dropdownItem}
                  onClick={() => {
                    onAction(item.action);
                    setShowDropdown(false);
                  }}
                >
                  <span className={styles.icon}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
