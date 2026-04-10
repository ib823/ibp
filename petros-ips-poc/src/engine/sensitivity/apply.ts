// ════════════════════════════════════════════════════════════════════════
// Sensitivity modifiers — deep-clone and scale inputs
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  PriceDeck,
  TimeSeriesData,
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
  variable: 'oilPrice' | 'gasPrice',
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
  }
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
