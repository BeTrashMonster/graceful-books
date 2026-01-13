# Capability Spec: Feature Visibility

## Overview
The Feature Visibility capability implements progressive feature disclosure based on the user's current phase. It prevents overwhelm by hiding advanced features while keeping them accessible for curious users, and creates satisfying "unlock" moments as users progress.

## ADDED Requirements


### PFD-001: Feature Revelation System
**Priority:** High
**Category:** User Experience

The system SHALL implement progressive feature disclosure where:

1. All features are technically available from day one
2. Interface shows only features relevant to current phase
3. Users can access hidden features through intentional exploration
4. Features unlock naturally as checklist items complete

**HIDDEN FEATURE ACCESS METHODS:**

The system will implement a **Roadmap View** approach:
- Visual journey map showing all features
- Current location highlighted
- Can "peek ahead" at future features
- Click to access any feature with "early access" confirmation

**ACCEPTANCE CRITERIA:**
- [ ] Core accounting features accessible regardless of phase
- [ ] Progressive disclosure doesn't block critical functions
- [ ] "Show all features" override available in settings
- [ ] Feature unlock notifications are encouraging, not restrictive

### PFD-002: Phase-Based Interface
**Priority:** High
**Category:** User Experience

Default visible features by phase:

**STABILIZE PHASE**
- Dashboard (simplified)
- Bank accounts setup
- Transaction entry (basic)
- Receipt capture
- Basic categorization
- Getting started checklist

**ORGANIZE PHASE**
- All Stabilize features +
- Chart of accounts (full)
- Bank reconciliation
- Invoice creation (basic)
- Expense tracking
- Basic reports (P&L, Balance Sheet)
- Vendor management

**BUILD PHASE**
- All Organize features +
- Advanced invoicing (recurring, deposits)
- Bill management
- Class/category tracking
- Custom reports
- Journal entries
- Inventory (basic)

**GROW PHASE**
- All Build features +
- Multi-currency
- Advanced inventory
- Sales tax automation
- Forecasting
- Team collaboration (full)
- API access
- 3D financial visualization

**ACCEPTANCE CRITERIA:**
- [ ] Each phase has defined feature set
- [ ] Transitions between phases are smooth
- [ ] Users understand how to access hidden features
- [ ] "Early access" to locked features works correctly

## Data Models

### FeatureVisibilityProfile
```typescript
interface FeatureVisibilityProfile {
  id: string;
  userId: string;
  currentPhase: Phase;

  // Feature access
  visibleFeatures: string[]; // Feature IDs currently visible
  unlockedFeatures: string[]; // Features unlocked early
  hiddenFeatures: string[]; // Features hidden in current phase

  // Settings
  showAllFeatures: boolean; // Override to show everything
  showLockedFeaturePreviews: boolean; // Show dimmed locked features

  // Unlock history
  unlocks: FeatureUnlock[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

interface FeatureUnlock {
  featureId: string;
  unlockedAt: Date;
  reason: 'phase-progression' | 'checklist-completion' | 'manual-unlock' | 'setting-override';
  notificationShown: boolean;
}

interface Feature {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;

  // Visibility rules
  minPhase: Phase;
  unlockConditions?: UnlockCondition[];

  // UI presentation
  category: FeatureCategory;
  order: number;

  // Educational content
  learnMoreUrl?: string;
  previewDescription: string; // Shown when locked
  unlockMessage: string; // Shown when unlocked

  // Feature flags
  betaFeature: boolean;
  requiresSubscription: boolean;
}

type Phase = 'stabilize' | 'organize' | 'build' | 'grow';

type FeatureCategory =
  | 'core-accounting'
  | 'transactions'
  | 'invoicing'
  | 'reporting'
  | 'advanced'
  | 'team'
  | 'integrations';

interface UnlockCondition {
  type: 'checklist-item' | 'transaction-count' | 'manual';
  checklistItemId?: string;
  transactionCount?: number;
  description: string;
}
```

## Feature Registry

### Core Features Definition
```typescript
const FEATURES: Feature[] = [
  // STABILIZE PHASE
  {
    id: 'dashboard-simple',
    name: 'Dashboard',
    description: 'Your financial overview at a glance',
    icon: 'home',
    route: '/dashboard',
    minPhase: 'stabilize',
    category: 'core-accounting',
    order: 1,
    previewDescription: 'Always available',
    unlockMessage: '',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'transaction-entry-basic',
    name: 'Transaction Entry',
    description: 'Record income and expenses',
    icon: 'receipt',
    route: '/transactions',
    minPhase: 'stabilize',
    category: 'transactions',
    order: 2,
    previewDescription: 'Always available',
    unlockMessage: '',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'receipt-capture',
    name: 'Receipt Capture',
    description: 'Upload and organize receipts',
    icon: 'camera',
    route: '/receipts',
    minPhase: 'stabilize',
    category: 'transactions',
    order: 3,
    previewDescription: 'Always available',
    unlockMessage: '',
    betaFeature: false,
    requiresSubscription: false
  },

  // ORGANIZE PHASE
  {
    id: 'chart-of-accounts-full',
    name: 'Chart of Accounts',
    description: 'Manage your account structure',
    icon: 'list',
    route: '/chart-of-accounts',
    minPhase: 'organize',
    category: 'core-accounting',
    order: 10,
    previewDescription: 'Set up your account structure as your bookkeeping matures',
    unlockMessage: 'You\'re ready for a complete chart of accounts!',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'bank-reconciliation',
    name: 'Bank Reconciliation',
    description: 'Match your records to bank statements',
    icon: 'check-circle',
    route: '/reconciliation',
    minPhase: 'organize',
    category: 'core-accounting',
    order: 11,
    unlockConditions: [
      {
        type: 'checklist-item',
        checklistItemId: 'gather-bank-statements',
        description: 'Complete "Gather bank statements" task'
      }
    ],
    previewDescription: 'Ensure accuracy by matching your books to your bank',
    unlockMessage: 'Bank reconciliation unlocked! Keep your books accurate.',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'invoicing-basic',
    name: 'Invoicing',
    description: 'Create and send professional invoices',
    icon: 'file-text',
    route: '/invoices',
    minPhase: 'organize',
    category: 'invoicing',
    order: 12,
    previewDescription: 'Send professional invoices to your clients',
    unlockMessage: 'Invoicing is ready! Start billing your clients.',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'reports-basic',
    name: 'Basic Reports',
    description: 'Profit & Loss and Balance Sheet',
    icon: 'bar-chart',
    route: '/reports',
    minPhase: 'organize',
    category: 'reporting',
    order: 13,
    unlockConditions: [
      {
        type: 'transaction-count',
        transactionCount: 20,
        description: 'Record at least 20 transactions'
      }
    ],
    previewDescription: 'See how your business is performing financially',
    unlockMessage: 'Reports unlocked! See your financial performance.',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'vendor-management',
    name: 'Vendor Management',
    description: 'Track who you pay',
    icon: 'users',
    route: '/vendors',
    minPhase: 'organize',
    category: 'transactions',
    order: 14,
    previewDescription: 'Organize your vendors and suppliers',
    unlockMessage: 'Vendor management ready! Organize who you pay.',
    betaFeature: false,
    requiresSubscription: false
  },

  // BUILD PHASE
  {
    id: 'invoicing-advanced',
    name: 'Advanced Invoicing',
    description: 'Recurring invoices, deposits, and more',
    icon: 'file-plus',
    route: '/invoices/advanced',
    minPhase: 'build',
    category: 'invoicing',
    order: 20,
    previewDescription: 'Automate invoicing with recurring billing',
    unlockMessage: 'Advanced invoicing unlocked! Automate your billing.',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'bill-management',
    name: 'Bill Management',
    description: 'Track and pay vendor bills',
    icon: 'credit-card',
    route: '/bills',
    minPhase: 'build',
    category: 'transactions',
    order: 21,
    previewDescription: 'Track what you owe to vendors',
    unlockMessage: 'Bill management ready! Track what you owe.',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'classes-categories',
    name: 'Classes & Categories',
    description: 'Multi-dimensional tracking',
    icon: 'tag',
    route: '/classes',
    minPhase: 'build',
    category: 'core-accounting',
    order: 22,
    previewDescription: 'Track your business from different angles',
    unlockMessage: 'Classes & categories unlocked! Track multiple dimensions.',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'custom-reports',
    name: 'Custom Reports',
    description: 'Build reports tailored to your needs',
    icon: 'pie-chart',
    route: '/reports/custom',
    minPhase: 'build',
    category: 'reporting',
    order: 23,
    previewDescription: 'Create reports that answer your specific questions',
    unlockMessage: 'Custom reports unlocked! Build your own insights.',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'journal-entries',
    name: 'Journal Entries',
    description: 'Advanced accounting adjustments',
    icon: 'edit',
    route: '/journal',
    minPhase: 'build',
    category: 'core-accounting',
    order: 24,
    previewDescription: 'Make manual adjustments when needed',
    unlockMessage: 'Journal entries unlocked! Make advanced adjustments.',
    betaFeature: false,
    requiresSubscription: false
  },
  {
    id: 'inventory-basic',
    name: 'Inventory Tracking',
    description: 'Track product stock levels',
    icon: 'package',
    route: '/inventory',
    minPhase: 'build',
    category: 'advanced',
    order: 25,
    previewDescription: 'Track what you have in stock',
    unlockMessage: 'Inventory tracking ready! Monitor your stock.',
    betaFeature: false,
    requiresSubscription: false
  },

  // GROW PHASE
  {
    id: 'multi-currency',
    name: 'Multi-Currency',
    description: 'Handle foreign transactions',
    icon: 'dollar-sign',
    route: '/settings/currency',
    minPhase: 'grow',
    category: 'advanced',
    order: 30,
    previewDescription: 'Work with international clients and vendors',
    unlockMessage: 'Multi-currency ready! Go global.',
    betaFeature: false,
    requiresSubscription: true
  },
  {
    id: 'inventory-advanced',
    name: 'Advanced Inventory',
    description: 'FIFO, LIFO, weighted average',
    icon: 'package',
    route: '/inventory/advanced',
    minPhase: 'grow',
    category: 'advanced',
    order: 31,
    previewDescription: 'Advanced valuation methods for inventory',
    unlockMessage: 'Advanced inventory unlocked! Choose your valuation method.',
    betaFeature: false,
    requiresSubscription: true
  },
  {
    id: 'forecasting',
    name: 'Financial Forecasting',
    description: 'Predict future cash flow',
    icon: 'trending-up',
    route: '/forecasting',
    minPhase: 'grow',
    category: 'reporting',
    order: 32,
    previewDescription: 'See where your business is headed',
    unlockMessage: 'Forecasting unlocked! Predict your future.',
    betaFeature: true,
    requiresSubscription: true
  },
  {
    id: 'team-collaboration',
    name: 'Team Collaboration',
    description: 'Multi-user access and permissions',
    icon: 'users',
    route: '/team',
    minPhase: 'grow',
    category: 'team',
    order: 33,
    previewDescription: 'Invite team members to collaborate',
    unlockMessage: 'Team features unlocked! Collaborate with your team.',
    betaFeature: false,
    requiresSubscription: true
  },
  {
    id: 'api-access',
    name: 'API Access',
    description: 'Build custom integrations',
    icon: 'code',
    route: '/settings/api',
    minPhase: 'grow',
    category: 'integrations',
    order: 34,
    previewDescription: 'Integrate with your other tools',
    unlockMessage: 'API access ready! Build custom integrations.',
    betaFeature: true,
    requiresSubscription: true
  },
  {
    id: 'viz-3d',
    name: '3D Visualization',
    description: 'Interactive financial visualizations',
    icon: 'box',
    route: '/visualizations',
    minPhase: 'grow',
    category: 'reporting',
    order: 35,
    previewDescription: 'See your finances in a whole new dimension',
    unlockMessage: '3D visualizations unlocked! Explore your data.',
    betaFeature: true,
    requiresSubscription: true
  }
];
```

## API

### Feature Visibility API
```typescript
interface FeatureVisibilityEngine {
  // Feature access queries
  getVisibleFeatures(userId: string): Promise<Feature[]>;
  getHiddenFeatures(userId: string): Promise<Feature[]>;
  getAllFeatures(): Promise<Feature[]>;
  isFeatureVisible(userId: string, featureId: string): Promise<boolean>;
  canAccessFeature(userId: string, featureId: string): Promise<AccessResult>;

  // Phase management
  updatePhase(userId: string, newPhase: Phase): Promise<FeatureVisibilityProfile>;
  getPhase(userId: string): Promise<Phase>;

  // Manual unlocking
  unlockFeature(
    userId: string,
    featureId: string,
    reason: string
  ): Promise<FeatureUnlock>;

  lockFeature(userId: string, featureId: string): Promise<void>;

  // Settings
  setShowAllFeatures(userId: string, show: boolean): Promise<void>;
  setShowLockedPreviews(userId: string, show: boolean): Promise<void>;

  // Notifications
  getPendingUnlockNotifications(userId: string): Promise<FeatureUnlock[]>;
  markUnlockNotificationShown(unlockId: string): Promise<void>;

  // Roadmap
  getRoadmap(userId: string): Promise<FeatureRoadmap>;
}

interface AccessResult {
  canAccess: boolean;
  reason?: string;
  unlockConditions?: UnlockCondition[];
  requiresSubscription?: boolean;
}

interface FeatureRoadmap {
  currentPhase: Phase;
  phases: PhaseRoadmap[];
  totalFeatures: number;
  unlockedFeatures: number;
  percentUnlocked: number;
}

interface PhaseRoadmap {
  phase: Phase;
  name: string;
  description: string;
  isCurrent: boolean;
  isUnlocked: boolean;
  features: Feature[];
  unlockedCount: number;
  totalCount: number;
}
```

## Business Logic

### Feature Visibility Determination
```typescript
function determineVisibleFeatures(
  userId: string,
  profile: FeatureVisibilityProfile
): Feature[] {
  // Override: show all features
  if (profile.showAllFeatures) {
    return getAllFeatures();
  }

  const allFeatures = getAllFeatures();
  const userPhase = profile.currentPhase;
  const phaseOrder = ['stabilize', 'organize', 'build', 'grow'];
  const userPhaseIndex = phaseOrder.indexOf(userPhase);

  return allFeatures.filter(feature => {
    const featurePhaseIndex = phaseOrder.indexOf(feature.minPhase);

    // Feature's minimum phase is <= user's current phase
    if (featurePhaseIndex <= userPhaseIndex) {
      return true;
    }

    // Feature manually unlocked early
    if (profile.unlockedFeatures.includes(feature.id)) {
      return true;
    }

    // Unlock conditions met
    if (checkUnlockConditions(feature, userId)) {
      return true;
    }

    return false;
  });
}

function checkUnlockConditions(
  feature: Feature,
  userId: string
): boolean {
  if (!feature.unlockConditions) {
    return false;
  }

  return feature.unlockConditions.every(condition => {
    switch (condition.type) {
      case 'checklist-item':
        return isChecklistItemComplete(userId, condition.checklistItemId!);

      case 'transaction-count':
        return getTransactionCount(userId) >= condition.transactionCount!;

      case 'manual':
        return false; // Must be unlocked manually

      default:
        return false;
    }
  });
}
```

### Phase Transition Logic
```typescript
function handlePhaseTransition(
  userId: string,
  oldPhase: Phase,
  newPhase: Phase
): FeatureUnlock[] {
  const newlyUnlockedFeatures: FeatureUnlock[] = [];
  const allFeatures = getAllFeatures();

  const phaseOrder = ['stabilize', 'organize', 'build', 'grow'];
  const oldIndex = phaseOrder.indexOf(oldPhase);
  const newIndex = phaseOrder.indexOf(newPhase);

  // Only unlock if progressing forward
  if (newIndex <= oldIndex) {
    return [];
  }

  // Find all features that should unlock with new phase
  allFeatures.forEach(feature => {
    const featurePhaseIndex = phaseOrder.indexOf(feature.minPhase);

    // Feature is now accessible
    if (featurePhaseIndex > oldIndex && featurePhaseIndex <= newIndex) {
      newlyUnlockedFeatures.push({
        featureId: feature.id,
        unlockedAt: new Date(),
        reason: 'phase-progression',
        notificationShown: false
      });
    }
  });

  return newlyUnlockedFeatures;
}
```

### Early Access Confirmation
```typescript
function requestEarlyAccess(
  userId: string,
  featureId: string
): EarlyAccessRequest {
  const feature = getFeature(featureId);
  const userProfile = getFeatureVisibilityProfile(userId);

  // Already unlocked
  if (userProfile.unlockedFeatures.includes(featureId)) {
    return {
      granted: true,
      feature,
      message: 'This feature is already unlocked for you.'
    };
  }

  // Check subscription requirement
  if (feature.requiresSubscription && !hasSubscription(userId)) {
    return {
      granted: false,
      feature,
      message: 'This feature requires a subscription.',
      upgradeUrl: '/settings/billing'
    };
  }

  // Check if too far ahead
  const phaseDistance = getPhaseDistance(
    userProfile.currentPhase,
    feature.minPhase
  );

  if (phaseDistance > 1) {
    return {
      granted: false,
      feature,
      message: `This feature is designed for the ${feature.minPhase} phase. You might find it overwhelming right now, but you can still access it if you'd like.`,
      warningLevel: 'high'
    };
  }

  // Grant early access
  return {
    granted: true,
    feature,
    message: `You're accessing ${feature.name} a bit early. We recommend completing your current phase tasks first, but it's yours to explore!`,
    warningLevel: 'low'
  };
}
```

## UI Components

### FeatureRoadmapView
Visual roadmap showing all features organized by phase.

**Props:**
- `userId: string`
- `onFeatureClick: (feature: Feature) => void`

**Features:**
- Vertical timeline with 4 phase sections
- Current phase highlighted
- Locked features dimmed with lock icon
- Unlocked features bright with checkmark
- Peek preview on hover (locked features)
- Click to request early access

### FeatureUnlockNotification
Toast/modal notification when feature unlocks.

**Props:**
- `unlock: FeatureUnlock`
- `feature: Feature`
- `onDismiss: () => void`
- `onExplore: () => void`

**Features:**
- Celebratory animation (gentle sparkle/glow)
- Feature icon and name
- Unlock message
- "Explore now" button
- "Dismiss" button
- Auto-dismiss after 10 seconds

### LockedFeaturePreview
Preview card for locked features.

**Props:**
- `feature: Feature`
- `currentPhase: Phase`
- `onRequestAccess: () => void`

**Features:**
- Dimmed/grayed appearance
- Lock icon
- Feature name and preview description
- "Coming in [Phase]" badge
- "Access early" button
- Tooltip with unlock conditions

### EarlyAccessDialog
Confirmation dialog for accessing locked features.

**Props:**
- `feature: Feature`
- `accessRequest: EarlyAccessRequest`
- `onConfirm: () => void`
- `onCancel: () => void`

**Features:**
- Feature description
- Warning message (if applicable)
- "I understand" checkbox
- Confirm/Cancel buttons
- Subscription upsell (if required)

### NavigationMenu
Enhanced navigation with feature visibility integration.

**Props:**
- `userId: string`
- `currentRoute: string`

**Features:**
- Only shows visible features
- "More features" section (collapsed by default)
- Roadmap link in footer
- Phase indicator badge
- Feature unlock badge (new feature available)

## User Experience

### Unlock Notifications
**Timing:**
- Show immediately when feature unlocks
- Queue if multiple features unlock at once
- Show one at a time with 2-second delay between

**Tone:**
- Celebratory but not overwhelming
- Focus on value ("Now you can...")
- No FOMO language

**Examples:**
- "Bank reconciliation unlocked! Keep your books accurate and catch errors early."
- "Custom reports ready! Build reports that answer your specific business questions."
- "You've reached the Build phase! 6 new features are now available."

### Locked Feature Messaging
**Empowering, not restrictive:**
- ❌ "This feature is locked"
- ✅ "This feature becomes available in the Organize phase"

**Educational:**
- ❌ "Upgrade to access"
- ✅ "Advanced inventory helps you track FIFO, LIFO, and weighted average valuation"

**Curious-friendly:**
- ❌ "Access denied"
- ✅ "Want to peek ahead? You can access this now, though it's designed for later."

### Roadmap View
**Visual Design:**
- Vertical timeline with 4 sections (phases)
- Current phase highlighted with glow/border
- Progress bar showing completion within phase
- Features as cards within each phase section

**Interactivity:**
- Hover locked feature for preview
- Click unlocked feature to navigate
- Click locked feature for early access dialog
- Filter by category (optional)

## Testing Requirements

### Unit Tests
- Feature visibility logic by phase
- Unlock condition checking
- Phase transition unlock detection
- Early access permission logic

### Integration Tests
- Feature unlock flow end-to-end
- Phase transition with notifications
- Early access request and grant
- Settings override (show all features)

### User Testing
- Users understand locked vs. unlocked
- Early access option is discoverable
- Unlock notifications feel rewarding
- Roadmap helps users understand progression
- No critical workflows blocked by visibility rules

## Performance Requirements
- Feature visibility check <50ms
- Roadmap render <500ms
- Unlock notification display <100ms
- Navigation menu render <200ms

## Accessibility
- Locked features have clear ARIA labels
- Unlock notifications announced to screen readers
- Keyboard navigation for roadmap
- High contrast mode for locked/unlocked states
- WCAG 2.1 AA compliance

## Security
- Feature visibility enforced on backend
- Cannot bypass visibility rules via URL manipulation
- Subscription requirements checked server-side
- Audit log of manual unlocks

## Future Enhancements
- A/B test different unlock metaphors (roadmap vs. building vs. calculator)
- Feature usage analytics to refine phase assignments
- Personalized unlock suggestions based on behavior
- Team-wide feature visibility (admin controls for teams)
- Feature voting (request features from higher phases)
