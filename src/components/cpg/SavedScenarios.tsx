import { useState, useEffect } from 'react';
import { Button } from '../core/Button';
import { Loading } from '../feedback/Loading';
import { ErrorMessage } from '../feedback/ErrorMessage';
import { Modal } from '../modals/Modal';
import { db } from '../../db/database';
import type { CPGDistributionCalculation, CPGDistributor } from '../../db/schema/cpg.schema';
import { useCPGSettingsContext } from '../../contexts/CPGSettingsContext';
import styles from './SavedScenarios.module.css';

interface SavedScenariosProps {
  companyId: string;
  deviceId: string;
  onLoadScenario?: (scenario: CPGDistributionCalculation) => void;
  onConvertToInvoice?: (scenario: CPGDistributionCalculation) => void;
}

/**
 * Saved Scenarios Component
 *
 * Displays all draft distribution calculations for scenario planning.
 * Features:
 * - Table view with scenario details
 * - Load scenario into calculator
 * - Duplicate scenario
 * - Delete scenario
 * - Convert to invoice
 */
export function SavedScenarios({ companyId, deviceId, onLoadScenario, onConvertToInvoice }: SavedScenariosProps) {
  const [scenarios, setScenarios] = useState<CPGDistributionCalculation[]>([]);
  const [distributors, setDistributors] = useState<CPGDistributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<CPGDistributionCalculation | null>(null);
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(new Set());
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Get formatting functions from context (respects user decimal settings)
  const { formatCurrency: formatCurrencyFromContext } = useCPGSettingsContext();

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all draft scenarios (query by company_id and filter for drafts)
      const draftScenarios = await db.cpgDistributionCalculations
        .where('company_id')
        .equals(companyId)
        .and((calc) => calc.active === true && calc.deleted_at === null && calc.is_draft === true)
        .toArray();

      // Load distributors for display
      const allDistributors = await db.cpgDistributors
        .where('company_id')
        .equals(companyId)
        .toArray();

      setScenarios(draftScenarios.sort((a, b) => b.updated_at - a.updated_at));
      setDistributors(allDistributors);
    } catch (err) {
      console.error('Error loading scenarios:', err);
      setError('Oops! We had trouble loading your saved scenarios. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDistributorName = (distributorId: string): string => {
    const distributor = distributors.find((d) => d.id === distributorId);
    return distributor?.name || 'Unknown';
  };

  const handleDelete = (scenario: CPGDistributionCalculation) => {
    setScenarioToDelete(scenario);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!scenarioToDelete) return;

    try {
      setDeletingId(scenarioToDelete.id);
      setError(null);

      // Soft delete
      await db.cpgDistributionCalculations.update(scenarioToDelete.id, {
        active: false,
        deleted_at: Date.now(),
        updated_at: Date.now(),
      });

      // Remove from local state
      setScenarios(scenarios.filter((s) => s.id !== scenarioToDelete.id));
      setShowDeleteConfirm(false);
      setScenarioToDelete(null);
    } catch (err) {
      console.error('Error deleting scenario:', err);
      setError('Oops! We had trouble deleting the scenario. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (scenario: CPGDistributionCalculation) => {
    try {
      setError(null);

      const newScenario: CPGDistributionCalculation = {
        ...scenario,
        id: crypto.randomUUID(),
        calculation_name: `${scenario.calculation_name} (Copy)`,
        created_at: Date.now(),
        updated_at: Date.now(),
        version_vector: { [deviceId]: 1 },
      };

      await db.cpgDistributionCalculations.add(newScenario);
      setScenarios([newScenario, ...scenarios]);
    } catch (err) {
      console.error('Error duplicating scenario:', err);
      setError('Oops! We had trouble duplicating the scenario. Please try again.');
    }
  };

  const handleLoad = (scenario: CPGDistributionCalculation) => {
    if (onLoadScenario) {
      onLoadScenario(scenario);
    }
  };

  const handleConvertToInvoice = (scenario: CPGDistributionCalculation) => {
    if (onConvertToInvoice) {
      onConvertToInvoice(scenario);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: string): string => {
    return formatCurrencyFromContext(parseFloat(value));
  };

  const toggleScenarioSelection = (scenarioId: string) => {
    const newSelection = new Set(selectedScenarios);
    if (newSelection.has(scenarioId)) {
      newSelection.delete(scenarioId);
    } else {
      newSelection.add(scenarioId);
    }
    setSelectedScenarios(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedScenarios.size === scenarios.length) {
      setSelectedScenarios(new Set());
    } else {
      setSelectedScenarios(new Set(scenarios.map(s => s.id)));
    }
  };

  const exportSelectedToCSV = () => {
    const selectedItems = scenarios.filter(s => selectedScenarios.has(s.id));
    if (selectedItems.length === 0) return;

    const headers = ['Scenario Name', 'Distributor', 'Pallets', 'Total Cost', 'Cost Per Unit', 'Date'];
    const rows = selectedItems.map(scenario => [
      scenario.calculation_name || '',
      getDistributorName(scenario.distributor_id),
      scenario.num_pallets,
      scenario.total_distribution_cost,
      scenario.distribution_cost_per_unit,
      formatDate(scenario.calculation_date)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `scenarios_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const exportDetailedDataTableCSV = () => {
    const selectedItems = scenarios.filter(s => selectedScenarios.has(s.id));
    if (selectedItems.length === 0) return;

    // Create a flat table format perfect for pivot tables
    const rows: string[] = [];

    // Headers
    const headers = [
      'Scenario Name',
      'Date',
      'Invoice Number',
      'Distributor',
      'Pallets',
      'Pallet #',
      'Product Units',
      'Product',
      'Base CPU',
      'Distribution Cost Per Unit',
      'Total CPU',
      'Selling Price',
      'Profit Per Unit',
      'Margin %',
      'Selling Price',
      'Fee Description',
      'Fee Amount',
      'Total Distribution Cost'
    ];
    rows.push(headers.join(','));

    // Data rows - one row per product per scenario
    selectedItems.forEach((scenario) => {
      const distributorName = getDistributorName(scenario.distributor_id);

      // Build product lookup from pallet_data for accurate quantities
      const productLookup: Record<string, { pallet_number: number, quantity: number }> = {};
      if (scenario.pallet_data && scenario.pallet_data.length > 0) {
        scenario.pallet_data.forEach((pallet: any) => {
          pallet.products.forEach((product: any) => {
            productLookup[product.product_name] = {
              pallet_number: pallet.pallet_number,
              quantity: product.quantity
            };
          });
        });
      }

      // Get all products
      const products = Object.keys(scenario.variant_data || {});

      products.forEach((variant) => {
        const varData = scenario.variant_data[variant];
        const result = scenario.variant_results?.[variant];
        if (!result) return;

        // Get product-specific data
        const productInfo = productLookup[variant];
        const palletNum = productInfo ? productInfo.pallet_number : 'N/A';
        const productUnits = productInfo ? productInfo.quantity : (varData.quantity || 'N/A');

        const baseCPU = parseFloat(varData.base_cpu);
        const distCostPerUnit = parseFloat(scenario.distribution_cost_per_unit);
        const totalCPU = parseFloat(result.total_cpu);
        const price = parseFloat(varData.price_per_unit);
        const profitPerUnit = price - totalCPU;

        // Create a row for each fee (or one row if no fees)
        if (scenario.fee_breakdown && scenario.fee_breakdown.length > 0) {
          scenario.fee_breakdown.forEach((fee: any) => {
            rows.push([
              `"${scenario.calculation_name || ''}"`,
              `"${formatDate(scenario.calculation_date)}"`,
              scenario.invoice_number || 'N/A',
              distributorName,
              scenario.num_pallets,
              palletNum,
              productUnits,
              `"${variant}"`,
              baseCPU.toFixed(2),
              distCostPerUnit.toFixed(2),
              totalCPU.toFixed(2),
              price.toFixed(2),
              profitPerUnit.toFixed(2),
              result.net_profit_margin,
              result.msrp || '',
              `"${fee.feeName}"`,
              parseFloat(fee.feeAmount).toFixed(2),
              scenario.total_distribution_cost
            ].join(','));
          });
        } else {
          // No fees, just product row
          rows.push([
            `"${scenario.calculation_name || ''}"`,
            `"${formatDate(scenario.calculation_date)}"`,
            scenario.invoice_number || 'N/A',
            distributorName,
            scenario.num_pallets,
            palletNum,
            productUnits,
            `"${variant}"`,
            baseCPU.toFixed(2),
            distCostPerUnit.toFixed(2),
            totalCPU.toFixed(2),
            price.toFixed(2),
            profitPerUnit.toFixed(2),
            result.net_profit_margin,
            result.msrp || '',
            '',
            '',
            scenario.total_distribution_cost
          ].join(','));
        }
      });
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `scenarios-detailed-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const exportSelectedToPDF = async () => {
    const selectedItems = scenarios.filter(s => selectedScenarios.has(s.id));
    if (selectedItems.length === 0) return;

    try {
      const pdfMake = await import('pdfmake/build/pdfmake');
      const pdfFonts = await import('pdfmake/build/vfs_fonts');
      (pdfMake as any).default.vfs = pdfFonts.default;

      const tableBody = selectedItems.map(scenario => [
        scenario.calculation_name || '',
        getDistributorName(scenario.distributor_id),
        scenario.num_pallets,
        formatCurrency(scenario.total_distribution_cost),
        formatCurrency(scenario.distribution_cost_per_unit),
        formatDate(scenario.calculation_date)
      ]);

      const docDefinition: any = {
        content: [
          { text: 'Saved Scenarios Export', style: 'header', margin: [0, 0, 0, 10] },
          { text: `${selectedItems.length} scenario${selectedItems.length !== 1 ? 's' : ''} exported`, style: 'subheader', margin: [0, 0, 0, 20] },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Scenario', style: 'tableHeader' },
                  { text: 'Distributor', style: 'tableHeader' },
                  { text: 'Pallets', style: 'tableHeader' },
                  { text: 'Total Cost', style: 'tableHeader', alignment: 'right' },
                  { text: 'Cost/Unit', style: 'tableHeader', alignment: 'right' },
                  { text: 'Date', style: 'tableHeader' }
                ],
                ...tableBody.map(row => [
                  row[0],
                  row[1],
                  row[2],
                  { text: row[3], alignment: 'right' },
                  { text: row[4], alignment: 'right' },
                  row[5]
                ])
              ]
            },
            layout: {
              fillColor: (rowIndex: number) => rowIndex === 0 ? '#6366f1' : (rowIndex % 2 === 0 ? '#f9fafb' : null),
              hLineColor: () => '#e5e7eb',
              vLineColor: () => '#e5e7eb',
            }
          }
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            color: '#111827'
          },
          tableHeader: {
            bold: true,
            fontSize: 10,
            color: 'white',
            fillColor: '#6366f1'
          }
        },
        defaultStyle: {
          fontSize: 9
        }
      };

      (pdfMake as any).default.createPdf(docDefinition).download(`scenarios_${Date.now()}.pdf`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loading message="Loading saved scenarios..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.errorContainer}>
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {scenarios.length === 0 ? (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyStateTitle}>No Saved Scenarios Yet</h3>
          <p className={styles.emptyStateMessage}>
            Draft scenarios let you explore "what-if" calculations without creating invoices or accounting entries.
            <br />
            Calculate distribution costs and choose "Save as Draft" to create your first scenario.
          </p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Saved Scenarios ({scenarios.length})</h2>
            <p className={styles.tableDescription}>
              Draft calculations for scenario planning and what-if analysis.
            </p>
          </div>

          {/* Action Toolbar */}
          {selectedScenarios.size > 0 && (
            <div style={{ padding: '1rem', background: 'linear-gradient(135deg, rgba(232, 212, 160, 0.1) 0%, rgba(255, 255, 255, 0.5) 100%)', border: '2px solid #D4AF37', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4b006e' }}>
                {selectedScenarios.size} scenario{selectedScenarios.size !== 1 ? 's' : ''} selected
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {selectedScenarios.size >= 2 && (
                  <button
                    onClick={() => setShowComparisonModal(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#D4AF37',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#B8860B';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(184, 134, 11, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#D4AF37';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Compare Side-by-Side
                  </button>
                )}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#D4AF37',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#B8860B';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(184, 134, 11, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#D4AF37';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Export Selected ▼
                  </button>
                  {showExportMenu && (
                    <>
                      <div onClick={() => setShowExportMenu(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} />
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 0.5rem)',
                        right: 0,
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        zIndex: 2,
                        minWidth: '150px'
                      }}>
                        <button
                          onClick={exportDetailedDataTableCSV}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            color: '#374151',
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(232, 212, 160, 0.2)';
                            e.currentTarget.style.color = '#4b006e';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.color = '#374151';
                          }}
                          title="Export detailed data table with all products, fees, and calculations"
                        >
                          Detailed Data Table CSV
                        </button>
                        <button
                          onClick={exportSelectedToCSV}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            color: '#374151',
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(232, 212, 160, 0.2)';
                            e.currentTarget.style.color = '#4b006e';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.color = '#374151';
                          }}
                          title="Export summary CSV with scenario names, totals, and dates"
                        >
                          Summary CSV
                        </button>
                        <button
                          onClick={exportSelectedToPDF}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            color: '#374151',
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(232, 212, 160, 0.2)';
                            e.currentTarget.style.color = '#4b006e';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.color = '#374151';
                          }}
                          title="Export summary PDF report"
                        >
                          Summary PDF
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setSelectedScenarios(new Set())}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'white',
                    color: '#4b006e',
                    border: '2px solid #D4AF37',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(232, 212, 160, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedScenarios.size === scenarios.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Scenario Name</th>
                <th>Distributor</th>
                <th>Pallets</th>
                <th>Total Cost</th>
                <th>Last Modified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => (
                <tr key={scenario.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedScenarios.has(scenario.id)}
                      onChange={() => toggleScenarioSelection(scenario.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td className={styles.nameCell}>
                    <div className={styles.scenarioName}>{scenario.calculation_name}</div>
                    {scenario.notes && (
                      <div className={styles.scenarioNotes}>{scenario.notes}</div>
                    )}
                  </td>
                  <td>{getDistributorName(scenario.distributor_id)}</td>
                  <td>{scenario.num_pallets}</td>
                  <td className={styles.costCell}>
                    {formatCurrency(scenario.total_distribution_cost)}
                  </td>
                  <td className={styles.dateCell}>{formatDate(scenario.updated_at)}</td>
                  <td className={styles.actionsCell}>
                    <div className={styles.actions}>
                      <button
                        onClick={() => handleLoad(scenario)}
                        className={styles.actionButton}
                        title="Load into calculator"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleConvertToInvoice(scenario)}
                        className={styles.actionButtonSuccess}
                        title="Convert to invoice"
                      >
                        Convert to Invoice
                      </button>
                      <button
                        onClick={() => handleDuplicate(scenario)}
                        className={styles.actionButton}
                        title="Duplicate scenario"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(scenario)}
                        className={styles.actionButtonDanger}
                        disabled={deletingId === scenario.id}
                        title="Delete scenario"
                      >
                        {deletingId === scenario.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && scenarioToDelete && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title=""
          size="sm"
        >
          <div className={styles.confirmModal}>
            <div className={styles.confirmModalHeader}>
              <h2 className={styles.confirmModalTitle}>Delete Scenario?</h2>
            </div>
            <p className={styles.confirmModalMessage}>
              Are you sure you want to delete "{scenarioToDelete.calculation_name}"? This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingId !== null}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                loading={deletingId !== null}
                disabled={deletingId !== null}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Comparison Modal */}
      {showComparisonModal && selectedScenarios.size >= 2 && (() => {
        const selectedItems = Array.from(selectedScenarios).slice(0, 4).map(id => scenarios.find(s => s.id === id)).filter(Boolean) as CPGDistributionCalculation[];

        // Find best values for highlighting
        const costs = selectedItems.map(s => parseFloat(s.total_distribution_cost));
        const costPerUnits = selectedItems.map(s => parseFloat(s.distribution_cost_per_unit));
        const lowestCost = Math.min(...costs);
        const lowestCostPerUnit = Math.min(...costPerUnits);
        const highestCost = Math.max(...costs);
        const highestCostPerUnit = Math.max(...costPerUnits);

        // Calculate cost differences from baseline (first scenario)
        const baseline = selectedItems[0];
        const baselineCost = parseFloat(baseline.total_distribution_cost);
        const baselineCostPerUnit = parseFloat(baseline.distribution_cost_per_unit);

        return (
        <Modal
          isOpen={showComparisonModal}
          onClose={() => setShowComparisonModal(false)}
          title="Compare Scenarios Side-by-Side"
          size="xl"
        >
          {/* Decision Summary */}
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'linear-gradient(135deg, rgba(232, 212, 160, 0.1) 0%, rgba(255, 255, 255, 0.5) 100%)', border: '2px solid #D4AF37', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#4b006e', margin: '0 0 0.75rem 0' }}>
              Quick Decision Guide
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div>
                <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Best Overall Cost</div>
                <div style={{ fontWeight: 700, color: '#4b006e' }}>
                  {selectedItems.find(s => parseFloat(s.total_distribution_cost) === lowestCost)?.calculation_name}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#B8860B', fontWeight: 600 }}>{formatCurrency(lowestCost.toFixed(2))}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Best Cost Per Unit</div>
                <div style={{ fontWeight: 700, color: '#4b006e' }}>
                  {selectedItems.find(s => parseFloat(s.distribution_cost_per_unit) === lowestCostPerUnit)?.calculation_name}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#B8860B', fontWeight: 600 }}>{formatCurrency(lowestCostPerUnit.toFixed(2))}/unit</div>
              </div>
              {lowestCost < highestCost && (
                <div>
                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Potential Savings</div>
                  <div style={{ fontWeight: 700, color: '#4b006e' }}>
                    {formatCurrency((highestCost - lowestCost).toFixed(2))}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#B8860B', fontWeight: 600 }}>
                    ({(((highestCost - lowestCost) / highestCost) * 100).toFixed(1)}% reduction)
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, rgba(75, 0, 110, 0.05) 0%, rgba(75, 0, 110, 0.08) 100%)', borderBottom: '2px solid #D4AF37' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, color: '#4b006e' }}>Field</th>
                  {selectedItems.map((scenario, idx) => (
                      <th key={scenario.id} style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, color: '#4b006e' }}>
                        {scenario.calculation_name}
                        {idx === 0 && <div style={{ fontSize: '0.75rem', fontWeight: 400, color: '#6b7280', marginTop: '0.25rem' }}>Baseline</div>}
                      </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Distributor</td>
                  {selectedItems.map(scenario => (
                      <td key={scenario.id} style={{ padding: '0.75rem' }}>{getDistributorName(scenario.distributor_id)}</td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Pallets</td>
                  {selectedItems.map(scenario => (
                      <td key={scenario.id} style={{ padding: '0.75rem' }}>{scenario.num_pallets}</td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Total Cost</td>
                  {selectedItems.map((scenario, idx) => {
                    const cost = parseFloat(scenario.total_distribution_cost);
                    const isBest = cost === lowestCost;
                    const isWorst = cost === highestCost && lowestCost !== highestCost;
                    const diff = cost - baselineCost;
                    const diffPercent = baselineCost !== 0 ? ((diff / baselineCost) * 100) : 0;

                    return (
                      <td key={scenario.id} style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600, color: isBest ? '#B8860B' : isWorst ? '#dc2626' : '#111827' }}>
                          {formatCurrency(scenario.total_distribution_cost)}
                          {isBest && <span style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: '#B8860B', fontWeight: 700 }}>Best</span>}
                        </div>
                        {idx > 0 && diff !== 0 && (
                          <div style={{ fontSize: '0.75rem', color: diff < 0 ? '#B8860B' : '#dc2626', marginTop: '0.25rem', fontWeight: 600 }}>
                            {diff < 0 ? '↓' : '↑'} {formatCurrency(Math.abs(diff).toFixed(2))} ({diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%)
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Cost Per Unit</td>
                  {selectedItems.map((scenario, idx) => {
                    const cpu = parseFloat(scenario.distribution_cost_per_unit);
                    const isBest = cpu === lowestCostPerUnit;
                    const isWorst = cpu === highestCostPerUnit && lowestCostPerUnit !== highestCostPerUnit;
                    const diff = cpu - baselineCostPerUnit;
                    const diffPercent = baselineCostPerUnit !== 0 ? ((diff / baselineCostPerUnit) * 100) : 0;

                    return (
                      <td key={scenario.id} style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600, color: isBest ? '#B8860B' : isWorst ? '#dc2626' : '#111827' }}>
                          {formatCurrency(scenario.distribution_cost_per_unit)}
                          {isBest && <span style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: '#B8860B', fontWeight: 700 }}>Best</span>}
                        </div>
                        {idx > 0 && diff !== 0 && (
                          <div style={{ fontSize: '0.75rem', color: diff < 0 ? '#B8860B' : '#dc2626', marginTop: '0.25rem', fontWeight: 600 }}>
                            {diff < 0 ? '↓' : '↑'} {formatCurrency(Math.abs(diff).toFixed(2))} ({diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%)
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Date</td>
                  {selectedItems.map(scenario => (
                      <td key={scenario.id} style={{ padding: '0.75rem' }}>{formatDate(scenario.calculation_date)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
            {selectedScenarios.size > 4 && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'linear-gradient(135deg, rgba(232, 212, 160, 0.2) 0%, rgba(255, 255, 255, 0.5) 100%)', border: '2px solid #D4AF37', borderRadius: '6px', fontSize: '0.875rem', color: '#4b006e', fontWeight: 600 }}>
                Showing first 4 scenarios. You have {selectedScenarios.size - 4} more selected.
              </div>
            )}
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outline"
              onClick={() => setShowComparisonModal(false)}
            >
              Close
            </Button>
          </div>
        </Modal>
        );
      })()}
    </div>
  );
}
