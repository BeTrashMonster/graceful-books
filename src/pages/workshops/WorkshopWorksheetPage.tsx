import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMyWorkshopEnrollment, saveWorksheetProgress, completeWorksheet, type WorkshopEnrollment } from '../../services/workshops.api';
import { LoadingOverlay } from '../../components/feedback/Loading';
import styles from './WorkshopWorksheetPage.module.css';

interface Ingredient {
  name: string;
  quantity: number;
  cost: number;
}

interface PackagingItem {
  name: string;
  cost: number;
}

export default function WorkshopWorksheetPage() {
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState<WorkshopEnrollment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [productName, setProductName] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', quantity: 0, cost: 0 },
  ]);
  const [packaging, setPackaging] = useState<PackagingItem[]>([
    { name: '', cost: 0 },
  ]);
  const [laborTime, setLaborTime] = useState<number>(0);
  const [laborRate, setLaborRate] = useState<number>(15);
  const [distributionCost, setDistributionCost] = useState<number>(0);

  // Load enrollment on mount
  useEffect(() => {
    loadEnrollment();
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!enrollment?.worksheetCompletedAt) {
        handleSaveProgress(true); // Silent save
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [enrollment, productName, ingredients, packaging, laborTime, distributionCost]);

  const loadEnrollment = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const enrollmentData = await getMyWorkshopEnrollment();
      if (!enrollmentData) {
        setError('No workshop enrollment found. Please sign up for a workshop first.');
        setIsLoading(false);
        return;
      }
      setEnrollment(enrollmentData);
      // TODO: Load saved worksheet data from backend if available
    } catch (err: any) {
      console.error('Failed to load enrollment:', err);
      setError(err.message || 'Failed to load workshop enrollment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProgress = async (silent = false) => {
    if (!silent) {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
    }

    try {
      await saveWorksheetProgress({
        ingredients,
        packaging,
        laborTime,
        distributionCost,
        totalCost: calculateTotalCost(),
      });

      if (!silent) {
        setSuccessMessage('Progress saved successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      console.error('Failed to save progress:', err);
      if (!silent) {
        setError(err.message || 'Failed to save progress');
      }
    } finally {
      if (!silent) {
        setIsSaving(false);
      }
    }
  };

  const handleCompleteWorksheet = async () => {
    if (!productName.trim()) {
      setError('Please enter a product name');
      return;
    }

    if (ingredients.every(i => !i.name.trim())) {
      setError('Please add at least one ingredient');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Save final progress
      await saveWorksheetProgress({
        ingredients,
        packaging,
        laborTime,
        distributionCost,
        totalCost: calculateTotalCost(),
      });

      // Mark as completed
      await completeWorksheet();

      // Navigate to thank you page or dashboard
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Failed to complete worksheet:', err);
      setError(err.message || 'Failed to complete worksheet');
    } finally {
      setIsSaving(false);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: 0, cost: 0 }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const addPackagingItem = () => {
    setPackaging([...packaging, { name: '', cost: 0 }]);
  };

  const removePackagingItem = (index: number) => {
    setPackaging(packaging.filter((_, i) => i !== index));
  };

  const updatePackagingItem = (index: number, field: keyof PackagingItem, value: string | number) => {
    const updated = [...packaging];
    updated[index] = { ...updated[index], [field]: value };
    setPackaging(updated);
  };

  const calculateIngredientsCost = () => {
    return ingredients.reduce((total, ing) => total + (ing.quantity * ing.cost), 0);
  };

  const calculatePackagingCost = () => {
    return packaging.reduce((total, pkg) => total + pkg.cost, 0);
  };

  const calculateLaborCost = () => {
    return laborTime * laborRate;
  };

  const calculateTotalCost = () => {
    return (
      calculateIngredientsCost() +
      calculatePackagingCost() +
      calculateLaborCost() +
      distributionCost
    );
  };

  if (isLoading) {
    return <LoadingOverlay message="Loading worksheet..." />;
  }

  if (error && !enrollment) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorHeader}>
            <h1 className={styles.errorTitle}>Worksheet Not Available</h1>
            <p className={styles.errorMessage}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {isSaving && <LoadingOverlay message="Saving your work..." />}

      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Product Cost Worksheet</h1>
          <p className={styles.subtitle}>
            Calculate the true cost of making one unit of your product
          </p>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}
        {successMessage && <div className={styles.successAlert}>{successMessage}</div>}

        {/* Progress Indicator */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{
              width: enrollment?.worksheetCompletedAt
                ? '100%'
                : productName && ingredients.some(i => i.name)
                ? '50%'
                : '25%',
            }}
          />
        </div>

        {/* Form */}
        <div className={styles.form}>
          {/* Product Name */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Product Information</h2>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="productName">
                What product are you analyzing? *
              </label>
              <input
                type="text"
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className={styles.input}
                placeholder="e.g., Lavender Soap, Chocolate Chip Cookie"
                required
              />
            </div>
          </div>

          {/* Ingredients */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Ingredients / Materials</h2>
              <button type="button" onClick={addIngredient} className={styles.addButton}>
                + Add Ingredient
              </button>
            </div>
            {ingredients.map((ingredient, index) => (
              <div key={index} className={styles.ingredientRow}>
                <div className={styles.ingredientFields}>
                  <input
                    type="text"
                    value={ingredient.name}
                    onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                    className={styles.input}
                    placeholder="Ingredient name"
                  />
                  <input
                    type="number"
                    value={ingredient.quantity || ''}
                    onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                    className={styles.inputSmall}
                    placeholder="Qty"
                    step="0.01"
                    min="0"
                  />
                  <input
                    type="number"
                    value={ingredient.cost || ''}
                    onChange={(e) => updateIngredient(index, 'cost', parseFloat(e.target.value) || 0)}
                    className={styles.inputSmall}
                    placeholder="Cost per unit"
                    step="0.01"
                    min="0"
                  />
                </div>
                {ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className={styles.removeButton}
                    aria-label="Remove ingredient"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <div className={styles.subtotal}>
              Total Ingredients Cost: <strong>${calculateIngredientsCost().toFixed(2)}</strong>
            </div>
          </div>

          {/* Packaging */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Packaging Materials</h2>
              <button type="button" onClick={addPackagingItem} className={styles.addButton}>
                + Add Packaging
              </button>
            </div>
            {packaging.map((item, index) => (
              <div key={index} className={styles.packagingRow}>
                <div className={styles.packagingFields}>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updatePackagingItem(index, 'name', e.target.value)}
                    className={styles.input}
                    placeholder="Packaging item"
                  />
                  <input
                    type="number"
                    value={item.cost || ''}
                    onChange={(e) => updatePackagingItem(index, 'cost', parseFloat(e.target.value) || 0)}
                    className={styles.inputSmall}
                    placeholder="Cost"
                    step="0.01"
                    min="0"
                  />
                </div>
                {packaging.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePackagingItem(index)}
                    className={styles.removeButton}
                    aria-label="Remove packaging item"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <div className={styles.subtotal}>
              Total Packaging Cost: <strong>${calculatePackagingCost().toFixed(2)}</strong>
            </div>
          </div>

          {/* Labor */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Labor</h2>
            <div className={styles.laborRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Time to make one unit (hours)</label>
                <input
                  type="number"
                  value={laborTime || ''}
                  onChange={(e) => setLaborTime(parseFloat(e.target.value) || 0)}
                  className={styles.input}
                  placeholder="0.5"
                  step="0.25"
                  min="0"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Labor rate ($/hour)</label>
                <input
                  type="number"
                  value={laborRate || ''}
                  onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)}
                  className={styles.input}
                  placeholder="15.00"
                  step="0.50"
                  min="0"
                />
              </div>
            </div>
            <div className={styles.subtotal}>
              Total Labor Cost: <strong>${calculateLaborCost().toFixed(2)}</strong>
            </div>
          </div>

          {/* Distribution */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Distribution / Shipping</h2>
            <div className={styles.formGroup}>
              <label className={styles.label}>Cost per unit to ship/distribute</label>
              <input
                type="number"
                value={distributionCost || ''}
                onChange={(e) => setDistributionCost(parseFloat(e.target.value) || 0)}
                className={styles.input}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          {/* Total Cost */}
          <div className={styles.totalSection}>
            <div className={styles.totalCard}>
              <h2 className={styles.totalLabel}>Total Cost Per Unit</h2>
              <div className={styles.totalAmount}>${calculateTotalCost().toFixed(2)}</div>
              <p className={styles.totalHint}>
                This is the minimum you need to charge to break even
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => handleSaveProgress(false)}
              className={styles.secondaryButton}
              disabled={isSaving}
            >
              Save Progress
            </button>
            <button
              type="button"
              onClick={handleCompleteWorksheet}
              className={styles.primaryButton}
              disabled={isSaving || !productName.trim()}
            >
              Complete Worksheet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
