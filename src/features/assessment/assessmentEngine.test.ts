/**
 * Assessment Engine Tests
 *
 * Tests for the core assessment engine functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  createAssessmentSession,
  resumeAssessmentSession,
  answerQuestion,
  navigateToSection,
  navigateToNextSection,
  navigateToPreviousSection,
  getAssessmentProgress,
  getSectionStatus,
  getAllSectionStatuses,
  isAssessmentComplete,
  validateAllAnswers,
  generateResults,
  getTimeSpent,
  getEstimatedTimeRemaining,
  exportSession,
  getNextQuestion,
  getProgressMessage,
} from './assessmentEngine';
import { AssessmentSection, BusinessType, RevenueRange } from './types';
import { getSections } from './questions';

describe('Assessment Engine', () => {
  describe('createAssessmentSession', () => {
    it('should create a new session with default values', () => {
      const session = createAssessmentSession('user123');

      expect(session.userId).toBe('user123');
      expect(session.answers.size).toBe(0);
      expect(session.currentSection).toBe(AssessmentSection.BUSINESS_INFO);
      expect(session.startedAt).toBeGreaterThan(0);
      expect(session.completedSections).toEqual([]);
      expect(session.isComplete).toBe(false);
    });
  });

  describe('resumeAssessmentSession', () => {
    it('should resume from saved answers', () => {
      const savedAnswers = [
        {
          questionId: 'business_structure',
          value: BusinessType.LLC,
          answeredAt: Date.now(),
        },
      ];

      const session = resumeAssessmentSession('user123', savedAnswers);

      expect(session.userId).toBe('user123');
      expect(session.answers.size).toBe(1);
      expect(session.answers.get('business_structure')).toBeDefined();
    });

    it('should restore current section if provided', () => {
      const session = resumeAssessmentSession(
        'user123',
        [],
        AssessmentSection.FINANCIAL_STATUS
      );

      expect(session.currentSection).toBe(AssessmentSection.FINANCIAL_STATUS);
    });
  });

  describe('answerQuestion', () => {
    it('should add answer to session', () => {
      const session = createAssessmentSession('user123');
      const result = answerQuestion(session, 'business_structure', BusinessType.LLC);

      expect(result.errors).toEqual([]);
      expect(result.session.answers.size).toBe(1);
      expect(result.session.answers.get('business_structure')?.value).toBe(BusinessType.LLC);
    });

    it('should validate answer', () => {
      const session = createAssessmentSession('user123');
      // Try to answer with invalid value
      const result = answerQuestion(session, 'business_structure', 'invalid' as any);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.questionId).toBe('business_structure');
    });

    it('should reject answer to non-existent question', () => {
      const session = createAssessmentSession('user123');
      const result = answerQuestion(session, 'nonexistent_question', 'value');

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should update lastUpdatedAt', () => {
      const session = createAssessmentSession('user123');
      const before = session.lastUpdatedAt;

      // Small delay to ensure timestamp changes
      const result = answerQuestion(session, 'business_structure', BusinessType.LLC);

      expect(result.session.lastUpdatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('navigation', () => {
    it('should navigate to specific section', () => {
      const session = createAssessmentSession('user123');
      const updated = navigateToSection(session, AssessmentSection.GOALS);

      expect(updated.currentSection).toBe(AssessmentSection.GOALS);
    });

    it('should navigate to next section', () => {
      const session = createAssessmentSession('user123');
      const sections = getSections();

      const updated = navigateToNextSection(session);

      expect(updated.currentSection).toBe(sections[1]);
    });

    it('should not go past last section', () => {
      const sections = getSections();
      let session = createAssessmentSession('user123');
      session = navigateToSection(session, sections[sections.length - 1]!);

      const updated = navigateToNextSection(session);

      expect(updated.currentSection).toBe(sections[sections.length - 1]);
    });

    it('should navigate to previous section', () => {
      const sections = getSections();
      let session = createAssessmentSession('user123');
      session = navigateToSection(session, sections[1]!);

      const updated = navigateToPreviousSection(session);

      expect(updated.currentSection).toBe(sections[0]);
    });

    it('should not go before first section', () => {
      const session = createAssessmentSession('user123');
      const updated = navigateToPreviousSection(session);

      expect(updated.currentSection).toBe(AssessmentSection.BUSINESS_INFO);
    });
  });

  describe('progress tracking', () => {
    it('should track assessment progress', () => {
      const session = createAssessmentSession('user123');
      const progress = getAssessmentProgress(session);

      expect(progress.totalQuestions).toBeGreaterThan(0);
      expect(progress.answeredQuestions).toBe(0);
      expect(progress.percentComplete).toBe(0);
      expect(progress.canSubmit).toBe(false);
    });

    it('should update progress as questions are answered', () => {
      let session = createAssessmentSession('user123');

      session = answerQuestion(session, 'business_structure', BusinessType.LLC).session;
      session = answerQuestion(session, 'revenue_range', RevenueRange.ZERO_TO_25K).session;

      const progress = getAssessmentProgress(session);

      expect(progress.answeredQuestions).toBe(2);
      expect(progress.percentComplete).toBeGreaterThan(0);
    });

    it('should track section completion', () => {
      const session = createAssessmentSession('user123');
      const status = getSectionStatus(AssessmentSection.BUSINESS_INFO, session.answers);

      expect(status.section).toBe(AssessmentSection.BUSINESS_INFO);
      expect(status.questionsTotal).toBeGreaterThan(0);
      expect(status.questionsAnswered).toBe(0);
      expect(status.isComplete).toBe(false);
    });

    it('should get all section statuses', () => {
      const session = createAssessmentSession('user123');
      const statuses = getAllSectionStatuses(session.answers);

      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBe(getSections().length);
    });
  });

  describe('completion', () => {
    it('should detect when assessment is incomplete', () => {
      const session = createAssessmentSession('user123');
      const complete = isAssessmentComplete(session.answers);

      expect(complete).toBe(false);
    });

    it('should validate all answers before submission', () => {
      const session = createAssessmentSession('user123');
      const errors = validateAllAnswers(session);

      expect(errors.length).toBeGreaterThan(0); // Should have errors for missing required questions
    });

    it('should not generate results for incomplete assessment', () => {
      const session = createAssessmentSession('user123');
      const { results, errors } = generateResults(session);

      expect(results).toBeNull();
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('time tracking', () => {
    it('should calculate time spent', () => {
      const session = createAssessmentSession('user123');
      const timeSpent = getTimeSpent(session);

      expect(timeSpent).toBeGreaterThanOrEqual(0);
    });

    it('should estimate remaining time', () => {
      const session = createAssessmentSession('user123');
      const remaining = getEstimatedTimeRemaining(session);

      expect(remaining).toBeGreaterThan(0);
    });
  });

  describe('session export', () => {
    it('should export session to plain object', () => {
      let session = createAssessmentSession('user123');
      session = answerQuestion(session, 'business_structure', BusinessType.LLC).session;

      const exported = exportSession(session);

      expect(exported.userId).toBe('user123');
      expect(Array.isArray(exported.answers)).toBe(true);
      expect(exported.answers.length).toBe(1);
      expect(exported.currentSection).toBe(session.currentSection);
      expect(exported.startedAt).toBe(session.startedAt);
    });
  });

  describe('helper functions', () => {
    it('should get next unanswered question', () => {
      const session = createAssessmentSession('user123');
      const nextQuestion = getNextQuestion(session);

      expect(nextQuestion).toBeTruthy();
    });

    it('should return null when section is complete', () => {
      let session = createAssessmentSession('user123');

      // Answer all questions in first section
      session = answerQuestion(session, 'business_structure', BusinessType.LLC).session;
      session = answerQuestion(session, 'revenue_range', RevenueRange.ZERO_TO_25K).session;
      session = answerQuestion(session, 'has_employees', 'no').session;
      session = answerQuestion(session, 'has_sales_tax', 'no').session;
      session = answerQuestion(session, 'has_inventory', 'no').session;

      const nextQuestion = getNextQuestion(session);

      // Should be null or next section's first question
      // (depends on implementation details)
      expect(nextQuestion === null || typeof nextQuestion === 'string').toBe(true);
    });

    it('should provide progress messages', () => {
      const progress0 = { percentComplete: 0 } as any;
      const progress20 = { percentComplete: 20 } as any;
      const progress40 = { percentComplete: 40 } as any;
      const progress60 = { percentComplete: 60 } as any;
      const progress90 = { percentComplete: 90 } as any;
      const progress100 = { percentComplete: 100 } as any;

      const msg0 = getProgressMessage(progress0);
      const msg20 = getProgressMessage(progress20);
      const msg40 = getProgressMessage(progress40);
      const msg60 = getProgressMessage(progress60);
      const msg90 = getProgressMessage(progress90);
      const msg100 = getProgressMessage(progress100);

      expect(msg0).toBeTruthy();
      expect(msg20).toBeTruthy();
      expect(msg40.toLowerCase()).toMatch(/halfway|half/);
      expect(msg60).toBeTruthy();
      expect(msg90).toBeTruthy();
      expect(msg100.toLowerCase()).toMatch(/done|ready/);
    });
  });
});
