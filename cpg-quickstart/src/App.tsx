import { useState, useEffect } from 'react';
import type { WorksheetData, WizardStep } from './types';
import WelcomeStep from './components/WelcomeStep';
import CategoriesStep from './components/CategoriesStep';
import ProductsStep from './components/ProductsStep';
import RecipesStep from './components/RecipesStep';
import InvoicesStep from './components/InvoicesStep';
import ReviewStep from './components/ReviewStep';
import SummaryPanel from './components/SummaryPanel';
import './App.css';

const STORAGE_KEY = 'cpg-quickstart-draft';

function App() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [data, setData] = useState<WorksheetData>({
    version: '1.0.0',
    created_at: new Date().toISOString(),
    categories: [],
    finished_products: [],
    recipes: [],
    invoices: [],
  });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setData(parsed.data);
        setCurrentStep(parsed.currentStep);
        setLastSaved(new Date(parsed.savedAt));
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, []);

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
    if (currentStep !== 'welcome') {
      const draft = {
        data,
        currentStep,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setLastSaved(new Date());
    }
  }, [data, currentStep]);

  const steps: WizardStep[] = ['welcome', 'categories', 'products', 'recipes', 'invoices', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      goToStep(steps[nextIndex]);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(steps[prevIndex]);
    }
  };

  const updateData = (updates: Partial<WorksheetData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const clearDraft = () => {
    if (confirm('Are you sure you want to clear all your work and start over?')) {
      localStorage.removeItem(STORAGE_KEY);
      setData({
        version: '1.0.0',
        created_at: new Date().toISOString(),
        categories: [],
        finished_products: [],
        recipes: [],
        invoices: [],
      });
      setCurrentStep('welcome');
      setLastSaved(null);
    }
  };

  const exportJSON = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cpg-quickstart-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1>CPG Quick Start Worksheet</h1>
            <p>Audacious Money</p>
          </div>
          {lastSaved && currentStep !== 'welcome' && (
            <div className="save-indicator">
              ✓ Last saved: {lastSaved.toLocaleTimeString()}
            </div>
          )}
        </div>
      </header>

      <div className="app-content">
        <main className="main-content">
          {currentStep === 'welcome' && (
            <WelcomeStep onNext={nextStep} />
          )}
          {currentStep === 'categories' && (
            <CategoriesStep
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          {currentStep === 'products' && (
            <ProductsStep
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          {currentStep === 'recipes' && (
            <RecipesStep
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          {currentStep === 'invoices' && (
            <InvoicesStep
              data={data}
              updateData={updateData}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          {currentStep === 'review' && (
            <ReviewStep
              data={data}
              goToStep={goToStep}
              onExport={exportJSON}
              onClear={clearDraft}
            />
          )}
        </main>

        {currentStep !== 'welcome' && (
          <SummaryPanel
            data={data}
            currentStep={currentStep}
            goToStep={goToStep}
          />
        )}
      </div>

      {currentStep !== 'welcome' && currentStep !== 'review' && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((currentStepIndex) / (steps.length - 1)) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
