/**
 * Assessment Page
 *
 * Main page for the onboarding assessment experience.
 * Manages state and orchestrates the complete assessment flow.
 *
 * Per ONB-001, ONB-002: Complete assessment flow with all 5 sections
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createAssessmentSession,
  answerQuestion,
  navigateToNext,
  navigateToPrevious,
  submitAssessment,
  type AssessmentSession,
} from '../features/disc/assessment';
import { DISC_QUESTIONS } from '../features/disc/questions';
import { AssessmentFlow } from '../components/assessment/AssessmentFlow';
import { AssessmentResults } from '../components/assessment/AssessmentResults';
import { Loading } from '../components/feedback/Loading';

/**
 * Assessment page component
 *
 * Features:
 * - Full assessment flow
 * - State management
 * - Results display
 * - Navigation integration
 * - Error handling
 */
export default function Assessment() {
  const navigate = useNavigate();

  // TODO: Get actual user ID from auth context
  const userId = 'demo-user-id';

  // Assessment state
  const [session, setSession] = useState<AssessmentSession>(() =>
    createAssessmentSession(userId)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [assessmentResults, setAssessmentResults] = useState<any>(null);

  // Map DISC questions to assessment format
  const questions = useMemo(
    () =>
      DISC_QUESTIONS.map((q) => ({
        id: q.id,
        text: q.text,
        category: q.category,
      })),
    []
  );

  // Handle answer change
  const handleAnswerChange = useCallback((questionIndex: number, value: number) => {
    setSession((prev) => answerQuestion(prev, questionIndex, value));
    setError(null);
  }, []);

  // Handle navigation
  const handleNavigate = useCallback((direction: 'next' | 'previous') => {
    setSession((prev) =>
      direction === 'next' ? navigateToNext(prev) : navigateToPrevious(prev)
    );
  }, []);

  // Handle assessment submission
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // TODO: Get encryption context from auth
      const result = await submitAssessment(session);

      if (result.success && result.data) {
        // Map results to display format
        const mappedResults = {
          phase: 'organize' as const, // TODO: Calculate from assessment
          phaseDescription:
            'You have basic financial processes in place and are ready to build more consistent habits. We\'ll help you establish regular routines and proper categorization.',
          businessType: 'Service-based', // TODO: Get from assessment answers
          literacyLevel: 'Developing', // TODO: Calculate from assessment
          discProfile: result.data.profile.primary_type || 'Steadiness', // From DISC assessment
          nextSteps: [
            'Set up your chart of accounts with categories that match your business',
            'Learn how to categorize transactions consistently',
            'Establish a weekly routine for reconciling your accounts',
            'Start tracking expenses by category to understand your spending',
          ],
        };

        setAssessmentResults(mappedResults);
        setShowResults(true);
      } else {
        setError(
          'We encountered an issue completing your assessment. Please try again.'
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something unexpected happened. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [session]);

  // Handle continue to dashboard
  const handleContinue = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // Handle retake assessment
  const handleRetake = useCallback(() => {
    setSession(createAssessmentSession(userId));
    setShowResults(false);
    setAssessmentResults(null);
    setError(null);
  }, [userId]);

  // Handle cancel/save for later
  const handleCancel = useCallback(() => {
    // TODO: Save session state to localStorage or database
    navigate('/dashboard');
  }, [navigate]);

  // Clear error
  const handleClearError = useCallback(() => {
    setError(null);
  }, []);

  // Show loading state
  if (isSubmitting && !error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading
          size="lg"
          message="Analyzing your responses and creating your personalized path..."
          centered
        />
      </div>
    );
  }

  // Show results
  if (showResults && assessmentResults) {
    return (
      <AssessmentResults
        results={assessmentResults}
        onContinue={handleContinue}
        onRetake={handleRetake}
      />
    );
  }

  // Show assessment flow
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <AssessmentFlow
        initialSession={session}
        session={session}
        questions={questions}
        onAnswerChange={handleAnswerChange}
        onNavigate={handleNavigate}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={error}
        onClearError={handleClearError}
        onCancel={handleCancel}
      />
    </div>
  );
}
