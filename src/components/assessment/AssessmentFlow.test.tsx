/**
 * AssessmentFlow Component Tests
 *
 * Tests for the main assessment flow container
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentFlow } from './AssessmentFlow';
import type { AssessmentSession } from '../../features/disc/assessment';

describe('AssessmentFlow', () => {
  const mockSession: AssessmentSession = {
    userId: 'test-user',
    answers: [null, null, null, null, null, null, null, null],
    startedAt: Date.now(),
    currentQuestionIndex: 0,
    isComplete: false,
  };

  const mockQuestions = [
    { id: 1, text: 'Question 1', category: 'fundamentals' },
    { id: 2, text: 'Question 2', category: 'fundamentals' },
    { id: 3, text: 'Question 3', category: 'financial' },
    { id: 4, text: 'Question 4', category: 'financial' },
    { id: 5, text: 'Question 5', category: 'literacy' },
    { id: 6, text: 'Question 6', category: 'literacy' },
    { id: 7, text: 'Question 7', category: 'specific' },
    { id: 8, text: 'Question 8', category: 'communication' },
  ];

  const mockOnAnswerChange = vi.fn();
  const mockOnNavigate = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnAnswerChange.mockClear();
    mockOnNavigate.mockClear();
    mockOnSubmit.mockClear();
  });

  it('renders assessment flow correctly', () => {
    render(
      <AssessmentFlow
        initialSession={mockSession}
        session={mockSession}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByTestId('assessment-flow')).toBeInTheDocument();
    expect(screen.getByText('Question 1')).toBeInTheDocument();
  });

  it('displays progress indicator', () => {
    render(
      <AssessmentFlow
        initialSession={mockSession}
        session={mockSession}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByTestId('assessment-progress')).toBeInTheDocument();
  });

  it('displays current question', () => {
    render(
      <AssessmentFlow
        initialSession={mockSession}
        session={mockSession}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByTestId('assessment-question')).toBeInTheDocument();
    expect(screen.getByText('Question 1')).toBeInTheDocument();
  });

  it('disables Previous button on first question', () => {
    render(
      <AssessmentFlow
        initialSession={mockSession}
        session={mockSession}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    const previousButton = screen.getByRole('button', { name: /previous question/i });
    expect(previousButton).toBeDisabled();
  });

  it('disables Next button when no answer selected', () => {
    render(
      <AssessmentFlow
        initialSession={mockSession}
        session={mockSession}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    const nextButton = screen.getByRole('button', { name: /next question/i });
    expect(nextButton).toBeDisabled();
  });

  it('enables Next button when answer is selected', () => {
    const sessionWithAnswer = {
      ...mockSession,
      answers: [2, null, null, null, null, null, null, null],
    };

    render(
      <AssessmentFlow
        initialSession={sessionWithAnswer}
        session={sessionWithAnswer}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    const nextButton = screen.getByRole('button', { name: /next question/i });
    expect(nextButton).not.toBeDisabled();
  });

  it('calls onAnswerChange when answer is selected', async () => {
    const user = userEvent.setup();

    render(
      <AssessmentFlow
        initialSession={mockSession}
        session={mockSession}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(screen.getByText('Agree'));

    expect(mockOnAnswerChange).toHaveBeenCalledWith(0, 2);
  });

  it('calls onNavigate when Next is clicked', async () => {
    const user = userEvent.setup();
    const sessionWithAnswer = {
      ...mockSession,
      answers: [2, null, null, null, null, null, null, null],
    };

    render(
      <AssessmentFlow
        initialSession={sessionWithAnswer}
        session={sessionWithAnswer}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: /next question/i }));

    expect(mockOnNavigate).toHaveBeenCalledWith('next');
  });

  it('calls onNavigate when Previous is clicked', async () => {
    const user = userEvent.setup();
    const sessionOnSecondQuestion = {
      ...mockSession,
      currentQuestionIndex: 1,
      answers: [2, null, null, null, null, null, null, null],
    };

    render(
      <AssessmentFlow
        initialSession={sessionOnSecondQuestion}
        session={sessionOnSecondQuestion}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: /previous question/i }));

    expect(mockOnNavigate).toHaveBeenCalledWith('previous');
  });

  it('shows Complete button on last question', () => {
    const sessionOnLastQuestion = {
      ...mockSession,
      currentQuestionIndex: 7,
      answers: [2, 1, 3, 2, 1, 2, 3, 1],
      isComplete: true,
    };

    render(
      <AssessmentFlow
        initialSession={sessionOnLastQuestion}
        session={sessionOnLastQuestion}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByRole('button', { name: /complete assessment/i })).toBeInTheDocument();
  });

  it('disables Complete button when assessment is not complete', () => {
    const sessionOnLastQuestion = {
      ...mockSession,
      currentQuestionIndex: 7,
      answers: [2, 1, 3, 2, 1, 2, 3, null],
      isComplete: false,
    };

    render(
      <AssessmentFlow
        initialSession={sessionOnLastQuestion}
        session={sessionOnLastQuestion}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    const completeButton = screen.getByRole('button', { name: /complete assessment/i });
    expect(completeButton).toBeDisabled();
  });

  it('calls onSubmit when Complete is clicked', async () => {
    const user = userEvent.setup();
    const sessionComplete = {
      ...mockSession,
      currentQuestionIndex: 7,
      answers: [2, 1, 3, 2, 1, 2, 3, 1],
      isComplete: true,
    };

    render(
      <AssessmentFlow
        initialSession={sessionComplete}
        session={sessionComplete}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: /complete assessment/i }));

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('displays error message when provided', () => {
    render(
      <AssessmentFlow
        initialSession={mockSession}
        session={mockSession}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
        error="Something went wrong"
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows cancel button when onCancel is provided', () => {
    const mockOnCancel = vi.fn();

    render(
      <AssessmentFlow
        initialSession={mockSession}
        session={mockSession}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/save and finish later/i)).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnCancel = vi.fn();

    render(
      <AssessmentFlow
        initialSession={mockSession}
        session={mockSession}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await user.click(screen.getByText(/save and finish later/i));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('disables all controls when isSubmitting is true', () => {
    const sessionWithAnswer = {
      ...mockSession,
      answers: [2, null, null, null, null, null, null, null],
    };

    render(
      <AssessmentFlow
        initialSession={sessionWithAnswer}
        session={sessionWithAnswer}
        questions={mockQuestions}
        onAnswerChange={mockOnAnswerChange}
        onNavigate={mockOnNavigate}
        onSubmit={mockOnSubmit}
        isSubmitting={true}
      />
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });
});
