/**
 * AssessmentQuestion Component Tests
 *
 * Tests for question display, answer selection, and accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentQuestion } from './AssessmentQuestion';

describe('AssessmentQuestion', () => {
  const mockQuestion = {
    text: 'How comfortable are you with financial statements?',
    description: 'This helps us understand your financial literacy level',
  };

  const mockOnAnswerSelect = vi.fn();

  beforeEach(() => {
    mockOnAnswerSelect.mockClear();
  });

  it('renders question text correctly', () => {
    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    expect(screen.getByText(mockQuestion.text)).toBeInTheDocument();
  });

  it('renders question number', () => {
    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    expect(screen.getByText('Q5')).toBeInTheDocument();
  });

  it('renders optional description when provided', () => {
    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    expect(screen.getByText(mockQuestion.description!)).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(
      <AssessmentQuestion
        question={{ text: mockQuestion.text }}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    expect(screen.queryByText(mockQuestion.description!)).not.toBeInTheDocument();
  });

  it('renders all answer options', () => {
    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    expect(screen.getByText('Strongly Disagree')).toBeInTheDocument();
    expect(screen.getByText('Disagree')).toBeInTheDocument();
    expect(screen.getByText('Agree')).toBeInTheDocument();
    expect(screen.getByText('Strongly Agree')).toBeInTheDocument();
  });

  it('calls onAnswerSelect when option is clicked', async () => {
    const user = userEvent.setup();

    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    await user.click(screen.getByText('Agree'));

    expect(mockOnAnswerSelect).toHaveBeenCalledWith(2);
    expect(mockOnAnswerSelect).toHaveBeenCalledTimes(1);
  });

  it('highlights selected answer', () => {
    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={2}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    const agreeOption = screen.getByRole('radio', { name: /agree/i, checked: true });
    expect(agreeOption).toBeInTheDocument();
  });

  it('supports keyboard navigation with Enter key', async () => {
    const user = userEvent.setup();

    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    const option = screen.getByText('Agree').closest('button');
    option?.focus();
    await user.keyboard('{Enter}');

    expect(mockOnAnswerSelect).toHaveBeenCalledWith(2);
  });

  it('supports keyboard navigation with Space key', async () => {
    const user = userEvent.setup();

    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    const option = screen.getByText('Disagree').closest('button');
    option?.focus();
    await user.keyboard(' ');

    expect(mockOnAnswerSelect).toHaveBeenCalledWith(1);
  });

  it('disables all options when isDisabled is true', () => {
    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
        isDisabled={true}
      />
    );

    const options = screen.getAllByRole('radio');
    options.forEach((option) => {
      expect(option).toBeDisabled();
    });
  });

  it('has proper ARIA attributes', () => {
    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={1}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    const radiogroup = screen.getByRole('radiogroup');
    expect(radiogroup).toBeInTheDocument();
    expect(radiogroup).toHaveAttribute('aria-labelledby', 'question-5');

    const selectedOption = screen.getByRole('radio', { checked: true });
    expect(selectedOption).toHaveAttribute('aria-checked', 'true');
  });

  it('displays helper text', () => {
    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    expect(
      screen.getByText(/Take your time. There are no wrong answers/i)
    ).toBeInTheDocument();
  });

  it('renders with correct test id', () => {
    render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={null}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    expect(screen.getByTestId('assessment-question')).toBeInTheDocument();
  });

  it('allows changing answer', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={2}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    await user.click(screen.getByText('Strongly Agree'));

    expect(mockOnAnswerSelect).toHaveBeenCalledWith(3);

    // Simulate re-render with new answer
    rerender(
      <AssessmentQuestion
        question={mockQuestion}
        currentAnswer={3}
        onAnswerSelect={mockOnAnswerSelect}
        questionNumber={5}
      />
    );

    const newSelectedOption = screen.getByRole('radio', {
      name: /strongly agree/i,
      checked: true,
    });
    expect(newSelectedOption).toBeInTheDocument();
  });
});
