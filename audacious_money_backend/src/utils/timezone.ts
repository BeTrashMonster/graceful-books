/**
 * Timezone Utilities
 *
 * Maps billing address (zip code + country) to IANA timezone
 * Used to set accurate default timezone from Stripe billing data
 */

/**
 * Map US zip code to IANA timezone
 *
 * Uses the first 3 digits of zip code for determination.
 * This is ~95% accurate for US addresses.
 */
export function getTimezoneFromUSZip(zipCode: string): string {
  // Remove any non-numeric characters and get first 3 digits
  const zip3 = parseInt(zipCode.replace(/\D/g, '').substring(0, 3));

  if (isNaN(zip3)) {
    return 'America/New_York'; // Default fallback
  }

  // Eastern Time (EST/EDT)
  if (
    (zip3 >= 005 && zip3 <= 027) || // MA, ME, NH, VT, RI, CT
    (zip3 >= 100 && zip3 <= 149) || // NY
    (zip3 >= 150 && zip3 <= 196) || // PA, NJ, DE, MD, DC
    (zip3 >= 220 && zip3 <= 246) || // VA
    (zip3 >= 247 && zip3 <= 268) || // WV
    (zip3 >= 270 && zip3 <= 289) || // NC, SC
    (zip3 >= 300 && zip3 <= 319) || // GA
    (zip3 >= 322 && zip3 <= 349) || // FL (Eastern portion)
    (zip3 >= 400 && zip3 <= 427) || // KY (Eastern portion)
    (zip3 >= 430 && zip3 <= 458) || // OH
    (zip3 >= 460 && zip3 <= 479) || // IN (Eastern portion)
    (zip3 >= 480 && zip3 <= 499)    // MI (Eastern portion)
  ) {
    return 'America/New_York';
  }

  // Central Time (CST/CDT)
  if (
    (zip3 >= 350 && zip3 <= 369) || // FL (Panhandle)
    (zip3 >= 354 && zip3 <= 369) || // AL
    (zip3 >= 370 && zip3 <= 395) || // TN (Western portion)
    (zip3 >= 386 && zip3 <= 397) || // MS
    (zip3 >= 500 && zip3 <= 528) || // IA
    (zip3 >= 530 && zip3 <= 549) || // WI
    (zip3 >= 546 && zip3 <= 567) || // MN
    (zip3 >= 570 && zip3 <= 577) || // SD
    (zip3 >= 580 && zip3 <= 588) || // ND
    (zip3 >= 590 && zip3 <= 599) || // MT (Eastern portion)
    (zip3 >= 600 && zip3 <= 629) || // IL
    (zip3 >= 630 && zip3 <= 658) || // MO
    (zip3 >= 660 && zip3 <= 679) || // KS
    (zip3 >= 680 && zip3 <= 698) || // NE
    (zip3 >= 700 && zip3 <= 729) || // LA
    (zip3 >= 730 && zip3 <= 749) || // AR
    (zip3 >= 750 && zip3 <= 799) || // TX (Central portion)
    (zip3 >= 385 && zip3 <= 397)    // MS
  ) {
    return 'America/Chicago';
  }

  // Mountain Time (MST/MDT)
  if (
    (zip3 >= 590 && zip3 <= 599) || // MT (Western portion)
    (zip3 >= 800 && zip3 <= 816) || // CO
    (zip3 >= 820 && zip3 <= 831) || // WY
    (zip3 >= 832 && zip3 <= 838) || // ID (Southern portion)
    (zip3 >= 840 && zip3 <= 847) || // UT
    (zip3 >= 850 && zip3 <= 865) || // AZ
    (zip3 >= 870 && zip3 <= 884) || // NM
    (zip3 >= 790 && zip3 <= 799)    // TX (Western portion - El Paso area)
  ) {
    return 'America/Denver';
  }

  // Pacific Time (PST/PDT)
  if (
    (zip3 >= 889 && zip3 <= 898) || // NV
    (zip3 >= 900 && zip3 <= 961) || // CA
    (zip3 >= 970 && zip3 <= 979) || // OR
    (zip3 >= 980 && zip3 <= 994)    // WA
  ) {
    return 'America/Los_Angeles';
  }

  // Alaska Time (AKST/AKDT)
  if (zip3 >= 995 && zip3 <= 999) {
    return 'America/Anchorage';
  }

  // Hawaii Time (HST - no DST)
  if (zip3 >= 967 && zip3 <= 968) {
    return 'Pacific/Honolulu';
  }

  // Default to Eastern if no match found
  return 'America/New_York';
}

/**
 * Get timezone from Stripe billing address
 *
 * Handles both US and international addresses
 */
export function getTimezoneFromBillingAddress(address: {
  postal_code?: string | null;
  country?: string | null;
}): string {
  const { postal_code, country } = address;

  // If no address data, return null (will fall back to browser detection)
  if (!postal_code || !country) {
    return null;
  }

  // Handle US addresses
  if (country === 'US') {
    return getTimezoneFromUSZip(postal_code);
  }

  // Handle common international countries
  // You can expand this list based on your user base
  const countryTimezones: Record<string, string> = {
    CA: 'America/Toronto', // Canada - default to Eastern (most populous)
    GB: 'Europe/London',
    AU: 'Australia/Sydney', // Australia - default to Sydney
    NZ: 'Pacific/Auckland',
    IE: 'Europe/Dublin',
    DE: 'Europe/Berlin',
    FR: 'Europe/Paris',
    ES: 'Europe/Madrid',
    IT: 'Europe/Rome',
    NL: 'Europe/Amsterdam',
    BE: 'Europe/Brussels',
    CH: 'Europe/Zurich',
    AT: 'Europe/Vienna',
    SE: 'Europe/Stockholm',
    NO: 'Europe/Oslo',
    DK: 'Europe/Copenhagen',
    FI: 'Europe/Helsinki',
    PL: 'Europe/Warsaw',
    JP: 'Asia/Tokyo',
    KR: 'Asia/Seoul',
    CN: 'Asia/Shanghai',
    IN: 'Asia/Kolkata',
    SG: 'Asia/Singapore',
    HK: 'Asia/Hong_Kong',
    MX: 'America/Mexico_City',
    BR: 'America/Sao_Paulo',
    AR: 'America/Argentina/Buenos_Aires',
    CL: 'America/Santiago',
    ZA: 'Africa/Johannesburg',
  };

  return countryTimezones[country] || null;
}

/**
 * Common US timezones for dropdown selection
 */
export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', example: 'New York, Miami' },
  { value: 'America/Chicago', label: 'Central Time (CT)', example: 'Chicago, Dallas' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', example: 'Denver, Phoenix' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', example: 'Los Angeles, Seattle' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', example: 'Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)', example: 'Honolulu' },
];

/**
 * All timezones for comprehensive dropdown
 */
export const ALL_TIMEZONES = [
  ...US_TIMEZONES,
  { value: 'America/Toronto', label: 'Eastern Time - Canada', example: 'Toronto' },
  { value: 'America/Vancouver', label: 'Pacific Time - Canada', example: 'Vancouver' },
  { value: 'Europe/London', label: 'GMT/BST', example: 'London' },
  { value: 'Europe/Paris', label: 'CET/CEST', example: 'Paris, Berlin' },
  { value: 'Asia/Tokyo', label: 'JST', example: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'AEDT/AEST', example: 'Sydney' },
  // Add more as needed
];
