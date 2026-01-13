/**
 * Contacts Schema Definition
 *
 * Defines the structure for contacts (customers and vendors).
 * Supports tracking customer receivables and vendor payables.
 *
 * Requirements:
 * - Customer and vendor management
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { Contact, ContactType } from '../../types/database.types';
import { ContactAccountType } from '../../types/database.types';

/**
 * Dexie.js schema definition for Contacts table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying contacts by company
 * - type: For querying by contact type (CUSTOMER, VENDOR, BOTH)
 * - active: For querying only active contacts
 * - parent_id: For querying sub-accounts (G3: Hierarchical Contacts)
 * - account_type: For querying by hierarchy type (G3: Hierarchical Contacts)
 * - [company_id+type]: Compound index for filtered queries
 * - [company_id+active]: Compound index for active contact queries
 * - [company_id+parent_id]: Compound index for hierarchy queries (G3)
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const contactsSchema = 'id, company_id, type, active, parent_id, account_type, [company_id+type], [company_id+active], [company_id+parent_id], updated_at, deleted_at';

/**
 * Table name constant
 */
export const CONTACTS_TABLE = 'contacts';

/**
 * Default values for new Contact
 */
export const createDefaultContact = (
  companyId: string,
  name: string,
  type: ContactType,
  deviceId: string
): Partial<Contact> => {
  const now = Date.now();

  return {
    company_id: companyId,
    type,
    name,
    email: null,
    phone: null,
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance: '0.00',
    // G3: Hierarchical Contacts - default to standalone
    parent_id: null,
    account_type: ContactAccountType.STANDALONE,
    hierarchy_level: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure contact has valid fields
 */
export const validateContact = (contact: Partial<Contact>): string[] => {
  const errors: string[] = [];

  if (!contact.company_id) {
    errors.push('company_id is required');
  }

  if (!contact.name || contact.name.trim() === '') {
    errors.push('name is required');
  }

  if (!contact.type) {
    errors.push('type is required');
  }

  if (contact.balance === undefined || contact.balance === null) {
    errors.push('balance is required');
  }

  // Optional: validate email format if provided
  if (contact.email && !isValidEmail(contact.email)) {
    errors.push('email format is invalid');
  }

  // Optional: validate phone format if provided
  if (contact.phone && !isValidPhone(contact.phone)) {
    errors.push('phone format is invalid');
  }

  return errors;
};

/**
 * Helper: Validate email format
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Helper: Validate phone format (basic validation)
 */
const isValidPhone = (phone: string): boolean => {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  // Check if it has at least 10 digits (flexible for international)
  return digitsOnly.length >= 10;
};

/**
 * Query helper: Get all contacts for a company
 */
export interface GetContactsQuery {
  company_id: string;
  type?: ContactType;
  active?: boolean;
  search?: string; // Search by name, email, or phone
}

/**
 * Contact summary for reporting
 */
export interface ContactSummary extends Contact {
  total_invoices?: number;
  total_payments?: number;
  last_transaction_date?: number;
  aging_30_days?: string;
  aging_60_days?: string;
  aging_90_days?: string;
  aging_over_90_days?: string;
}

/**
 * Contact balance calculation
 */
export interface ContactBalance {
  contact_id: string;
  total_invoiced: string;
  total_paid: string;
  balance: string;
}

/**
 * Helper: Format contact name for display
 * Handles business names vs. personal names
 */
export const formatContactName = (contact: Contact): string => {
  return contact.name.trim();
};

/**
 * Helper: Format contact address for display
 */
export const formatContactAddress = (contact: Contact): string => {
  if (!contact.address) {
    return '';
  }
  return contact.address.trim();
};

/**
 * Helper: Get contact display type
 */
export const getContactTypeDisplay = (type: ContactType): string => {
  const displays: Record<ContactType, string> = {
    CUSTOMER: 'Customer',
    VENDOR: 'Vendor',
    BOTH: 'Customer & Vendor',
  };
  return displays[type];
};

/**
 * Helper: Determine if contact is a customer
 */
export const isCustomer = (contact: Contact): boolean => {
  return contact.type === 'CUSTOMER' || contact.type === 'BOTH';
};

/**
 * Helper: Determine if contact is a vendor
 */
export const isVendor = (contact: Contact): boolean => {
  return contact.type === 'VENDOR' || contact.type === 'BOTH';
};

/**
 * Contact aging buckets for AR/AP reporting
 */
export interface ContactAging {
  contact_id: string;
  contact_name: string;
  current: string; // 0-30 days
  aging_30: string; // 31-60 days
  aging_60: string; // 61-90 days
  aging_90: string; // 91+ days
  total_balance: string;
}

/**
 * Standard contact fields for quick entry
 */
export interface ContactQuickEntry {
  name: string;
  email?: string;
  phone?: string;
}

/**
 * Helper: Merge duplicate contacts
 * Used when two contacts are identified as the same entity
 */
export interface ContactMergeOptions {
  keep_contact_id: string;
  merge_contact_id: string;
  preferred_name?: string;
  preferred_email?: string;
  preferred_phone?: string;
  preferred_address?: string;
}

/**
 * Helper: Search contacts by multiple fields
 */
export const searchContacts = (
  contacts: Contact[],
  searchTerm: string
): Contact[] => {
  const term = searchTerm.toLowerCase().trim();

  if (!term) {
    return contacts;
  }

  return contacts.filter((contact) => {
    return (
      contact.name.toLowerCase().includes(term) ||
      contact.email?.toLowerCase().includes(term) ||
      contact.phone?.includes(term) ||
      contact.address?.toLowerCase().includes(term)
    );
  });
};
