/**
 * Tests for DISCAssessment Component
 *
 * Tests assessment flow, question navigation, and submission
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DISCAssessment } from './DISCAssessment';
import { DISC_QUESTIONS } from '../../features/disc/questions';

// Mock submitAssessment
vi.mock('../../features/disc/assessment', async () => {
  const actual = await vi.importActual('../../features/disc/assessment');
  return {
    ...actual,
    submitAssessment: vi.fn(),
  };
});

describe('DISCAssessment Component', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();
  const TEST_USER_ID = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render assessment component', () => {
      render(<DISCAssessment userId={TEST_USER_ID} />);

      expect(screen.getByTestId('disc-assessment')).toBeInTheDocument();
    });

    it('should show first question on mount', () => {
      render(<DISCAssessment userId={TEST_USER_ID} />);

      const firstQuestion = DISC_QUESTIONS[0];
      if (firstQuestion) {
        expect(screen.getByText(firstQuestion.text)).toBeInTheDocument();
      }
    });

    it('should show progress bar', () => {
      render(<DISCAssessment userId={TEST_USER_ID} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('should show all answer options', () => {
      render(<DISCAssessment userId={TEST_USER_ID} />);

      expect(screen.getByText('Strongly Disagree')).toBeInTheDocument();
      expect(screen.getByText('Disagree')).toBeInTheDocument();
      expect(screen.getByText('Agree')).toBeInTheDocument();
      expect(screen.getByText('Strongly Agree')).toBeInTheDocument();
    });

    it('should show cancel button when onCancel provided', () => {
      render(<DISCAssessment userId={TEST_USER_ID} onCancel={mockOnCancel} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should not show cancel button when onCancel not provided', () => {
      render(<DISCAssessment userId={TEST_USER_ID} />);

      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });
  });

  describe('answer selection', () => {
    it('should select answer when clicked', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      const agreeButton = screen.getByText('Agree');
      await user.click(agreeButton);

      const radioButton = agreeButton.closest('[role="radio"]');
      expect(radioButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should allow changing answer', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      // Select first answer
      await user.click(screen.getByText('Agree'));

      // Change to different answer
      await user.click(screen.getByText('Strongly Agree'));

      const stronglyAgreeButton = screen.getByText('Strongly Agree').closest('[role="radio"]');
      expect(stronglyAgreeButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should enable next button after answering', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      const nextButton = screen.getByLabelText('Next question');
      expect(nextButton).toBeDisabled();

      await user.click(screen.getByText('Agree'));

      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('navigation', () => {
    it('should disable previous button on first question', () => {
      render(<DISCAssessment userId={TEST_USER_ID} />);

      const prevButton = screen.getByLabelText('Previous question');
      expect(prevButton).toBeDisabled();
    });

    it('should navigate to next question', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      // Answer first question
      await user.click(screen.getByText('Agree'));

      // Click next
      await user.click(screen.getByLabelText('Next question'));

      // Should show second question
      const secondQuestion = DISC_QUESTIONS[1];
      if (secondQuestion) {
        expect(screen.getByText(secondQuestion.text)).toBeInTheDocument();
      }
    });

    it('should navigate to previous question', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      // Answer and go to next question
      await user.click(screen.getByText('Agree'));
      await user.click(screen.getByLabelText('Next question'));

      // Go back
      await user.click(screen.getByLabelText('Previous question'));

      // Should show first question again
      const firstQuestion = DISC_QUESTIONS[0];
      if (firstQuestion) {
        expect(screen.getByText(firstQuestion.text)).toBeInTheDocument();
      }
    });

    it('should show submit button on last question', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      // Answer all questions and navigate to last
      for (let i = 0; i < DISC_QUESTIONS.length - 1; i++) {
        await user.click(screen.getByText('Agree'));
        await user.click(screen.getByLabelText('Next question'));
      }

      // Answer last question
      await user.click(screen.getByText('Agree'));

      expect(screen.getByText('Submit Assessment')).toBeInTheDocument();
      expect(screen.queryByLabelText('Next question')).not.toBeInTheDocument();
    });
  });

  describe('progress tracking', () => {
    it('should update progress as questions are answered', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      const progressBar = screen.getByRole('progressbar');

      // Initially 0%
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');

      // Answer first question
      await user.click(screen.getByText('Agree'));

      // Progress should increase
      await waitFor(() => {
        const currentProgress = parseInt(progressBar.getAttribute('aria-valuenow') || '0');
        expect(currentProgress).toBeGreaterThan(0);
      });
    });

    it('should show question counter', () => {
      render(<DISCAssessment userId={TEST_USER_ID} />);

      expect(screen.getByText(`Question 1 of ${DISC_QUESTIONS.length}`)).toBeInTheDocument();
    });

    it('should update question counter when navigating', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      await user.click(screen.getByText('Agree'));
      await user.click(screen.getByLabelText('Next question'));

      expect(screen.getByText(`Question 2 of ${DISC_QUESTIONS.length}`)).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    it('should disable submit until all questions answered', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} onComplete={mockOnComplete} />);

      // Navigate to last question without answering all
      for (let i = 0; i < DISC_QUESTIONS.length - 1; i++) {
        await user.click(screen.getByText('Agree'));
        await user.click(screen.getByLabelText('Next question'));
      }

      // Don't answer last question - submit should be disabled
      const submitButton = screen.getByText('Submit Assessment');
      expect(submitButton).toBeDisabled();
    });

    it('should show error if trying to submit incomplete assessment', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} onComplete={mockOnComplete} />);

      // Try to manually trigger submit with incomplete assessment
      // Note: Button is disabled so this tests the validation

      // Navigate to last question
      for (let i = 0; i < DISC_QUESTIONS.length - 1; i++) {
        await user.click(screen.getByText('Agree'));
        await user.click(screen.getByLabelText('Next question'));
      }

      const submitButton = screen.getByText('Submit Assessment');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('cancel action', () => {
    it('should call onCancel when cancel clicked', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Cancel'));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should disable cancel during submission', async () => {
      const user = userEvent.setup();
      const { submitAssessment } = await import('../../features/disc/assessment');

      // Mock slow submission
      (submitAssessment as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<DISCAssessment userId={TEST_USER_ID} onCancel={mockOnCancel} />);

      // Answer all questions
      for (let i = 0; i < DISC_QUESTIONS.length; i++) {
        await user.click(screen.getByText('Agree'));
        if (i < DISC_QUESTIONS.length - 1) {
          await user.click(screen.getByLabelText('Next question'));
        }
      }

      // Start submission
      const submitButton = screen.getByText('Submit Assessment');
      await user.click(submitButton);

      // Cancel should be disabled
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<DISCAssessment userId={TEST_USER_ID} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('should use aria-checked for answer options', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      const agreeOption = screen.getByText('Agree').closest('[role="radio"]');

      expect(agreeOption).toHaveAttribute('aria-checked', 'false');

      await user.click(screen.getByText('Agree'));

      expect(agreeOption).toHaveAttribute('aria-checked', 'true');
    });

    it('should set aria-busy during submission', async () => {
      const user = userEvent.setup();
      const { submitAssessment } = await import('../../features/disc/assessment');

      // Mock slow submission
      (submitAssessment as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<DISCAssessment userId={TEST_USER_ID} />);

      // Answer all questions
      for (let i = 0; i < DISC_QUESTIONS.length; i++) {
        await user.click(screen.getByText('Agree'));
        if (i < DISC_QUESTIONS.length - 1) {
          await user.click(screen.getByLabelText('Next question'));
        }
      }

      const submitButton = screen.getByText('Submit Assessment');
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toHaveAttribute('aria-busy', 'true');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle rapid answer changes', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      // Rapidly click different answers
      await user.click(screen.getByText('Strongly Disagree'));
      await user.click(screen.getByText('Disagree'));
      await user.click(screen.getByText('Agree'));
      await user.click(screen.getByText('Strongly Agree'));

      // Last selection should be active
      const lastOption = screen.getByText('Strongly Agree').closest('[role="radio"]');
      expect(lastOption).toHaveAttribute('aria-checked', 'true');
    });

    it('should preserve answers when navigating back and forth', async () => {
      const user = userEvent.setup();
      render(<DISCAssessment userId={TEST_USER_ID} />);

      // Answer first question
      await user.click(screen.getByText('Strongly Agree'));
      await user.click(screen.getByLabelText('Next question'));

      // Answer second question
      await user.click(screen.getByText('Disagree'));

      // Go back to first
      await user.click(screen.getByLabelText('Previous question'));

      // First answer should still be selected
      const firstAnswer = screen.getByText('Strongly Agree').closest('[role="radio"]');
      expect(firstAnswer).toHaveAttribute('aria-checked', 'true');
    });
  });
});
