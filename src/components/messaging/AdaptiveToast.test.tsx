/**
 * Tests for AdaptiveToast Component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdaptiveToast, AdaptiveToastContainer, type Toast } from './AdaptiveToast';
import type { DISCProfile } from '../../utils/discMessageAdapter';

describe('AdaptiveToast', () => {
  const dominanceProfile: DISCProfile = {
    dominanceScore: 90,
    influenceScore: 30,
    steadinessScore: 20,
    conscientiousnessScore: 40,
    primaryStyle: 'D',
    secondaryStyle: 'C',
  };

  const influenceProfile: DISCProfile = {
    dominanceScore: 30,
    influenceScore: 90,
    steadinessScore: 20,
    conscientiousnessScore: 40,
    primaryStyle: 'I',
    secondaryStyle: 'C',
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('should render toast with Dominance style message', () => {
      render(
        <AdaptiveToast
          messageId="transaction.save.success"
          profile={dominanceProfile}
          type="success"
          show={true}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText("Done. Transaction recorded. What's next?")).toBeInTheDocument();
    });

    it('should render toast with Influence style message', () => {
      render(
        <AdaptiveToast
          messageId="transaction.save.success"
          profile={influenceProfile}
          type="success"
          show={true}
        />
      );

      expect(screen.getByText("Woohoo! Transaction saved! You're on a roll!")).toBeInTheDocument();
    });

    it('should render with different toast types', () => {
      const { rerender } = render(
        <AdaptiveToast
          messageId="transaction.save.success"
          type="success"
          show={true}
        />
      );

      expect(screen.getByRole('alert')).toHaveClass('adaptive-toast--success');

      rerender(
        <AdaptiveToast
          messageId="sync.error.network"
          type="error"
          show={true}
        />
      );

      expect(screen.getByRole('alert')).toHaveClass('adaptive-toast--error');
    });

    it('should interpolate placeholders', () => {
      render(
        <AdaptiveToast
          messageId="account.create.success"
          placeholders={{ type: 'Asset', number: '1000' }}
          profile={dominanceProfile}
          type="success"
          show={true}
        />
      );

      // The D variant for account.create.success doesn't show placeholders,
      // but we can test with a C profile
      const cProfile: DISCProfile = {
        dominanceScore: 30,
        influenceScore: 20,
        steadinessScore: 40,
        conscientiousnessScore: 90,
        primaryStyle: 'C',
        secondaryStyle: 'S',
      };

      render(
        <AdaptiveToast
          messageId="account.create.success"
          placeholders={{ type: 'Asset', number: '1000' }}
          profile={cProfile}
          type="success"
          show={true}
        />
      );

      expect(screen.getByText(/Asset/)).toBeInTheDocument();
      expect(screen.getByText(/1000/)).toBeInTheDocument();
    });

    it('should not render when show is false', () => {
      render(
        <AdaptiveToast
          messageId="transaction.save.success"
          show={false}
        />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-dismiss after duration', async () => {
      const onDismiss = vi.fn();

      render(
        <AdaptiveToast
          messageId="transaction.save.success"
          type="success"
          duration={1000}
          onDismiss={onDismiss}
          show={true}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Fast-forward time past duration and animation
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // Should have been called after time advances
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should not auto-dismiss when duration is 0', async () => {
      const onDismiss = vi.fn();

      render(
        <AdaptiveToast
          messageId="transaction.save.success"
          type="success"
          duration={0}
          onDismiss={onDismiss}
          show={true}
        />
      );

      vi.advanceTimersByTime(5000);

      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('manual dismiss', () => {
    it('should dismiss when close button clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const onDismiss = vi.fn();

      render(
        <AdaptiveToast
          messageId="transaction.save.success"
          type="success"
          onDismiss={onDismiss}
          show={true}
        />
      );

      const dismissButton = screen.getByLabelText('Dismiss notification');
      await user.click(dismissButton);

      // Fast-forward animation time
      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Should have been called
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <AdaptiveToast
          messageId="transaction.save.success"
          type="success"
          show={true}
        />
      );

      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('aria-live', 'polite');
    });

    it('should have accessible dismiss button', () => {
      render(
        <AdaptiveToast
          messageId="transaction.save.success"
          type="success"
          show={true}
        />
      );

      const dismissButton = screen.getByLabelText('Dismiss notification');
      expect(dismissButton).toBeInTheDocument();
      expect(dismissButton).toHaveAttribute('type', 'button');
    });
  });
});

describe('AdaptiveToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const mockToasts: Toast[] = [
    {
      id: '1',
      messageId: 'transaction.save.success',
      type: 'success',
      duration: 3000,
    },
    {
      id: '2',
      messageId: 'sync.error.network',
      type: 'error',
      duration: 0,
    },
  ];

  it('should render multiple toasts', () => {
    const onDismiss = vi.fn();

    render(
      <AdaptiveToastContainer
        toasts={mockToasts}
        onDismiss={onDismiss}
        position="top-right"
      />
    );

    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

  it('should not render when toasts array is empty', () => {
    const onDismiss = vi.fn();

    const { container } = render(
      <AdaptiveToastContainer
        toasts={[]}
        onDismiss={onDismiss}
        position="top-right"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should apply position class', () => {
    const onDismiss = vi.fn();

    const { container, rerender } = render(
      <AdaptiveToastContainer
        toasts={mockToasts}
        onDismiss={onDismiss}
        position="top-right"
      />
    );

    expect(container.querySelector('.adaptive-toast-container--top-right')).toBeInTheDocument();

    rerender(
      <AdaptiveToastContainer
        toasts={mockToasts}
        onDismiss={onDismiss}
        position="bottom-left"
      />
    );

    expect(container.querySelector('.adaptive-toast-container--bottom-left')).toBeInTheDocument();
  });

  it('should call onDismiss with correct toast id', async () => {
    const user = userEvent.setup({ delay: null });
    const onDismiss = vi.fn();

    render(
      <AdaptiveToastContainer
        toasts={mockToasts}
        onDismiss={onDismiss}
        position="top-right"
      />
    );

    const dismissButtons = screen.getAllByLabelText('Dismiss notification');
    await user.click(dismissButtons[0]!);

    // Fast-forward animation time
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Should have been called with correct ID
    expect(onDismiss).toHaveBeenCalledWith('1');
  });

  it('should pass profile to all toasts', () => {
    const profile: DISCProfile = {
      dominanceScore: 90,
      influenceScore: 30,
      steadinessScore: 20,
      conscientiousnessScore: 40,
      primaryStyle: 'D',
      secondaryStyle: 'C',
    };

    const onDismiss = vi.fn();

    render(
      <AdaptiveToastContainer
        toasts={mockToasts}
        profile={profile}
        onDismiss={onDismiss}
        position="top-right"
      />
    );

    // D variant of transaction.save.success
    expect(screen.getByText("Done. Transaction recorded. What's next?")).toBeInTheDocument();
  });
});
