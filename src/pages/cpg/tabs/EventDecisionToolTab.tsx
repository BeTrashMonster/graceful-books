/**
 * Event Decision Tool Tab
 *
 * Plan farmers markets and events - calculate costs, margins, and break-even points
 */

import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { Button } from '../../../components/core/Button';
import { Input } from '../../../components/forms/Input';
import { EventImpactSummary } from '../../../components/cpg/EventImpactSummary';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../db';
import { EventAnalyzerService } from '../../../services/cpg/eventAnalyzer.service';
import { cpuCalculatorService } from '../../../services/cpg/cpuCalculator.service';
import { getProfitMarginQualityWithSettings, createDefaultCPGSettings } from '../../../db/schema/cpg.schema';
import type { CPGSettings } from '../../../db/schema/cpg.schema';
import styles from './EventDecisionToolTab.module.css';

interface LaborEntry {
  id: string;
  description: string;
  hours: string;
  hourlyRate: string;
  costType: 'actual' | 'opportunity';
}

interface FormData {
  eventName: string;
  eventStartDate: string;
  eventEndDate: string;
  location: string;
  eventCost: string;
  travelingCosts: string;
  laborEntries: LaborEntry[];
  selectedProducts: string[];
  productData: Record<string, {
    retailPrice: string;
    unitsBringing: string;
    baseCPU: string;
  }>;
}

interface Product {
  id: string;
  name: string;
  displayName: string;
  sku: string | null;
  msrp: string;
  cpu: string;
}

interface EventDecisionToolTabProps {
  editEventId?: string | null;
}

export function EventDecisionToolTab({ editEventId }: EventDecisionToolTabProps) {
  const { companyId, deviceId } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    eventName: '',
    eventStartDate: '',
    eventEndDate: '',
    location: '',
    eventCost: '',
    travelingCosts: '',
    laborEntries: [],
    selectedProducts: [],
    productData: {},
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [cpgSettings, setCpgSettings] = useState<CPGSettings | null>(null);

  const productDropdownRef = useRef<HTMLDivElement>(null);
  const productButtonRef = useRef<HTMLButtonElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Load products and settings
  useEffect(() => {
    loadData();
  }, [companyId]);

  // Load event for editing
  useEffect(() => {
    if (editEventId && companyId) {
      loadEventForEditing(editEventId);
    }
  }, [editEventId, companyId]);

  const loadData = async () => {
    // Don't try to load if companyId isn't available yet
    if (!companyId) {
      return;
    }

    setIsLoadingData(true);
    try {
      // Load CPG settings
      let settings = await db.cpgSettings
        .where('company_id')
        .equals(companyId)
        .and((s) => s.active && !s.deleted_at)
        .first();

      if (!settings) {
        const defaultSettings = createDefaultCPGSettings(companyId, deviceId);
        await db.cpgSettings.add(defaultSettings as CPGSettings);
        settings = defaultSettings as CPGSettings;
      }
      setCpgSettings(settings);

      // Load products
      const prods = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .filter(p => p.active && !p.deleted_at)
        .toArray();

      const productsWithCPU = await Promise.all(
        prods.map(async (p) => {
          try {
            const cpuBreakdown = await cpuCalculatorService.getFinishedProductCPUBreakdown(p.id, companyId);
            const displayName = p.sku ? `${p.sku} - ${p.name}` : p.name;
            return {
              id: p.id,
              name: p.name,
              displayName,
              sku: p.sku,
              msrp: p.msrp || '0',
              cpu: cpuBreakdown.cpu || '0',
            };
          } catch {
            return null;
          }
        })
      );

      // Filter out failed products and sort alphabetically
      const validProducts = productsWithCPU.filter(Boolean) as Product[];
      validProducts.sort((a, b) => a.displayName.localeCompare(b.displayName));

      setProducts(validProducts);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Unable to load product data. Please visit "My Products" to ensure your products have recipes and ingredient costs set up, then try again. If you just uploaded data, give it a moment to finish processing.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadEventForEditing = async (eventId: string) => {
    try {
      setError(null);

      // Fetch the event from database
      const event = await db.cpgEvents.get(eventId);
      if (!event) {
        setError('Event not found');
        return;
      }

      // Convert timestamps to YYYY-MM-DD format for date inputs
      const startDate = new Date(event.event_start_date).toISOString().split('T')[0];
      const endDate = new Date(event.event_end_date).toISOString().split('T')[0];

      // Prepare labor entries if they exist
      const laborEntries: LaborEntry[] = event.labor_entries
        ? event.labor_entries.map(e => ({
            id: e.id,
            description: e.description || '',
            hours: e.hours,
            hourlyRate: e.hourly_rate,
            costType: e.cost_type,
          }))
        : [];

      // Prepare product data if it exists
      const selectedProducts: string[] = [];
      const productData: Record<string, { retailPrice: string; unitsBringing: string; baseCPU: string }> = {};

      if (event.variant_event_data) {
        Object.entries(event.variant_event_data).forEach(([name, data]: [string, any]) => {
          selectedProducts.push(name);
          productData[name] = {
            retailPrice: data.retail_price?.toString() || '0',
            unitsBringing: data.units_bringing?.toString() || '0',
            baseCPU: data.base_cpu?.toString() || '0',
          };
        });
      }

      // Populate form with event data
      setFormData({
        eventName: event.event_name,
        eventStartDate: startDate,
        eventEndDate: endDate,
        location: event.location || '',
        eventCost: event.event_cost?.toString() || '0',
        travelingCosts: event.traveling_fees?.toString() || '',
        laborEntries,
        selectedProducts,
        productData,
      });

      // Reconstruct analysis results from event data if they exist
      if (event.variant_event_results && Object.keys(event.variant_event_results).length > 0) {
        // Convert variant_event_results from snake_case to camelCase
        const variantResults: Record<string, any> = {};
        for (const [variantName, result] of Object.entries(event.variant_event_results)) {
          variantResults[variantName] = {
            eventCostPerUnit: result.event_cost_per_unit,
            cpuWithEvent: result.cpu_with_event,
            laborCostPerUnit: result.labor_cost_per_unit,
            totalCostWithLabor: result.total_cost_with_labor,
            netProfitMarginWithEvent: result.net_profit_margin_with_event,
            netProfitMarginWithoutEvent: result.net_profit_margin_without_event,
            netProfitMarginWithLabor: result.net_profit_margin_with_labor,
            marginQualityWithEvent: result.margin_quality_with_event,
            marginDifference: '0', // Not stored, calculate if needed
          };
        }

        // Calculate total units
        const totalUnits = Object.values(event.variant_event_data || {}).reduce(
          (sum, data: any) => sum + parseFloat(data.units_bringing || '0'),
          0
        );

        // Calculate break-even units (approximate)
        const breakEvenUnits = totalUnits; // Simplified - actual calculation would be more complex

        const analysisResult = {
          eventId: event.id,
          eventName: event.event_name,
          location: event.location,
          eventStartDate: event.event_start_date,
          eventEndDate: event.event_end_date,
          eventCost: event.event_cost,
          travelingFees: event.traveling_fees,
          laborEntries: laborEntries,
          variantResults,
          totalEventCost: event.total_event_cost,
          totalActualLaborCost: event.total_actual_labor_cost,
          totalOpportunityCost: event.total_opportunity_cost,
          totalUnits: totalUnits.toString(),
          breakEvenUnits: breakEvenUnits.toString(),
          recommendation: event.recommendation || 'neutral',
          recommendationReason: '', // Not stored
        };

        setAnalysisResult(analysisResult);

        // Scroll to results after a brief delay
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } catch (err) {
      console.error('Failed to load event:', err);
      setError('Failed to load event for editing');
    }
  };

  // Calculate dropdown position with viewport awareness
  useEffect(() => {
    if (showProductDropdown && productButtonRef.current) {
      const rect = productButtonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 20; // 20px margin
      const spaceAbove = rect.top - 20; // 20px margin

      // Calculate max height based on available space
      const maxHeight = Math.min(300, Math.max(200, spaceBelow));

      // If not enough space below, position above
      const shouldPositionAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

      setDropdownPosition({
        top: shouldPositionAbove ? rect.top - maxHeight - 4 : rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [showProductDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideButton = productButtonRef.current && !productButtonRef.current.contains(target);
      const isOutsideDropdown = productDropdownRef.current && !productDropdownRef.current.contains(target);

      if (isOutsideButton && isOutsideDropdown) {
        setShowProductDropdown(false);
      }
    };

    if (showProductDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProductDropdown]);

  // Handle date blur to fix 2-digit year entries (26 -> 2026, not 0026)
  const handleDateBlur = (field: 'eventStartDate' | 'eventEndDate', value: string) => {
    if (!value) return;

    try {
      const parts = value.split('-');
      if (parts.length === 3) {
        let year = parseInt(parts[0], 10);

        // If year is 2 digits (0-99), convert to current century
        if (year >= 0 && year < 100) {
          year += 2000;
          const fixedDate = `${year}-${parts[1]}-${parts[2]}`;
          setFormData((prev) => ({ ...prev, [field]: fixedDate }));
        }
      }
    } catch (e) {
      // Invalid date format, ignore
    }
  };

  const handleProductSelect = (productId: string, selected: boolean) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (selected) {
      setFormData(prev => ({
        ...prev,
        selectedProducts: [...prev.selectedProducts, product.displayName],
        productData: {
          ...prev.productData,
          [product.displayName]: {
            retailPrice: product.msrp,
            unitsBringing: '',
            baseCPU: product.cpu,
          },
        },
      }));
    } else {
      setFormData(prev => {
        const newSelected = prev.selectedProducts.filter(name => name !== product.displayName);
        const newData = { ...prev.productData };
        delete newData[product.displayName];
        return {
          ...prev,
          selectedProducts: newSelected,
          productData: newData,
        };
      });
    }
  };

  const handleSelectAllProducts = () => {
    const allProductNames = products.map(p => p.displayName);
    const allProductData: Record<string, any> = {};
    products.forEach(p => {
      allProductData[p.displayName] = {
        retailPrice: p.msrp,
        unitsBringing: '',
        baseCPU: p.cpu,
      };
    });
    setFormData(prev => ({
      ...prev,
      selectedProducts: allProductNames,
      productData: allProductData,
    }));
  };

  const handleClearAllProducts = () => {
    setFormData(prev => ({
      ...prev,
      selectedProducts: [],
      productData: {},
    }));
  };

  const addLaborEntry = () => {
    const newEntry: LaborEntry = {
      id: nanoid(),
      description: '',
      hours: '',
      hourlyRate: '',
      costType: 'actual',
    };
    setFormData(prev => ({
      ...prev,
      laborEntries: [...prev.laborEntries, newEntry],
    }));
  };

  const removeLaborEntry = (id: string) => {
    setFormData(prev => ({
      ...prev,
      laborEntries: prev.laborEntries.filter(entry => entry.id !== id),
    }));
  };

  const handleLaborEntryChange = (id: string, field: keyof Omit<LaborEntry, 'id'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      laborEntries: prev.laborEntries.map(entry =>
        entry.id === id ? { ...entry, [field]: value } : entry
      ),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.eventName.trim()) {
      newErrors.eventName = 'Event name is required';
    }

    if (!formData.eventStartDate) {
      newErrors.eventStartDate = 'Start date is required';
    }

    if (!formData.eventEndDate) {
      newErrors.eventEndDate = 'End date is required';
    }

    if (formData.eventStartDate && formData.eventEndDate) {
      // Parse dates in local timezone for comparison
      const startDate = new Date(formData.eventStartDate + 'T00:00:00');
      const endDate = new Date(formData.eventEndDate + 'T00:00:00');
      if (endDate < startDate) {
        newErrors.eventEndDate = 'End date must be after start date';
      }
    }

    if (!formData.eventCost || parseFloat(formData.eventCost) < 0) {
      newErrors.eventCost = 'Event cost is required';
    }

    if (formData.selectedProducts.length === 0) {
      newErrors.selectedProducts = 'Please select at least one product';
    }

    formData.selectedProducts.forEach(productName => {
      const data = formData.productData[productName];
      if (!data.unitsBringing || parseFloat(data.unitsBringing) <= 0) {
        newErrors[`product_${productName}_units`] = `${productName}: Units must be greater than 0`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAnalyze = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = new EventAnalyzerService(db);

      // Filter out incomplete labor entries (must have hours and hourlyRate filled in)
      const completeLaborEntries = formData.laborEntries.filter(e =>
        e.hours && e.hourlyRate && parseFloat(e.hours) > 0 && parseFloat(e.hourlyRate) > 0
      );

      console.log('Complete labor entries:', completeLaborEntries);

      // Create event
      // Parse dates in local timezone (not UTC)
      // Adding 'T00:00:00' forces the date to be interpreted as local midnight
      const localStartDate = new Date(formData.eventStartDate + 'T00:00:00').getTime();
      const localEndDate = new Date(formData.eventEndDate + 'T23:59:59').getTime();

      const event = await service.createEvent({
        companyId,
        eventName: formData.eventName,
        location: formData.location,
        eventStartDate: localStartDate,
        eventEndDate: localEndDate,
        eventCost: formData.eventCost,
        travelingFees: formData.travelingCosts || undefined,
        laborEntries: completeLaborEntries.length > 0 ? completeLaborEntries.map(e => ({
          id: e.id,
          description: e.description,
          hours: e.hours,
          hourly_rate: e.hourlyRate,
          cost_type: e.costType,
        })) : undefined,
      }, deviceId);

      console.log('Event created:', {
        eventId: event.id,
        laborEntries: event.labor_entries,
        laborEntriesLength: event.labor_entries?.length || 0,
      });

      // Prepare variant data - ensure all values are valid strings with numbers
      const variantEventData: Record<string, any> = {};
      formData.selectedProducts.forEach(productName => {
        const data = formData.productData[productName];
        if (data) {
          // Ensure we have valid numeric strings, defaulting to '0' if empty/invalid
          const retailPrice = data.retailPrice && !isNaN(parseFloat(data.retailPrice))
            ? data.retailPrice
            : '0';
          const unitsBringing = data.unitsBringing && !isNaN(parseFloat(data.unitsBringing))
            ? data.unitsBringing
            : '0';
          const baseCPU = data.baseCPU && !isNaN(parseFloat(data.baseCPU))
            ? data.baseCPU
            : '0';

          variantEventData[productName] = {
            retailPrice,
            unitsBringing,
            baseCPU,
          };
        }
      });

      // Debug log the data being sent
      console.log('Analyzing event with data:', {
        eventId: event.id,
        variantEventData,
        eventCost: formData.eventCost,
        travelingCosts: formData.travelingCosts,
      });

      // Analyze event
      const result = await service.analyzeEvent({
        eventId: event.id,
        variantEventData,
      }, deviceId);

      console.log('Analysis result:', {
        totalActualLaborCost: result.totalActualLaborCost,
        totalOpportunityCost: result.totalOpportunityCost,
        totalEventCost: result.totalEventCost,
      });

      setAnalysisResult(result);

      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getMarginQuality = (marginPercentage: string): 'gutCheck' | 'good' | 'better' | 'best' => {
    if (!cpgSettings) {
      const margin = parseFloat(marginPercentage);
      if (margin < 50) return 'gutCheck';
      if (margin < 60) return 'good';
      if (margin < 70) return 'better';
      return 'best';
    }
    return getProfitMarginQualityWithSettings(marginPercentage, cpgSettings);
  };

  const getMarginColorClass = (quality: 'gutCheck' | 'good' | 'better' | 'best'): string => {
    const colorMap = {
      gutCheck: 'marginGutCheck',
      good: 'marginGood',
      better: 'marginBetter',
      best: 'marginBest',
    };
    return colorMap[quality];
  };

  if (isLoadingData) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading event planning tools...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <form onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }} className={styles.form} noValidate>

        {/* Event Details Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Event Details</h3>

          {/* Row 1: Event Name, Start Date, End Date */}
          <div className={styles.row}>
            <Input
              label="Event Name"
              type="text"
              value={formData.eventName}
              onChange={(e) => setFormData(prev => ({ ...prev, eventName: e.target.value }))}
              error={errors.eventName}
              required
              fullWidth
            />
            <Input
              label="Start Date"
              type="date"
              value={formData.eventStartDate}
              onChange={(e) => setFormData(prev => ({ ...prev, eventStartDate: e.target.value }))}
              onBlur={(e) => handleDateBlur('eventStartDate', e.target.value)}
              error={errors.eventStartDate}
              required
              fullWidth
            />
            <Input
              label="End Date"
              type="date"
              value={formData.eventEndDate}
              onChange={(e) => setFormData(prev => ({ ...prev, eventEndDate: e.target.value }))}
              onBlur={(e) => handleDateBlur('eventEndDate', e.target.value)}
              error={errors.eventEndDate}
              required
              fullWidth
            />
          </div>

          {/* Row 2: Location, Event Cost, Traveling Costs */}
          <div className={styles.row}>
            <Input
              label="Location"
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              fullWidth
              helperText="Optional: Track events by venue"
            />
            <Input
              label="Event Cost"
              type="number"
              step="0.01"
              min="0"
              value={formData.eventCost}
              onChange={(e) => setFormData(prev => ({ ...prev, eventCost: e.target.value }))}
              error={errors.eventCost}
              required
              fullWidth
              helperText="Booth fees, permits, supplies, etc."
            />
            <Input
              label="Traveling Costs"
              type="number"
              step="0.01"
              min="0"
              value={formData.travelingCosts}
              onChange={(e) => setFormData(prev => ({ ...prev, travelingCosts: e.target.value }))}
              fullWidth
              helperText="Gas, hotel, flights, food, etc."
            />
          </div>
        </div>

        {/* Labor Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Labor Costs</h3>
          <p className={styles.sectionDescription}>
            Track labor for the event. Add multiple entries if you and employees will be working.
          </p>

          {formData.laborEntries.map((entry, index) => (
            <fieldset key={entry.id} className={styles.laborEntryCard}>
              <legend className={styles.laborEntryLegend}>Labor Entry {index + 1}</legend>
              <button
                type="button"
                onClick={() => removeLaborEntry(entry.id)}
                className={styles.removeButton}
                aria-label={`Remove labor entry ${index + 1}`}
              >
                ✕
              </button>
              <div className={styles.laborEntryFields}>
                <div className={styles.laborEntryRow}>
                  <Input
                    label="Hours"
                    type="number"
                    step="0.5"
                    min="0"
                    value={entry.hours}
                    onChange={(e) => handleLaborEntryChange(entry.id, 'hours', e.target.value)}
                    fullWidth
                  />
                  <Input
                    label="Hourly Rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={entry.hourlyRate}
                    onChange={(e) => handleLaborEntryChange(entry.id, 'hourlyRate', e.target.value)}
                    fullWidth
                  />
                  <Input
                    label="Description"
                    type="text"
                    value={entry.description}
                    onChange={(e) => handleLaborEntryChange(entry.id, 'description', e.target.value)}
                    fullWidth
                    placeholder="ex: Millie working the booth"
                  />
                </div>
                <div className={styles.costTypeSelector}>
                  <label className={styles.costTypeLabel}>Cost Type:</label>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name={`costType_${entry.id}`}
                        value="actual"
                        checked={entry.costType === 'actual'}
                        onChange={() => handleLaborEntryChange(entry.id, 'costType', 'actual')}
                      />
                      <span>Actual Cost (paid helping hands)</span>
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name={`costType_${entry.id}`}
                        value="opportunity"
                        checked={entry.costType === 'opportunity'}
                        onChange={() => handleLaborEntryChange(entry.id, 'costType', 'opportunity')}
                      />
                      <span>Sweat Equity (owner's time)</span>
                    </label>
                  </div>
                </div>
              </div>
            </fieldset>
          ))}

          <Button
            type="button"
            variant="purple"
            size="md"
            onClick={addLaborEntry}
            className={styles.addLaborButton}
          >
            ✨ Add Labor Entry
          </Button>
        </div>

        {/* Product Selection */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Select Products for this Event</h3>
          {errors.selectedProducts && (
            <div className={styles.errorMessage}>{errors.selectedProducts}</div>
          )}

          <div className={styles.productSelector}>
            <button
              type="button"
              ref={productButtonRef}
              className={styles.productDropdown}
              onClick={() => setShowProductDropdown(!showProductDropdown)}
              aria-expanded={showProductDropdown}
              aria-haspopup="menu"
            >
              <span>
                {formData.selectedProducts.length === 0
                  ? 'No Products Selected'
                  : formData.selectedProducts.length === products.length
                  ? 'All Products Selected'
                  : `${formData.selectedProducts.length} Product${formData.selectedProducts.length === 1 ? '' : 's'} Selected`}
              </span>
              <span aria-hidden="true">{showProductDropdown ? '▲' : '▼'}</span>
            </button>

            {showProductDropdown && (
              <div
                ref={productDropdownRef}
                className={styles.productDropdownMenu}
                role="menu"
                style={{
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                }}
              >
                <div className={styles.productDropdownActions}>
                  <button
                    type="button"
                    onClick={handleSelectAllProducts}
                    className={styles.selectAllButton}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllProducts}
                    className={styles.clearAllButton}
                  >
                    Clear All
                  </button>
                </div>

                {products.map(product => (
                  <label
                    key={product.id}
                    className={styles.productCheckboxLabel}
                  >
                    <input
                      type="checkbox"
                      checked={formData.selectedProducts.includes(product.displayName)}
                      onChange={(e) => handleProductSelect(product.id, e.target.checked)}
                    />
                    <span>{product.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {formData.selectedProducts.length > 0 && (
            <div className={styles.selectedProductsList}>
              <h4 className={styles.selectedProductsTitle}>
                Selected Products ({formData.selectedProducts.length}):
              </h4>
              <div className={styles.selectedProductsGrid}>
                {formData.selectedProducts.map(productName => (
                  <div key={productName} className={styles.selectedProductChip}>
                    <span>{productName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const product = products.find(p => p.displayName === productName);
                        if (product) handleProductSelect(product.id, false);
                      }}
                      className={styles.removeChipButton}
                      aria-label={`Remove ${productName}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Product Details */}
        {formData.selectedProducts.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Product Details</h3>
            <p className={styles.sectionDescription}>
              Enter quantities you're bringing. Retail prices and base CPUs are pre-filled.
            </p>

            {formData.selectedProducts.map(productName => (
              <div key={productName} className={styles.productDetailsCard}>
                <h4 className={styles.productDetailsTitle}>{productName}</h4>
                <div className={styles.productDetailsRow}>
                  <Input
                    label="Retail Price"
                    type="number"
                    step="0.01"
                    min="0"
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
                    fullWidth
                    helperText="Price customers pay"
                  />
                  <Input
                    label="Units Bringing"
                    type="number"
                    step="1"
                    min="0"
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
                    error={errors[`product_${productName}_units`]}
                    required
                    fullWidth
                    helperText="How many units are you bringing?"
                  />
                  <Input
                    label="Base CPU"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.productData[productName]?.baseCPU || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      productData: {
                        ...prev.productData,
                        [productName]: {
                          ...prev.productData[productName],
                          baseCPU: e.target.value,
                        },
                      },
                    }))}
                    fullWidth
                    helperText="Your cost per unit"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className={styles.actions}>
          <Button
            type="submit"
            variant="gold"
            size="lg"
            loading={isLoading}
            disabled={isLoading}
            className={styles.analyzeButton}
          >
            Analyze Event
          </Button>
        </div>
      </form>

      {/* Results */}
      {analysisResult && (
        <div ref={resultsRef} className={styles.results}>
          <h2 className={styles.resultsTitle}>Event Analysis Results</h2>

          <EventImpactSummary
            totalEventCost={analysisResult.totalEventCost}
            totalTravelingCost={formData.travelingCosts || null}
            totalActualLaborCost={analysisResult.totalActualLaborCost || null}
            totalOpportunityCost={analysisResult.totalOpportunityCost || null}
            totalUnits={(() => {
              const total = Object.values(formData.productData).reduce(
                (sum, data) => sum + parseFloat(data.unitsBringing || '0'),
                0
              );
              return total.toString();
            })()}
            breakEvenUnits={analysisResult.breakEvenUnits}
            averageRetailPrice={(() => {
              const products = Object.keys(analysisResult.variantResults);
              if (products.length === 0) return undefined;
              const totalPrice = products.reduce((sum, name) => {
                return sum + parseFloat(formData.productData[name]?.retailPrice || '0');
              }, 0);
              return (totalPrice / products.length).toString();
            })()}
            averageCPU={(() => {
              const products = Object.keys(analysisResult.variantResults);
              if (products.length === 0) return undefined;
              const totalCPU = products.reduce((sum, name) => {
                const results = analysisResult.variantResults[name];
                const baseCPU = parseFloat(results.cpuWithEvent) - parseFloat(results.eventCostPerUnit);
                return sum + baseCPU;
              }, 0);
              return (totalCPU / products.length).toString();
            })()}
            averageEventCostPerUnit={(() => {
              const products = Object.keys(analysisResult.variantResults);
              if (products.length === 0) return undefined;
              const totalEventCost = products.reduce((sum, name) => {
                const results = analysisResult.variantResults[name];
                return sum + parseFloat(results.eventCostPerUnit);
              }, 0);
              return (totalEventCost / products.length).toString();
            })()}
            averageGrossProfitWithEvent={(() => {
              const products = Object.keys(analysisResult.variantResults);
              if (products.length === 0) return undefined;
              const totalGrossProfit = products.reduce((sum, name) => {
                const results = analysisResult.variantResults[name];
                const retailPrice = parseFloat(formData.productData[name]?.retailPrice || '0');
                // Include labor cost in total cost (based on expected units)
                const laborCost = results.laborCostPerUnit ? parseFloat(results.laborCostPerUnit) : 0;
                const totalCost = parseFloat(results.cpuWithEvent) + laborCost;
                return sum + (retailPrice - totalCost);
              }, 0);
              return (totalGrossProfit / products.length).toString();
            })()}
            averageMarginWithEvent={(() => {
              const products = Object.keys(analysisResult.variantResults);
              if (products.length === 0) return undefined;
              const totalMargin = products.reduce((sum, name) => {
                const results = analysisResult.variantResults[name];
                const retailPrice = parseFloat(formData.productData[name]?.retailPrice || '0');
                // Calculate margin WITHOUT labor cost - component will recalculate with labor
                const totalCostWithoutLabor = parseFloat(results.cpuWithEvent);
                const grossProfitWithoutLabor = retailPrice - totalCostWithoutLabor;
                const margin = retailPrice > 0 ? (grossProfitWithoutLabor / retailPrice) * 100 : 0;
                return sum + margin;
              }, 0);
              return (totalMargin / products.length).toString();
            })()}
            variantData={Object.keys(analysisResult.variantResults).map(name => {
              const results = analysisResult.variantResults[name];
              const baseCPU = parseFloat(results.cpuWithEvent) - parseFloat(results.eventCostPerUnit);
              return {
                name,
                unitsAvailable: parseFloat(formData.productData[name]?.unitsBringing || '0'),
                retailPrice: parseFloat(formData.productData[name]?.retailPrice || '0'),
                eventCostPerUnit: parseFloat(results.eventCostPerUnit),
                baseCPU,
              };
            })}
          />

          {/* Product Comparisons */}
          <h3 className={styles.comparisonTitle}>Product Analysis</h3>
          {Object.entries(analysisResult.variantResults).map(([productName, results]: [string, any]) => {
            const retailPrice = parseFloat(formData.productData[productName]?.retailPrice || '0');
            const baseCPU = parseFloat(results.cpuWithEvent) - parseFloat(results.eventCostPerUnit);
            const eventCost = parseFloat(results.eventCostPerUnit);
            const laborCost = results.laborCostPerUnit ? parseFloat(results.laborCostPerUnit) : 0;

            // WITHOUT Event scenario
            const grossProfitWithout = retailPrice - baseCPU;
            const marginWithout = retailPrice > 0 ? ((grossProfitWithout / retailPrice) * 100).toFixed(2) : '0.00';
            const marginQualityWithout = getMarginQuality(marginWithout);

            // WITH Event scenario
            const totalCostWith = baseCPU + eventCost + laborCost;
            const grossProfitWith = retailPrice - totalCostWith;
            const marginWith = parseFloat(results.netProfitMarginWithLabor || results.netProfitMarginWithEvent);
            const marginQualityWith = results.marginQualityWithEvent;

            return (
              <div key={productName} className={styles.comparisonCard}>
                <h4>{productName}</h4>

                <div className={styles.comparisonGrid}>
                  {/* WITHOUT Event */}
                  <div className={styles.comparisonColumn}>
                    <div className={styles.columnHeader}>
                      <span>✗ WITHOUT Event</span>
                    </div>
                    <div className={styles.plStatement}>
                      <div className={styles.plRow}>
                        <span>Retail Price</span>
                        <span>${retailPrice.toFixed(2)}</span>
                      </div>
                      <div className={styles.plRowCost}>
                        <span>Less: CPU</span>
                        <span>(${baseCPU.toFixed(2)})</span>
                      </div>
                      <div className={styles.plRowDivider}>
                        <span>Gross Profit</span>
                        <span>${grossProfitWithout.toFixed(2)}</span>
                      </div>
                      <div className={`${styles.plRowMargin} ${styles[getMarginColorClass(marginQualityWithout)]}`}>
                        <span>Margin</span>
                        <span>{marginWithout}%</span>
                      </div>
                    </div>
                  </div>

                  {/* WITH Event */}
                  <div className={styles.comparisonColumn}>
                    <div className={styles.columnHeader}>
                      <span>✓ WITH Event</span>
                    </div>
                    <div className={styles.plStatement}>
                      <div className={styles.plRow}>
                        <span>Retail Price</span>
                        <span>${retailPrice.toFixed(2)}</span>
                      </div>
                      <div className={styles.plRowCost}>
                        <span>Less: CPU</span>
                        <span>(${baseCPU.toFixed(2)})</span>
                      </div>
                      <div className={styles.plRowCost}>
                        <span>Less: Event Cost/Unit</span>
                        <span>(${eventCost.toFixed(2)})</span>
                      </div>
                      {laborCost > 0 && (
                        <div className={styles.plRowCost}>
                          <span>Less: Labor/Unit</span>
                          <span>(${laborCost.toFixed(2)})</span>
                        </div>
                      )}
                      <div className={styles.plRowDivider}>
                        <span>Gross Profit</span>
                        <span>${grossProfitWith.toFixed(2)}</span>
                      </div>
                      <div className={`${styles.plRowMargin} ${styles[getMarginColorClass(marginQualityWith)]}`}>
                        <span>Margin</span>
                        <span>{marginWith.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
