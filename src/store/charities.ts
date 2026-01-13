/**
 * Charities Store
 *
 * Provides read-only access to charity data.
 * Charities are pre-defined and not modifiable by users.
 */

import type { Charity, CharityCategory } from '../types/database.types';
import { CHARITIES, getCharityById, getCharitiesByCategory, getActiveCharities } from '../data/charities';

/**
 * Get all active charities
 */
export async function getAllCharities(): Promise<Charity[]> {
  return getActiveCharities();
}

/**
 * Get charity by ID
 */
export async function getCharity(id: string): Promise<Charity | undefined> {
  return getCharityById(id);
}

/**
 * Get charities filtered by category
 */
export async function getCharitiesByFilter(category?: CharityCategory): Promise<Charity[]> {
  if (!category) {
    return getActiveCharities();
  }
  return getCharitiesByCategory(category);
}

/**
 * Search charities by name or description
 */
export async function searchCharities(query: string): Promise<Charity[]> {
  const searchTerm = query.toLowerCase().trim();

  if (!searchTerm) {
    return getActiveCharities();
  }

  return CHARITIES.filter((charity) => {
    if (!charity.active) return false;

    const nameMatch = charity.name.toLowerCase().includes(searchTerm);
    const descriptionMatch = charity.description.toLowerCase().includes(searchTerm);

    return nameMatch || descriptionMatch;
  });
}

/**
 * Get charities grouped by category
 */
export async function getCharitiesGroupedByCategory(): Promise<Map<CharityCategory, Charity[]>> {
  const grouped = new Map<CharityCategory, Charity[]>();

  const activeCharities = getActiveCharities();

  activeCharities.forEach((charity) => {
    const existing = grouped.get(charity.category) || [];
    grouped.set(charity.category, [...existing, charity]);
  });

  return grouped;
}
