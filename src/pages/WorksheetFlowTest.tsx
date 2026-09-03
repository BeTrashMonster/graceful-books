import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComprehensiveWorksheet } from '../components/onboarding/ComprehensiveWorksheet';
import { importWorksheetData } from '../services/cpg/worksheetImporter.service';
import { getDeviceId } from '../utils/device';
import styles from './auth/Signup.module.css';

/**
 * Full worksheet flow test - creates a test company and runs the complete flow
 * Accessible at /worksheet-flow-test
 */

// Generate a test company ID
const generateTestCompanyId = (): string => {
  return `test-company-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

export default function WorksheetFlowTest() {
  const navigate = useNavigate();
  const [testCompanyId, setTestCompanyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  // Set up test company on mount
  useEffect(() => {
    const companyId = generateTestCompanyId();
    setTestCompanyId(companyId);

    // Store in session storage so auth context can pick it up
    const testSession = {
      token: 'test-token-not-real',
      userId: companyId,
      email: 'test@example.com',
      isTestMode: true
    };
    sessionStorage.setItem('graceful_books_session', JSON.stringify(testSession));

    console.log('🧪 Test session created:', { companyId });

    // Cleanup on unmount
    return () => {
      // Don't clean up - let them navigate to /cpg to see results
    };
  }, []);

  const handleWorksheetComplete = async (worksheetData: any) => {
    if (!testCompanyId) {
      setError('No test company ID');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const deviceId = getDeviceId();

      console.log('🧪 Test import starting...', {
        companyId: testCompanyId,
        deviceId,
        worksheetData
      });

      // Log the exact data being sent for debugging
      console.log('📦 Worksheet data structure:');
      console.log('  Categories:', worksheetData.categories?.length);
      console.log('  Vendors:', worksheetData.vendors?.length);
      console.log('  Products:', worksheetData.finished_products?.length);
      console.log('  Recipes:', worksheetData.recipes?.length);
      console.log('  Invoices:', worksheetData.invoices?.length);

      if (worksheetData.invoices?.length > 0) {
        worksheetData.invoices.forEach((inv: any, i: number) => {
          console.log(`  Invoice ${i + 1} (${inv.vendor_name}):`);
          inv.items?.forEach((item: any, j: number) => {
            console.log(`    Item ${j + 1}: category=${item.category_id}, variant=${item.variant}, qty=${item.quantity}, unit_cost="${item.unit_cost}", line_total=${item.line_total}`);
          });
        });
      }

      const result = await importWorksheetData(
        worksheetData,
        testCompanyId,
        deviceId
      );

      console.log('🧪 Import result:', result);
      setImportResult(result);

      if (!result.success) {
        setError(`Import failed: ${result.errors.join(', ')}`);
        return;
      }

      // Success! Navigate to CPG dashboard to see the imported data
      alert(`Success! Imported:\n- ${result.counts.categories} categories\n- ${result.counts.vendors} vendors\n- ${result.counts.products} products\n- ${result.counts.recipes} recipe items\n- ${result.counts.invoices} invoices\n\nClick OK to view in software.`);

      navigate('/cpg');
    } catch (err) {
      console.error('🧪 Import error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigate('/cpg');
  };

  if (!testCompanyId) {
    return <div>Setting up test environment...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Test mode banner */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#7c2d12',
        color: 'white',
        padding: '0.5rem 1rem',
        textAlign: 'center',
        zIndex: 9999,
        fontSize: '0.875rem'
      }}>
        <strong>TEST MODE</strong> | Company ID: {testCompanyId} |
        Data will be stored locally in IndexedDB
      </div>

      <div className={styles.wideCard} style={{ marginTop: '3rem' }}>
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <strong>Error:</strong> {error}
            {importResult && (
              <pre style={{ marginTop: '0.5rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(importResult, null, 2)}
              </pre>
            )}
          </div>
        )}

        {isSubmitting && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Importing...</div>
              <div>Check console for detailed logs</div>
            </div>
          </div>
        )}

        <ComprehensiveWorksheet
          onComplete={handleWorksheetComplete}
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
}
