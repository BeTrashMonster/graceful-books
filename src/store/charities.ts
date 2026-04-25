/**
 * Charities Store
 *
 * Provides read-only access to charity data from the API.
 * Charities are managed through the admin dashboard.
 */

import type { Charity, CharityCategory } from '../types/database.types';
import { getCharities } from '../services/charities.api';

/**
 * Get all active charities from the API
 */
export async function getAllCharities(): Promise<Charity[]> {
  return getCharities();
}

/**
 * Get charity by ID
 */
export async function getCharity(id: string): Promise<Charity | undefined> {
  const charities = await getCharities();
  return charities.find(c => c.id === id);
}

/**
 * Get charities filtered by category
 */
export async function getCharitiesByFilter(category?: CharityCategory): Promise<Charity[]> {
  const charities = await getCharities();

  if (!category) {
    return charities;
  }

  return charities.filter(c => c.category === category);
}

/**
 * Search charities by name or description
 */
export async function searchCharities(query: string): Promise<Charity[]> {
  const charities = await getCharities();
  const searchTerm = query.toLowerCase().trim();

  if (!searchTerm) {
    return charities;
  }

  return charities.filter((charity) => {
    const nameMatch = charity.name.toLowerCase().includes(searchTerm);
    const shortDescMatch = charity.shortDescription?.toLowerCase().includes(searchTerm);
    const longDescMatch = charity.longDescription?.toLowerCase().includes(searchTerm);

    return nameMatch || shortDescMatch || longDescMatch;
  });
}

/**
 * Get charities grouped by category
 */
export async function getCharitiesGroupedByCategory(): Promise<Map<CharityCategory, Charity[]>> {
  const charities = await getCharities();
  const grouped = new Map<CharityCategory, Charity[]>();

  charities.forEach((charity) => {
    const existing = grouped.get(charity.category) || [];
    grouped.set(charity.category, [...existing, charity]);
  });

  return grouped;
}
