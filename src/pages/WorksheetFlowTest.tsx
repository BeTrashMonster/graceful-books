import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComprehensiveWorksheet } from '../components/onboarding/ComprehensiveWorksheet';
import { importWorksheetData, type WorksheetData } from '../services/cpg/worksheetImporter.service';
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

// Generate temp IDs matching the expected format
let tempIdCounter = 1000;
const generateTempId = (): string => {
  tempIdCounter++;
  const random = Math.random().toString(36).substring(2, 10);
  return `temp-${tempIdCounter}-${random}`;
};

// Create mock worksheet data with variants (Packaging: Pouch, Label, Sticker)
const createMockWorksheetData = (): WorksheetData => {
  const packagingCategoryId = generateTempId();
  const ingredientsCategoryId = generateTempId();
  const shCategoryId = generateTempId();
  const vendorId = generateTempId();
  const productId = generateTempId();
  const invoiceId = generateTempId();

  return {
    version: '1.0.0',
    created_at: new Date().toISOString(),
    categories: [
      { id: packagingCategoryId, name: 'Packaging', variants: ['Pouch', 'Label', 'Sticker'], sort_order: 1 },
      { id: ingredientsCategoryId, name: 'Ingredients', variants: ['Organic', 'Regular'], sort_order: 2 },
      { id: shCategoryId, name: 'Shipping & Handling', variants: [], sort_order: 9999, is_distribution_category: true }
    ],
    vendors: [{ id: vendorId, name: 'Test Supplier Co' }],
    finished_products: [{ id: productId, name: 'Test Product', msrp: '29.99', sku: 'TEST-001' }],
    recipes: [{
      product_id: productId,
      items: [
        { category_id: packagingCategoryId, variant: 'Pouch', quantity: '1', unit: 'each' },
        { category_id: packagingCategoryId, variant: 'Label', quantity: '1', unit: 'each' },
        { category_id: ingredientsCategoryId, variant: 'Organic', quantity: '8', unit: 'oz' }
      ]
    }],
    invoices: [{
      id: invoiceId,
      vendor_id: vendorId,
      vendor_name: 'Test Supplier Co',
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_number: 'INV-TEST-001',
      invoice_total: '45.00',
      items: [
        { category_id: packagingCategoryId, variant: 'Pouch', quantity: '100', unit: 'each', unit_cost: '0.15', line_total: '15.00' },
        { category_id: packagingCategoryId, variant: 'Label', quantity: '100', unit: 'each', unit_cost: '0.10', line_total: '10.00' },
        { category_id: packagingCategoryId, variant: 'Sticker', quantity: '100', unit: 'each', unit_cost: '0.05', line_total: '5.00' },
        { category_id: ingredientsCategoryId, variant: 'Organic', quantity: '10', unit: 'lb', unit_cost: '1.50', line_total: '15.00' }
      ],
      notes: 'Test invoice with Pouch/Label/Sticker variants'
    }],
    unit_conversions: []
  };
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
      companyId: companyId,  // Auth context looks for this
      companyName: 'Test Company',
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

  const handleQuickImport = async () => {
    if (!testCompanyId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const deviceId = getDeviceId();
      const mockData = createMockWorksheetData();

      console.log('🚀 Quick import with mock data:', mockData);

      const result = await importWorksheetData(mockData, testCompanyId, deviceId);

      console.log('✅ Quick import result:', result);
      setImportResult(result);

      if (!result.success) {
        setError(`Import failed: ${result.errors.join(', ')}`);
        return;
      }

      alert(`Quick Import Success!\n\nImported:\n- ${result.counts.categories} categories\n- ${result.counts.vendors} vendors\n- ${result.counts.products} products\n- ${result.counts.recipes} recipe items\n- ${result.counts.invoices} invoices\n\nClick OK to view in software.`);
      navigate('/cpg');
    } catch (err) {
      console.error('❌ Quick import error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
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

        {/* Quick Import Button - Skip manual data entry */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <button
            onClick={handleQuickImport}
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#7c2d12',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            Quick Import (Mock Data)
          </button>
          <span style={{ color: '#92400e', fontSize: '0.875rem' }}>
            Skip manual entry - imports test data with Packaging (Pouch/Label/Sticker), Ingredients, and S&H categories
          </span>
        </div>

        <ComprehensiveWorksheet
          onComplete={handleWorksheetComplete}
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
}
