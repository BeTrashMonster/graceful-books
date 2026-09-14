import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMyWorkshopEnrollment, completeWorksheet, type WorkshopEnrollment } from '../../services/workshops.api';
import { ComprehensiveWorksheet } from '../../components/onboarding/ComprehensiveWorksheet';
import { importWorksheetData, type ImportResult } from '../../services/cpg/worksheetImporter.service';
import { ImportWarningsModal } from '../../components/cpg/modals/ImportWarningsModal';
import { LoadingOverlay } from '../../components/feedback/Loading';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceId } from '../../utils/device';
import styles from './WorkshopWorksheetPage.module.css';
import signupStyles from '../auth/Signup.module.css';

export default function WorkshopWorksheetPage() {
  console.log('[Worksheet] Component mounted');
  const navigate = useNavigate();
  const { companyId: authCompanyId } = useAuth();
  const [enrollment, setEnrollment] = useState<WorkshopEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarningsModal, setShowWarningsModal] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Load enrollment on mount
  useEffect(() => {
    loadEnrollment();
  }, []);

  const loadEnrollment = async () => {
    console.log('[Worksheet] Loading enrollment...');
    setIsLoading(true);
    setError(null);
    try {
      const enrollmentData = await getMyWorkshopEnrollment();
      console.log('[Worksheet] Enrollment data received:', enrollmentData);

      if (!enrollmentData) {
        console.log('[Worksheet] No enrollment found');
        setError('No workshop enrollment found. Please sign up for a workshop first.');
        setIsLoading(false);
        return;
      }

      console.log('[Worksheet] Setting enrollment state');
      setEnrollment(enrollmentData);
      console.log('[Worksheet] Enrollment loaded successfully');
    } catch (err: any) {
      console.error('[Worksheet] Error loading enrollment:', err);
      console.error('[Worksheet] Error details:', {
        message: err.message,
        code: err.code,
        status: err.status
      });
      setError(err.message || 'Failed to load workshop enrollment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorksheetComplete = async (worksheetData: any) => {
    console.log('[Worksheet] handleWorksheetComplete called');
    console.log('[Worksheet] Auth companyId:', authCompanyId);
    console.log('[Worksheet] Worksheet data received:', worksheetData);

    // Try to get company ID from auth hook, or fall back to session storage
    let companyId = authCompanyId;

    if (!companyId) {
      console.log('[Worksheet] No companyId from auth hook, checking sessionStorage...');
      const sessionData = sessionStorage.getItem('graceful_books_session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        companyId = session?.userId;
        console.log('[Worksheet] Found userId in sessionStorage:', companyId);
      }
    }

    if (!companyId) {
      console.error('[Worksheet] No company_id found anywhere');
      setError('User session not found. Please refresh the page and try again.');
      return;
    }

    console.log('[Worksheet] Using company_id:', companyId);

    setIsSubmitting(true);
    setError(null);

    try {
      const deviceId = getDeviceId();
      console.log('[Worksheet] Device ID:', deviceId);

      // Import worksheet data into database
      console.log('[Worksheet] Calling importWorksheetData...');
      const result = await importWorksheetData(
        worksheetData,
        companyId,
        deviceId
      );

      console.log('[Worksheet] Import result:', result);

      if (!result.success) {
        console.error('[Worksheet] Import failed:', result.errors);
        setError(`Failed to import data: ${result.errors.join(', ')}`);
        return;
      }

      // Store import results so they can be shown on the countdown page
      sessionStorage.setItem('worksheet_import_results', JSON.stringify({
        counts: result.counts,
        skipped: result.skipped,
        warnings: result.warnings,
        importedAt: new Date().toISOString(),
        companyId: companyId,
      }));
      console.log('[Worksheet] Stored import results in sessionStorage');

      // Mark worksheet as completed in workshop enrollment (non-blocking)
      // If this fails, we still proceed - the import was successful
      console.log('[Worksheet] Marking worksheet as completed...');
      try {
        await Promise.race([
          completeWorksheet(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]);
        console.log('[Worksheet] Worksheet marked as completed');
      } catch (apiError) {
        // Log but don't block - the import succeeded, that's what matters
        console.warn('[Worksheet] Failed to mark worksheet complete (non-blocking):', apiError);
      }

      // Check if there are warnings to show
      if (result.warnings && result.warnings.length > 0) {
        console.log('[Worksheet] Import has warnings, showing modal:', result.warnings);
        setImportResult(result);
        setShowWarningsModal(true);
        // Don't navigate yet - let user review warnings first
        return;
      }

      // No warnings - navigate directly to countdown page
      console.log('[Worksheet] Navigating to countdown page');
      navigate('/workshops/countdown');
    } catch (error) {
      console.error('[Worksheet] Exception in handleWorksheetComplete:', error);
      setError(error instanceof Error ? error.message : 'Failed to save worksheet data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipWorksheet = async () => {
    console.log('[Worksheet] User skipped worksheet');
    // For workshop flow, we don't allow skipping - they must complete the worksheet
    // But we can handle this gracefully by just logging
    navigate('/workshops/countdown');
  };

  const handleWarningsModalContinue = () => {
    console.log('[Worksheet] User acknowledged warnings, navigating to countdown page');
    setShowWarningsModal(false);
    navigate('/workshops/countdown');
  };

  const handleWarningsModalClose = () => {
    // User wants to review - close modal but stay on page
    // They can see their data was imported and decide what to do
    console.log('[Worksheet] User wants to review warnings');
    setShowWarningsModal(false);
    // Show a helpful message
    setError('Your data has been imported. Some items need attention - you can fix them in the software after the workshop.');
  };

  console.log('[Worksheet] Render - isLoading:', isLoading, 'error:', error, 'enrollment:', enrollment);

  if (isLoading) {
    console.log('[Worksheet] Rendering loading overlay');
    return <LoadingOverlay message="Loading worksheet..." />;
  }

  if (error && !enrollment) {
    console.log('[Worksheet] Rendering error state');
    return (
      <div className={signupStyles.container}>
        <div className={signupStyles.card}>
          <div className={styles.errorHeader}>
            <h1 className={styles.errorTitle}>Worksheet Not Available</h1>
            <p className={styles.errorMessage}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  console.log('[Worksheet] Rendering ComprehensiveWorksheet');
  return (
    <div className={signupStyles.container}>
      {isSubmitting && <LoadingOverlay message="Saving your worksheet..." />}
      <div className={signupStyles.wideCard}>
        {error && <div className={styles.error}>{error}</div>}
        <ComprehensiveWorksheet
          onComplete={handleWorksheetComplete}
          onSkip={handleSkipWorksheet}
        />
      </div>

      {/* Warnings Modal - shown when import succeeds but has warnings */}
      {importResult && (
        <ImportWarningsModal
          isOpen={showWarningsModal}
          onClose={handleWarningsModalClose}
          onContinue={handleWarningsModalContinue}
          warnings={importResult.warnings}
          counts={importResult.counts}
          skipped={importResult.skipped}
        />
      )}
    </div>
  );
}
