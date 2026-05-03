/**
 * Fun Company ID Generator
 *
 * Generates memorable, personality-filled company IDs in the format:
 * nature_animal_### (e.g., ocean_elephant_614)
 *
 * This makes IDs:
 * - Memorable and fun
 * - Support-friendly
 * - Brand-aligned with judgment-free, friendly experience
 * - URL-safe
 */

const NATURE_WORDS = [
  // Water
  'ocean', 'river', 'lake', 'stream', 'creek', 'waterfall', 'tide', 'wave',
  // Earth
  'forest', 'mountain', 'valley', 'meadow', 'canyon', 'cliff', 'hill', 'peak',
  // Elements
  'stone', 'rock', 'crystal', 'pebble', 'sand', 'soil', 'clay',
  // Plants
  'tree', 'flower', 'bloom', 'moss', 'fern', 'vine', 'leaf', 'root',
  // Sky
  'cloud', 'sky', 'star', 'moon', 'sun', 'aurora', 'horizon',
  // Weather
  'rain', 'snow', 'mist', 'breeze', 'wind', 'thunder', 'lightning',
  // Landscape
  'prairie', 'desert', 'tundra', 'jungle', 'savanna', 'woodland', 'grove',
  // Natural features
  'spring', 'pond', 'marsh', 'reef', 'dune', 'glacier', 'volcano'
];

const ANIMAL_WORDS = [
  // Land mammals
  'elephant', 'dolphin', 'owl', 'fox', 'wolf', 'bear', 'deer', 'rabbit',
  'squirrel', 'otter', 'badger', 'raccoon', 'hedgehog', 'panda', 'koala',
  'tiger', 'lion', 'leopard', 'cheetah', 'jaguar', 'lynx', 'bobcat',
  // Sea creatures
  'whale', 'seal', 'walrus', 'manatee', 'octopus', 'starfish', 'turtle',
  'penguin', 'seahorse', 'jellyfish', 'orca', 'narwhal',
  // Birds
  'eagle', 'hawk', 'falcon', 'raven', 'crow', 'swan', 'crane', 'heron',
  'pelican', 'flamingo', 'parrot', 'hummingbird', 'kingfisher', 'peacock',
  // Smaller creatures
  'butterfly', 'dragonfly', 'ladybug', 'firefly', 'beetle', 'mantis',
  // Hooved animals
  'moose', 'elk', 'bison', 'buffalo', 'antelope', 'gazelle', 'zebra', 'giraffe',
  // Canines/Felines
  'coyote', 'dingo', 'fennec', 'caracal', 'ocelot', 'serval',
  // Other
  'armadillo', 'platypus', 'sloth', 'capybara', 'meerkat', 'mongoose'
];

/**
 * Generate a random fun company ID
 *
 * Format: nature_animal_###
 * Example: ocean_elephant_614
 *
 * @returns Fun company ID string
 */
export function generateFunCompanyId(): string {
  const nature = NATURE_WORDS[Math.floor(Math.random() * NATURE_WORDS.length)];
  const animal = ANIMAL_WORDS[Math.floor(Math.random() * ANIMAL_WORDS.length)];
  const number = Math.floor(100 + Math.random() * 900); // 3-digit number (100-999)

  return `${nature}_${animal}_${number}`;
}

/**
 * Check if a company ID follows the fun format
 *
 * @param id - Company ID to check
 * @returns True if it's a fun ID format
 */
export function isFunCompanyId(id: string): boolean {
  return /^[a-z]+_[a-z]+_\d{3}$/.test(id);
}

/**
 * Generate a unique fun company ID by checking database
 *
 * Keeps generating until it finds one that's not in the database.
 * Used during signup to ensure uniqueness.
 *
 * @param db - Database connection
 * @param maxAttempts - Maximum attempts before giving up (default: 100)
 * @returns Promise resolving to unique fun company ID
 * @throws Error if can't find unique ID after maxAttempts
 */
export async function generateUniqueFunCompanyId(
  db: any,
  maxAttempts: number = 100
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const id = generateFunCompanyId();

    // Check if ID already exists
    const result = await db.query('SELECT 1 FROM users WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return id;
    }
  }

  throw new Error(
    'Could not generate unique company ID after ' + maxAttempts + ' attempts'
  );
}

/**
 * Format a fun company ID for display
 *
 * @param id - Company ID to format
 * @returns Formatted display string (e.g., "Ocean Elephant 614")
 */
export function formatFunCompanyId(id: string): string {
  if (!isFunCompanyId(id)) {
    return id; // Return as-is if not fun format
  }

  const parts = id.split('_');
  return `${capitalize(parts[0])} ${capitalize(parts[1])} ${parts[2]}`;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
