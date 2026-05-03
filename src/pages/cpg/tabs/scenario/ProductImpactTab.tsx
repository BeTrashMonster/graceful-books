/**
 * Product Impact Tab - Scenario Planning
 *
 * Analyze product revenue, costs, and profitability scenarios
 */

import { ProductImpactAnalysis } from '../../../../components/cpg/ProductImpactAnalysis';
import { useAuth } from '../../../../contexts/AuthContext';

export function ProductImpactTab() {
  const { companyId } = useAuth();

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2>Sales Impact Scenarios</h2>
        <p>
          Test different sales volumes across Break-even, Good, Better, and Best scenarios
          to see revenue, costs, and profitability.
        </p>
      </div>

      <ProductImpactAnalysis
        companyId={companyId}
        ownerPayCalculatorLink="/cpg/labor-roles?tab=owner-pay"
        showScenarioTabs={false}
      />
    </div>
  );
}
