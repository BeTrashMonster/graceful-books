import type { WorksheetData, WizardStep } from '../types';
import './SummaryPanel.css';

interface SummaryPanelProps {
  data: WorksheetData;
  currentStep: WizardStep;
  goToStep: (step: WizardStep) => void;
}

export default function SummaryPanel({ data, currentStep, goToStep }: SummaryPanelProps) {
  return (
    <aside className="summary-panel">
      <div className="summary-header">
        <h3>Your Progress</h3>
        <p>Click any section to edit</p>
      </div>

      <div className="summary-sections">
        {/* Categories */}
        <button
          className={`summary-section ${currentStep === 'categories' ? 'active' : ''} ${data.categories.length > 0 ? 'completed' : ''}`}
          onClick={() => goToStep('categories')}
        >
          <div className="summary-section-header">
            <span className="summary-icon">📦</span>
            <span className="summary-title">Categories</span>
            <span className="summary-badge">{data.categories.length}</span>
          </div>
          {data.categories.length > 0 && (
            <div className="summary-section-content">
              {data.categories.slice(0, 3).map((cat) => (
                <div key={cat.id} className="summary-item">
                  • {cat.name}
                  {cat.variants.length > 0 && ` (${cat.variants.length} variants)`}
                </div>
              ))}
              {data.categories.length > 3 && (
                <div className="summary-item-more">
                  +{data.categories.length - 3} more
                </div>
              )}
            </div>
          )}
        </button>

        {/* Products */}
        <button
          className={`summary-section ${currentStep === 'products' ? 'active' : ''} ${data.finished_products.length > 0 ? 'completed' : ''}`}
          onClick={() => goToStep('products')}
        >
          <div className="summary-section-header">
            <span className="summary-icon">🛍️</span>
            <span className="summary-title">Products</span>
            <span className="summary-badge">{data.finished_products.length}</span>
          </div>
          {data.finished_products.length > 0 && (
            <div className="summary-section-content">
              {data.finished_products.slice(0, 3).map((product) => (
                <div key={product.id} className="summary-item">
                  • {product.name} (${product.msrp})
                </div>
              ))}
              {data.finished_products.length > 3 && (
                <div className="summary-item-more">
                  +{data.finished_products.length - 3} more
                </div>
              )}
            </div>
          )}
        </button>

        {/* Recipes */}
        <button
          className={`summary-section ${currentStep === 'recipes' ? 'active' : ''} ${data.recipes.length > 0 ? 'completed' : ''}`}
          onClick={() => goToStep('recipes')}
        >
          <div className="summary-section-header">
            <span className="summary-icon">🍳</span>
            <span className="summary-title">Recipes</span>
            <span className="summary-badge">{data.recipes.length}</span>
          </div>
          {data.recipes.length > 0 && (
            <div className="summary-section-content">
              {data.recipes.slice(0, 3).map((recipe) => {
                const product = data.finished_products.find(p => p.id === recipe.product_id);
                return (
                  <div key={recipe.product_id} className="summary-item">
                    • {product?.name || 'Unknown'} ({recipe.items.length} ingredients)
                  </div>
                );
              })}
              {data.recipes.length > 3 && (
                <div className="summary-item-more">
                  +{data.recipes.length - 3} more
                </div>
              )}
            </div>
          )}
        </button>

        {/* Invoices */}
        <button
          className={`summary-section ${currentStep === 'invoices' ? 'active' : ''} ${data.invoices.length > 0 ? 'completed' : ''}`}
          onClick={() => goToStep('invoices')}
        >
          <div className="summary-section-header">
            <span className="summary-icon">📄</span>
            <span className="summary-title">Invoices</span>
            <span className="summary-badge">{data.invoices.length}</span>
          </div>
          {data.invoices.length > 0 && (
            <div className="summary-section-content">
              {data.invoices.slice(0, 3).map((invoice) => {
                const total = invoice.items.reduce((sum, item) =>
                  sum + (parseFloat(item.quantity) * parseFloat(item.unit_cost)), 0
                );
                return (
                  <div key={invoice.id} className="summary-item">
                    • {invoice.vendor_name} (${total.toFixed(2)})
                  </div>
                );
              })}
              {data.invoices.length > 3 && (
                <div className="summary-item-more">
                  +{data.invoices.length - 3} more
                </div>
              )}
            </div>
          )}
        </button>
      </div>

      <div className="summary-footer">
        {currentStep === 'review' ? (
          <div style={{ textAlign: 'center', color: 'var(--success-green)', fontWeight: 600 }}>
            ✓ Ready to Export
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => goToStep('review')}
            style={{ width: '100%' }}
          >
            Review & Export →
          </button>
        )}
      </div>
    </aside>
  );
}
