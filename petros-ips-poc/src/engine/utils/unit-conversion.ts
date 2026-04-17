// ════════════════════════════════════════════════════════════════════════
// Configurable Unit Conversion Engine (DF-01)
// ════════════════════════════════════════════════════════════════════════
//
// Super-users can add, update, and remove conversion factors. The engine
// supports direct lookups, reciprocal lookups, and chained conversions
// through intermediate units (e.g. bbl → m³ → litres).
// ════════════════════════════════════════════════════════════════════════

import type { UnitConversion } from '@/engine/types';

/** Standard petroleum-industry conversions seeded into a fresh project. */
export const DEFAULT_CONVERSIONS: readonly UnitConversion[] = [
  // Oil volume
  { id: 'bbl-m3',     fromUnit: 'bbl', toUnit: 'm³',      factor: 0.158987, category: 'volume_oil', isDefault: true, description: 'Barrels to Cubic Meters' },
  { id: 'bbl-litres', fromUnit: 'bbl', toUnit: 'litres',  factor: 158.987,  category: 'volume_oil', isDefault: true, description: 'Barrels to Litres' },
  { id: 'bbl-gal',    fromUnit: 'bbl', toUnit: 'US gal',  factor: 42.0,     category: 'volume_oil', isDefault: true, description: 'Barrels to US Gallons' },

  // Gas volume
  { id: 'mmscf-bcf',   fromUnit: 'MMscf', toUnit: 'Bcf',     factor: 0.001,    category: 'volume_gas', isDefault: true, description: 'Million SCF to Billion SCF' },
  { id: 'mmscf-mmbtu', fromUnit: 'MMscf', toUnit: 'MMBtu',   factor: 1.055,    category: 'volume_gas', isDefault: true, description: 'Million SCF to Million BTU' },
  { id: 'mmscf-pj',    fromUnit: 'MMscf', toUnit: 'PJ',      factor: 0.001113, category: 'volume_gas', isDefault: true, description: 'Million SCF to Petajoules' },
  { id: 'mmscf-nm3',   fromUnit: 'MMscf', toUnit: 'kNm³',    factor: 28.317,   category: 'volume_gas', isDefault: true, description: 'Million SCF to Thousand Normal Cubic Meters' },
  { id: 'bcf-tscf',    fromUnit: 'Bcf',   toUnit: 'Tscf',    factor: 0.001,    category: 'volume_gas', isDefault: true, description: 'Billion SCF to Trillion SCF' },

  // Energy
  { id: 'mmbtu-gj',  fromUnit: 'MMBtu', toUnit: 'GJ',  factor: 1.05506,  category: 'energy', isDefault: true, description: 'Million BTU to Gigajoules' },
  { id: 'mmbtu-mwh', fromUnit: 'MMBtu', toUnit: 'MWh', factor: 0.29307,  category: 'energy', isDefault: true, description: 'Million BTU to Megawatt-hours' },

  // Mass
  { id: 'tonne-kg',    fromUnit: 'tonne', toUnit: 'kg',             factor: 1000.0,   category: 'mass', isDefault: true, description: 'Metric Tonnes to Kilograms' },
  { id: 'tonne-lb',    fromUnit: 'tonne', toUnit: 'lb',             factor: 2204.62,  category: 'mass', isDefault: true, description: 'Metric Tonnes to Pounds' },
  { id: 'bbl-tonne',   fromUnit: 'bbl',   toUnit: 'tonne (crude)',  factor: 0.1364,   category: 'mass', isDefault: true, description: 'Barrels to Tonnes (average crude, API 35)' },

  // Currency
  { id: 'usd-myr', fromUnit: 'USD', toUnit: 'MYR', factor: 4.50, category: 'currency', isDefault: true, description: 'US Dollars to Malaysian Ringgit' },

  // BOE equivalence
  { id: 'mscf-boe', fromUnit: 'Mscf', toUnit: 'boe', factor: 1 / 6, category: 'energy', isDefault: true, description: 'Thousand SCF Gas to Barrel Oil Equivalent (6:1 energy basis)' },
];

// ── Conversion functions ───────────────────────────────────────────────

/** Find a direct conversion in the table */
function findDirect(
  conversions: readonly UnitConversion[],
  fromUnit: string,
  toUnit: string,
): UnitConversion | undefined {
  return conversions.find((c) => c.fromUnit === fromUnit && c.toUnit === toUnit);
}

/** Find a reverse conversion (use 1/factor) */
function findReverse(
  conversions: readonly UnitConversion[],
  fromUnit: string,
  toUnit: string,
): UnitConversion | undefined {
  return conversions.find((c) => c.fromUnit === toUnit && c.toUnit === fromUnit);
}

/**
 * Convert a value from one unit to another.
 * Tries direct → reverse → chained (1-hop intermediate).
 *
 * Throws if no conversion path exists.
 */
function assertUsableFactor(f: number, fromUnit: string, toUnit: string): void {
  if (!Number.isFinite(f) || f <= 0) {
    throw new Error(
      `Invalid conversion factor ${f} on "${fromUnit} → ${toUnit}" — factors must be positive finite numbers`,
    );
  }
}

export function convert(
  value: number,
  fromUnit: string,
  toUnit: string,
  conversions: readonly UnitConversion[] = DEFAULT_CONVERSIONS,
): number {
  if (fromUnit === toUnit) return value;

  // Direct lookup
  const direct = findDirect(conversions, fromUnit, toUnit);
  if (direct) {
    assertUsableFactor(direct.factor, direct.fromUnit, direct.toUnit);
    return value * direct.factor;
  }

  // Reverse lookup
  const reverse = findReverse(conversions, fromUnit, toUnit);
  if (reverse) {
    assertUsableFactor(reverse.factor, reverse.fromUnit, reverse.toUnit);
    return value / reverse.factor;
  }

  // 1-hop chained lookup: from → intermediate → to
  const candidates = conversions.filter((c) => c.fromUnit === fromUnit);
  for (const first of candidates) {
    const second = findDirect(conversions, first.toUnit, toUnit) ?? findReverse(conversions, first.toUnit, toUnit);
    if (second) {
      assertUsableFactor(first.factor, first.fromUnit, first.toUnit);
      assertUsableFactor(second.factor, second.fromUnit, second.toUnit);
      const intermediate = value * first.factor;
      return second.fromUnit === first.toUnit
        ? intermediate * second.factor
        : intermediate / second.factor;
    }
  }

  // 1-hop chained lookup via reverse first
  const reverseCandidates = conversions.filter((c) => c.toUnit === fromUnit);
  for (const first of reverseCandidates) {
    const intermediateUnit = first.fromUnit;
    const second = findDirect(conversions, intermediateUnit, toUnit) ?? findReverse(conversions, intermediateUnit, toUnit);
    if (second) {
      assertUsableFactor(first.factor, first.fromUnit, first.toUnit);
      assertUsableFactor(second.factor, second.fromUnit, second.toUnit);
      const intermediate = value / first.factor;
      return second.fromUnit === intermediateUnit
        ? intermediate * second.factor
        : intermediate / second.factor;
    }
  }

  throw new Error(`No conversion path from "${fromUnit}" to "${toUnit}"`);
}

/** Returns true if a conversion path exists */
export function canConvert(
  fromUnit: string,
  toUnit: string,
  conversions: readonly UnitConversion[] = DEFAULT_CONVERSIONS,
): boolean {
  if (fromUnit === toUnit) return true;
  try {
    convert(1, fromUnit, toUnit, conversions);
    return true;
  } catch {
    return false;
  }
}

// ── Mutation helpers (super-user actions) ──────────────────────────────

export interface NewConversionInput {
  fromUnit: string;
  toUnit: string;
  factor: number;
  category: UnitConversion['category'];
  description: string;
}

/** Validate the inputs of a new or updated conversion */
export function validateConversion(input: NewConversionInput): string | null {
  if (!input.fromUnit || !input.toUnit) return 'Both units must be specified';
  if (input.fromUnit === input.toUnit) return 'fromUnit and toUnit must differ';
  if (!Number.isFinite(input.factor) || input.factor <= 0) return 'Factor must be a positive finite number';
  return null;
}

/** Add a new conversion (returns a new array; non-mutating) */
export function addConversion(
  current: readonly UnitConversion[],
  input: NewConversionInput,
): UnitConversion[] {
  const error = validateConversion(input);
  if (error) throw new Error(error);

  // Check for duplicate pair
  if (findDirect(current, input.fromUnit, input.toUnit)) {
    throw new Error(`Conversion ${input.fromUnit} → ${input.toUnit} already exists`);
  }

  const id = `custom-${input.fromUnit.toLowerCase()}-${input.toUnit.toLowerCase()}-${Date.now()}`;
  return [
    ...current,
    { id, ...input, isDefault: false },
  ];
}

/** Update the factor of an existing conversion.
 *
 * For System Default rows, the first edit captures the original factor as
 * `defaultFactor` so the UI can present a Modified pill and offer a Reset
 * action. Subsequent edits leave the captured `defaultFactor` untouched. */
export function updateConversion(
  current: readonly UnitConversion[],
  id: string,
  factor: number,
): UnitConversion[] {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error('Factor must be a positive finite number');
  }
  return current.map((c) => {
    if (c.id !== id) return c;
    const capturedDefault = c.isDefault && c.defaultFactor === undefined ? c.factor : c.defaultFactor;
    return { ...c, factor, defaultFactor: capturedDefault };
  });
}

/** Restore a System Default conversion to its original (seeded) factor.
 *  Throws if the target is not a default row or has never been modified. */
export function resetConversionToDefault(
  current: readonly UnitConversion[],
  id: string,
): UnitConversion[] {
  return current.map((c) => {
    if (c.id !== id) return c;
    if (!c.isDefault) throw new Error('Only System Default rows can be reset.');
    if (c.defaultFactor === undefined) return c; // already at default
    const { defaultFactor: _d, ...rest } = c;
    void _d;
    return { ...rest, factor: c.defaultFactor };
  });
}

/** True when a System Default row has been modified away from its seeded factor. */
export function isConversionModified(c: UnitConversion): boolean {
  return c.isDefault && c.defaultFactor !== undefined && c.factor !== c.defaultFactor;
}

/** Remove a custom (non-default) conversion */
export function removeConversion(
  current: readonly UnitConversion[],
  id: string,
): UnitConversion[] {
  const target = current.find((c) => c.id === id);
  if (!target) return [...current];
  if (target.isDefault) {
    throw new Error('Cannot remove a default conversion. Customise the factor instead.');
  }
  return current.filter((c) => c.id !== id);
}
