/**
 * AssessmentProgress Component Tests
 *
 * Tests for progress indicator and milestone messaging
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssessmentProgress } from './AssessmentProgress';

describe('AssessmentProgress', () => {
  it('renders progress information correctly', () => {
    render(
      <AssessmentProgress
        currentQuestion={5}
        totalQuestions={16}
        percentComplete={31}
        sectionName="Current Financial State"
      />
    );

    expect(screen.getByText(/Question \d+ of \d+/)).toBeInTheDocument();
    expect(screen.getByText('31%')).toBeInTheDocument();
  });

  it('displays correct message for < 25% progress', () => {
    render(
      <AssessmentProgress
        currentQuestion={2}
        totalQuestions={16}
        percentComplete={12}
        sectionName="Business Fundamentals"
      />
    );

    const messages = screen.getAllByText(/Getting to know you/i);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('displays correct message for 25% progress', () => {
    render(
      <AssessmentProgress
        currentQuestion={4}
        totalQuestions={16}
        percentComplete={25}
        sectionName="Business Fundamentals"
      />
    );

    const messages = screen.getAllByText(/You're making great progress!/i);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('displays correct message for 50% progress', () => {
    render(
      <AssessmentProgress
        currentQuestion={8}
        totalQuestions={16}
        percentComplete={50}
        sectionName="Financial Literacy"
      />
    );

    const messages = screen.getAllByText(/Halfway there! You're doing great./i);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('displays correct message for 75% progress', () => {
    render(
      <AssessmentProgress
        currentQuestion={12}
        totalQuestions={16}
        percentComplete={75}
        sectionName="Business Specific"
      />
    );

    const messages = screen.getAllByText(/Almost there! You're doing wonderfully./i);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('displays correct message for 100% progress', () => {
    render(
      <AssessmentProgress
        currentQuestion={16}
        totalQuestions={16}
        percentComplete={100}
        sectionName="Communication Style"
      />
    );

    const messages = screen.getAllByText(/Welcome to Graceful Books! We've prepared a personalized path just for you./i);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('displays section name', () => {
    render(
      <AssessmentProgress
        currentQuestion={5}
        totalQuestions={16}
        percentComplete={31}
        sectionName="Current Financial State"
      />
    );

    expect(screen.getByText('Current Financial State')).toBeInTheDocument();
  });

  it('has proper ARIA attributes for progress bar', () => {
    render(
      <AssessmentProgress
        currentQuestion={5}
        totalQuestions={16}
        percentComplete={31}
        sectionName="Current Financial State"
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '31');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-label', 'Assessment progress');
  });

  it('includes screen reader announcement', () => {
    render(
      <AssessmentProgress
        currentQuestion={5}
        totalQuestions={16}
        percentComplete={31}
        sectionName="Current Financial State"
      />
    );

    const srOnly = screen.getByRole('status');
    expect(srOnly).toHaveTextContent('Question 5 of 16. 31% complete');
  });

  it('displays milestone emoji for different progress levels', () => {
    const { rerender } = render(
      <AssessmentProgress
        currentQuestion={1}
        totalQuestions={16}
        percentComplete={6}
        sectionName="Business Fundamentals"
      />
    );

    expect(screen.getByText('👋')).toBeInTheDocument();

    rerender(
      <AssessmentProgress
        currentQuestion={4}
        totalQuestions={16}
        percentComplete={25}
        sectionName="Business Fundamentals"
      />
    );

    expect(screen.getByText('🌱')).toBeInTheDocument();

    rerender(
      <AssessmentProgress
        currentQuestion={8}
        totalQuestions={16}
        percentComplete={50}
        sectionName="Financial Literacy"
      />
    );

    expect(screen.getByText('💪')).toBeInTheDocument();

    rerender(
      <AssessmentProgress
        currentQuestion={12}
        totalQuestions={16}
        percentComplete={75}
        sectionName="Business Specific"
      />
    );

    expect(screen.getByText('⭐')).toBeInTheDocument();

    rerender(
      <AssessmentProgress
        currentQuestion={16}
        totalQuestions={16}
        percentComplete={100}
        sectionName="Communication Style"
      />
    );

    expect(screen.getByText('🎉')).toBeInTheDocument();
  });

  it('renders with correct test id', () => {
    render(
      <AssessmentProgress
        currentQuestion={5}
        totalQuestions={16}
        percentComplete={31}
        sectionName="Current Financial State"
      />
    );

    expect(screen.getByTestId('assessment-progress')).toBeInTheDocument();
  });

  it('updates progress bar width based on percentage', () => {
    const { container } = render(
      <AssessmentProgress
        currentQuestion={8}
        totalQuestions={16}
        percentComplete={50}
        sectionName="Financial Literacy"
      />
    );

    const progressFill = container.querySelector('[style*="width: 50%"]');
    expect(progressFill).toBeInTheDocument();
  });
});
