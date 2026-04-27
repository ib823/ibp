// ════════════════════════════════════════════════════════════════════════
// Sensitivity modifiers — deep-clone and scale inputs
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  PriceDeck,
  TimeSeriesData,
  FiscalRegime,
} from '@/engine/types';

function scaleTimeSeries<T extends number>(
  series: TimeSeriesData<T>,
  factor: number,
): TimeSeriesData<T> {
  const result: Record<number, T> = {};
  for (const [year, value] of Object.entries(series)) {
    result[Number(year)] = (value * factor) as T;
  }
  return result;
}

export function applyPriceSensitivity(
  priceDeck: PriceDeck,
  variable: 'oilPrice' | 'gasPrice' | 'fx',
  pct: number,
): PriceDeck {
  const factor = 1 + pct;
  switch (variable) {
    case 'oilPrice':
      return {
        ...priceDeck,
        oil: scaleTimeSeries(priceDeck.oil, factor),
        // Condensate tracks oil price
        condensate: scaleTimeSeries(priceDeck.condensate, factor),
      };
    case 'gasPrice':
      return {
        ...priceDeck,
        gas: scaleTimeSeries(priceDeck.gas, factor),
      };
    case 'fx':
      // FX flex per Bank Negara reference rate band (D4 / D36).
      // Scales `exchangeRate` time series; downstream consumers use this
      // for MYR-functional reporting / consolidation (D44).
      return {
        ...priceDeck,
        exchangeRate: scaleTimeSeries(priceDeck.exchangeRate, factor),
      };
  }
}

/**
 * Apply a multiplicative scale to a fiscal-regime parameter (PITA rate,
 * royalty rate, Sarawak SST rate) for sensitivity / Monte Carlo. (D38)
 *
 * Scaling rates rather than absolute-rate-changes keeps the sensitivity
 * symmetric around the base. For example `pct=+0.10` increases PITA from
 * 38% to 41.8% (38% × 1.10). For Budget-cycle scenarios, the UI may
 * prefer absolute-rate inputs — that's a Phase 1b SAC delivery.
 */
export function applyFiscalSensitivity(
  project: ProjectInputs,
  variable: 'pitaRate' | 'royaltyRate' | 'sarawakSstRate',
  pct: number,
): ProjectInputs {
  const factor = 1 + pct;
  const base = project.fiscalRegimeConfig;
  const scaled: FiscalRegime = (() => {
    switch (variable) {
      case 'pitaRate':
        return { ...base, pitaRate: base.pitaRate * factor };
      case 'royaltyRate':
        return { ...base, royaltyRate: base.royaltyRate * factor };
      case 'sarawakSstRate':
        return {
          ...base,
          sarawakSstRate: (base.sarawakSstRate ?? 0) * factor,
        };
    }
  })();
  return { ...project, fiscalRegimeConfig: scaled };
}

export function applyProjectSensitivity(
  project: ProjectInputs,
  variable: 'production' | 'capex' | 'opex',
  pct: number,
): ProjectInputs {
  const factor = 1 + pct;

  switch (variable) {
    case 'production':
      return {
        ...project,
        productionProfile: {
          oil: scaleTimeSeries(project.productionProfile.oil, factor),
          gas: scaleTimeSeries(project.productionProfile.gas, factor),
          condensate: scaleTimeSeries(project.productionProfile.condensate, factor),
          water: project.productionProfile.water,
        },
      };
    case 'capex':
      return {
        ...project,
        costProfile: {
          ...project.costProfile,
          capexDrilling: scaleTimeSeries(project.costProfile.capexDrilling, factor),
          capexFacilities: scaleTimeSeries(project.costProfile.capexFacilities, factor),
          capexSubsea: scaleTimeSeries(project.costProfile.capexSubsea, factor),
          capexOther: scaleTimeSeries(project.costProfile.capexOther, factor),
        },
      };
    case 'opex':
      return {
        ...project,
        costProfile: {
          ...project.costProfile,
          opexFixed: scaleTimeSeries(project.costProfile.opexFixed, factor),
          opexVariable: scaleTimeSeries(project.costProfile.opexVariable, factor),
        },
      };
  }
}
