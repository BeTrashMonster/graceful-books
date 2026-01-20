/**
 * Charities Data
 *
 * Pre-defined list of charitable organizations that users can support.
 * Users select one charity during signup, and $5 from their monthly
 * subscription goes to their chosen cause.
 */

import { nanoid } from 'nanoid';
import type { Charity, CharityCategory } from '../types/database.types';

/**
 * Available charities for user selection
 * Each charity receives $5/month from the user's subscription
 */
export const CHARITIES: Charity[] = [
  {
    id: nanoid(),
    name: 'Khan Academy',
    description: 'Free, world-class education for anyone, anywhere. Providing educational resources for students globally.',
    category: 'EDUCATION',
    website: 'https://www.khanacademy.org',
    logo: 'khan-academy',
    active: true,
  },
  {
    id: nanoid(),
    name: 'GiveDirectly',
    description: 'Direct cash transfers to people living in extreme poverty. Empowering recipients to decide what they need most.',
    category: 'POVERTY',
    website: 'https://www.givedirectly.org',
    logo: 'givedirectly',
    active: true,
  },
  {
    id: nanoid(),
    name: 'Charity: Water',
    description: 'Bringing clean and safe drinking water to people in developing countries around the world.',
    category: 'HEALTH',
    website: 'https://www.charitywater.org',
    logo: 'charity-water',
    active: true,
  },
  {
    id: nanoid(),
    name: 'Doctors Without Borders',
    description: 'Providing emergency medical aid to people affected by conflict, epidemics, disasters, or exclusion from healthcare.',
    category: 'HEALTH',
    website: 'https://www.doctorswithoutborders.org',
    logo: 'doctors-without-borders',
    active: true,
  },
  {
    id: nanoid(),
    name: 'The Nature Conservancy',
    description: 'Protecting ecologically important lands and waters for nature and people around the globe.',
    category: 'ENVIRONMENT',
    website: 'https://www.nature.org',
    logo: 'nature-conservancy',
    active: true,
  },
  {
    id: nanoid(),
    name: 'World Wildlife Fund',
    description: 'Conserving nature and reducing the most pressing threats to the diversity of life on Earth.',
    category: 'ENVIRONMENT',
    website: 'https://www.worldwildlife.org',
    logo: 'wwf',
    active: true,
  },
  {
    id: nanoid(),
    name: 'Feeding America',
    description: "Fighting hunger in America by connecting people with food and providing support through the nation's food banks.",
    category: 'POVERTY',
    website: 'https://www.feedingamerica.org',
    logo: 'feeding-america',
    active: true,
  },
  {
    id: nanoid(),
    name: 'ASPCA',
    description: 'Working to rescue animals from abuse, pass humane laws, and share resources with shelters nationwide.',
    category: 'ANIMAL_WELFARE',
    website: 'https://www.aspca.org',
    logo: 'aspca',
    active: true,
  },
  {
    id: nanoid(),
    name: 'Amnesty International',
    description: 'Fighting injustice and defending human rights around the world through research, advocacy, and action.',
    category: 'HUMAN_RIGHTS',
    website: 'https://www.amnesty.org',
    logo: 'amnesty-international',
    active: true,
  },
  {
    id: nanoid(),
    name: 'Red Cross',
    description: 'Preventing and alleviating human suffering during emergencies through humanitarian services and support.',
    category: 'DISASTER_RELIEF',
    website: 'https://www.redcross.org',
    logo: 'red-cross',
    active: true,
  },
  {
    id: nanoid(),
    name: 'St. Jude Children\'s Research Hospital',
    description: 'Leading the way in understanding and treating childhood cancer and other life-threatening diseases.',
    category: 'HEALTH',
    website: 'https://www.stjude.org',
    logo: 'st-jude',
    active: true,
  },
  {
    id: nanoid(),
    name: 'Habitat for Humanity',
    description: 'Building homes, communities, and hope. Helping families build strength, stability, and self-reliance through shelter.',
    category: 'COMMUNITY',
    website: 'https://www.habitat.org',
    logo: 'habitat-for-humanity',
    active: true,
  },
  {
    id: nanoid(),
    name: 'Room to Read',
    description: 'Transforming lives through education. Creating a world free from illiteracy and gender inequality.',
    category: 'EDUCATION',
    website: 'https://www.roomtoread.org',
    logo: 'room-to-read',
    active: true,
  },
  {
    id: nanoid(),
    name: 'The Ocean Cleanup',
    description: 'Developing advanced technologies to rid the oceans of plastic. Cleaning up our waters for future generations.',
    category: 'ENVIRONMENT',
    website: 'https://theoceancleanup.com',
    logo: 'ocean-cleanup',
    active: true,
  },
  {
    id: nanoid(),
    name: 'Code.org',
    description: 'Expanding access to computer science in schools and increasing participation by women and underrepresented minorities.',
    category: 'EDUCATION',
    website: 'https://code.org',
    logo: 'code-org',
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
    EDUCATION: 0,
    ENVIRONMENT: 0,
    HEALTH: 0,
    POVERTY: 0,
    ANIMAL_WELFARE: 0,
    HUMAN_RIGHTS: 0,
    DISASTER_RELIEF: 0,
    ARTS_CULTURE: 0,
    COMMUNITY: 0,
    OTHER: 0,
  };

  CHARITIES.filter((c) => c.active).forEach((charity) => {
    counts[charity.category]++;
  });

  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({
      category: category,
      count,
    }));
}
