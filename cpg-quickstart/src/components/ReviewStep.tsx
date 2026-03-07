import type { WorksheetData, WizardStep } from '../types';

interface ReviewStepProps {
  data: WorksheetData;
  goToStep: (step: WizardStep) => void;
  onExport: () => void;
  onClear: () => void;
}

export default function ReviewStep({ data, goToStep, onExport, onClear }: ReviewStepProps) {
  return (
    <div className="step">
      <div className="step-header">
        <h2 className="step-title">Review & Export</h2>
        <p className="step-description">
          Double-check everything looks good, then download your data file for the April 1 presentation.
        </p>
      </div>

      <div className="step-content">
        <div style={{
          background: 'var(--bg-gray-light)',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid var(--border-gray)',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem 0', color: 'var(--primary-purple)' }}>
            Your CPG Setup Summary
          </h3>

          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {/* Categories */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  📦 Ingredient Categories
                </h4>
                <button
                  className="btn btn-tertiary"
                  onClick={() => goToStep('categories')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Edit
                </button>
              </div>
              {data.categories.length === 0 ? (
                <p style={{ color: 'var(--text-gray)', margin: 0 }}>No categories added</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.categories.map((cat) => (
                    <div key={cat.id} style={{
                      background: 'white',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.875rem'
                    }}>
                      <strong>{cat.name}</strong>
                      {cat.variants.length > 0 && (
                        <span style={{ color: 'var(--text-gray)' }}>
                          {' • '}Variants: {cat.variants.join(', ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Products */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  🛍️ Finished Products
                </h4>
                <button
                  className="btn btn-tertiary"
                  onClick={() => goToStep('products')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Edit
                </button>
              </div>
              {data.finished_products.length === 0 ? (
                <p style={{ color: 'var(--text-gray)', margin: 0 }}>No products added</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.finished_products.map((product) => (
                    <div key={product.id} style={{
                      background: 'white',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.875rem'
                    }}>
                      <strong>{product.name}</strong>
                      <span style={{ color: 'var(--text-gray)' }}>
                        {' • '}MSRP: ${product.msrp}
                        {product.sku && ` • SKU: ${product.sku}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recipes */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  🍳 Product Recipes
                </h4>
                <button
                  className="btn btn-tertiary"
                  onClick={() => goToStep('recipes')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Edit
                </button>
              </div>
              {data.recipes.length === 0 ? (
                <p style={{ color: 'var(--text-gray)', margin: 0 }}>No recipes added</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.recipes.map((recipe) => {
                    const product = data.finished_products.find(p => p.id === recipe.product_id);
                    return (
                      <div key={recipe.product_id} style={{
                        background: 'white',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.875rem'
                      }}>
                        <strong>{product?.name || 'Unknown Product'}</strong>
                        <div style={{ color: 'var(--text-gray)', marginTop: '0.25rem' }}>
                          {recipe.items.map((item, idx) => {
                            const cat = data.categories.find(c => c.id === item.category_id);
                            return (
                              <div key={idx}>
                                • {item.quantity} {item.unit} {cat?.name}{item.variant ? ` (${item.variant})` : ''}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invoices */}
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  📄 Purchase Invoices
                </h4>
                <button
                  className="btn btn-tertiary"
                  onClick={() => goToStep('invoices')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Edit
                </button>
              </div>
              {data.invoices.length === 0 ? (
                <p style={{ color: 'var(--text-gray)', margin: 0 }}>No invoices added</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.invoices.map((invoice) => {
                    const total = invoice.items.reduce((sum, item) =>
                      sum + (parseFloat(item.quantity) * parseFloat(item.unit_cost)), 0
                    );
                    return (
                      <div key={invoice.id} style={{
                        background: 'white',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.875rem'
                      }}>
                        <strong>{invoice.vendor_name}</strong>
                        <span style={{ color: 'var(--text-gray)' }}>
                          {' • '}{new Date(invoice.invoice_date).toLocaleDateString()}
                          {' • '}${total.toFixed(2)}
                          {invoice.invoice_number && ` • #${invoice.invoice_number}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(22, 163, 74, 0.1)',
          border: '1px solid var(--success-green)',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0', color: 'var(--success-green)' }}>
            ✓ Ready to Export
          </h3>
          <p style={{ margin: 0, color: 'var(--text-gray)' }}>
            Your worksheet looks great! Click "Download Data File" below to save a JSON file.
            Keep this file safe - you'll import it into the full software on April 1.
          </p>
        </div>

        <div style={{
          background: 'rgba(212, 175, 55, 0.1)',
          border: '1px solid var(--accent-gold)',
          padding: '1.5rem',
          borderRadius: '8px'
        }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0', color: 'var(--primary-purple)' }}>
            💡 What happens next?
          </h3>
          <p style={{ margin: 0, color: 'var(--text-gray)' }}>
            On April 1, you'll receive access to the full CPG tracking software. During the presentation,
            you'll upload this data file and everything you've entered here will be imported automatically.
            No need to enter it all again!
          </p>
        </div>
      </div>

      <div className="step-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
        <button className="btn btn-tertiary" onClick={() => goToStep('invoices')}>
          ← Back
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem' }}>
          <button className="btn btn-danger" onClick={onClear}>
            Clear All Data
          </button>
          <button className="btn btn-success" onClick={onExport}>
            📥 Download Data File
          </button>
        </div>
      </div>
    </div>
  );
}
