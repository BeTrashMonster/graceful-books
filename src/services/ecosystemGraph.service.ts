/**
 * Ecosystem Graph Data Service
 *
 * Provides nodes and connections for the product ecosystem navigation graph.
 * Shows different product areas (Bookkeeping, CPG Tool, etc.) with active/inactive states.
 */

import type { GraphNode, GraphConnection } from './cpg/financialWebData.service';

export type EcosystemNodeType =
  | 'bookkeeping'      // Core bookkeeping features
  | 'cpg'              // CPG Tool features
  | 'future'           // Future products (inactive)
  | 'central';         // Central hub node

export interface EcosystemNode extends Omit<GraphNode, 'type'> {
  type: EcosystemNodeType;
  route?: string;      // Navigation route when clicked
  description?: string; // Tooltip description
}

export interface EcosystemData {
  nodes: EcosystemNode[];
  connections: GraphConnection[];
}

export interface ProductAccess {
  bookkeeping: boolean;
  cpg: boolean;
}

/**
 * Get ecosystem graph data based on user's product access
 */
export function getEcosystemData(productAccess: ProductAccess): EcosystemData {
  const nodes: EcosystemNode[] = [
    // Central Hub
    {
      id: 'hub',
      name: 'Graceful Books',
      totalSpent: '0',
      type: 'central',
      isActive: true,
      description: 'Your financial ecosystem',
    },

    // Bookkeeping Suite Nodes
    {
      id: 'accounts',
      name: 'Chart of Accounts',
      totalSpent: '0',
      type: 'bookkeeping',
      isActive: productAccess.bookkeeping,
      route: '/accounts',
      description: 'Manage your chart of accounts',
    },
    {
      id: 'transactions',
      name: 'Transactions',
      totalSpent: '0',
      type: 'bookkeeping',
      isActive: productAccess.bookkeeping,
      route: '/transactions',
      description: 'Record and view transactions',
    },
    {
      id: 'reconciliation',
      name: 'Reconciliation',
      totalSpent: '0',
      type: 'bookkeeping',
      isActive: productAccess.bookkeeping,
      route: '/reconciliation',
      description: 'Match bank statements',
    },
    {
      id: 'invoices',
      name: 'Invoices',
      totalSpent: '0',
      type: 'bookkeeping',
      isActive: productAccess.bookkeeping,
      route: '/invoices',
      description: 'Create and manage invoices',
    },
    {
      id: 'reports',
      name: 'Reports',
      totalSpent: '0',
      type: 'bookkeeping',
      isActive: productAccess.bookkeeping,
      route: '/reports/profit-loss',
      description: 'Financial reports and analytics',
    },
    {
      id: 'customers',
      name: 'Customers',
      totalSpent: '0',
      type: 'bookkeeping',
      isActive: productAccess.bookkeeping,
      route: '/customers',
      description: 'Manage customer relationships',
    },
    {
      id: 'vendors',
      name: 'Vendors',
      totalSpent: '0',
      type: 'bookkeeping',
      isActive: productAccess.bookkeeping,
      route: '/vendors',
      description: 'Manage vendor relationships',
    },

    // CPG Tool Node
    {
      id: 'cpg-tool',
      name: 'CPG Analytics',
      totalSpent: '0',
      type: 'cpg',
      isActive: productAccess.cpg,
      route: '/cpg',
      description: 'Cost per good analysis and distribution tracking',
    },

    // Future Products (always inactive for now)
    {
      id: 'payroll',
      name: 'Payroll',
      totalSpent: '0',
      type: 'future',
      isActive: false,
      description: 'Coming soon: Employee payroll management',
    },
    {
      id: 'inventory',
      name: 'Inventory',
      totalSpent: '0',
      type: 'future',
      isActive: false,
      description: 'Coming soon: Inventory tracking',
    },
  ];

  // Connections show relationships between features
  const connections: GraphConnection[] = [
    // Hub connects to all main areas
    { source: 'hub', target: 'accounts', productCount: 1, products: [] },
    { source: 'hub', target: 'transactions', productCount: 1, products: [] },
    { source: 'hub', target: 'reports', productCount: 1, products: [] },
    { source: 'hub', target: 'cpg-tool', productCount: 1, products: [] },

    // Bookkeeping interconnections
    { source: 'accounts', target: 'transactions', productCount: 2, products: [] },
    { source: 'transactions', target: 'reconciliation', productCount: 2, products: [] },
    { source: 'transactions', target: 'reports', productCount: 2, products: [] },
    { source: 'invoices', target: 'customers', productCount: 2, products: [] },
    { source: 'invoices', target: 'transactions', productCount: 2, products: [] },
    { source: 'vendors', target: 'transactions', productCount: 2, products: [] },

    // CPG connects to bookkeeping
    { source: 'cpg-tool', target: 'transactions', productCount: 1, products: [] },
    { source: 'cpg-tool', target: 'vendors', productCount: 1, products: [] },
    { source: 'cpg-tool', target: 'reports', productCount: 1, products: [] },

    // Future products connect to hub
    { source: 'hub', target: 'payroll', productCount: 1, products: [] },
    { source: 'hub', target: 'inventory', productCount: 1, products: [] },
  ];

  return { nodes, connections };
}

/**
 * Get node color based on type and active state
 */
export function getNodeColor(type: EcosystemNodeType, isActive: boolean): string {
  if (!isActive) {
    return '#e9d5ff'; // Light purple for inactive
  }

  switch (type) {
    case 'central':
      return '#4b006e'; // Deep purple
    case 'bookkeeping':
      return '#4b006e'; // Purple
    case 'cpg':
      return '#509724'; // Green (matches CPG distribution color)
    case 'future':
      return '#9ca3af'; // Gray
    default:
      return '#4b006e';
  }
}
