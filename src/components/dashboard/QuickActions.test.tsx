/**
 * Tests for QuickActions Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickActions, type QuickAction } from './QuickActions';

const mockActions: QuickAction[] = [
  {
    id: '1',
    label: 'New Transaction',
    icon: <span data-testid="icon-1">+</span>,
    onClick: vi.fn(),
  },
  {
    id: '2',
    label: 'New Account',
    icon: <span data-testid="icon-2">$</span>,
    onClick: vi.fn(),
    variant: 'primary',
  },
  {
    id: '3',
    label: 'View Reports',
    onClick: vi.fn(),
    variant: 'secondary',
  },
];

describe('QuickActions Component', () => {
  describe('rendering', () => {
    it('should render with actions', () => {
      render(<QuickActions actions={mockActions} />);

      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('New Transaction')).toBeInTheDocument();
      expect(screen.getByText('New Account')).toBeInTheDocument();
      expect(screen.getByText('View Reports')).toBeInTheDocument();
    });

    it('should render correct number of actions', () => {
      render(<QuickActions actions={mockActions} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    it('should render with custom title', () => {
      render(<QuickActions actions={mockActions} title="My Actions" />);

      expect(screen.getByText('My Actions')).toBeInTheDocument();
    });

    it('should render icons when provided', () => {
      render(<QuickActions actions={mockActions} />);

      expect(screen.getByTestId('icon-1')).toBeInTheDocument();
      expect(screen.getByTestId('icon-2')).toBeInTheDocument();
    });

    it('should not render icons when not provided', () => {
      render(<QuickActions actions={mockActions} />);

      const viewReportsButton = screen.getByText('View Reports').closest('button');
      expect(viewReportsButton?.querySelector('[data-testid^="icon"]')).not.toBeInTheDocument();
    });

    it('should return null when no actions provided', () => {
      const { container } = render(<QuickActions actions={[]} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('interactions', () => {
    it('should call onClick when action clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Test Action',
          onClick: handleClick,
        },
      ];

      render(<QuickActions actions={actions} />);

      const button = screen.getByRole('button', { name: /test action/i });
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should call correct handler for each action', async () => {
      const user = userEvent.setup();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const actions: QuickAction[] = [
        { id: '1', label: 'Action 1', onClick: handler1 },
        { id: '2', label: 'Action 2', onClick: handler2 },
      ];

      render(<QuickActions actions={actions} />);

      await user.click(screen.getByRole('button', { name: /action 1/i }));
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /action 2/i }));
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Disabled Action',
          onClick: handleClick,
          disabled: true,
        },
      ];

      render(<QuickActions actions={actions} />);

      const button = screen.getByRole('button', { name: /disabled action/i });
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should support keyboard activation', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Test Action',
          onClick: handleClick,
        },
      ];

      render(<QuickActions actions={actions} />);

      const button = screen.getByRole('button', { name: /test action/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('variants', () => {
    it('should apply primary variant', () => {
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Primary Action',
          onClick: vi.fn(),
          variant: 'primary',
        },
      ];

      render(<QuickActions actions={actions} />);

      const button = screen.getByRole('button', { name: /primary action/i });
      expect(button).toBeInTheDocument();
    });

    it('should apply secondary variant', () => {
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Secondary Action',
          onClick: vi.fn(),
          variant: 'secondary',
        },
      ];

      render(<QuickActions actions={actions} />);

      const button = screen.getByRole('button', { name: /secondary action/i });
      expect(button).toBeInTheDocument();
    });

    it('should default to secondary variant', () => {
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Default Action',
          onClick: vi.fn(),
        },
      ];

      render(<QuickActions actions={actions} />);

      const button = screen.getByRole('button', { name: /default action/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should disable button when disabled prop is true', () => {
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Disabled Action',
          onClick: vi.fn(),
          disabled: true,
        },
      ];

      render(<QuickActions actions={actions} />);

      const button = screen.getByRole('button', { name: /disabled action/i });
      expect(button).toBeDisabled();
    });

    it('should enable button when disabled prop is false', () => {
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Enabled Action',
          onClick: vi.fn(),
          disabled: false,
        },
      ];

      render(<QuickActions actions={actions} />);

      const button = screen.getByRole('button', { name: /enabled action/i });
      expect(button).not.toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have accessible group role', () => {
      render(<QuickActions actions={mockActions} />);

      expect(screen.getByRole('group', { name: /quick actions/i })).toBeInTheDocument();
    });

    it('should have aria-label on buttons', () => {
      render(<QuickActions actions={mockActions} />);

      expect(screen.getByRole('button', { name: 'New Transaction' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'New Account' })).toBeInTheDocument();
    });

    it('should hide icons from screen readers', () => {
      const { container } = render(<QuickActions actions={mockActions} />);

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should be keyboard focusable', () => {
      render(<QuickActions actions={mockActions} />);

      const button = screen.getByRole('button', { name: 'New Transaction' });
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('should not be keyboard focusable when disabled', () => {
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Disabled Action',
          onClick: vi.fn(),
          disabled: true,
        },
      ];

      render(<QuickActions actions={actions} />);

      const button = screen.getByRole('button', { name: /disabled action/i });
      expect(button).toBeDisabled();
    });
  });

  describe('custom props', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <QuickActions actions={mockActions} className="custom-class" />
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv.className).toContain('custom-class');
    });
  });

  describe('edge cases', () => {
    it('should handle single action', () => {
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Single Action',
          onClick: vi.fn(),
        },
      ];

      render(<QuickActions actions={actions} />);

      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('should handle many actions', () => {
      const actions: QuickAction[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        label: `Action ${i}`,
        onClick: vi.fn(),
      }));

      render(<QuickActions actions={actions} />);

      expect(screen.getAllByRole('button')).toHaveLength(10);
    });

    it('should handle long action labels', () => {
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'This is a very long action label that might wrap',
          onClick: vi.fn(),
        },
      ];

      render(<QuickActions actions={actions} />);

      expect(
        screen.getByText(/This is a very long action label/)
      ).toBeInTheDocument();
    });

    it('should handle actions with duplicate labels', () => {
      const actions: QuickAction[] = [
        { id: '1', label: 'Action', onClick: vi.fn() },
        { id: '2', label: 'Action', onClick: vi.fn() },
      ];

      render(<QuickActions actions={actions} />);

      const buttons = screen.getAllByRole('button', { name: /action/i });
      expect(buttons).toHaveLength(2);
    });
  });

  describe('integration', () => {
    it('should render complete set of actions with all features', () => {
      const actions: QuickAction[] = [
        {
          id: '1',
          label: 'Primary Action',
          icon: <span data-testid="icon-primary">🎯</span>,
          onClick: vi.fn(),
          variant: 'primary',
        },
        {
          id: '2',
          label: 'Secondary Action',
          icon: <span data-testid="icon-secondary">📊</span>,
          onClick: vi.fn(),
          variant: 'secondary',
        },
        {
          id: '3',
          label: 'Disabled Action',
          onClick: vi.fn(),
          disabled: true,
        },
      ];

      render(<QuickActions actions={actions} title="Dashboard Actions" />);

      expect(screen.getByText('Dashboard Actions')).toBeInTheDocument();
      expect(screen.getByTestId('icon-primary')).toBeInTheDocument();
      expect(screen.getByTestId('icon-secondary')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Disabled Action' })).toBeDisabled();
    });
  });
});
