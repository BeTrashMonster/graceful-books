import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { importWorksheetData, type WorksheetData } from '../services/cpg/worksheetImporter.service';
import { getDeviceId } from '../utils/device';
import styles from './auth/Signup.module.css';

/**
 * Test page for worksheet import - accessible at /worksheet-import-test
 * Pre-filled mock data to test the full import flow without manual entry
 */

// Generate temp IDs matching the expected format
let tempIdCounter = 1000;
const generateTempId = (): string => {
  tempIdCounter++;
  const random = Math.random().toString(36).substring(2, 10);
  return `temp-${tempIdCounter}-${random}`;
};

// Create mock worksheet data with variants (like Packaging with Pouch/Label/Sticker)
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
      {
        id: packagingCategoryId,
        name: 'Packaging',
        variants: ['Pouch', 'Label', 'Sticker'],
        sort_order: 1,
        is_distribution_category: false
      },
      {
        id: ingredientsCategoryId,
        name: 'Ingredients',
        variants: ['Organic', 'Regular'],
        sort_order: 2,
        is_distribution_category: false
      },
      {
        id: shCategoryId,
        name: 'Shipping & Handling',
        variants: [],
        sort_order: 9999,
        is_distribution_category: true
      }
    ],

    vendors: [
      {
        id: vendorId,
        name: 'Test Supplier Co'
      }
    ],

    finished_products: [
      {
        id: productId,
        name: 'Test Product',
        msrp: '29.99',
        sku: 'TEST-001'
      }
    ],

    recipes: [
      {
        product_id: productId,
        items: [
          {
            category_id: packagingCategoryId,
            variant: 'Pouch',
            quantity: '1',
            unit: 'each'
          },
          {
            category_id: packagingCategoryId,
            variant: 'Label',
            quantity: '1',
            unit: 'each'
          },
          {
            category_id: ingredientsCategoryId,
            variant: 'Organic',
            quantity: '8',
            unit: 'oz'
          }
        ]
      }
    ],

    invoices: [
      {
        id: invoiceId,
        vendor_id: vendorId,
        vendor_name: 'Test Supplier Co',
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_number: 'INV-TEST-001',
        invoice_total: '45.00',
        items: [
          // Regular items with variants - THIS IS THE PROBLEM AREA
          {
            category_id: packagingCategoryId,
            variant: 'Pouch',
            quantity: '100',
            unit: 'each',
            unit_cost: '0.15',  // STRING - valid format
            line_total: '15.00'
          },
          {
            category_id: packagingCategoryId,
            variant: 'Label',
            quantity: '100',
            unit: 'each',
            unit_cost: '0.10',  // STRING - valid format
            line_total: '10.00'
          },
          {
            category_id: packagingCategoryId,
            variant: 'Sticker',
            quantity: '100',
            unit: 'each',
            unit_cost: '0.05',  // STRING - valid format
            line_total: '5.00'
          },
          {
            category_id: ingredientsCategoryId,
            variant: 'Organic',
            quantity: '10',
            unit: 'lb',
            unit_cost: '1.50',
            line_total: '15.00'
          }
        ],
        notes: 'Test invoice with variants'
      }
    ],

    unit_conversions: []
  };
};

export default function WorksheetImportTest() {
  const { companyId } = useAuth();
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [mockData, setMockData] = useState<WorksheetData | null>(null);

  const handleGenerateMockData = () => {
    const data = createMockWorksheetData();
    setMockData(data);
    console.log('📋 Generated mock worksheet data:', data);
  };

  const handleRunImport = async () => {
    if (!companyId) {
      setStatus('error');
      setResult({ error: 'No company ID found. Please log in first.' });
      return;
    }

    if (!mockData) {
      setStatus('error');
      setResult({ error: 'Generate mock data first.' });
      return;
    }

    setStatus('running');
    setResult(null);

    try {
      const deviceId = getDeviceId();
      console.log('🚀 Starting import with:', { companyId, deviceId });
      console.log('📦 Mock data being imported:', JSON.stringify(mockData, null, 2));

      const importResult = await importWorksheetData(mockData, companyId, deviceId);

      console.log('✅ Import result:', importResult);
      setResult(importResult);
      setStatus(importResult.success ? 'success' : 'error');
    } catch (error) {
      console.error('❌ Import error:', error);
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
      setStatus('error');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card} style={{ maxWidth: '800px', padding: '2rem' }}>
        <h1 style={{ marginBottom: '1rem', color: '#1f2937' }}>Worksheet Import Test</h1>

        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <p><strong>Company ID:</strong> {companyId || 'Not logged in'}</p>
          <p><strong>Status:</strong> {status}</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={handleGenerateMockData}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#4b006e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            1. Generate Mock Data
          </button>

          <button
            onClick={handleRunImport}
            disabled={!mockData || !companyId || status === 'running'}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: mockData && companyId ? '#1a4731' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: mockData && companyId ? 'pointer' : 'not-allowed',
              fontWeight: 600
            }}
          >
            2. Run Import
          </button>
        </div>

        {mockData && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#374151' }}>Mock Data Preview:</h3>
            <details>
              <summary style={{ cursor: 'pointer', color: '#4b006e' }}>
                Click to expand ({mockData.categories.length} categories, {mockData.invoices.length} invoices, {mockData.invoices[0]?.items.length} line items)
              </summary>
              <pre style={{
                backgroundColor: '#1f2937',
                color: '#10b981',
                padding: '1rem',
                borderRadius: '8px',
                overflow: 'auto',
                maxHeight: '400px',
                fontSize: '0.75rem'
              }}>
                {JSON.stringify(mockData, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {result && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: status === 'success' ? '#d1fae5' : '#fee2e2',
            borderRadius: '8px'
          }}>
            <h3 style={{
              marginBottom: '0.5rem',
              color: status === 'success' ? '#065f46' : '#991b1b'
            }}>
              {status === 'success' ? 'Import Successful!' : 'Import Failed'}
            </h3>
            <pre style={{
              backgroundColor: status === 'success' ? '#065f46' : '#991b1b',
              color: 'white',
              padding: '1rem',
              borderRadius: '8px',
              overflow: 'auto',
              maxHeight: '300px',
              fontSize: '0.75rem'
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
          <h4 style={{ color: '#92400e', marginBottom: '0.5rem' }}>What This Tests:</h4>
          <ul style={{ color: '#78350f', paddingLeft: '1.5rem', margin: 0 }}>
            <li>Categories with variants (Packaging: Pouch, Label, Sticker)</li>
            <li>Invoice line items with variant-specific unit_cost values</li>
            <li>Vendor creation and linking</li>
            <li>Full import flow: validation → transformation → database</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
