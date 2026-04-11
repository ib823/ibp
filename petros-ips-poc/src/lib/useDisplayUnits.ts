// ════════════════════════════════════════════════════════════════════════
// useDisplayUnits — consumer-facing React hook
// ════════════════════════════════════════════════════════════════════════
//
// Binds the currency-/unit-aware formatters in `./format.ts` to live
// Zustand state from `project-store`. Returns:
//
//   - Bound formatters: `money`, `oilVolume`, `oilRate`, `gasVolume`,
//     `gasRate`, `energy`, `mass`, `gasPrice`, `oilPrice`.
//   - Scalar factors: `currencyFactor`, `oilFactor`, `gasFactor`,
//     `energyFactor`, `massFactor` — use these inside chart `useMemo`
//     data transforms so re-renders depend on the scalar, not the whole
//     conversion table.
//   - Label metadata: `currencyCode`, `currencySymbol`, `oilUnit`,
//     `gasUnit`, `energyUnit`, `massUnit`.
//   - Raw access: `prefs`, `conversions` (for Excel export and edge cases).
//
// Uses `useShallow` to avoid re-firing on unrelated store updates.
// ════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '@/store/project-store';
import {
  CURRENCY_SYMBOLS,
  getConversionFactor,
} from '@/lib/display-units';
import {
  formatMoney,
  formatOilVolume,
  formatOilRate,
  formatGasVolume,
  formatGasRate,
  formatEnergy,
  formatMass,
  formatPricePerUnit,
  formatOilPricePerUnit,
  type MoneyOpts,
  type UnitOpts,
  type UnitScale,
} from '@/lib/format';
import type { UnitConversion, UnitPreferences } from '@/engine/types';

export interface DisplayUnits {
  // Formatters — bound to live prefs + conversions
  money: (value: number | null | undefined, opts?: Omit<MoneyOpts, 'currency' | 'conversions'>) => string;
  oilVolume: (value: number | null | undefined, opts?: Omit<UnitOpts, 'unit' | 'conversions'>) => string;
  oilRate: (value: number | null | undefined, opts?: Omit<UnitOpts, 'unit' | 'conversions'>) => string;
  gasVolume: (value: number | null | undefined, opts?: Omit<UnitOpts, 'unit' | 'conversions'>) => string;
  gasRate: (value: number | null | undefined, opts?: Omit<UnitOpts, 'unit' | 'conversions'>) => string;
  energy: (value: number | null | undefined, opts?: Omit<UnitOpts, 'unit' | 'conversions'>) => string;
  mass: (value: number | null | undefined, opts?: Omit<UnitOpts, 'unit' | 'conversions'>) => string;
  gasPrice: (valuePerMMBtu: number | null | undefined) => string;
  oilPrice: (valuePerBbl: number | null | undefined) => string;

  // Scalar factors (for chart data pre-scaling in useMemo deps)
  currencyFactor: number;
  oilFactor: number;
  gasFactor: number;
  energyFactor: number;
  massFactor: number;

  // Labels — for axis titles, table headers
  currencyCode: string;
  currencySymbol: string;
  oilUnit: string;
  gasUnit: string;
  energyUnit: string;
  massUnit: string;

  // Raw access
  prefs: UnitPreferences;
  conversions: readonly UnitConversion[];
}

export function useDisplayUnits(): DisplayUnits {
  const { prefs, conversions } = useProjectStore(
    useShallow((s) => ({
      prefs: s.unitPreferences,
      conversions: s.unitConversions,
    })),
  );

  const currencyFactor = useMemo(
    () => getConversionFactor('USD', prefs.currency, conversions),
    [prefs.currency, conversions],
  );
  const oilFactor = useMemo(
    () => getConversionFactor('bbl', prefs.oilVolume, conversions),
    [prefs.oilVolume, conversions],
  );
  const gasFactor = useMemo(
    () => getConversionFactor('MMscf', prefs.gasVolume, conversions),
    [prefs.gasVolume, conversions],
  );
  const energyFactor = useMemo(
    () => getConversionFactor('MMBtu', prefs.energy, conversions),
    [prefs.energy, conversions],
  );
  const massFactor = useMemo(
    () => getConversionFactor('tonne', prefs.mass, conversions),
    [prefs.mass, conversions],
  );

  return useMemo<DisplayUnits>(
    () => ({
      money: (value, opts) =>
        formatMoney(value, { currency: prefs.currency, conversions, ...(opts ?? {}) }),
      oilVolume: (value, opts) =>
        formatOilVolume(value, { unit: prefs.oilVolume, conversions, ...(opts ?? {}) }),
      oilRate: (value, opts) =>
        formatOilRate(value, { unit: prefs.oilVolume, conversions, ...(opts ?? {}) }),
      gasVolume: (value, opts) =>
        formatGasVolume(value, { unit: prefs.gasVolume, conversions, ...(opts ?? {}) }),
      gasRate: (value, opts) =>
        formatGasRate(value, { unit: prefs.gasVolume, conversions, ...(opts ?? {}) }),
      energy: (value, opts) =>
        formatEnergy(value, { unit: prefs.energy, conversions, ...(opts ?? {}) }),
      mass: (value, opts) =>
        formatMass(value, { unit: prefs.mass, conversions, ...(opts ?? {}) }),
      gasPrice: (valuePerMMBtu) =>
        formatPricePerUnit(valuePerMMBtu, {
          energy: prefs.energy,
          conversions,
          currency: prefs.currency,
        }),
      oilPrice: (valuePerBbl) =>
        formatOilPricePerUnit(valuePerBbl, {
          oilVolume: prefs.oilVolume,
          conversions,
          currency: prefs.currency,
        }),

      currencyFactor,
      oilFactor,
      gasFactor,
      energyFactor,
      massFactor,

      currencyCode: prefs.currency,
      currencySymbol: CURRENCY_SYMBOLS[prefs.currency] ?? prefs.currency,
      oilUnit: prefs.oilVolume,
      gasUnit: prefs.gasVolume,
      energyUnit: prefs.energy,
      massUnit: prefs.mass,

      prefs,
      conversions,
    }),
    [
      prefs,
      conversions,
      currencyFactor,
      oilFactor,
      gasFactor,
      energyFactor,
      massFactor,
    ],
  );
}

// Re-export the scale type so consumers can pass a typed scale without
// importing from format.ts directly.
export type { UnitScale };
