/**
 * Event Decision Tool Tab
 *
 * Plan farmers markets and events - calculate costs, margins, and break-even points
 */

import { useState, useEffect } from 'react';
import { Button } from '../../../components/core/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db';
import { EventAnalyzerService } from '../../../services/cpg/eventAnalyzer.service';
import { cpuCalculatorService } from '../../../services/cpg/cpuCalculator.service';
import styles from './EventDecisionToolTab.module.css';

interface FormData {
  eventName: string;
  location: string;
  eventStartDate: string;
  eventEndDate: string;
  eventCost: string;
  travelingFees: string;
  laborEntries: Array<{
    id: string;
    description: string;
    hours: string;
    hourlyRate: string;
    costType: 'actual' | 'opportunity';
  }>;
  selectedProducts: string[];
  productData: Record<string, {
    retailPrice: string;
    unitsBringing: string;
    baseCPU: string;
  }>;
}

export function EventDecisionToolTab() {
  const { companyId, deviceId } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    eventName: '',
    location: '',
    eventStartDate: '',
    eventEndDate: '',
    eventCost: '',
    travelingFees: '',
    laborEntries: [],
    selectedProducts: [],
    productData: {},
  });

  const [products, setProducts] = useState<Array<{ id: string; name: string; sku: string | null; msrp: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load products
  useEffect(() => {
    loadProducts();
  }, [companyId]);

  const loadProducts = async () => {
    const prods = await db.cpgFinishedProducts
      .where('company_id')
      .equals(companyId)
      .filter(p => p.active && !p.deleted_at)
      .toArray();

    const productsWithCPU = await Promise.all(
      prods.map(async (p) => {
        try {
          const cpu = await cpuCalculatorService.getFinishedProductCPUBreakdown(p.id, companyId);
          return {
            id: p.id,
            name: p.sku ? `${p.sku} - ${p.name}` : p.name,
            sku: p.sku,
            msrp: p.msrp || '0',
            cpu: cpu.cpu || '0',
          };
        } catch {
          return null;
        }
      })
    );

    setProducts(productsWithCPU.filter(Boolean) as any);
  };

  const handleProductSelect = (productId: string, selected: boolean) => {
    if (selected) {
      const product = products.find(p => p.id === productId);
      if (product) {
        setFormData(prev => ({
          ...prev,
          selectedProducts: [...prev.selectedProducts, product.name],
          productData: {
            ...prev.productData,
            [product.name]: {
              retailPrice: product.msrp,
              unitsBringing: '0',
              baseCPU: (product as any).cpu,
            },
          },
        }));
      }
    } else {
      const product = products.find(p => p.id === productId);
      if (product) {
        setFormData(prev => {
          const newSelected = prev.selectedProducts.filter(id => id !== product.name);
          const newData = { ...prev.productData };
          delete newData[product.name];
          return {
            ...prev,
            selectedProducts: newSelected,
            productData: newData,
          };
        });
      }
    }
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const service = new EventAnalyzerService(db);

      // Create event
      const event = await service.createEvent({
        companyId,
        eventName: formData.eventName,
        location: formData.location,
        eventStartDate: new Date(formData.eventStartDate).getTime(),
        eventEndDate: new Date(formData.eventEndDate).getTime(),
        eventCost: formData.eventCost,
        travelingFees: formData.travelingFees || undefined,
        laborEntries: formData.laborEntries.length > 0 ? formData.laborEntries : undefined,
      }, deviceId);

      // Analyze event
      const result = await service.analyzeEvent({
        eventId: event.id,
        variantEventData: formData.productData,
      }, deviceId);

      setAnalysisResult(result);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const addLaborEntry = () => {
    setFormData(prev => ({
      ...prev,
      laborEntries: [
        ...prev.laborEntries,
        {
          id: Date.now().toString(),
          description: '',
          hours: '',
          hourlyRate: '',
          costType: 'actual',
        },
      ],
    }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.form}>
        <h2 className={styles.sectionTitle}>Event Details</h2>

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>Event Name *</label>
            <input
              type="text"
              value={formData.eventName}
              onChange={(e) => setFormData(prev => ({ ...prev, eventName: e.target.value }))}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Location *</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Start Date *</label>
            <input
              type="date"
              value={formData.eventStartDate}
              onChange={(e) => setFormData(prev => ({ ...prev, eventStartDate: e.target.value }))}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>End Date *</label>
            <input
              type="date"
              value={formData.eventEndDate}
              onChange={(e) => setFormData(prev => ({ ...prev, eventEndDate: e.target.value }))}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Event Cost *</label>
            <input
              type="number"
              value={formData.eventCost}
              onChange={(e) => setFormData(prev => ({ ...prev, eventCost: e.target.value }))}
              className={styles.input}
              placeholder="0.00"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Traveling Fees</label>
            <input
              type="number"
              value={formData.travelingFees}
              onChange={(e) => setFormData(prev => ({ ...prev, travelingFees: e.target.value }))}
              className={styles.input}
              placeholder="0.00"
            />
          </div>
        </div>

        <h3 className={styles.subsectionTitle}>Labor Costs</h3>
        <Button onClick={addLaborEntry} variant="secondary" size="sm">
          + Add Labor Entry
        </Button>

        {formData.laborEntries.map((entry, idx) => (
          <div key={entry.id} className={styles.laborEntry}>
            <input
              type="text"
              placeholder="Description"
              value={entry.description}
              onChange={(e) => {
                const newEntries = [...formData.laborEntries];
                newEntries[idx].description = e.target.value;
                setFormData(prev => ({ ...prev, laborEntries: newEntries }));
              }}
              className={styles.input}
            />
            <input
              type="number"
              placeholder="Hours"
              value={entry.hours}
              onChange={(e) => {
                const newEntries = [...formData.laborEntries];
                newEntries[idx].hours = e.target.value;
                setFormData(prev => ({ ...prev, laborEntries: newEntries }));
              }}
              className={styles.inputSmall}
            />
            <input
              type="number"
              placeholder="$/hour"
              value={entry.hourlyRate}
              onChange={(e) => {
                const newEntries = [...formData.laborEntries];
                newEntries[idx].hourlyRate = e.target.value;
                setFormData(prev => ({ ...prev, laborEntries: newEntries }));
              }}
              className={styles.inputSmall}
            />
            <select
              value={entry.costType}
              onChange={(e) => {
                const newEntries = [...formData.laborEntries];
                newEntries[idx].costType = e.target.value as 'actual' | 'opportunity';
                setFormData(prev => ({ ...prev, laborEntries: newEntries }));
              }}
              className={styles.select}
            >
              <option value="actual">Paid Labor</option>
              <option value="opportunity">Sweat Equity</option>
            </select>
          </div>
        ))}

        <h3 className={styles.subsectionTitle}>Products</h3>
        <div className={styles.productList}>
          {products.map(product => (
            <label key={product.id} className={styles.productCheckbox}>
              <input
                type="checkbox"
                checked={formData.selectedProducts.includes(product.name)}
                onChange={(e) => handleProductSelect(product.id, e.target.checked)}
              />
              <span>{product.name}</span>
            </label>
          ))}
        </div>

        {formData.selectedProducts.map(productName => (
          <div key={productName} className={styles.productDetails}>
            <h4>{productName}</h4>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Retail Price</label>
                <input
                  type="number"
                  value={formData.productData[productName]?.retailPrice || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    productData: {
                      ...prev.productData,
                      [productName]: {
                        ...prev.productData[productName],
                        retailPrice: e.target.value,
                      },
                    },
                  }))}
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Units Bringing</label>
                <input
                  type="number"
                  value={formData.productData[productName]?.unitsBringing || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    productData: {
                      ...prev.productData,
                      [productName]: {
                        ...prev.productData[productName],
                        unitsBringing: e.target.value,
                      },
                    },
                  }))}
                  className={styles.input}
                />
              </div>
            </div>
          </div>
        ))}

        {error && <div className={styles.error}>{error}</div>}

        <Button
          onClick={handleAnalyze}
          loading={isLoading}
          disabled={!formData.eventName || !formData.location || formData.selectedProducts.length === 0}
          size="lg"
        >
          Analyze Event
        </Button>

        {analysisResult && (
          <div className={styles.results}>
            <h2>Analysis Results</h2>
            <div className={styles.resultCard}>
              <p><strong>Break-Even Units:</strong> {analysisResult.breakEvenUnits}</p>
              <p><strong>Recommendation:</strong> {analysisResult.recommendation}</p>
              <p>{analysisResult.recommendationReason}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
