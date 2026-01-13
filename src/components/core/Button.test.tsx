/**
 * Tests for Button Component
 *
 * Tests button variants, sizes, states, and accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button Component', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      render(<Button>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should render all variants', () => {
      const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;

      variants.forEach((variant) => {
        const { unmount } = render(<Button variant={variant}>{variant}</Button>);
        const button = screen.getByRole('button', { name: new RegExp(variant, 'i') });
        expect(button).toBeInTheDocument();
        unmount();
      });
    });

    it('should render all sizes', () => {
      const sizes = ['sm', 'md', 'lg'] as const;

      sizes.forEach((size) => {
        const { unmount } = render(<Button size={size}>{size}</Button>);
        const button = screen.getByRole('button', { name: new RegExp(size, 'i') });
        expect(button).toBeInTheDocument();
        unmount();
      });
    });

    it('should render full width when specified', () => {
      render(<Button fullWidth>Full Width</Button>);

      const button = screen.getByRole('button');
      expect(button.className).toContain('fullWidth');
    });

    it('should render with icon before', () => {
      render(<Button iconBefore={<span data-testid="icon-before">🔒</span>}>Secure</Button>);

      expect(screen.getByTestId('icon-before')).toBeInTheDocument();
    });

    it('should render with icon after', () => {
      render(<Button iconAfter={<span data-testid="icon-after">→</span>}>Next</Button>);

      expect(screen.getByTestId('icon-after')).toBeInTheDocument();
    });

    it('should render with both icons', () => {
      render(
        <Button
          iconBefore={<span data-testid="icon-before">←</span>}
          iconAfter={<span data-testid="icon-after">→</span>}
        >
          Both
        </Button>
      );

      expect(screen.getByTestId('icon-before')).toBeInTheDocument();
      expect(screen.getByTestId('icon-after')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when loading', () => {
      render(<Button loading>Loading</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();
    });

    it('should hide icons when loading', () => {
      render(
        <Button
          loading
          iconBefore={<span data-testid="icon-before">🔒</span>}
          iconAfter={<span data-testid="icon-after">→</span>}
        >
          Processing
        </Button>
      );

      expect(screen.queryByTestId('icon-before')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-after')).not.toBeInTheDocument();
    });

    it('should show spinner with aria-hidden', () => {
      const { container } = render(<Button loading>Loading</Button>);

      const spinner = container.querySelector('[aria-hidden="true"]');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('should be disabled when loading', () => {
      render(<Button loading>Loading</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button disabled onClick={handleClick}>Disabled</Button>);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('interactions', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should support keyboard activation with Enter', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Press Enter</Button>);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalled();
    });

    it('should support keyboard activation with Space', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Press Space</Button>);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('button types', () => {
    it('should default to type="button"', () => {
      render(<Button>Default Type</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should accept type="submit"', () => {
      render(<Button type="submit">Submit</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should accept type="reset"', () => {
      render(<Button type="reset">Reset</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'reset');
    });
  });

  describe('custom props', () => {
    it('should accept custom className', () => {
      render(<Button className="custom-class">Custom</Button>);

      const button = screen.getByRole('button');
      expect(button.className).toContain('custom-class');
    });

    it('should forward additional props', () => {
      render(<Button data-testid="custom-button" aria-label="Custom label">Custom</Button>);

      const button = screen.getByTestId('custom-button');
      expect(button).toHaveAttribute('aria-label', 'Custom label');
    });

    it('should forward ref', () => {
      const ref = vi.fn();
      render(<Button ref={ref}>With Ref</Button>);

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
    });
  });

  describe('accessibility', () => {
    it('should have accessible role', () => {
      render(<Button>Accessible</Button>);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should set aria-busy when loading', () => {
      render(<Button loading>Loading</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('should set aria-disabled when disabled', () => {
      render(<Button disabled>Disabled</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('should hide icons from screen readers', () => {
      const { container } = render(
        <Button iconBefore={<span>🔒</span>}>Secure</Button>
      );

      const iconContainer = container.querySelector('[aria-hidden="true"]');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should be keyboard focusable', () => {
      render(<Button>Focusable</Button>);

      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('should not be keyboard focusable when disabled', () => {
      render(<Button disabled>Not Focusable</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty children', () => {
      render(<Button />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle complex children', () => {
      render(
        <Button>
          <span>Complex</span> <strong>Children</strong>
        </Button>
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Complex')).toBeInTheDocument();
      expect(screen.getByText('Children')).toBeInTheDocument();
    });

    it('should handle rapid clicks', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Click Fast</Button>);

      const button = screen.getByRole('button');
      await user.tripleClick(button);

      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it('should handle being toggled between loading states', () => {
      const { rerender } = render(<Button loading>Loading</Button>);

      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');

      rerender(<Button loading={false}>Not Loading</Button>);

      button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'false');
    });
  });
});
