export interface EcosystemNode {
  id: string;
  name: string;
  price: string;
  type: 'hub' | 'module' | 'accountant';
  color: string;
  description: string;
  keyFeatures: string[];
  standaloneAvailable: boolean;
  integratedInBookkeeping: boolean;
  charityContribution: string;
}

export interface EcosystemLink {
  source: string;
  target: string;
  type: 'integrated' | 'standalone' | 'accountant';
}

export const ecosystemNodes: EcosystemNode[] = [
  // CENTER HUB
  {
    id: 'bookkeeping',
    name: 'Audacious Money\n(Bookkeeping)',
    price: '$40/month',
    type: 'hub',
    color: '#7C3AED', // Royal purple
    description: 'The heart of your financial ecosystem. Zero-knowledge encrypted, local-first accounting that makes bookkeeping feel like magic instead of math.',
    keyFeatures: [
      'Full double-entry accounting (hidden complexity)',
      'Invoicing & proposal generation',
      'Service provider management (bookkeeping view)',
      'Integrated phase-based checklist',
      'Progressive feature unfurling',
      'Everything unlocks as you grow - no upsells!'
    ],
    standaloneAvailable: false,
    integratedInBookkeeping: true,
    charityContribution: '$5/month to your chosen charity'
  },

  // RADIATING MODULES
  {
    id: 'budgeting',
    name: 'Budgeting',
    price: '$10/month',
    type: 'module',
    color: '#10B981', // Green
    description: 'Take control of your cash flow with visual budgeting tools that make planning feel empowering, not restrictive.',
    keyFeatures: [
      'Visual cash flow planning',
      'Forecast vs. actual tracking',
      'Spending category insights',
      'Budget alerts & notifications',
      'Integrates with bookkeeping data when ready'
    ],
    standaloneAvailable: true,
    integratedInBookkeeping: true,
    charityContribution: '$5/month to your chosen charity'
  },

  {
    id: 'debt',
    name: 'Debt Management',
    price: '$20/month',
    type: 'module',
    color: '#F59E0B', // Gold
    description: 'Transform debt from overwhelming to manageable with strategic payoff plans and interest optimization.',
    keyFeatures: [
      'Debt snowball & avalanche strategies',
      'Interest optimization calculator',
      'Payoff timeline visualization',
      'Progress tracking & celebrations',
      'Integrates with bookkeeping for complete picture'
    ],
    standaloneAvailable: true,
    integratedInBookkeeping: true,
    charityContribution: '$5/month to your chosen charity'
  },

  {
    id: 'service-job',
    name: 'Service Provider\n& Job Costing',
    price: '$30/month',
    type: 'module',
    color: '#F59E0B', // Gold
    description: 'Perfect for contractors, agencies, and service providers. Track project profitability and manage your team with ease.',
    keyFeatures: [
      'Project-based job costing',
      'Client management & communication',
      'Contractor/vendor tracking',
      'Profitability analysis per project',
      'Time & materials tracking',
      '1099 management'
    ],
    standaloneAvailable: true,
    integratedInBookkeeping: true,
    charityContribution: '$5/month to your chosen charity'
  },

  {
    id: 'cpg',
    name: 'Product Costing',
    price: '$50/month or $5/unit',
    type: 'module',
    color: '#10B981', // Green
    description: 'Nail your product pricing with sophisticated cost tracking, margin analysis, and promo decision support.',
    keyFeatures: [
      'Ingredient/component cost tracking',
      'Margin calculation & analysis',
      'Promo ROI decision support',
      'Scenario planning for pricing',
      'CPG-specific financial insights',
      'Integrates with inventory when ready'
    ],
    standaloneAvailable: true,
    integratedInBookkeeping: true,
    charityContribution: '$5/month to your chosen charity'
  },

  // SEPARATE ORBIT - ACCOUNTANT PORTAL
  {
    id: 'accountant',
    name: 'Fractional CFO\n& Accountant Portal',
    price: '$60/month',
    type: 'accountant',
    color: '#EF4444', // Red/rebellious
    description: 'The secret weapon for accountants and fractional CFOs. DISC-based client communication + full accounting access.',
    keyFeatures: [
      'DISC assessment for client communication',
      'Dual custom reports (client + accountant)',
      'Integrated checklist sync with client books',
      'Full accounting access (not just read-only!)',
      'Multi-client dashboard',
      'White-label option for accounting firms'
    ],
    standaloneAvailable: true,
    integratedInBookkeeping: false,
    charityContribution: '$5/month to your chosen charity'
  }
];

export const ecosystemLinks: EcosystemLink[] = [
  // Hub connections to modules
  { source: 'bookkeeping', target: 'budgeting', type: 'integrated' },
  { source: 'bookkeeping', target: 'debt', type: 'integrated' },
  { source: 'bookkeeping', target: 'service-job', type: 'integrated' },
  { source: 'bookkeeping', target: 'cpg', type: 'integrated' },

  // Accountant portal connection (separate orbit)
  { source: 'bookkeeping', target: 'accountant', type: 'accountant' }
];
