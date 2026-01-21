/**
 * Charity Seed Data
 *
 * Seeds the database with 15 well-known verified charities across categories.
 * For development and testing purposes.
 *
 * Requirements:
 * - IC3: Admin Panel - Charity Management (seed script for initial charity list)
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../index';
import type { Charity } from '../../types/database.types';
import { CharityCategory, CharityStatus } from '../../types/database.types';

const SEED_CHARITIES: Omit<Charity, 'id' | 'created_at' | 'updated_at'>[] = [
  // Education
  {
    name: 'Khan Academy',
    ein: '26-1544963',
    description: 'Free world-class education for anyone, anywhere. Providing high-quality educational resources to students worldwide.',
    category: CharityCategory.EDUCATION,
    website: 'https://www.khanacademy.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },
  {
    name: 'Teach For America',
    ein: '13-3541913',
    description: 'Works to ensure all children have access to an excellent education by recruiting and developing leaders.',
    category: CharityCategory.EDUCATION,
    website: 'https://www.teachforamerica.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },

  // Environment
  {
    name: 'The Nature Conservancy',
    ein: '53-0242652',
    description: 'Works to protect ecologically important lands and waters for nature and people around the world.',
    category: CharityCategory.ENVIRONMENT,
    website: 'https://www.nature.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },
  {
    name: 'World Wildlife Fund',
    ein: '52-1693387',
    description: 'Leading conservation organization working to protect wildlife and endangered species worldwide.',
    category: CharityCategory.ENVIRONMENT,
    website: 'https://www.worldwildlife.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },

  // Health
  {
    name: 'St. Jude Children\'s Research Hospital',
    ein: '62-0646012',
    description: 'Leading the way the world understands, treats and defeats childhood cancer and other life-threatening diseases.',
    category: CharityCategory.HEALTH,
    website: 'https://www.stjude.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },
  {
    name: 'Doctors Without Borders',
    ein: '13-3433452',
    description: 'Provides emergency medical aid to people affected by conflict, epidemics, disasters, or exclusion from healthcare.',
    category: CharityCategory.HEALTH,
    website: 'https://www.doctorswithoutborders.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },

  // Poverty
  {
    name: 'Feeding America',
    ein: '36-3673599',
    description: 'Nationwide network of food banks feeding millions of people through food pantries and meal programs.',
    category: CharityCategory.POVERTY,
    website: 'https://www.feedingamerica.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },
  {
    name: 'GiveDirectly',
    ein: '27-1661997',
    description: 'Sends money directly to people living in extreme poverty through mobile payments with no strings attached.',
    category: CharityCategory.POVERTY,
    website: 'https://www.givedirectly.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },

  // Animal Welfare
  {
    name: 'American Society for the Prevention of Cruelty to Animals',
    ein: '13-1623829',
    description: 'Works to rescue animals from abuse, pass humane laws, and share resources with shelters nationwide.',
    category: CharityCategory.ANIMAL_WELFARE,
    website: 'https://www.aspca.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },

  // Human Rights
  {
    name: 'American Civil Liberties Union Foundation',
    ein: '13-6213516',
    description: 'Defends and preserves individual rights and liberties guaranteed by the Constitution and laws of the United States.',
    category: CharityCategory.HUMAN_RIGHTS,
    website: 'https://www.aclu.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },

  // Disaster Relief
  {
    name: 'American Red Cross',
    ein: '53-0196605',
    description: 'Prevents and alleviates human suffering in the face of emergencies by mobilizing volunteers and donors.',
    category: CharityCategory.DISASTER_RELIEF,
    website: 'https://www.redcross.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },

  // Arts & Culture
  {
    name: 'The Metropolitan Museum of Art',
    ein: '13-1624086',
    description: 'Collects, studies, conserves, and presents significant works of art across cultures and time periods.',
    category: CharityCategory.ARTS_CULTURE,
    website: 'https://www.metmuseum.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },

  // Community
  {
    name: 'Habitat for Humanity International',
    ein: '91-1914868',
    description: 'Brings people together to build homes, communities, and hope. Helps families build and improve places to call home.',
    category: CharityCategory.COMMUNITY,
    website: 'https://www.habitat.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },
  {
    name: 'United Way Worldwide',
    ein: '13-1635294',
    description: 'Advances the common good by creating opportunities for better lives in communities across the world.',
    category: CharityCategory.COMMUNITY,
    website: 'https://www.unitedway.org',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Verified 501(c)(3). Active on IRS EOS.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },

  // Default "Graceful Books Community Fund"
  {
    name: 'Graceful Books Community Fund',
    ein: '99-9999999',
    description: 'Default charity supporting financial literacy and entrepreneurship education for underserved communities.',
    category: CharityCategory.EDUCATION,
    website: 'https://gracefulbooks.com/community-fund',
    logo: null,
    status: CharityStatus.VERIFIED,
    verification_notes: 'Internal charity. Verified for platform use.',
    rejection_reason: null,
    created_by: 'system',
    active: true,
  },
];

/**
 * Seed the charities table with initial data
 */
export async function seedCharities() {
  try {
    // Check if charities already exist
    const existingCount = await db.charities.count();
    if (existingCount > 0) {
      console.log(`Charities table already has ${existingCount} entries. Skipping seed.`);
      return;
    }

    const now = Date.now();
    const charitiesWithIds: Charity[] = SEED_CHARITIES.map((charity) => ({
      id: uuidv4(),
      ...charity,
      created_at: now,
      updated_at: now,
    }));

    await db.charities.bulkAdd(charitiesWithIds);
    console.log(`Successfully seeded ${charitiesWithIds.length} charities.`);
  } catch (error) {
    console.error('Error seeding charities:', error);
    throw error;
  }
}

/**
 * Clear all charities from the table
 * Use with caution! This will delete all charity data.
 */
export async function clearCharities() {
  try {
    await db.charities.clear();
    console.log('Successfully cleared all charities.');
  } catch (error) {
    console.error('Error clearing charities:', error);
    throw error;
  }
}

/**
 * Reseed charities (clear and seed)
 */
export async function reseedCharities() {
  await clearCharities();
  await seedCharities();
}
