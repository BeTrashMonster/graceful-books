/**
 * Charities Data
 *
 * Pre-defined list of charitable organizations that users can support.
 * Users select one charity during signup, and $5 from their monthly
 * subscription goes to their chosen cause.
 */

import { nanoid } from 'nanoid';
import type { Charity } from '../types/database.types';
import { CharityCategory, CharityStatus } from '../types/database.types';

/**
 * Available charities for user selection
 * Each charity receives $5/month from the user's subscription
 */
export const CHARITIES: Charity[] = [
  {
    id: nanoid(),
    name: 'Khan Academy',
    ein: '26-1544963',
    description: 'Free, world-class education for anyone, anywhere. Providing educational resources for students globally.',
    category: CharityCategory.EDUCATION,
    website: 'https://www.khanacademy.org',
    logo: 'khan-academy',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'GiveDirectly',
    ein: '27-1661997',
    description: 'Direct cash transfers to people living in extreme poverty. Empowering recipients to decide what they need most.',
    category: CharityCategory.POVERTY,
    website: 'https://www.givedirectly.org',
    logo: 'givedirectly',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'Charity: Water',
    ein: '22-3936753',
    description: 'Bringing clean and safe drinking water to people in developing countries around the world.',
    category: CharityCategory.HEALTH,
    website: 'https://www.charitywater.org',
    logo: 'charity-water',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'Doctors Without Borders',
    ein: '13-3433452',
    description: 'Providing emergency medical aid to people affected by conflict, epidemics, disasters, or exclusion from healthcare.',
    category: CharityCategory.HEALTH,
    website: 'https://www.doctorswithoutborders.org',
    logo: 'doctors-without-borders',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'The Nature Conservancy',
    ein: '53-0242652',
    description: 'Protecting ecologically important lands and waters for nature and people around the globe.',
    category: CharityCategory.ENVIRONMENT,
    website: 'https://www.nature.org',
    logo: 'nature-conservancy',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'World Wildlife Fund',
    ein: '52-1693387',
    description: 'Conserving nature and reducing the most pressing threats to the diversity of life on Earth.',
    category: CharityCategory.ENVIRONMENT,
    website: 'https://www.worldwildlife.org',
    logo: 'wwf',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'Feeding America',
    ein: '36-3673599',
    description: "Fighting hunger in America by connecting people with food and providing support through the nation's food banks.",
    category: CharityCategory.POVERTY,
    website: 'https://www.feedingamerica.org',
    logo: 'feeding-america',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'ASPCA',
    ein: '13-1623829',
    description: 'Working to rescue animals from abuse, pass humane laws, and share resources with shelters nationwide.',
    category: CharityCategory.ANIMAL_WELFARE,
    website: 'https://www.aspca.org',
    logo: 'aspca',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'Amnesty International',
    ein: '13-1910655',
    description: 'Fighting injustice and defending human rights around the world through research, advocacy, and action.',
    category: CharityCategory.HUMAN_RIGHTS,
    website: 'https://www.amnesty.org',
    logo: 'amnesty-international',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'Red Cross',
    ein: '53-0196605',
    description: 'Preventing and alleviating human suffering during emergencies through humanitarian services and support.',
    category: CharityCategory.DISASTER_RELIEF,
    website: 'https://www.redcross.org',
    logo: 'red-cross',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'St. Jude Children\'s Research Hospital',
    ein: '62-0646012',
    description: 'Leading the way in understanding and treating childhood cancer and other life-threatening diseases.',
    category: CharityCategory.HEALTH,
    website: 'https://www.stjude.org',
    logo: 'st-jude',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'Habitat for Humanity',
    ein: '91-1914868',
    description: 'Building homes, communities, and hope. Helping families build strength, stability, and self-reliance through shelter.',
    category: CharityCategory.COMMUNITY,
    website: 'https://www.habitat.org',
    logo: 'habitat-for-humanity',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'Room to Read',
    ein: '68-0539887',
    description: 'Transforming lives through education. Creating a world free from illiteracy and gender inequality.',
    category: CharityCategory.EDUCATION,
    website: 'https://www.roomtoread.org',
    logo: 'room-to-read',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'The Ocean Cleanup',
    ein: '82-2857436',
    description: 'Developing advanced technologies to rid the oceans of plastic. Cleaning up our waters for future generations.',
    category: CharityCategory.ENVIRONMENT,
    website: 'https://theoceancleanup.com',
    logo: 'ocean-cleanup',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
  {
    id: nanoid(),
    name: 'Code.org',
    ein: '46-0858543',
    description: 'Expanding access to computer science in schools and increasing participation by women and underrepresented minorities.',
    category: CharityCategory.EDUCATION,
    website: 'https://code.org',
    logo: 'code-org',
    payment_address: null,
    status: CharityStatus.VERIFIED,
    verification_notes: null,
    rejection_reason: null,
    created_by: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    active: true,
  },
];

/**
 * Get charity by ID
 */
export function getCharityById(id: string): Charity | undefined {
  return CHARITIES.find((charity) => charity.id === id);
}

/**
 * Get charities by category
 */
export function getCharitiesByCategory(category: CharityCategory): Charity[] {
  return CHARITIES.filter((charity) => charity.category === category && charity.active);
}

/**
 * Get all active charities
 */
export function getActiveCharities(): Charity[] {
  return CHARITIES.filter((charity) => charity.active);
}

/**
 * Get all charity categories with counts
 */
export function getCategoriesWithCounts(): Array<{ category: CharityCategory; count: number }> {
  const counts: Record<CharityCategory, number> = {
    [CharityCategory.EDUCATION]: 0,
    [CharityCategory.ENVIRONMENT]: 0,
    [CharityCategory.HEALTH]: 0,
    [CharityCategory.POVERTY]: 0,
    [CharityCategory.ANIMAL_WELFARE]: 0,
    [CharityCategory.HUMAN_RIGHTS]: 0,
    [CharityCategory.DISASTER_RELIEF]: 0,
    [CharityCategory.ARTS_CULTURE]: 0,
    [CharityCategory.COMMUNITY]: 0,
    [CharityCategory.OTHER]: 0,
  };

  CHARITIES.filter((c) => c.active).forEach((charity) => {
    counts[charity.category]++;
  });

  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({
      category: category as CharityCategory,
      count,
    }));
}
