/**
 * Tests for FeatureGate Component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureGate, useFeatureGate } from './FeatureGate';

describe('FeatureGate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('basic rendering', () => {
    it('should render children when feature is accessible', () => {
      render(
        <FeatureGate
          feature="dashboard"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
        >
          <div>Dashboard Content</div>
        </FeatureGate>
      );

      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });

    it('should not render children when feature is not accessible', () => {
      render(
        <FeatureGate
          feature="invoicing"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
        >
          <div>Invoicing Content</div>
        </FeatureGate>
      );

      expect(screen.queryByText('Invoicing Content')).not.toBeInTheDocument();
    });

    it('should render nothing by default when feature is locked', () => {
      const { container } = render(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render nothing when feature is not visible', () => {
      const { container } = render(
        <FeatureGate
          feature="forecasting"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
          hideIfNotVisible={true}
        >
          <div>Forecasting Content</div>
        </FeatureGate>
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('fallback rendering', () => {
    it('should render fallback when feature is locked and showLocked is true', () => {
      render(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
          showLocked={true}
          fallback={<div>Locked Message</div>}
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      expect(screen.queryByText('Categories Content')).not.toBeInTheDocument();
      expect(screen.getByText('Locked Message')).toBeInTheDocument();
    });

    it('should not render fallback when showLocked is false', () => {
      const { container } = render(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
          showLocked={false}
          fallback={<div>Locked Message</div>}
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render custom fallback component', () => {
      const CustomFallback = () => <div role="alert">Custom Locked State</div>;

      render(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
          showLocked={true}
          fallback={<CustomFallback />}
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Custom Locked State');
    });
  });

  describe('hideIfNotVisible behavior', () => {
    it('should hide when feature is not visible and hideIfNotVisible is true', () => {
      const { container } = render(
        <FeatureGate
          feature="forecasting"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
          hideIfNotVisible={true}
          fallback={<div>Fallback</div>}
        >
          <div>Content</div>
        </FeatureGate>
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show fallback when hideIfNotVisible is false but feature is locked', () => {
      render(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
          hideIfNotVisible={false}
          showLocked={true}
          fallback={<div>Locked Categories</div>}
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      expect(screen.getByText('Locked Categories')).toBeInTheDocument();
    });
  });

  describe('phase transitions', () => {
    it('should render children when phase increases and feature becomes accessible', () => {
      const { rerender } = render(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      expect(screen.queryByText('Categories Content')).not.toBeInTheDocument();

      rerender(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'organize', userId: 'test-user' }}
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      expect(screen.getByText('Categories Content')).toBeInTheDocument();
    });

    it('should handle phase progression correctly', () => {
      const { rerender } = render(
        <FeatureGate
          feature="invoicing"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
        >
          <div>Invoicing Content</div>
        </FeatureGate>
      );

      expect(screen.queryByText('Invoicing Content')).not.toBeInTheDocument();

      // Move to organize (still not accessible)
      rerender(
        <FeatureGate
          feature="invoicing"
          visibilityOptions={{ currentPhase: 'organize', userId: 'test-user' }}
        >
          <div>Invoicing Content</div>
        </FeatureGate>
      );

      expect(screen.queryByText('Invoicing Content')).not.toBeInTheDocument();

      // Move to build (now accessible)
      rerender(
        <FeatureGate
          feature="invoicing"
          visibilityOptions={{ currentPhase: 'build', userId: 'test-user' }}
        >
          <div>Invoicing Content</div>
        </FeatureGate>
      );

      expect(screen.getByText('Invoicing Content')).toBeInTheDocument();
    });
  });

  describe('showAllFeatures override', () => {
    it('should show locked features when showAllFeatures is true', () => {
      render(
        <FeatureGate
          feature="forecasting"
          visibilityOptions={{
            currentPhase: 'stabilize',
            userId: 'test-user',
            initialShowAllFeatures: true,
          }}
          showLocked={true}
          fallback={<div>Locked Forecasting</div>}
        >
          <div>Forecasting Content</div>
        </FeatureGate>
      );

      // Should show fallback because feature is locked, but is visible due to showAllFeatures
      expect(screen.getByText('Locked Forecasting')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should maintain accessible structure for children', () => {
      render(
        <FeatureGate
          feature="dashboard"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
        >
          <button aria-label="Open Dashboard">Dashboard</button>
        </FeatureGate>
      );

      const button = screen.getByLabelText('Open Dashboard');
      expect(button).toBeInTheDocument();
    });

    it('should maintain accessible structure for fallback', () => {
      render(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
          showLocked={true}
          fallback={
            <div role="alert" aria-label="Feature locked">
              Categories coming soon
            </div>
          }
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-label', 'Feature locked');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined userId gracefully', () => {
      render(
        <FeatureGate
          feature="dashboard"
          visibilityOptions={{ currentPhase: 'stabilize' }}
        >
          <div>Dashboard Content</div>
        </FeatureGate>
      );

      // Should still work without userId
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });

    it('should handle multiple feature gates for same feature', () => {
      render(
        <div>
          <FeatureGate
            feature="dashboard"
            visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
          >
            <div>Dashboard Instance 1</div>
          </FeatureGate>
          <FeatureGate
            feature="dashboard"
            visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
          >
            <div>Dashboard Instance 2</div>
          </FeatureGate>
        </div>
      );

      expect(screen.getByText('Dashboard Instance 1')).toBeInTheDocument();
      expect(screen.getByText('Dashboard Instance 2')).toBeInTheDocument();
    });

    it('should handle rapid phase changes', () => {
      const { rerender } = render(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'stabilize', userId: 'test-user' }}
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      // Rapid phase changes
      rerender(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'organize', userId: 'test-user' }}
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      rerender(
        <FeatureGate
          feature="categories"
          visibilityOptions={{ currentPhase: 'build', userId: 'test-user' }}
        >
          <div>Categories Content</div>
        </FeatureGate>
      );

      expect(screen.getByText('Categories Content')).toBeInTheDocument();
    });
  });
});

describe('useFeatureGate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should provide feature access information', () => {
    const TestComponent = () => {
      const { canAccess, isVisible, access, metadata } = useFeatureGate('dashboard', {
        currentPhase: 'stabilize',
        userId: 'test-user',
      });

      return (
        <div>
          <div data-testid="can-access">{canAccess.toString()}</div>
          <div data-testid="is-visible">{isVisible.toString()}</div>
          <div data-testid="access-reason">{access.reason || 'none'}</div>
          <div data-testid="metadata-name">{metadata?.name || 'none'}</div>
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId('can-access')).toHaveTextContent('true');
    expect(screen.getByTestId('is-visible')).toHaveTextContent('true');
    expect(screen.getByTestId('access-reason')).toHaveTextContent('none');
    expect(screen.getByTestId('metadata-name')).toHaveTextContent('Dashboard');
  });

  it('should handle locked features', () => {
    const TestComponent = () => {
      const { canAccess, isVisible, access } = useFeatureGate('categories', {
        currentPhase: 'stabilize',
        userId: 'test-user',
      });

      return (
        <div>
          <div data-testid="can-access">{canAccess.toString()}</div>
          <div data-testid="is-visible">{isVisible.toString()}</div>
          <div data-testid="reason">{access.reason || 'none'}</div>
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId('can-access')).toHaveTextContent('false');
    expect(screen.getByTestId('is-visible')).toHaveTextContent('true');
    expect(screen.getByTestId('reason')).toHaveTextContent('phase-locked');
  });

  it('should update when phase changes', () => {
    const TestComponent = ({ phase }: { phase: string }) => {
      const { canAccess } = useFeatureGate('categories', {
        currentPhase: phase as any,
        userId: 'test-user',
      });

      return <div data-testid="can-access">{canAccess.toString()}</div>;
    };

    const { rerender } = render(<TestComponent phase="stabilize" />);
    expect(screen.getByTestId('can-access')).toHaveTextContent('false');

    rerender(<TestComponent phase="organize" />);
    expect(screen.getByTestId('can-access')).toHaveTextContent('true');
  });
});
