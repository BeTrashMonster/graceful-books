/**
 * Phase-Based Feature Visibility Rules
 *
 * Defines which features are visible and accessible in each business phase.
 * Features unlock progressively as users advance through phases.
 *
 * Requirements:
 * - PFD-001: Feature visibility rules by phase
 * - PFD-002: UI adaptation based on phase
 */

import type { BusinessPhase } from '../../types';
import type {
  FeatureId,
  FeatureMetadata,
  PhaseVisibilityRules,
  FeatureAccessResult,
} from './types';

/**
 * All features with their metadata
 */
export const FEATURE_METADATA: Record<FeatureId, FeatureMetadata> = {
  // Stabilize phase features
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Overview of your financial health',
    availableInPhase: 'stabilize',
    icon: 'dashboard',
    route: '/dashboard',
    category: 'reports',
  },
  'basic-transactions': {
    id: 'basic-transactions',
    name: 'Basic Transactions',
    description: 'Record income and expenses',
    availableInPhase: 'stabilize',
    icon: 'transaction',
    route: '/transactions',
    category: 'transactions',
  },
  'simple-reports': {
    id: 'simple-reports',
    name: 'Simple Reports',
    description: 'Basic income and expense reports',
    availableInPhase: 'stabilize',
    icon: 'report',
    route: '/reports/simple',
    category: 'reports',
  },
  'accounts-basic': {
    id: 'accounts-basic',
    name: 'Basic Accounts',
    description: 'Manage your chart of accounts',
    availableInPhase: 'stabilize',
    icon: 'account',
    route: '/accounts',
    category: 'settings',
  },
  'help-center': {
    id: 'help-center',
    name: 'Help Center',
    description: 'Get help and learn accounting basics',
    availableInPhase: 'stabilize',
    icon: 'help',
    route: '/help',
    category: 'settings',
  },

  // Organize phase features
  categories: {
    id: 'categories',
    name: 'Categories',
    description: 'Organize transactions with categories',
    availableInPhase: 'organize',
    icon: 'category',
    route: '/categories',
    category: 'transactions',
  },
  tags: {
    id: 'tags',
    name: 'Tags',
    description: 'Tag transactions for better tracking',
    availableInPhase: 'organize',
    icon: 'tag',
    route: '/tags',
    category: 'transactions',
  },
  reconciliation: {
    id: 'reconciliation',
    name: 'Bank Reconciliation',
    description: 'Match transactions with bank statements',
    availableInPhase: 'organize',
    icon: 'reconcile',
    route: '/reconciliation',
    category: 'transactions',
  },
  'advanced-reports': {
    id: 'advanced-reports',
    name: 'Advanced Reports',
    description: 'Detailed financial reports and insights',
    availableInPhase: 'organize',
    icon: 'chart',
    route: '/reports/advanced',
    category: 'reports',
  },
  search: {
    id: 'search',
    name: 'Advanced Search',
    description: 'Search and filter transactions',
    availableInPhase: 'organize',
    icon: 'search',
    category: 'transactions',
  },
  filters: {
    id: 'filters',
    name: 'Custom Filters',
    description: 'Create custom transaction filters',
    availableInPhase: 'organize',
    icon: 'filter',
    category: 'transactions',
  },

  // Build phase features
  invoicing: {
    id: 'invoicing',
    name: 'Invoicing',
    description: 'Create and send professional invoices',
    availableInPhase: 'build',
    icon: 'invoice',
    route: '/invoices',
    category: 'transactions',
  },
  customers: {
    id: 'customers',
    name: 'Customer Management',
    description: 'Track customers and their payments',
    availableInPhase: 'build',
    icon: 'customer',
    route: '/customers',
    category: 'contacts',
  },
  inventory: {
    id: 'inventory',
    name: 'Inventory Tracking',
    description: 'Monitor product inventory levels',
    availableInPhase: 'build',
    icon: 'inventory',
    route: '/inventory',
    category: 'advanced',
  },
  products: {
    id: 'products',
    name: 'Product Catalog',
    description: 'Manage products and services',
    availableInPhase: 'build',
    icon: 'product',
    route: '/products',
    category: 'advanced',
  },
  'recurring-transactions': {
    id: 'recurring-transactions',
    name: 'Recurring Transactions',
    description: 'Automate regular income and expenses',
    availableInPhase: 'build',
    icon: 'recurring',
    route: '/transactions/recurring',
    category: 'transactions',
  },
  estimates: {
    id: 'estimates',
    name: 'Estimates & Quotes',
    description: 'Create estimates for potential clients',
    availableInPhase: 'build',
    icon: 'estimate',
    route: '/estimates',
    category: 'transactions',
  },

  // Grow phase features
  forecasting: {
    id: 'forecasting',
    name: 'Financial Forecasting',
    description: 'Project future financial performance',
    availableInPhase: 'grow',
    icon: 'forecast',
    route: '/forecasting',
    category: 'reports',
  },
  analytics: {
    id: 'analytics',
    name: 'Business Analytics',
    description: 'Advanced analytics and insights',
    availableInPhase: 'grow',
    icon: 'analytics',
    route: '/analytics',
    category: 'reports',
  },
  integrations: {
    id: 'integrations',
    name: 'Third-Party Integrations',
    description: 'Connect with external services',
    availableInPhase: 'grow',
    icon: 'integration',
    route: '/integrations',
    category: 'advanced',
  },
  'api-access': {
    id: 'api-access',
    name: 'API Access',
    description: 'Programmatic access to your data',
    availableInPhase: 'grow',
    icon: 'api',
    route: '/api',
    category: 'advanced',
  },
  'multi-currency': {
    id: 'multi-currency',
    name: 'Multi-Currency',
    description: 'Handle multiple currencies',
    availableInPhase: 'grow',
    icon: 'currency',
    route: '/settings/currency',
    category: 'settings',
  },
  'custom-reports': {
    id: 'custom-reports',
    name: 'Custom Report Builder',
    description: 'Build your own custom reports',
    availableInPhase: 'grow',
    icon: 'report-builder',
    route: '/reports/custom',
    category: 'reports',
  },
};

/**
 * Phase hierarchy - defines order of phases
 */
const PHASE_HIERARCHY: Record<BusinessPhase, number> = {
  stabilize: 1,
  organize: 2,
  build: 3,
  grow: 4,
};

/**
 * Visibility rules for each phase
 */
export const PHASE_VISIBILITY_RULES: Record<BusinessPhase, PhaseVisibilityRules> = {
  stabilize: {
    phase: 'stabilize',
    visibleFeatures: [
      'dashboard',
      'basic-transactions',
      'simple-reports',
      'accounts-basic',
      'help-center',
    ],
    previewFeatures: ['categories', 'tags', 'reconciliation'],
  },
  organize: {
    phase: 'organize',
    visibleFeatures: [
      // All Stabilize features
      'dashboard',
      'basic-transactions',
      'simple-reports',
      'accounts-basic',
      'help-center',
      // New Organize features
      'categories',
      'tags',
      'reconciliation',
      'advanced-reports',
      'search',
      'filters',
    ],
    previewFeatures: ['invoicing', 'customers', 'products'],
  },
  build: {
    phase: 'build',
    visibleFeatures: [
      // All Stabilize features
      'dashboard',
      'basic-transactions',
      'simple-reports',
      'accounts-basic',
      'help-center',
      // All Organize features
      'categories',
      'tags',
      'reconciliation',
      'advanced-reports',
      'search',
      'filters',
      // New Build features
      'invoicing',
      'customers',
      'inventory',
      'products',
      'recurring-transactions',
      'estimates',
    ],
    previewFeatures: ['forecasting', 'analytics', 'integrations'],
  },
  grow: {
    phase: 'grow',
    visibleFeatures: [
      // All previous features
      'dashboard',
      'basic-transactions',
      'simple-reports',
      'accounts-basic',
      'help-center',
      'categories',
      'tags',
      'reconciliation',
      'advanced-reports',
      'search',
      'filters',
      'invoicing',
      'customers',
      'inventory',
      'products',
      'recurring-transactions',
      'estimates',
      // New Grow features
      'forecasting',
      'analytics',
      'integrations',
      'api-access',
      'multi-currency',
      'custom-reports',
    ],
    previewFeatures: [], // All features unlocked
  },
};

/**
 * Check if a feature is accessible in a given phase
 */
export function isFeatureAccessible(
  featureId: FeatureId,
  currentPhase: BusinessPhase
): boolean {
  const feature = FEATURE_METADATA[featureId];
  if (!feature) {
    return false;
  }

  const currentPhaseLevel = PHASE_HIERARCHY[currentPhase];
  const requiredPhaseLevel = PHASE_HIERARCHY[feature.availableInPhase];

  return currentPhaseLevel >= requiredPhaseLevel;
}

/**
 * Check if a feature is visible (but may be locked) in a given phase
 */
export function isFeatureVisible(
  featureId: FeatureId,
  currentPhase: BusinessPhase
): boolean {
  const rules = PHASE_VISIBILITY_RULES[currentPhase];
  return (
    rules.visibleFeatures.includes(featureId) ||
    (rules.previewFeatures?.includes(featureId) ?? false)
  );
}

/**
 * Get feature access result
 */
export function getFeatureAccess(
  featureId: FeatureId,
  currentPhase: BusinessPhase,
  showAllFeatures: boolean = false
): FeatureAccessResult {
  const feature = FEATURE_METADATA[featureId];

  if (!feature) {
    return {
      canAccess: false,
      isVisible: false,
      reason: 'not-found',
      message: 'This feature does not exist.',
    };
  }

  const isAccessible = isFeatureAccessible(featureId, currentPhase);
  const isVisible = isFeatureVisible(featureId, currentPhase) || showAllFeatures;

  if (isAccessible) {
    return {
      canAccess: true,
      isVisible: true,
      availableInPhase: feature.availableInPhase,
    };
  }

  if (isVisible || showAllFeatures) {
    return {
      canAccess: false,
      isVisible: true,
      availableInPhase: feature.availableInPhase,
      reason: 'phase-locked',
      message: `This feature becomes available in the ${capitalizePhase(feature.availableInPhase)} phase. You're currently in the ${capitalizePhase(currentPhase)} phase.`,
    };
  }

  return {
    canAccess: false,
    isVisible: false,
    availableInPhase: feature.availableInPhase,
    reason: 'preference-hidden',
    message: 'This feature is not yet available.',
  };
}

/**
 * Get all features for a given phase
 */
export function getFeaturesForPhase(phase: BusinessPhase): FeatureId[] {
  return PHASE_VISIBILITY_RULES[phase].visibleFeatures;
}

/**
 * Get accessible features for a given phase
 */
export function getAccessibleFeatures(phase: BusinessPhase): FeatureId[] {
  return PHASE_VISIBILITY_RULES[phase].visibleFeatures.filter((featureId) =>
    isFeatureAccessible(featureId, phase)
  );
}

/**
 * Get locked features for a given phase (visible but not accessible)
 */
export function getLockedFeatures(phase: BusinessPhase): FeatureId[] {
  return PHASE_VISIBILITY_RULES[phase].visibleFeatures.filter(
    (featureId) => !isFeatureAccessible(featureId, phase)
  );
}

/**
 * Get features unlocked when transitioning from one phase to another
 */
export function getUnlockedFeatures(
  oldPhase: BusinessPhase,
  newPhase: BusinessPhase
): FeatureId[] {
  const oldAccessible = new Set(getAccessibleFeatures(oldPhase));
  const newAccessible = getAccessibleFeatures(newPhase);

  return newAccessible.filter((featureId) => !oldAccessible.has(featureId));
}

/**
 * Get feature metadata by ID
 */
export function getFeatureMetadata(featureId: FeatureId): FeatureMetadata | undefined {
  return FEATURE_METADATA[featureId];
}

/**
 * Get all feature metadata
 */
export function getAllFeatures(): FeatureMetadata[] {
  return Object.values(FEATURE_METADATA);
}

/**
 * Get features by category
 */
export function getFeaturesByCategory(
  category: FeatureMetadata['category']
): FeatureMetadata[] {
  return getAllFeatures().filter((feature) => feature.category === category);
}

/**
 * Helper: Capitalize phase name for display
 */
function capitalizePhase(phase: BusinessPhase): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/**
 * Helper: Get human-readable phase description
 */
export function getPhaseDescription(phase: BusinessPhase): string {
  const descriptions: Record<BusinessPhase, string> = {
    stabilize: 'Getting your financial foundation in place',
    organize: 'Organizing and categorizing your finances',
    build: 'Building systems to grow your business',
    grow: 'Scaling with advanced tools and insights',
  };
  return descriptions[phase];
}

/**
 * Helper: Get next phase
 */
export function getNextPhase(currentPhase: BusinessPhase): BusinessPhase | null {
  const phases: BusinessPhase[] = ['stabilize', 'organize', 'build', 'grow'];
  const currentIndex = phases.indexOf(currentPhase);
  if (currentIndex === -1 || currentIndex === phases.length - 1) {
    return null;
  }
  return phases[currentIndex + 1] as BusinessPhase;
}
