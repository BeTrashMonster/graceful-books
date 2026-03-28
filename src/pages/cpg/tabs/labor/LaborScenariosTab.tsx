/**
 * Labor Scenarios Tab
 *
 * Interactive calculator for modeling different labor configurations
 * and seeing the impact across products.
 *
 * Features:
 * - Filter by products and/or roles
 * - Compare current vs scenario configurations
 * - Add hypothetical roles for planning
 * - See cost impact across all affected products
 * - Export scenarios for documentation
 *
 * Requirements:
 * - Purple headings, gold borders
 * - Product-grouped display with purple headers
 * - Editable scenario values
 */

import { useState, useEffect } from 'react';
import { Button } from '../../../../components/core/Button';
import { useAuth } from '../../../../contexts/AuthContext';
import { db } from '../../../../db/database';
import { LaborRoleService } from '../../../../services/cpg/laborRole.service';
import { cpuCalculatorService } from '../../../../services/cpg/cpuCalculator.service';
import type { CPGLaborRole, CPGFinishedProduct } from '../../../../db/schema/cpg.schema';
import styles from './LaborScenariosTab.module.css';

interface ScenarioRole {
  id: string;
  roleId: string; // References actual role, or 'new-{id}' for hypothetical
  roleName: string;
  productId: string;
  productName: string;
  // Current values
  currentHours: number;
  currentRate: number;
  currentCost: number;
  // Scenario values (editable)
  scenarioHours: number;
  scenarioRate: number;
  scenarioCost: number;
  // Flag for hypothetical roles
  isHypothetical: boolean;
}

interface ProductCPUSummary {
  productId: string;
  productName: string;
  // CPU Breakdown
  materialCPU: number;
  // Labor CPU
  currentLaborCPU: number;
  scenarioLaborCPU: number;
  // Total CPU (Material + Labor)
  currentTotalCPU: number;
  scenarioTotalCPU: number;
  // Impact
  cpuChange: number;
  cpuChangePercent: number;
}

export function LaborScenariosTab() {
  const { companyId, deviceId } = useAuth();
  const [service] = useState(() => new LaborRoleService(db));

  // Data
  const [roles, setRoles] = useState<CPGLaborRole[]>([]);
  const [products, setProducts] = useState<CPGFinishedProduct[]>([]);
  const [scenarioRoles, setScenarioRoles] = useState<ScenarioRole[]>([]);
  const [cpuSummaries, setCpuSummaries] = useState<ProductCPUSummary[]>([]);

  // Filters
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [showProductFilter, setShowProductFilter] = useState(false);
  const [showRoleFilter, setShowRoleFilter] = useState(false);

  // UI State
  const [loading, setLoading] = useState(true);
  const [scenarioGenerated, setScenarioGenerated] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, [companyId]);

  // Recalculate CPU summaries when scenario roles change
  useEffect(() => {
    if (scenarioRoles.length > 0) {
      calculateProductCPUSummaries().then(setCpuSummaries);
    } else {
      setCpuSummaries([]);
    }
  }, [scenarioRoles, products]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load roles
      const allRoles = await service.getRoles(companyId);
      setRoles(allRoles);

      // Load products
      const allProducts = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .and((p) => p.active && p.deleted_at === null)
        .toArray();
      setProducts(allProducts);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateScenario = async () => {
    try {
      setLoading(true);
      const scenarioData: ScenarioRole[] = [];

      // Get products to include
      const productsToInclude = selectedProducts.size > 0
        ? products.filter(p => selectedProducts.has(p.id))
        : products;

      // For each product, get its labor assignments
      for (const product of productsToInclude) {
        const assignments = await service.getProductAssignments(product.id);

        for (const assignment of assignments) {
          // Apply role filter if active
          if (selectedRoles.size > 0 && !selectedRoles.has(assignment.labor_role_id)) {
            continue;
          }

          const role = await service.getRole(assignment.labor_role_id);
          if (!role) continue;

          const hoursPerUnit = parseFloat(assignment.hours_per_unit || '0');
          const hourlyRate = parseFloat(service.getEffectiveHourlyRate(role));
          const costPerUnit = hoursPerUnit * hourlyRate;

          scenarioData.push({
            id: `${product.id}-${role.id}`,
            roleId: role.id,
            roleName: role.role_name,
            productId: product.id,
            productName: product.name,
            currentHours: hoursPerUnit,
            currentRate: hourlyRate,
            currentCost: costPerUnit,
            scenarioHours: hoursPerUnit,
            scenarioRate: hourlyRate,
            scenarioCost: costPerUnit,
            isHypothetical: false,
          });
        }
      }

      // Sort by product name, then role name
      scenarioData.sort((a, b) => {
        const productCompare = a.productName.localeCompare(b.productName);
        if (productCompare !== 0) return productCompare;
        return a.roleName.localeCompare(b.roleName);
      });

      setScenarioRoles(scenarioData);
      setScenarioGenerated(true);
    } catch (err) {
      console.error('Error generating scenario:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateScenarioValue = (id: string, field: 'hours' | 'rate', value: number) => {
    setScenarioRoles(prev => prev.map(role => {
      if (role.id !== id) return role;

      const updated = { ...role };
      if (field === 'hours') {
        updated.scenarioHours = value;
      } else {
        updated.scenarioRate = value;
      }
      updated.scenarioCost = updated.scenarioHours * updated.scenarioRate;

      return updated;
    }));
  };

  const addHypotheticalRole = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newRole: ScenarioRole = {
      id: `new-${Date.now()}`,
      roleId: `new-${Date.now()}`,
      roleName: 'New Role',
      productId: product.id,
      productName: product.name,
      currentHours: 0,
      currentRate: 0,
      currentCost: 0,
      scenarioHours: 0,
      scenarioRate: 20,
      scenarioCost: 0,
      isHypothetical: true,
    };

    setScenarioRoles(prev => {
      const newList = [...prev, newRole];
      // Re-sort to keep product grouping
      return newList.sort((a, b) => {
        const productCompare = a.productName.localeCompare(b.productName);
        if (productCompare !== 0) return productCompare;
        return a.roleName.localeCompare(b.roleName);
      });
    });
  };

  const removeHypotheticalRole = (id: string) => {
    setScenarioRoles(prev => prev.filter(role => role.id !== id));
  };

  const updateRoleName = (id: string, name: string) => {
    setScenarioRoles(prev => prev.map(role =>
      role.id === id ? { ...role, roleName: name } : role
    ));
  };

  // Calculate product CPU summaries (big picture)
  const calculateProductCPUSummaries = async (): Promise<ProductCPUSummary[]> => {
    const summaries: ProductCPUSummary[] = [];

    // Group scenario roles by product
    const rolesByProduct = scenarioRoles.reduce((acc, role) => {
      if (!acc[role.productId]) acc[role.productId] = [];
      acc[role.productId].push(role);
      return acc;
    }, {} as Record<string, ScenarioRole[]>);

    for (const productId of Object.keys(rolesByProduct)) {
      const product = products.find(p => p.id === productId);
      if (!product) continue;

      // Get CPU data for this product
      const cpuData = await cpuCalculatorService.calculateFinishedProductCPU(productId, companyId);

      const productRoles = rolesByProduct[productId];
      const currentLaborCPU = productRoles.reduce((sum, r) => sum + r.currentCost, 0);
      const scenarioLaborCPU = productRoles.reduce((sum, r) => sum + r.scenarioCost, 0);

      const materialCPU = cpuData?.materialCPU ? parseFloat(cpuData.materialCPU) : 0;

      const currentTotalCPU = materialCPU + currentLaborCPU;
      const scenarioTotalCPU = materialCPU + scenarioLaborCPU;
      const cpuChange = scenarioTotalCPU - currentTotalCPU;
      const cpuChangePercent = currentTotalCPU > 0 ? (cpuChange / currentTotalCPU) * 100 : 0;

      summaries.push({
        productId,
        productName: product.name,
        materialCPU,
        currentLaborCPU,
        scenarioLaborCPU,
        currentTotalCPU,
        scenarioTotalCPU,
        cpuChange,
        cpuChangePercent,
      });
    }

    return summaries;
  };

  // Calculate impact summary (labor costs only)
  const calculateImpact = () => {
    const productImpacts = new Map<string, { current: number; scenario: number }>();

    scenarioRoles.forEach(role => {
      const existing = productImpacts.get(role.productId) || { current: 0, scenario: 0 };
      existing.current += role.currentCost;
      existing.scenario += role.scenarioCost;
      productImpacts.set(role.productId, existing);
    });

    return Array.from(productImpacts.entries()).map(([productId, impact]) => {
      const product = products.find(p => p.id === productId);
      return {
        productId,
        productName: product?.name || 'Unknown',
        currentCost: impact.current,
        scenarioCost: impact.scenario,
        change: impact.scenario - impact.current,
        changePercent: impact.current > 0 ? ((impact.scenario - impact.current) / impact.current) * 100 : 0,
      };
    });
  };

  const exportCSV = () => {
    const impacts = calculateImpact();
    const totalCurrent = impacts.reduce((sum, p) => sum + p.currentCost, 0);
    const totalScenario = impacts.reduce((sum, p) => sum + p.scenarioCost, 0);
    const totalChange = totalScenario - totalCurrent;

    let csv = 'Labor Scenario Analysis Export\n';
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;

    csv += 'SCENARIO DETAILS\n';
    csv += 'Product,Role,Current Hours,Current Rate,Current Cost,Scenario Hours,Scenario Rate,Scenario Cost,Change\n';

    scenarioRoles.forEach(role => {
      const change = role.scenarioCost - role.currentCost;
      csv += `${role.productName},${role.roleName},${role.currentHours},`;
      csv += `$${role.currentRate.toFixed(2)},$${role.currentCost.toFixed(2)},`;
      csv += `${role.scenarioHours},$${role.scenarioRate.toFixed(2)},`;
      csv += `$${role.scenarioCost.toFixed(2)},$${change.toFixed(2)}\n`;
    });

    csv += '\n';
    csv += 'PRODUCT IMPACT SUMMARY\n';
    csv += 'Product,Current Total,Scenario Total,Change ($),Change (%)\n';

    impacts.forEach(impact => {
      csv += `${impact.productName},$${impact.currentCost.toFixed(2)},`;
      csv += `$${impact.scenarioCost.toFixed(2)},$${impact.change.toFixed(2)},`;
      csv += `${impact.changePercent.toFixed(1)}%\n`;
    });

    csv += '\n';
    csv += `TOTAL IMPACT,$${totalCurrent.toFixed(2)},$${totalScenario.toFixed(2)},$${totalChange.toFixed(2)},${totalCurrent > 0 ? ((totalChange / totalCurrent) * 100).toFixed(1) : '0'}%\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labor-scenario-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Group roles by product
  const groupedRoles = scenarioRoles.reduce((acc, role) => {
    if (!acc[role.productId]) {
      acc[role.productId] = {
        productName: role.productName,
        roles: [],
      };
    }
    acc[role.productId].roles.push(role);
    return acc;
  }, {} as Record<string, { productName: string; roles: ScenarioRole[] }>);

  const productGroups = Object.entries(groupedRoles);

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Filter Section */}
      <div className={styles.filterSection}>
        <h2 className={styles.heading}>Filter Scenario</h2>
        <p className={styles.subheading}>Select products and/or roles to model different labor configurations</p>

        <div className={styles.filters}>
          {/* Product Filter */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Products</label>
            <div className={styles.filterDropdown}>
              <button
                className={styles.filterButton}
                onClick={() => setShowProductFilter(!showProductFilter)}
              >
                {selectedProducts.size === 0 ? 'All Products' : `${selectedProducts.size} Selected`}
                <span className={styles.dropdownIcon}>▼</span>
              </button>

              {showProductFilter && (
                <div className={styles.dropdownMenu}>
                  {products.map(product => (
                    <label key={product.id} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedProducts);
                          if (e.target.checked) {
                            newSet.add(product.id);
                          } else {
                            newSet.delete(product.id);
                          }
                          setSelectedProducts(newSet);
                        }}
                      />
                      {product.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Role Filter */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Roles</label>
            <div className={styles.filterDropdown}>
              <button
                className={styles.filterButton}
                onClick={() => setShowRoleFilter(!showRoleFilter)}
              >
                {selectedRoles.size === 0 ? 'All Roles' : `${selectedRoles.size} Selected`}
                <span className={styles.dropdownIcon}>▼</span>
              </button>

              {showRoleFilter && (
                <div className={styles.dropdownMenu}>
                  {roles.map(role => (
                    <label key={role.id} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={selectedRoles.has(role.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedRoles);
                          if (e.target.checked) {
                            newSet.add(role.id);
                          } else {
                            newSet.delete(role.id);
                          }
                          setSelectedRoles(newSet);
                        }}
                      />
                      {role.role_name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="purple"
          onClick={handleGenerateScenario}
          disabled={loading}
          style={{ marginTop: '1rem' }}
        >
          {scenarioGenerated ? 'Regenerate Scenario' : 'Generate Scenario'}
        </Button>
      </div>

      {/* Scenario Table */}
      {scenarioGenerated && productGroups.length > 0 && (
        <>
          <div className={styles.tableSection}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.roleColumn}>Role</th>
                  <th className={styles.currentSection} colSpan={3}>Current</th>
                  <th className={styles.scenarioSection} colSpan={3}>Scenario</th>
                  <th className={styles.deltaColumn}>Δ</th>
                </tr>
                <tr className={styles.subheader}>
                  <th></th>
                  <th>Hrs/Unit</th>
                  <th>Rate</th>
                  <th>Cost</th>
                  <th>Hrs/Unit</th>
                  <th>Rate</th>
                  <th>Cost</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {productGroups.map(([productId, group]) => (
                  <>
                    {/* Product Header Row */}
                    <tr key={`product-${productId}`} className={styles.productHeader}>
                      <td colSpan={8}>{group.productName}</td>
                    </tr>

                    {/* CPU Summary Row */}
                    <tr key={`cpu-${productId}`} className={styles.cpuSummaryRow}>
                      <td colSpan={8}>
                        {(() => {
                          const summary = cpuSummaries.find(s => s.productId === productId);
                          if (!summary) return null;
                          const laborChange = summary.scenarioLaborCPU - summary.currentLaborCPU;
                          const cpuChange = summary.scenarioTotalCPU - summary.currentTotalCPU;
                          return (
                            <div className={styles.cpuSummaryContent}>
                              <div className={styles.cpuItem}>
                                <span className={styles.cpuLabel}>Labor CPU:</span>
                                <span className={styles.cpuValues}>
                                  ${summary.currentLaborCPU.toFixed(2)} → ${summary.scenarioLaborCPU.toFixed(2)}
                                </span>
                                {laborChange !== 0 && (
                                  <span className={laborChange > 0 ? styles.cpuChangeNegative : styles.cpuChangePositive}>
                                    {laborChange > 0 ? '+' : ''}${laborChange.toFixed(2)}
                                  </span>
                                )}
                              </div>
                              <div className={styles.cpuDivider}></div>
                              <div className={styles.cpuItem}>
                                <span className={styles.cpuLabel}>Total CPU:</span>
                                <span className={styles.cpuValues}>
                                  ${summary.currentTotalCPU.toFixed(2)} → ${summary.scenarioTotalCPU.toFixed(2)}
                                </span>
                                {cpuChange !== 0 && (
                                  <span className={cpuChange > 0 ? styles.cpuChangeNegative : styles.cpuChangePositive}>
                                    {cpuChange > 0 ? '+' : ''}${cpuChange.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>

                    {/* Role Rows */}
                    {group.roles.map(role => {
                      const delta = role.scenarioCost - role.currentCost;
                      const deltaPercent = role.currentCost > 0
                        ? ((delta / role.currentCost) * 100)
                        : 0;

                      return (
                        <tr key={role.id} className={role.isHypothetical ? styles.hypotheticalRow : ''}>
                          <td className={styles.roleColumn}>
                            {role.isHypothetical ? (
                              <input
                                type="text"
                                value={role.roleName}
                                onChange={(e) => updateRoleName(role.id, e.target.value)}
                                className={styles.roleNameInput}
                                placeholder="Role name"
                              />
                            ) : (
                              role.roleName
                            )}
                          </td>
                          <td>{role.currentHours.toFixed(2)}</td>
                          <td>${role.currentRate.toFixed(2)}</td>
                          <td>${role.currentCost.toFixed(2)}</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={role.scenarioHours}
                              onChange={(e) => updateScenarioValue(role.id, 'hours', parseFloat(e.target.value) || 0)}
                              className={styles.editInput}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={role.scenarioRate}
                              onChange={(e) => updateScenarioValue(role.id, 'rate', parseFloat(e.target.value) || 0)}
                              className={styles.editInput}
                            />
                          </td>
                          <td className={styles.calculatedValue}>${role.scenarioCost.toFixed(2)}</td>
                          <td className={styles.deltaColumn}>
                            {delta !== 0 && (
                              <span className={delta > 0 ? styles.deltaPositive : styles.deltaNegative}>
                                {delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(2)}
                              </span>
                            )}
                            {role.isHypothetical && (
                              <button
                                onClick={() => removeHypotheticalRole(role.id)}
                                className={styles.removeButton}
                                title="Remove"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Add Role Row */}
                    <tr>
                      <td colSpan={8} className={styles.addRoleRow}>
                        <button
                          onClick={() => addHypotheticalRole(productId)}
                          className={styles.addRoleButton}
                        >
                          + Add Role
                        </button>
                      </td>
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Impact Summary */}
          <div className={styles.impactSection}>
            <h3 className={styles.impactHeading}>Impact Summary</h3>

            <table className={styles.impactTable}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Current Labor Cost</th>
                  <th>Scenario Labor Cost</th>
                  <th>Change</th>
                  <th>Total Current CPU</th>
                  <th>Total Scenario CPU</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {cpuSummaries.map(summary => {
                  const laborChange = summary.scenarioLaborCPU - summary.currentLaborCPU;
                  const cpuChange = summary.scenarioTotalCPU - summary.currentTotalCPU;

                  return (
                    <tr key={summary.productId}>
                      <td className={styles.impactProduct}>{summary.productName}</td>
                      <td className={styles.impactCost}>${summary.currentLaborCPU.toFixed(2)}</td>
                      <td className={styles.impactCost}>${summary.scenarioLaborCPU.toFixed(2)}</td>
                      <td className={laborChange > 0 ? styles.impactIncrease : styles.impactDecrease}>
                        {laborChange > 0 ? '+' : ''}${laborChange.toFixed(2)}
                      </td>
                      <td className={styles.impactCost}>${summary.currentTotalCPU.toFixed(2)}</td>
                      <td className={styles.impactCost}>${summary.scenarioTotalCPU.toFixed(2)}</td>
                      <td className={cpuChange > 0 ? styles.impactIncrease : styles.impactDecrease}>
                        {cpuChange > 0 ? '+' : ''}${cpuChange.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className={styles.impactTotal}>
              <span>Total Cost Impact:</span>
              <span className={styles.totalValue}>
                ${cpuSummaries.reduce((sum, s) => sum + (s.scenarioLaborCPU - s.currentLaborCPU), 0).toFixed(2)}
              </span>
            </div>

            <div className={styles.impactFooter}>
              <Button
                variant="gold"
                onClick={exportCSV}
              >
                Export CSV
              </Button>
            </div>
          </div>
        </>
      )}

      {scenarioGenerated && productGroups.length === 0 && (
        <div className={styles.emptyState}>
          <p>No labor roles found for the selected filters. Try adjusting your filter selection.</p>
        </div>
      )}
    </div>
  );
}
