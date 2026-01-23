/**
 * Demo Entity Configuration
 *
 * Demo company setup for testing and development.
 * Multi-Member LLC with two owners.
 */

import type { EntityConfiguration, Owner } from '../types'

/**
 * Demo company owners
 */
export const DEMO_OWNERS: Owner[] = [
  {
    id: 'owner-audders',
    name: 'Audders',
    ownershipPercentage: 80,
  },
  {
    id: 'owner-monett',
    name: 'Monett',
    ownershipPercentage: 20,
  },
]

/**
 * Demo company entity configuration
 */
export const DEMO_ENTITY_CONFIG: EntityConfiguration = {
  entityType: 'multi-member-llc',
  owners: DEMO_OWNERS,
  fiscalYearEnd: '12-31',
}

/**
 * Get entity configuration for a company
 * TODO: Replace with database lookup when onboarding is implemented
 */
export function getEntityConfig(companyId: string): EntityConfiguration {
  // For now, return demo config for all companies
  // Later this will query the database
  return DEMO_ENTITY_CONFIG
}
