/**
 * Tests for AdaptiveHelp Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdaptiveHelp, AdaptiveHelpText } from './AdaptiveHelp';
import type { DISCProfile } from '../../utils/discMessageAdapter';

describe('AdaptiveHelp', () => {
  const dominanceProfile: DISCProfile = {
    dominanceScore: 90,
    influenceScore: 30,
    steadinessScore: 20,
    conscientiousnessScore: 40,
    primaryStyle: 'D',
    secondaryStyle: 'C',
  };

  const conscientiousnessProfile: DISCProfile = {
    dominanceScore: 30,
    influenceScore: 20,
    steadinessScore: 40,
    conscientiousnessScore: 90,
    primaryStyle: 'C',
    secondaryStyle: 'S',
  };

  describe('inline mode', () => {
    it('should render inline help with message', () => {
      render(
        <AdaptiveHelp
          messageId="help.chart_of_accounts"
          profile={dominanceProfile}
          mode="inline"
        />
      );

      expect(screen.getByText(/Chart of Accounts/)).toBeInTheDocument();
    });

    it('should show Dominance style message', () => {
      render(
        <AdaptiveHelp
          messageId="help.chart_of_accounts"
          profile={dominanceProfile}
          mode="inline"
        />
      );

      expect(screen.getByText("Chart of Accounts: Categories for all your money. Assets, income, expenses.")).toBeInTheDocument();
    });

    it('should show Conscientiousness style message', () => {
      render(
        <AdaptiveHelp
          messageId="help.chart_of_accounts"
          profile={conscientiousnessProfile}
          mode="inline"
        />
      );

      expect(screen.getByText(/systematic classification/)).toBeInTheDocument();
      expect(screen.getByText(/GAAP principles/)).toBeInTheDocument();
    });

    it('should render custom icon', () => {
      render(
        <AdaptiveHelp
          messageId="help.chart_of_accounts"
          mode="inline"
          icon={<span data-testid="custom-icon">ℹ</span>}
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('tooltip mode', () => {
    it('should render help trigger button', () => {
      render(
        <AdaptiveHelp
          messageId="help.chart_of_accounts"
          mode="tooltip"
        />
      );

      expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
    });

    it('should show tooltip on hover', async () => {
      const user = userEvent.setup();

      render(
        <AdaptiveHelp
          messageId="help.chart_of_accounts"
          profile={dominanceProfile}
          mode="tooltip"
        />
      );

      const trigger = screen.getByRole('button', { name: 'Help' });

      // Initially tooltip should not be visible
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Hover over trigger
      await user.hover(trigger);

      // Tooltip should appear
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText(/Chart of Accounts/)).toBeInTheDocument();
    });

    it('should hide tooltip on mouse leave', async () => {
      const user = userEvent.setup();

      render(
        <AdaptiveHelp
          messageId="help.chart_of_accounts"
          mode="tooltip"
        />
      );

      const trigger = screen.getByRole('button', { name: 'Help' });

      // Hover to show
      await user.hover(trigger);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Unhover to hide
      await user.unhover(trigger);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should show tooltip on focus', async () => {
      const user = userEvent.setup();

      render(
        <AdaptiveHelp
          messageId="help.chart_of_accounts"
          mode="tooltip"
        />
      );

      const trigger = screen.getByRole('button', { name: 'Help' });

      // Focus trigger
      await user.tab();
      expect(trigger).toHaveFocus();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper button role and label', () => {
      render(
        <AdaptiveHelp
          messageId="help.chart_of_accounts"
          mode="tooltip"
        />
      );

      const button = screen.getByRole('button', { name: 'Help' });
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should have tooltip role', async () => {
      const user = userEvent.setup();

      render(
        <AdaptiveHelp
          messageId="help.chart_of_accounts"
          mode="tooltip"
        />
      );

      const trigger = screen.getByRole('button', { name: 'Help' });
      await user.hover(trigger);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('placeholder interpolation', () => {
    it('should interpolate placeholders in help text', () => {
      // Using a message with placeholders in all variants
      render(
        <AdaptiveHelp
          messageId="transaction.validation.unbalanced"
          placeholders={{ debits: '100.00', credits: '95.00', difference: '5.00' }}
          profile={conscientiousnessProfile}
          mode="inline"
        />
      );

      expect(screen.getByText(/100.00/)).toBeInTheDocument();
      expect(screen.getByText(/95.00/)).toBeInTheDocument();
    });
  });
});

describe('AdaptiveHelpText', () => {
  const dominanceProfile: DISCProfile = {
    dominanceScore: 90,
    influenceScore: 30,
    steadinessScore: 20,
    conscientiousnessScore: 40,
    primaryStyle: 'D',
    secondaryStyle: 'C',
  };

  it('should render as paragraph by default', () => {
    const { container } = render(
      <AdaptiveHelpText
        messageId="help.chart_of_accounts"
        profile={dominanceProfile}
      />
    );

    expect(container.querySelector('p')).toBeInTheDocument();
  });

  it('should render as span when specified', () => {
    const { container } = render(
      <AdaptiveHelpText
        messageId="help.chart_of_accounts"
        profile={dominanceProfile}
        as="span"
      />
    );

    expect(container.querySelector('span')).toBeInTheDocument();
  });

  it('should render adaptive message', () => {
    render(
      <AdaptiveHelpText
        messageId="help.chart_of_accounts"
        profile={dominanceProfile}
      />
    );

    expect(screen.getByText("Chart of Accounts: Categories for all your money. Assets, income, expenses.")).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <AdaptiveHelpText
        messageId="help.chart_of_accounts"
        className="custom-class"
      />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should interpolate placeholders', () => {
    // Use C profile to ensure placeholders are shown
    const cProfile: DISCProfile = {
      dominanceScore: 30,
      influenceScore: 20,
      steadinessScore: 40,
      conscientiousnessScore: 90,
      primaryStyle: 'C',
      secondaryStyle: 'S',
    };

    render(
      <AdaptiveHelpText
        messageId="transaction.validation.unbalanced"
        placeholders={{ debits: '100.00', credits: '95.00', difference: '5.00' }}
        profile={cProfile}
      />
    );

    expect(screen.getByText(/Debits: 100.00/)).toBeInTheDocument();
  });
});
