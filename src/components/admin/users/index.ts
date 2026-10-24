/**
 * Admin User Components Index
 *
 * Exports all components for the admin user list and details views.
 */

// Badge components
export { StatusBadge, WorkshopBadge, TagBadge } from './StatusBadge';
export type { StatusBadgeProps, WorkshopBadgeProps, TagBadgeProps } from './StatusBadge';

// Filter bar
export { UserFilterBar } from './UserFilterBar';
export type { UserFilters, FilterOptions } from './UserFilterBar';

// User row
export { UserRow, UserRowHeader } from './UserRow';
export type {
  UserStatusBadge,
  UserWorkshop,
  UserRowData,
} from './UserRow';

// Info card
export { InfoCard, InfoSection, InfoGrid, QuickStat } from './InfoCard';
export type { InfoItem } from './InfoCard';

// Expanded panel
export { UserExpandedPanel } from './UserExpandedPanel';
export type {
  EmailHistoryItem,
  NotePreview,
  UserExpandedData,
} from './UserExpandedPanel';

// Subscription management
export { SubscriptionManagement } from './SubscriptionManagement';
export type { SubscriptionManagementProps, SubscriptionData } from './SubscriptionManagement';
