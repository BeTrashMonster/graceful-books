/**
 * Unit Conversion Utility
 *
 * Handles automatic conversions between different units of measurement
 * for CPG invoices and recipes. Supports weight, volume, count conversions,
 * and density-based weight-to-volume conversions (e.g., lb to cups for flour).
 */

export type UnitType = 'weight' | 'volume' | 'count' | 'each';

export type WeightUnit = 'mg' | 'g' | 'kg' | 'oz' | 'lb';
export type VolumeUnit = 'ml' | 'tsp' | 'tbsp' | 'fl oz' | 'cup' | 'pt' | 'qt' | 'L' | 'gal';
export type CountUnit = 'each' | 'dozen' | 'case';
export type Unit = WeightUnit | VolumeUnit | CountUnit;

export interface UnitDefinition {
  unit: Unit;
  type: UnitType;
  label: string;
  baseUnit: Unit; // The base unit for this type (for conversion)
  toBaseMultiplier: number; // Multiply by this to get base unit
}

// Unit catalog
export const UNIT_CATALOG: Record<Unit, UnitDefinition> = {
  // Weight units (base: g for precision with small measurements)
  'mg': { unit: 'mg', type: 'weight', label: 'Milligram (mg)', baseUnit: 'g', toBaseMultiplier: 0.001 },
  'g': { unit: 'g', type: 'weight', label: 'Gram (g)', baseUnit: 'g', toBaseMultiplier: 1 },
  'kg': { unit: 'kg', type: 'weight', label: 'Kilogram (kg)', baseUnit: 'g', toBaseMultiplier: 1000 },
  'oz': { unit: 'oz', type: 'weight', label: 'Ounce (oz)', baseUnit: 'g', toBaseMultiplier: 28.3495 },
  'lb': { unit: 'lb', type: 'weight', label: 'Pound (lb)', baseUnit: 'g', toBaseMultiplier: 453.592 },

  // Volume units (base: ml) - ordered small to large
  'ml': { unit: 'ml', type: 'volume', label: 'Milliliter (ml)', baseUnit: 'ml', toBaseMultiplier: 1 },
  'tsp': { unit: 'tsp', type: 'volume', label: 'Teaspoon (tsp)', baseUnit: 'ml', toBaseMultiplier: 4.92892 },
  'tbsp': { unit: 'tbsp', type: 'volume', label: 'Tablespoon (tbsp)', baseUnit: 'ml', toBaseMultiplier: 14.7868 },
  'fl oz': { unit: 'fl oz', type: 'volume', label: 'Fluid Ounce (fl oz)', baseUnit: 'ml', toBaseMultiplier: 29.5735 },
  'cup': { unit: 'cup', type: 'volume', label: 'Cup', baseUnit: 'ml', toBaseMultiplier: 236.588 },
  'pt': { unit: 'pt', type: 'volume', label: 'Pint (pt)', baseUnit: 'ml', toBaseMultiplier: 473.176 },
  'qt': { unit: 'qt', type: 'volume', label: 'Quart (qt)', baseUnit: 'ml', toBaseMultiplier: 946.353 },
  'L': { unit: 'L', type: 'volume', label: 'Liter (L)', baseUnit: 'ml', toBaseMultiplier: 1000 },
  'gal': { unit: 'gal', type: 'volume', label: 'Gallon (gal)', baseUnit: 'ml', toBaseMultiplier: 3785.41 },

  // Count units (base: each)
  'each': { unit: 'each', type: 'count', label: 'Each', baseUnit: 'each', toBaseMultiplier: 1 },
  'dozen': { unit: 'dozen', type: 'count', label: 'Dozen', baseUnit: 'each', toBaseMultiplier: 12 },
  'case': { unit: 'case', type: 'count', label: 'Case', baseUnit: 'each', toBaseMultiplier: 24 }, // Default case size, can be customized
};

/**
 * Get all available units grouped by type
 */
export function getUnitsByType(): Record<UnitType, UnitDefinition[]> {
  const grouped: Record<UnitType, UnitDefinition[]> = {
    weight: [],
    volume: [],
    count: [],
    each: [],
  };

  Object.values(UNIT_CATALOG).forEach(def => {
    grouped[def.type].push(def);
  });

  return grouped;
}

/**
 * Check if two units are compatible (same type)
 */
export function areUnitsCompatible(unit1: Unit, unit2: Unit): boolean {
  const def1 = UNIT_CATALOG[unit1];
  const def2 = UNIT_CATALOG[unit2];

  if (!def1 || !def2) return false;

  return def1.type === def2.type;
}

/**
 * Convert a quantity from one unit to another
 * Returns null if units are incompatible
 *
 * @example
 * convertUnit(1, 'lb', 'oz') => 16
 * convertUnit(100, 'ml', 'fl oz') => 3.38
 * convertUnit(2, 'dozen', 'each') => 24
 */
export function convertUnit(
  quantity: number,
  fromUnit: Unit,
  toUnit: Unit
): number | null {
  // Same unit - no conversion needed
  if (fromUnit === toUnit) return quantity;

  const fromDef = UNIT_CATALOG[fromUnit];
  const toDef = UNIT_CATALOG[toUnit];

  if (!fromDef || !toDef) return null;

  // Incompatible types
  if (!areUnitsCompatible(fromUnit, toUnit)) return null;

  // Convert to base unit, then to target unit
  const inBaseUnits = quantity * fromDef.toBaseMultiplier;
  const converted = inBaseUnits / toDef.toBaseMultiplier;

  return converted;
}

/**
 * Convert a price per unit to a different unit
 *
 * @example
 * Invoice: $80/lb, Recipe needs oz
 * convertPricePerUnit(80, 'lb', 'oz') => 5 (i.e., $5/oz)
 */
export function convertPricePerUnit(
  pricePerUnit: number,
  fromUnit: Unit,
  toUnit: Unit
): number | null {
  const converted = convertUnit(1, fromUnit, toUnit);
  if (converted === null) return null;

  // Price per unit goes inversely
  // If 1 lb = 16 oz, then $80/lb = $80/16 = $5/oz
  return pricePerUnit / converted;
}

/**
 * Format a unit for display
 */
export function formatUnit(unit: Unit): string {
  return UNIT_CATALOG[unit]?.label || unit;
}

/**
 * Get mismatch warning message
 */
export function getUnitMismatchWarning(
  invoiceUnit: Unit,
  recipeUnit: Unit,
  productName: string
): string | null {
  if (!areUnitsCompatible(invoiceUnit, recipeUnit)) {
    return `⚠️ Unit mismatch for ${productName}: Invoice uses ${formatUnit(invoiceUnit)}, but recipe uses ${formatUnit(recipeUnit)}. These units cannot be automatically converted.`;
  }
  return null;
}

/**
 * Validate that a unit exists in the catalog
 */
export function isValidUnit(unit: string): unit is Unit {
  return unit in UNIT_CATALOG;
}

/**
 * Get the unit type for a given unit
 */
export function getUnitType(unit: Unit): UnitType | null {
  return UNIT_CATALOG[unit]?.type || null;
}

// ============================================================================
// DENSITY-BASED WEIGHT ↔ VOLUME CONVERSIONS
// ============================================================================
// These functions enable converting between weight and volume units when
// the ingredient's density (grams per cup) is known.
//
// Common densities (grams per cup):
// - All-purpose flour: 125g
// - Bread flour: 127g
// - Sugar (granulated): 200g
// - Brown sugar (packed): 220g
// - Powdered sugar: 120g
// - Butter: 227g
// - Milk: 245g
// - Water: 237g
// - Vegetable oil: 218g
// - Honey: 340g
// - Salt (table): 288g
// - Cocoa powder: 85g
// ============================================================================

// 1 cup = 236.588 ml (US cup)
const ML_PER_CUP = 236.588;

/**
 * Check if weight↔volume conversion is possible with density
 */
export function canConvertWithDensity(
  fromUnit: Unit,
  toUnit: Unit,
  gramsPerCup: number | null | undefined
): boolean {
  if (!gramsPerCup || gramsPerCup <= 0) return false;

  const fromType = getUnitType(fromUnit);
  const toType = getUnitType(toUnit);

  if (!fromType || !toType) return false;

  // One must be weight, other must be volume
  return (fromType === 'weight' && toType === 'volume') ||
         (fromType === 'volume' && toType === 'weight');
}

/**
 * Convert between weight and volume units using density (grams per cup)
 *
 * @param quantity - The quantity to convert
 * @param fromUnit - Source unit (weight or volume)
 * @param toUnit - Target unit (volume or weight)
 * @param gramsPerCup - Density of the ingredient (grams per 1 cup)
 * @returns Converted quantity, or null if conversion not possible
 *
 * @example
 * // 3 lb flour to cups (flour = 125 g/cup)
 * convertUnitWithDensity(3, 'lb', 'cup', 125) => 10.89 cups
 *
 * // 2 cups flour to oz
 * convertUnitWithDensity(2, 'cup', 'oz', 125) => 8.82 oz
 */
export function convertUnitWithDensity(
  quantity: number,
  fromUnit: Unit,
  toUnit: Unit,
  gramsPerCup: number | null | undefined
): number | null {
  // Same unit - no conversion needed
  if (fromUnit === toUnit) return quantity;

  // Try same-type conversion first (doesn't need density)
  if (areUnitsCompatible(fromUnit, toUnit)) {
    return convertUnit(quantity, fromUnit, toUnit);
  }

  // Check if density-based conversion is possible
  if (!canConvertWithDensity(fromUnit, toUnit, gramsPerCup)) {
    return null;
  }

  const fromDef = UNIT_CATALOG[fromUnit];
  const toDef = UNIT_CATALOG[toUnit];
  const fromType = fromDef.type;
  const toType = toDef.type;

  // Calculate grams per ml from grams per cup
  const gramsPerMl = gramsPerCup! / ML_PER_CUP;

  if (fromType === 'weight' && toType === 'volume') {
    // Weight → Volume: convert weight to grams, then to ml, then to target volume
    const inGrams = quantity * fromDef.toBaseMultiplier;
    const inMl = inGrams / gramsPerMl;
    const inTargetVolume = inMl / toDef.toBaseMultiplier;
    return inTargetVolume;
  } else if (fromType === 'volume' && toType === 'weight') {
    // Volume → Weight: convert volume to ml, then to grams, then to target weight
    const inMl = quantity * fromDef.toBaseMultiplier;
    const inGrams = inMl * gramsPerMl;
    const inTargetWeight = inGrams / toDef.toBaseMultiplier;
    return inTargetWeight;
  }

  return null;
}

/**
 * Convert a price per unit between weight and volume using density
 *
 * @example
 * // Flour costs $5/lb, what's the cost per cup? (flour = 125 g/cup)
 * convertPricePerUnitWithDensity(5, 'lb', 'cup', 125) => $1.38/cup
 */
export function convertPricePerUnitWithDensity(
  pricePerUnit: number,
  fromUnit: Unit,
  toUnit: Unit,
  gramsPerCup: number | null | undefined
): number | null {
  // Same unit - no conversion needed
  if (fromUnit === toUnit) return pricePerUnit;

  // Try same-type conversion first
  if (areUnitsCompatible(fromUnit, toUnit)) {
    return convertPricePerUnit(pricePerUnit, fromUnit, toUnit);
  }

  // Use density-based conversion
  const converted = convertUnitWithDensity(1, fromUnit, toUnit, gramsPerCup);
  if (converted === null) return null;

  // Price per unit goes inversely
  return pricePerUnit / converted;
}

/**
 * Get mismatch warning message (density-aware version)
 * Returns null if units can be converted (either same type or with density)
 */
export function getUnitMismatchWarningWithDensity(
  invoiceUnit: Unit,
  recipeUnit: Unit,
  productName: string,
  gramsPerCup: number | null | undefined
): string | null {
  // Same type units are always compatible
  if (areUnitsCompatible(invoiceUnit, recipeUnit)) {
    return null;
  }

  // Check if density-based conversion is possible
  if (canConvertWithDensity(invoiceUnit, recipeUnit, gramsPerCup)) {
    return null; // Can convert with density
  }

  // Check if density WOULD help (weight↔volume mismatch)
  const fromType = getUnitType(invoiceUnit);
  const toType = getUnitType(recipeUnit);

  if ((fromType === 'weight' && toType === 'volume') ||
      (fromType === 'volume' && toType === 'weight')) {
    return `Unit conversion needed for ${productName}: Invoice uses ${formatUnit(invoiceUnit)}, recipe uses ${formatUnit(recipeUnit)}. Set "Grams per Cup" on this ingredient to enable automatic conversion.`;
  }

  // Truly incompatible (e.g., weight↔count)
  return `Unit mismatch for ${productName}: Invoice uses ${formatUnit(invoiceUnit)}, but recipe uses ${formatUnit(recipeUnit)}. These units cannot be automatically converted.`;
}
