/**
 * Tests for DISC Assessment Logic
 *
 * Tests the assessment flow, answer management, and profile creation
 */

import { describe, it, expect } from 'vitest';
import {
  createAssessmentSession,
  answerQuestion,
  getAssessmentProgress,
  navigateToQuestion,
  navigateToNext,
  navigateToPrevious,
  calculateSessionScores,
  resumeAssessment,
  exportSession,
  importSession,
  getTimeSpent,
  getEstimatedTimeRemaining,
} from './assessment';
import { DISC_QUESTIONS } from './questions';

describe('DISC Assessment Logic', () => {
  const TEST_USER_ID = 'test-user-123';

  describe('createAssessmentSession', () => {
    it('should create a new assessment session', () => {
      const session = createAssessmentSession(TEST_USER_ID);

      expect(session.userId).toBe(TEST_USER_ID);
      expect(session.answers).toHaveLength(DISC_QUESTIONS.length);
      expect(session.answers.every((a) => a === null)).toBe(true);
      expect(session.currentQuestionIndex).toBe(0);
      expect(session.isComplete).toBe(false);
      expect(session.startedAt).toBeGreaterThan(0);
    });

    it('should create sessions with current timestamp', () => {
      const before = Date.now();
      const session = createAssessmentSession(TEST_USER_ID);
      const after = Date.now();

      expect(session.startedAt).toBeGreaterThanOrEqual(before);
      expect(session.startedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('answerQuestion', () => {
    let session: ReturnType<typeof createAssessmentSession>;

    beforeEach(() => {
      session = createAssessmentSession(TEST_USER_ID);
    });

    it('should record an answer', () => {
      const updated = answerQuestion(session, 0, 3);

      expect(updated.answers[0]).toBe(3);
      expect(updated.currentQuestionIndex).toBe(0);
    });

    it('should not advance question index when answering', () => {
      const updated = answerQuestion(session, 0, 2);

      expect(updated.currentQuestionIndex).toBe(0);
    });

    it('should allow updating previous answers', () => {
      let updated = answerQuestion(session, 0, 3);
      updated = answerQuestion(updated, 0, 1); // Change answer

      expect(updated.answers[0]).toBe(1);
    });

    it('should throw error for invalid question index', () => {
      expect(() => answerQuestion(session, -1, 2)).toThrow('Invalid question index');
      expect(() => answerQuestion(session, DISC_QUESTIONS.length, 2)).toThrow(
        'Invalid question index'
      );
    });

    it('should throw error for invalid answer value', () => {
      expect(() => answerQuestion(session, 0, -1)).toThrow('Invalid answer value');
      expect(() => answerQuestion(session, 0, 4)).toThrow('Invalid answer value');
    });

    it('should mark session as complete when all questions answered', () => {
      let updated = session;

      // Answer all questions
      for (let i = 0; i < DISC_QUESTIONS.length; i++) {
        updated = answerQuestion(updated, i, 2);
      }

      expect(updated.isComplete).toBe(true);
    });

    it('should not mark as complete if one question is unanswered', () => {
      let updated = session;

      // Answer all but last question
      for (let i = 0; i < DISC_QUESTIONS.length - 1; i++) {
        updated = answerQuestion(updated, i, 2);
      }

      expect(updated.isComplete).toBe(false);
    });

    it('should not change question index when answering any question', () => {
      const lastIndex = DISC_QUESTIONS.length - 1;
      const updated = answerQuestion(session, lastIndex, 3);

      expect(updated.currentQuestionIndex).toBe(0); // Should remain at initial index
    });
  });

  describe('getAssessmentProgress', () => {
    it('should calculate progress correctly for new session', () => {
      const session = createAssessmentSession(TEST_USER_ID);
      const progress = getAssessmentProgress(session);

      expect(progress.totalQuestions).toBe(DISC_QUESTIONS.length);
      expect(progress.answeredQuestions).toBe(0);
      expect(progress.percentComplete).toBe(0);
      expect(progress.canSubmit).toBe(false);
      expect(progress.currentQuestion).toBe(DISC_QUESTIONS[0]);
    });

    it('should calculate progress correctly for partial completion', () => {
      let session = createAssessmentSession(TEST_USER_ID);

      // Answer half the questions
      const halfQuestions = Math.floor(DISC_QUESTIONS.length / 2);
      for (let i = 0; i < halfQuestions; i++) {
        session = answerQuestion(session, i, 2);
      }

      const progress = getAssessmentProgress(session);

      expect(progress.answeredQuestions).toBe(halfQuestions);
      expect(progress.percentComplete).toBeGreaterThan(40);
      expect(progress.percentComplete).toBeLessThan(60);
      expect(progress.canSubmit).toBe(false);
    });

    it('should calculate progress correctly for complete session', () => {
      let session = createAssessmentSession(TEST_USER_ID);

      // Answer all questions
      for (let i = 0; i < DISC_QUESTIONS.length; i++) {
        session = answerQuestion(session, i, 2);
      }

      const progress = getAssessmentProgress(session);

      expect(progress.answeredQuestions).toBe(DISC_QUESTIONS.length);
      expect(progress.percentComplete).toBe(100);
      expect(progress.canSubmit).toBe(true);
    });
  });

  describe('navigation', () => {
    let session: ReturnType<typeof createAssessmentSession>;

    beforeEach(() => {
      session = createAssessmentSession(TEST_USER_ID);
    });

    it('should navigate to specific question', () => {
      const updated = navigateToQuestion(session, 5);

      expect(updated.currentQuestionIndex).toBe(5);
    });

    it('should navigate to next question', () => {
      const updated = navigateToNext(session);

      expect(updated.currentQuestionIndex).toBe(1);
    });

    it('should navigate to previous question', () => {
      let updated = navigateToQuestion(session, 5);
      updated = navigateToPrevious(updated);

      expect(updated.currentQuestionIndex).toBe(4);
    });

    it('should not go before first question', () => {
      const updated = navigateToPrevious(session);

      expect(updated.currentQuestionIndex).toBe(0);
    });

    it('should not go past last question', () => {
      let updated = navigateToQuestion(session, DISC_QUESTIONS.length - 1);
      updated = navigateToNext(updated);

      expect(updated.currentQuestionIndex).toBe(DISC_QUESTIONS.length - 1);
    });

    it('should throw error for invalid navigation index', () => {
      expect(() => navigateToQuestion(session, -1)).toThrow('Invalid question index');
      expect(() => navigateToQuestion(session, DISC_QUESTIONS.length)).toThrow(
        'Invalid question index'
      );
    });
  });

  describe('calculateSessionScores', () => {
    it('should calculate scores for complete session', () => {
      let session = createAssessmentSession(TEST_USER_ID);

      // Answer all questions
      for (let i = 0; i < DISC_QUESTIONS.length; i++) {
        session = answerQuestion(session, i, 2);
      }

      const result = calculateSessionScores(session);

      expect(result.scores).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should throw error for incomplete session', () => {
      const session = createAssessmentSession(TEST_USER_ID);

      expect(() => calculateSessionScores(session)).toThrow(
        'Cannot calculate scores'
      );
    });

    it('should throw error for partially complete session', () => {
      let session = createAssessmentSession(TEST_USER_ID);

      // Answer only half the questions
      for (let i = 0; i < Math.floor(DISC_QUESTIONS.length / 2); i++) {
        session = answerQuestion(session, i, 2);
      }

      expect(() => calculateSessionScores(session)).toThrow(
        'Cannot calculate scores'
      );
    });
  });

  describe('resumeAssessment', () => {
    it('should resume from saved answers', () => {
      const savedAnswers = new Array(DISC_QUESTIONS.length).fill(null);
      savedAnswers[0] = 3;
      savedAnswers[1] = 2;
      savedAnswers[2] = 1;

      const session = resumeAssessment(TEST_USER_ID, savedAnswers);

      expect(session.userId).toBe(TEST_USER_ID);
      expect(session.answers).toEqual(savedAnswers);
      expect(session.currentQuestionIndex).toBe(3); // First unanswered
      expect(session.isComplete).toBe(false);
    });

    it('should resume from completed assessment', () => {
      const savedAnswers = new Array(DISC_QUESTIONS.length).fill(2);

      const session = resumeAssessment(TEST_USER_ID, savedAnswers);

      expect(session.isComplete).toBe(true);
      expect(session.currentQuestionIndex).toBe(DISC_QUESTIONS.length - 1);
    });

    it('should throw error for invalid saved answers length', () => {
      const savedAnswers = [1, 2, 3]; // Too short

      expect(() => resumeAssessment(TEST_USER_ID, savedAnswers)).toThrow(
        'Invalid saved answers length'
      );
    });

    it('should use provided startedAt timestamp', () => {
      const savedAnswers = new Array(DISC_QUESTIONS.length).fill(null);
      const startedAt = Date.now() - 100000;

      const session = resumeAssessment(TEST_USER_ID, savedAnswers, startedAt);

      expect(session.startedAt).toBe(startedAt);
    });
  });

  describe('session persistence', () => {
    it('should export session correctly', () => {
      const session = createAssessmentSession(TEST_USER_ID);
      const exported = exportSession(session);

      expect(exported).toHaveProperty('userId');
      expect(exported).toHaveProperty('answers');
      expect(exported).toHaveProperty('startedAt');
      expect(exported).toHaveProperty('currentQuestionIndex');
      expect(exported).toHaveProperty('isComplete');
    });

    it('should import session correctly', () => {
      const originalSession = createAssessmentSession(TEST_USER_ID);
      const exported = exportSession(originalSession);
      const imported = importSession(exported);

      expect(imported.userId).toBe(originalSession.userId);
      expect(imported.answers).toEqual(originalSession.answers);
      expect(imported.startedAt).toBe(originalSession.startedAt);
      expect(imported.currentQuestionIndex).toBe(originalSession.currentQuestionIndex);
      expect(imported.isComplete).toBe(originalSession.isComplete);
    });

    it('should throw error for invalid import data', () => {
      expect(() => importSession({})).toThrow('Invalid session data');
      expect(() => importSession({ userId: 'test' })).toThrow('Invalid session data');
      expect(() => importSession({ answers: [] })).toThrow('Invalid session data');
    });

    it('should handle export/import roundtrip', () => {
      let session = createAssessmentSession(TEST_USER_ID);
      session = answerQuestion(session, 0, 3);
      session = answerQuestion(session, 1, 2);

      const exported = exportSession(session);
      const imported = importSession(exported);

      expect(imported).toEqual(session);
    });
  });

  describe('time tracking', () => {
    it('should calculate time spent', () => {
      const session = createAssessmentSession(TEST_USER_ID);

      // Simulate time passing
      const timeSpent = getTimeSpent(session);

      expect(timeSpent).toBeGreaterThanOrEqual(0);
    });

    it('should estimate time remaining for new session', () => {
      const session = createAssessmentSession(TEST_USER_ID);
      const estimated = getEstimatedTimeRemaining(session);

      // Should estimate 30 seconds per question
      expect(estimated).toBeGreaterThan(0);
      expect(estimated).toBeLessThanOrEqual(DISC_QUESTIONS.length * 30 * 1000);
    });

    it('should estimate time remaining based on progress', () => {
      let session = createAssessmentSession(TEST_USER_ID);

      // Manually set older start time to simulate time spent
      session = { ...session, startedAt: Date.now() - 60000 }; // 60 seconds ago

      // Answer half the questions
      for (let i = 0; i < Math.floor(DISC_QUESTIONS.length / 2); i++) {
        session = answerQuestion(session, i, 2);
      }

      const estimated = getEstimatedTimeRemaining(session);

      // Should estimate based on actual pace
      expect(estimated).toBeGreaterThan(0);
    });

    it('should return 0 time remaining for complete session', () => {
      let session = createAssessmentSession(TEST_USER_ID);

      // Answer all questions
      for (let i = 0; i < DISC_QUESTIONS.length; i++) {
        session = answerQuestion(session, i, 2);
      }

      const estimated = getEstimatedTimeRemaining(session);

      expect(estimated).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid answer changes', () => {
      let session = createAssessmentSession(TEST_USER_ID);

      // Rapidly change same answer multiple times
      session = answerQuestion(session, 0, 0);
      session = answerQuestion(session, 0, 1);
      session = answerQuestion(session, 0, 2);
      session = answerQuestion(session, 0, 3);

      expect(session.answers[0]).toBe(3); // Last value
    });

    it('should handle answering questions out of order', () => {
      let session = createAssessmentSession(TEST_USER_ID);

      // Answer questions in random order
      session = answerQuestion(session, 5, 2);
      session = answerQuestion(session, 2, 3);
      session = answerQuestion(session, 8, 1);

      expect(session.answers[5]).toBe(2);
      expect(session.answers[2]).toBe(3);
      expect(session.answers[8]).toBe(1);
      expect(session.isComplete).toBe(false);
    });

    it('should maintain immutability of session', () => {
      const session = createAssessmentSession(TEST_USER_ID);
      const updated = answerQuestion(session, 0, 3);

      // Original session should not be modified
      expect(session.answers[0]).toBe(null);
      expect(updated.answers[0]).toBe(3);
    });
  });
});
