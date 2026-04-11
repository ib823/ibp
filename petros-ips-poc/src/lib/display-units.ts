// ════════════════════════════════════════════════════════════════════════
// Display Unit Helpers
// ════════════════════════════════════════════════════════════════════════
//
// Thin display-side wrapper around the engine's pure `convert()`. The
// engine throws on missing paths / bad factors (fail-loud in calculation).
// Display code must NEVER throw on a user-picked unit — wrong label is
// preferable to a blank screen, and silent wrong-unit numbers are worst
// of all. `convertSafe` returns the original value + logs a dev warning
// so missing paths surface during QA without breaking the UI.
// ════════════════════════════════════════════════════════════════════════

import type { UnitConversion } from '@/engine/types';
import { canConvert, convert } from '@/engine/utils/unit-conversion';

/** ISO currency code → display symbol. Fallback: the code itself. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  MYR: 'RM',
};

const warned = new Set<string>();

function isDevEnvironment(): boolean {
  // Vite exposes DEV at build time; during vitest runs import.meta.env.DEV
  // is also truthy. In production builds this compiles to `false` and
  // warnings tree-shake away entirely.
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return true;
  }
}

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  if (isDevEnvironment()) {
    console.warn(message);
  }
}

/**
 * Convert `value` from `fromUnit` to `toUnit` using the supplied conversion
 * table. Never throws:
 *  - Missing path → returns original value, logs once per (from,to) pair.
 *  - Non-finite result → returns original value, logs once.
 *  - Zero or negative factor (should be blocked upstream) → returns original.
 */
export function convertSafe(
  value: number,
  fromUnit: string,
  toUnit: string,
  conversions: readonly UnitConversion[],
): number {
  if (fromUnit === toUnit) return value;
  if (!canConvert(fromUnit, toUnit, conversions)) {
    warnOnce(
      `missing:${fromUnit}->${toUnit}`,
      `[display-units] No conversion path "${fromUnit}" → "${toUnit}"; rendering value in source unit.`,
    );
    return value;
  }
  try {
    const result = convert(value, fromUnit, toUnit, conversions);
    if (!Number.isFinite(result)) {
      warnOnce(
        `nonfinite:${fromUnit}->${toUnit}`,
        `[display-units] Non-finite result for "${fromUnit}" → "${toUnit}"; rendering source value.`,
      );
      return value;
    }
    return result;
  } catch (err) {
    warnOnce(
      `throw:${fromUnit}->${toUnit}`,
      `[display-units] convert() threw on "${fromUnit}" → "${toUnit}": ${(err as Error).message}`,
    );
    return value;
  }
}

/**
 * Scalar factor for multiplying base-unit values into display units.
 * Cheap enough to call inside useMemo; returns 1 for identity conversions.
 */
export function getConversionFactor(
  fromUnit: string,
  toUnit: string,
  conversions: readonly UnitConversion[],
): number {
  return convertSafe(1, fromUnit, toUnit, conversions);
}

/** Normalize -0 to 0 so accounting parentheses render correctly. */
export function normalizeZero(n: number): number {
  return n === 0 ? 0 : n;
}

/** Test-only: clear the dev warn cache so tests can re-trigger warnings. */
export function __resetWarnCacheForTests(): void {
  warned.clear();
}
