/**
 * AssessmentResults Component Tests
 *
 * Tests for results display and celebration
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentResults } from './AssessmentResults';

describe('AssessmentResults', () => {
  const mockResults = {
    phase: 'organize' as const,
    phaseDescription:
      'You have basic financial processes in place and are ready to build more consistent habits.',
    businessType: 'Service-based',
    literacyLevel: 'Developing',
    discProfile: 'Steadiness',
    nextSteps: [
      'Set up your chart of accounts',
      'Learn how to categorize transactions',
      'Establish a weekly routine',
    ],
  };

  const mockOnContinue = vi.fn();

  beforeEach(() => {
    mockOnContinue.mockClear();
  });

  it('renders results container', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByTestId('assessment-results')).toBeInTheDocument();
  });

  it('displays welcome message', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('Welcome to Graceful Books!')).toBeInTheDocument();
    expect(
      screen.getByText(/We've prepared a personalized path just for you/i)
    ).toBeInTheDocument();
  });

  it('displays phase title and tagline', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('Organize Phase')).toBeInTheDocument();
    expect(screen.getByText('Creating Structure')).toBeInTheDocument();
  });

  it('displays phase description', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(
      screen.getByText(/You have basic financial processes in place/i)
    ).toBeInTheDocument();
  });

  it('displays business type', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('Business Type')).toBeInTheDocument();
    expect(screen.getByText('Service-based')).toBeInTheDocument();
  });

  it('displays financial literacy level', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('Financial Literacy')).toBeInTheDocument();
    expect(screen.getByText('Developing')).toBeInTheDocument();
  });

  it('displays communication style', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('Communication Style')).toBeInTheDocument();
    expect(screen.getByText('Steadiness')).toBeInTheDocument();
  });

  it('displays all next steps', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('Set up your chart of accounts')).toBeInTheDocument();
    expect(screen.getByText('Learn how to categorize transactions')).toBeInTheDocument();
    expect(screen.getByText('Establish a weekly routine')).toBeInTheDocument();
  });

  it('numbers next steps correctly', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    const stepNumbers = screen.getAllByText(/^[123]$/);
    expect(stepNumbers).toHaveLength(3);
  });

  it('displays Get Started button', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('calls onContinue when Get Started is clicked', async () => {
    const user = userEvent.setup();

    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    await user.click(screen.getByRole('button', { name: /get started/i }));

    expect(mockOnContinue).toHaveBeenCalled();
  });

  it('shows retake button when onRetake is provided', () => {
    const mockOnRetake = vi.fn();

    render(
      <AssessmentResults
        results={mockResults}
        onContinue={mockOnContinue}
        onRetake={mockOnRetake}
      />
    );

    expect(screen.getByText(/retake assessment/i)).toBeInTheDocument();
  });

  it('calls onRetake when retake button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnRetake = vi.fn();

    render(
      <AssessmentResults
        results={mockResults}
        onContinue={mockOnContinue}
        onRetake={mockOnRetake}
      />
    );

    await user.click(screen.getByText(/retake assessment/i));

    expect(mockOnRetake).toHaveBeenCalled();
  });

  it('does not show retake button when onRetake is not provided', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.queryByText(/retake assessment/i)).not.toBeInTheDocument();
  });

  it('renders correct phase info for stabilize phase', () => {
    const stabilizeResults = { ...mockResults, phase: 'stabilize' as const };

    render(
      <AssessmentResults results={stabilizeResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('Stabilize Phase')).toBeInTheDocument();
    expect(screen.getByText('Building Your Foundation')).toBeInTheDocument();
  });

  it('renders correct phase info for build phase', () => {
    const buildResults = { ...mockResults, phase: 'build' as const };

    render(
      <AssessmentResults results={buildResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('Build Phase')).toBeInTheDocument();
    expect(screen.getByText('Growing Strategically')).toBeInTheDocument();
  });

  it('renders correct phase info for grow phase', () => {
    const growResults = { ...mockResults, phase: 'grow' as const };

    render(
      <AssessmentResults results={growResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('Grow Phase')).toBeInTheDocument();
    expect(screen.getByText('Scaling with Confidence')).toBeInTheDocument();
  });

  it('displays "What this means for you" section', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('What this means for you')).toBeInTheDocument();
  });

  it('displays "Your next steps" section', () => {
    render(
      <AssessmentResults results={mockResults} onContinue={mockOnContinue} />
    );

    expect(screen.getByText('Your next steps')).toBeInTheDocument();
  });
});
