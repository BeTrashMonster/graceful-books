/**
 * Admin Charity Service
 *
 * Handles charity management operations for admin users only.
 * Includes CRUD operations and 5-step verification workflow.
 *
 * Requirements:
 * - IC3: Admin Panel - Charity Management
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import type { Charity, CharityCategory } from '../../types/database.types';
import { CharityStatus } from '../../types/database.types';
import { createDefaultCharity, validateCharity, isValidEIN } from '../../db/schema/charity.schema';

/**
 * Charity creation input
 */
export interface CreateCharityInput {
  name: string;
  ein: string;
  description: string;
  category: CharityCategory;
  website: string;
  logo?: string;
  createdBy: string; // Admin user ID
}

/**
 * Charity update input
 */
export interface UpdateCharityInput {
  name?: string;
  ein?: string;
  description?: string;
  category?: CharityCategory;
  website?: string;
  logo?: string | null;
}

/**
 * Verification note input
 */
export interface AddVerificationNoteInput {
  charityId: string;
  note: string;
}

/**
 * Verification input
 */
export interface VerifyCharityInput {
  charityId: string;
  verifiedBy: string; // Admin user ID
}

/**
 * Rejection input
 */
export interface RejectCharityInput {
  charityId: string;
  reason: string;
  rejectedBy: string; // Admin user ID
}

/**
 * Filter options for charity list
 */
export interface CharityFilterOptions {
  status?: CharityStatus;
  category?: CharityCategory;
  searchTerm?: string;
}

/**
 * Get all charities with optional filters
 */
export async function getAllCharities(filters?: CharityFilterOptions): Promise<Charity[]> {
  try {
    let query = db.charities.toCollection();

    // Apply status filter
    if (filters?.status) {
      query = db.charities.where('status').equals(filters.status);
    }

    // Apply category filter
    if (filters?.category) {
      const statusFiltered = await query.toArray();
      const categoryFiltered = statusFiltered.filter(c => c.category === filters.category);

      // Apply search if provided
      if (filters?.searchTerm) {
        return categoryFiltered.filter(c =>
          c.name.toLowerCase().includes(filters.searchTerm!.toLowerCase()) ||
          c.ein.includes(filters.searchTerm!) ||
          c.description.toLowerCase().includes(filters.searchTerm!.toLowerCase())
        );
      }

      return categoryFiltered;
    }

    const charities = await query.toArray();

    // Apply search filter if provided
    if (filters?.searchTerm) {
      return charities.filter(c =>
        c.name.toLowerCase().includes(filters.searchTerm!.toLowerCase()) ||
        c.ein.includes(filters.searchTerm!) ||
        c.description.toLowerCase().includes(filters.searchTerm!.toLowerCase())
      );
    }

    return charities;
  } catch (error) {
    console.error('Error fetching charities:', error);
    throw new Error('Failed to fetch charities');
  }
}

/**
 * Get charity by ID
 */
export async function getCharityById(id: string): Promise<Charity | undefined> {
  try {
    return await db.charities.get(id);
  } catch (error) {
    console.error('Error fetching charity:', error);
    throw new Error('Failed to fetch charity');
  }
}

/**
 * Get verified charities (for user selection dropdown)
 */
export async function getVerifiedCharities(): Promise<Charity[]> {
  try {
    return await db.charities
      .where('status')
      .equals(CharityStatus.VERIFIED)
      .toArray();
  } catch (error) {
    console.error('Error fetching verified charities:', error);
    throw new Error('Failed to fetch verified charities');
  }
}

/**
 * Create a new charity (starts in PENDING status)
 */
export async function createCharity(input: CreateCharityInput): Promise<Charity> {
  try {
    const charity: Charity = {
      id: uuidv4(),
      ...createDefaultCharity(
        input.name,
        input.ein,
        input.description,
        input.category,
        input.website,
        input.createdBy,
        input.logo
      ),
    } as Charity;

    // Validate charity data
    const errors = validateCharity(charity);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    await db.charities.add(charity);
    return charity;
  } catch (error) {
    console.error('Error creating charity:', error);
    throw error instanceof Error ? error : new Error('Failed to create charity');
  }
}

/**
 * Update charity details
 */
export async function updateCharity(id: string, input: UpdateCharityInput): Promise<Charity> {
  try {
    const existing = await db.charities.get(id);
    if (!existing) {
      throw new Error('Charity not found');
    }

    const updated: Charity = {
      ...existing,
      ...input,
      updated_at: Date.now(),
    };

    // Validate if EIN is being updated
    if (input.ein && !isValidEIN(input.ein)) {
      throw new Error('EIN must be in format XX-XXXXXXX (e.g., 12-3456789)');
    }

    await db.charities.update(id, updated);
    return updated;
  } catch (error) {
    console.error('Error updating charity:', error);
    throw error instanceof Error ? error : new Error('Failed to update charity');
  }
}

/**
 * Add verification note to charity
 * Step 3: IRS verification note
 * Step 4: Website verification note
 */
export async function addVerificationNote(input: AddVerificationNoteInput): Promise<Charity> {
  try {
    const charity = await db.charities.get(input.charityId);
    if (!charity) {
      throw new Error('Charity not found');
    }

    const existingNotes = charity.verification_notes || '';
    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${input.note}`;
    const updatedNotes = existingNotes
      ? `${existingNotes}\n${newNote}`
      : newNote;

    const updated: Charity = {
      ...charity,
      verification_notes: updatedNotes,
      updated_at: Date.now(),
    };

    await db.charities.update(input.charityId, updated);
    return updated;
  } catch (error) {
    console.error('Error adding verification note:', error);
    throw error instanceof Error ? error : new Error('Failed to add verification note');
  }
}

/**
 * Verify charity (Step 5: Final Approval)
 * Changes status from PENDING to VERIFIED
 */
export async function verifyCharity(input: VerifyCharityInput): Promise<Charity> {
  try {
    const charity = await db.charities.get(input.charityId);
    if (!charity) {
      throw new Error('Charity not found');
    }

    if (charity.status !== CharityStatus.PENDING) {
      throw new Error(`Cannot verify charity with status: ${charity.status}`);
    }

    const timestamp = new Date().toISOString();
    const verificationNote = `[${timestamp}] Verified by admin user ${input.verifiedBy}. Status changed from PENDING to VERIFIED.`;
    const updatedNotes = charity.verification_notes
      ? `${charity.verification_notes}\n${verificationNote}`
      : verificationNote;

    const updated: Charity = {
      ...charity,
      status: CharityStatus.VERIFIED,
      verification_notes: updatedNotes,
      updated_at: Date.now(),
    };

    await db.charities.update(input.charityId, updated);

    // Audit log entry would go here (if audit service is available)
    console.log(`Charity ${charity.name} verified by admin ${input.verifiedBy}`);

    return updated;
  } catch (error) {
    console.error('Error verifying charity:', error);
    throw error instanceof Error ? error : new Error('Failed to verify charity');
  }
}

/**
 * Reject charity
 * Changes status from PENDING to REJECTED
 */
export async function rejectCharity(input: RejectCharityInput): Promise<Charity> {
  try {
    const charity = await db.charities.get(input.charityId);
    if (!charity) {
      throw new Error('Charity not found');
    }

    if (charity.status !== CharityStatus.PENDING) {
      throw new Error(`Cannot reject charity with status: ${charity.status}`);
    }

    const timestamp = new Date().toISOString();
    const rejectionNote = `[${timestamp}] Rejected by admin user ${input.rejectedBy}. Reason: ${input.reason}`;
    const updatedNotes = charity.verification_notes
      ? `${charity.verification_notes}\n${rejectionNote}`
      : rejectionNote;

    const updated: Charity = {
      ...charity,
      status: CharityStatus.REJECTED,
      rejection_reason: input.reason,
      verification_notes: updatedNotes,
      updated_at: Date.now(),
    };

    await db.charities.update(input.charityId, updated);

    // Audit log entry would go here (if audit service is available)
    console.log(`Charity ${charity.name} rejected by admin ${input.rejectedBy}: ${input.reason}`);

    return updated;
  } catch (error) {
    console.error('Error rejecting charity:', error);
    throw error instanceof Error ? error : new Error('Failed to reject charity');
  }
}

/**
 * Soft delete charity (mark as INACTIVE)
 */
export async function removeCharity(id: string): Promise<Charity> {
  try {
    const charity = await db.charities.get(id);
    if (!charity) {
      throw new Error('Charity not found');
    }

    const updated: Charity = {
      ...charity,
      status: CharityStatus.INACTIVE,
      active: false,
      updated_at: Date.now(),
    };

    await db.charities.update(id, updated);
    return updated;
  } catch (error) {
    console.error('Error removing charity:', error);
    throw error instanceof Error ? error : new Error('Failed to remove charity');
  }
}

/**
 * Get charity statistics for admin dashboard
 */
export async function getCharityStatistics() {
  try {
    const allCharities = await db.charities.toArray();

    return {
      total: allCharities.length,
      verified: allCharities.filter(c => c.status === CharityStatus.VERIFIED).length,
      pending: allCharities.filter(c => c.status === CharityStatus.PENDING).length,
      rejected: allCharities.filter(c => c.status === CharityStatus.REJECTED).length,
      inactive: allCharities.filter(c => c.status === CharityStatus.INACTIVE).length,
    };
  } catch (error) {
    console.error('Error fetching charity statistics:', error);
    throw new Error('Failed to fetch charity statistics');
  }
}

/**
 * Validate EIN format
 */
export function validateEINFormat(ein: string): { valid: boolean; error?: string } {
  if (!ein || ein.trim() === '') {
    return { valid: false, error: 'EIN is required' };
  }

  if (!isValidEIN(ein)) {
    return { valid: false, error: 'EIN must be in format XX-XXXXXXX (e.g., 12-3456789)' };
  }

  return { valid: true };
}
