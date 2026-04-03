/**
 * Labor Reports Tab
 *
 * Provides labor cost analysis and reporting for CPG products.
 *
 * Features:
 * - Labor Cost by Product: Shows which products have the highest labor costs
 * - Labor Cost by Role: Shows which roles are most utilized and costly
 * - Labor vs. Ingredients Ratio: Shows labor as % of total CPU
 *
 * Requirements:
 * - Labor + Roles Roadmap Phase 4
 * - WCAG 2.1 AA compliance
 * - Export to CSV functionality
 * - Sortable tables
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '../../../../components/core/Button';
import { Loading } from '../../../../components/feedback/Loading';
import { useAuth } from '../../../../contexts/AuthContext';
import { db } from '../../../../db/database';
import { LaborRoleService } from '../../../../services/cpg/laborRole.service';
import { cpuCalculatorService } from '../../../../services/cpg/cpuCalculator.service';
import type { CPGLaborRole, CPGFinishedProduct } from '../../../../db/schema/cpg.schema';
import { useCPGSettings } from '../../../../hooks/useCPGSettings';
import styles from './LaborReportsTab.module.css';

interface ProductLaborData {
  productId: string;
  productName: string;
  totalLaborCPU: number;
  roleCount: number;
  totalCPU: number;
  laborPercentage: number;
  materialCPU: number;
}

interface RoleLaborData {
  roleId: string;
  roleName: string;
  hourlyRate: number;
  productCount: number;
  totalHoursPerMonth: number;
  totalCostPerMonth: number;
}

type SortField = 'productName' | 'totalLaborCPU' | 'roleCount' | 'laborPercentage';
type SortDirection = 'asc' | 'desc';
type RoleSortField = 'roleName' | 'hourlyRate' | 'productCount' | 'totalCostPerMonth';

export function LaborReportsTab() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { formatCurrency, formatNumber, formatPercentage } = useCPGSettings();

  // Services
  const [laborRoleService] = useState(() => new LaborRoleService(db));

  // Data
  const [productLaborData, setProductLaborData] = useState<ProductLaborData[]>([]);
  const [roleLaborData, setRoleLaborData] = useState<RoleLaborData[]>([]);

  // Sorting state
  const [productSortField, setProductSortField] = useState<SortField>('totalLaborCPU');
  const [productSortDirection, setProductSortDirection] = useState<SortDirection>('desc');
  const [roleSortField, setRoleSortField] = useState<RoleSortField>('totalCostPerMonth');
  const [roleSortDirection, setRoleSortDirection] = useState<SortDirection>('desc');

  // Load data
  useEffect(() => {
    loadReportData();
  }, [companyId]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all active products
      const products = await db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .and(p => p.active && p.deleted_at === null)
        .toArray();

      // Get all active labor roles
      const roles = await laborRoleService.getRoles(companyId);

      // Calculate product labor data
      const productData: ProductLaborData[] = [];
      for (const product of products) {
        const laborCalc = await laborRoleService.calculateProductLaborCost(product.id);
        const cpuResult = await cpuCalculatorService.calculateFinishedProductCPU(
          product.id,
          companyId,
          null
        );

        const totalLaborCPU = parseFloat(laborCalc.totalLaborCostPerUnit);
        const totalCPU = cpuResult.cpu ? parseFloat(cpuResult.cpu) : 0;
        const materialCPU = cpuResult.materialCPU ? parseFloat(cpuResult.materialCPU) : 0;
        const laborPercentage = totalCPU > 0 ? (totalLaborCPU / totalCPU) * 100 : 0;

        if (totalLaborCPU > 0) {
          productData.push({
            productId: product.id,
            productName: product.name,
            totalLaborCPU,
            roleCount: laborCalc.breakdown.length,
            totalCPU,
            laborPercentage,
            materialCPU,
          });
        }
      }

      setProductLaborData(productData);

      // Calculate role labor data
      const roleData: RoleLaborData[] = [];
      for (const role of roles) {
        const assignments = await laborRoleService.getRoleAssignments(role.id);
        const hourlyRate = parseFloat(laborRoleService.getEffectiveHourlyRate(role));

        // Calculate total hours per month (assuming products are made continuously)
        // This is a simplified calculation - in reality, production schedules vary
        let totalHoursPerMonth = 0;
        for (const assignment of assignments) {
          const hoursPerUnit = parseFloat(assignment.hours_per_unit || '0');
          // Assume 100 units per month as baseline (this is arbitrary - user can adjust logic)
          totalHoursPerMonth += hoursPerUnit * 100;
        }

        const totalCostPerMonth = totalHoursPerMonth * hourlyRate;

        if (assignments.length > 0) {
          roleData.push({
            roleId: role.id,
            roleName: role.role_name,
            hourlyRate,
            productCount: assignments.length,
            totalHoursPerMonth,
            totalCostPerMonth,
          });
        }
      }

      setRoleLaborData(roleData);
    } catch (err) {
      console.error('Error loading labor report data:', err);
      setError('Failed to load labor reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Sort product data
  const sortedProductData = useMemo(() => {
    const sorted = [...productLaborData];
    sorted.sort((a, b) => {
      let aVal: number | string = a[productSortField];
      let bVal: number | string = b[productSortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return productSortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const aNum = typeof aVal === 'number' ? aVal : 0;
      const bNum = typeof bVal === 'number' ? bVal : 0;
      return productSortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
    return sorted;
  }, [productLaborData, productSortField, productSortDirection]);

  // Sort role data
  const sortedRoleData = useMemo(() => {
    const sorted = [...roleLaborData];
    sorted.sort((a, b) => {
      let aVal: number | string = a[roleSortField];
      let bVal: number | string = b[roleSortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return roleSortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const aNum = typeof aVal === 'number' ? aVal : 0;
      const bNum = typeof bVal === 'number' ? bVal : 0;
      return roleSortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
    return sorted;
  }, [roleLaborData, roleSortField, roleSortDirection]);

  // Handle product sort
  const handleProductSort = (field: SortField) => {
    if (productSortField === field) {
      setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setProductSortField(field);
      setProductSortDirection('desc');
    }
  };

  // Handle role sort
  const handleRoleSort = (field: RoleSortField) => {
    if (roleSortField === field) {
      setRoleSortDirection(roleSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setRoleSortField(field);
      setRoleSortDirection('desc');
    }
  };

  // Export to CSV
  const exportProductsToCSV = () => {
    const headers = ['Product Name', 'Total Labor CPU', '# of Roles', '% of Total CPU'];
    const rows = sortedProductData.map(p => [
      p.productName,
      formatCurrency(p.totalLaborCPU),
      p.roleCount.toString(),
      formatPercentage(p.laborPercentage),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labor-cost-by-product-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRolesToCSV = () => {
    const headers = ['Role Name', 'Hourly Rate', '# Products', 'Total Hours/Month', 'Total Cost/Month'];
    const rows = sortedRoleData.map(r => [
      r.roleName,
      formatCurrency(r.hourlyRate),
      r.productCount.toString(),
      formatNumber(r.totalHoursPerMonth),
      formatCurrency(r.totalCostPerMonth),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `labor-cost-by-role-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render sort indicator
  const renderSortIndicator = (field: SortField | RoleSortField, currentField: SortField | RoleSortField, direction: SortDirection) => {
    if (field !== currentField) return null;
    return direction === 'asc' ? ' ↑' : ' ↓';
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loading message="Loading labor reports..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorMessage}>{error}</p>
        <Button variant="purple" onClick={loadReportData}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.intro}>
        <p>Analyze your labor costs across products and roles to optimize your production efficiency.</p>
      </div>

      {/* Report A: Labor Cost by Product */}
      <section className={styles.reportSection}>
        <div className={styles.reportHeader}>
          <h2>Labor Cost by Product</h2>
          <Button
            variant="gold"
            size="sm"
            onClick={exportProductsToCSV}
            disabled={sortedProductData.length === 0}
          >
            Export to CSV
          </Button>
        </div>

        {sortedProductData.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No products with labor costs found. Assign labor roles to your products to see them here.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th onClick={() => handleProductSort('productName')} className={styles.sortable}>
                    Product Name{renderSortIndicator('productName', productSortField, productSortDirection)}
                  </th>
                  <th onClick={() => handleProductSort('totalLaborCPU')} className={styles.sortable}>
                    Total Labor CPU{renderSortIndicator('totalLaborCPU', productSortField, productSortDirection)}
                  </th>
                  <th onClick={() => handleProductSort('roleCount')} className={styles.sortable}>
                    # of Roles{renderSortIndicator('roleCount', productSortField, productSortDirection)}
                  </th>
                  <th onClick={() => handleProductSort('laborPercentage')} className={styles.sortable}>
                    % of Total CPU{renderSortIndicator('laborPercentage', productSortField, productSortDirection)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedProductData.map(product => (
                  <tr key={product.productId}>
                    <td>{product.productName}</td>
                    <td>{formatCurrency(product.totalLaborCPU)}</td>
                    <td>{product.roleCount}</td>
                    <td>{formatPercentage(product.laborPercentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Report B: Labor Cost by Role */}
      <section className={styles.reportSection}>
        <div className={styles.reportHeader}>
          <h2>Labor Cost by Role</h2>
          <Button
            variant="gold"
            size="sm"
            onClick={exportRolesToCSV}
            disabled={sortedRoleData.length === 0}
          >
            Export to CSV
          </Button>
        </div>

        {sortedRoleData.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No roles assigned to products found. Assign labor roles to your products to see them here.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th onClick={() => handleRoleSort('roleName')} className={styles.sortable}>
                    Role Name{renderSortIndicator('roleName', roleSortField, roleSortDirection)}
                  </th>
                  <th onClick={() => handleRoleSort('hourlyRate')} className={styles.sortable}>
                    Hourly Rate{renderSortIndicator('hourlyRate', roleSortField, roleSortDirection)}
                  </th>
                  <th onClick={() => handleRoleSort('productCount')} className={styles.sortable}>
                    # Products{renderSortIndicator('productCount', roleSortField, roleSortDirection)}
                  </th>
                  <th>Total Hours/Month</th>
                  <th onClick={() => handleRoleSort('totalCostPerMonth')} className={styles.sortable}>
                    Total Cost/Month{renderSortIndicator('totalCostPerMonth', roleSortField, roleSortDirection)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRoleData.map(role => (
                  <tr key={role.roleId}>
                    <td>{role.roleName}</td>
                    <td>{formatCurrency(role.hourlyRate)}/hr</td>
                    <td>{role.productCount}</td>
                    <td>{formatNumber(role.totalHoursPerMonth)} hrs</td>
                    <td>{formatCurrency(role.totalCostPerMonth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.reportNote}>
          * Monthly calculations assume 100 units per product. Adjust production volumes for accurate projections.
        </p>
      </section>

      {/* Report C: Labor vs. Ingredients Ratio */}
      <section className={styles.reportSection}>
        <div className={styles.reportHeader}>
          <h2>Labor vs. Ingredients Ratio</h2>
        </div>

        {sortedProductData.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No products with labor costs found. Assign labor roles to your products to see them here.</p>
          </div>
        ) : (
          <div className={styles.ratioContainer}>
            <p className={styles.ratioIntro}>
              This shows whether your products are labor-intensive or material-intensive, helping you optimize pricing and production.
            </p>
            <div className={styles.ratioGrid}>
              {sortedProductData.map(product => {
                const ingredientPercentage = product.totalCPU > 0
                  ? (product.materialCPU / product.totalCPU) * 100
                  : 0;

                return (
                  <div key={product.productId} className={styles.ratioCard}>
                    <h3 className={styles.ratioProductName}>{product.productName}</h3>
                    <div className={styles.ratioBar}>
                      <div
                        className={styles.ratioLaborSegment}
                        style={{ width: `${product.laborPercentage}%` }}
                      >
                        {product.laborPercentage > 15 && (
                          <span className={styles.ratioLabel}>
                            Labor {formatPercentage(product.laborPercentage, 0)}
                          </span>
                        )}
                      </div>
                      <div
                        className={styles.ratioIngredientSegment}
                        style={{ width: `${ingredientPercentage}%` }}
                      >
                        {ingredientPercentage > 15 && (
                          <span className={styles.ratioLabel}>
                            Ingredients {formatPercentage(ingredientPercentage, 0)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.ratioDetails}>
                      <div className={styles.ratioDetail}>
                        <span className={styles.ratioDetailLabel}>Labor:</span>
                        <span className={styles.ratioDetailValue}>
                          {formatCurrency(product.totalLaborCPU)} ({formatPercentage(product.laborPercentage)})
                        </span>
                      </div>
                      <div className={styles.ratioDetail}>
                        <span className={styles.ratioDetailLabel}>Ingredients:</span>
                        <span className={styles.ratioDetailValue}>
                          {formatCurrency(product.materialCPU)} ({formatPercentage(ingredientPercentage)})
                        </span>
                      </div>
                      <div className={styles.ratioDetail}>
                        <span className={styles.ratioDetailLabel}>Total CPU:</span>
                        <span className={styles.ratioDetailValue}>
                          {formatCurrency(product.totalCPU)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
