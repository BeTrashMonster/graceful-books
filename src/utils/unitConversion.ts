/**
 * Unit Conversion Utility
 *
 * Handles automatic conversions between different units of measurement
 * for CPG invoices and recipes. Supports weight, volume, and count conversions.
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
