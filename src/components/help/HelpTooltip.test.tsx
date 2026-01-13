/**
 * Tests for HelpTooltip component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HelpTooltip } from './HelpTooltip';

describe('HelpTooltip', () => {
  it('should render trigger button', () => {
    render(<HelpTooltip content="Test help content" />);
    const trigger = screen.getByTestId('help-tooltip-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('?');
  });

  it('should show tooltip on hover', async () => {
    render(<HelpTooltip content="Test help content" />);
    const trigger = screen.getByTestId('help-tooltip-trigger');

    // Tooltip should not be visible initially
    expect(screen.queryByTestId('help-tooltip-content')).not.toBeInTheDocument();

    // Hover over trigger
    fireEvent.mouseEnter(trigger);

    // Tooltip should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('help-tooltip-content')).toBeInTheDocument();
    });
  });

  it('should hide tooltip on mouse leave', async () => {
    render(<HelpTooltip content="Test help content" />);
    const trigger = screen.getByTestId('help-tooltip-trigger');

    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
      expect(screen.getByTestId('help-tooltip-content')).toBeInTheDocument();
    });

    fireEvent.mouseLeave(trigger);
    await waitFor(() => {
      expect(screen.queryByTestId('help-tooltip-content')).not.toBeInTheDocument();
    });
  });

  it('should show tooltip on focus', async () => {
    render(<HelpTooltip content="Test help content" />);
    const trigger = screen.getByTestId('help-tooltip-trigger');

    fireEvent.focus(trigger);
    await waitFor(() => {
      expect(screen.getByTestId('help-tooltip-content')).toBeInTheDocument();
    });
  });

  it('should hide tooltip on blur', async () => {
    render(<HelpTooltip content="Test help content" />);
    const trigger = screen.getByTestId('help-tooltip-trigger');

    fireEvent.focus(trigger);
    await waitFor(() => {
      expect(screen.getByTestId('help-tooltip-content')).toBeInTheDocument();
    });

    fireEvent.blur(trigger);
    await waitFor(() => {
      expect(screen.queryByTestId('help-tooltip-content')).not.toBeInTheDocument();
    });
  });

  it('should display content text', async () => {
    const content = 'This is helpful information';
    render(<HelpTooltip content={content} />);
    const trigger = screen.getByTestId('help-tooltip-trigger');

    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
      expect(screen.getByText(content)).toBeInTheDocument();
    });
  });

  it('should display title when provided', async () => {
    const title = 'Help Title';
    const content = 'Help content';
    render(<HelpTooltip title={title} content={content} />);
    const trigger = screen.getByTestId('help-tooltip-trigger');

    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it('should show learn more link when provided', async () => {
    const onLearnMore = vi.fn();
    render(
      <HelpTooltip
        content="Test content"
        learnMoreLink="test-term"
        onLearnMore={onLearnMore}
      />
    );
    const trigger = screen.getByTestId('help-tooltip-trigger');

    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
      expect(screen.getByTestId('help-tooltip-learn-more')).toBeInTheDocument();
    });
  });

  it('should call onLearnMore when learn more is clicked', async () => {
    const onLearnMore = vi.fn();
    const learnMoreLink = 'test-term';
    render(
      <HelpTooltip
        content="Test content"
        learnMoreLink={learnMoreLink}
        onLearnMore={onLearnMore}
      />
    );
    const trigger = screen.getByTestId('help-tooltip-trigger');

    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
      const learnMore = screen.getByTestId('help-tooltip-learn-more');
      fireEvent.click(learnMore);
    });

    expect(onLearnMore).toHaveBeenCalledWith(learnMoreLink);
  });

  it('should not show learn more if no link provided', async () => {
    render(<HelpTooltip content="Test content" />);
    const trigger = screen.getByTestId('help-tooltip-trigger');

    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
      expect(screen.queryByTestId('help-tooltip-learn-more')).not.toBeInTheDocument();
    });
  });

  it('should have proper accessibility attributes', () => {
    render(<HelpTooltip content="Test content" />);
    const trigger = screen.getByTestId('help-tooltip-trigger');

    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-label', 'Help');
  });

  it('should have tooltip role when visible', async () => {
    render(<HelpTooltip content="Test content" />);
    const trigger = screen.getByTestId('help-tooltip-trigger');

    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
      const tooltip = screen.getByTestId('help-tooltip-content');
      expect(tooltip).toHaveAttribute('role', 'tooltip');
    });
  });

  it('should support different positions', async () => {
    const { rerender } = render(
      <HelpTooltip content="Test content" position="top" />
    );
    const trigger = screen.getByTestId('help-tooltip-trigger');

    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
      const tooltip = screen.getByTestId('help-tooltip-content');
      expect(tooltip.className).toContain('bottom-full');
    });

    fireEvent.mouseLeave(trigger);
    await waitFor(() => {
      expect(screen.queryByTestId('help-tooltip-content')).not.toBeInTheDocument();
    });

    rerender(<HelpTooltip content="Test content" position="bottom" />);
    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
      const tooltip = screen.getByTestId('help-tooltip-content');
      expect(tooltip.className).toContain('top-full');
    });
  });
});
