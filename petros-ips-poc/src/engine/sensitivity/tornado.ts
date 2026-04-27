// ════════════════════════════════════════════════════════════════════════
// Tornado Sensitivity Analysis
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  PriceDeck,
  SensitivityVariable,
  TornadoResult,
  TornadoDataPoint,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { applyPriceSensitivity, applyProjectSensitivity, applyFiscalSensitivity } from './apply';

const DEFAULT_VARIABLES: SensitivityVariable[] = [
  'oilPrice', 'gasPrice', 'production', 'capex', 'opex',
];

const DEFAULT_PERCENTAGES = [-0.30, -0.20, -0.10, 0.10, 0.20, 0.30];

export function calculateTornado(
  project: ProjectInputs,
  priceDeck: PriceDeck,
  variables: SensitivityVariable[] = DEFAULT_VARIABLES,
  percentages: number[] = DEFAULT_PERCENTAGES,
): TornadoResult {
  // Base case
  const baseResult = calculateProjectEconomics(project, priceDeck);
  const baseNpv = baseResult.npv10 as number;

  const dataPoints: TornadoDataPoint[] = [];

  for (const variable of variables) {
    for (const pct of percentages) {
      const { modifiedProject, modifiedPriceDeck } = applySensitivity(
        project, priceDeck, variable, pct,
      );
      const result = calculateProjectEconomics(modifiedProject, modifiedPriceDeck);
      const npvValue = result.npv10 as number;

      dataPoints.push({
        variable,
        percentChange: pct,
        npvDelta: usd(npvValue - baseNpv),
        npvValue: usd(npvValue),
      });
    }
  }

  // Sort by absolute impact at the largest percentage (±30%)
  const maxPct = Math.max(...percentages.map(Math.abs));
  const impactByVariable = new Map<SensitivityVariable, number>();
  for (const dp of dataPoints) {
    if (Math.abs(dp.percentChange) === maxPct) {
      const current = impactByVariable.get(dp.variable) ?? 0;
      impactByVariable.set(dp.variable, Math.max(current, Math.abs(dp.npvDelta as number)));
    }
  }

  // Sort data points: most sensitive variable first, then by percentage
  const variableOrder = [...impactByVariable.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);

  dataPoints.sort((a, b) => {
    const aIdx = variableOrder.indexOf(a.variable);
    const bIdx = variableOrder.indexOf(b.variable);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.percentChange - b.percentChange;
  });

  return {
    baseNpv: usd(baseNpv),
    dataPoints,
  };
}

function applySensitivity(
  project: ProjectInputs,
  priceDeck: PriceDeck,
  variable: SensitivityVariable,
  pct: number,
): { modifiedProject: ProjectInputs; modifiedPriceDeck: PriceDeck } {
  switch (variable) {
    case 'oilPrice':
    case 'gasPrice':
    case 'fx':
      return {
        modifiedProject: project,
        modifiedPriceDeck: applyPriceSensitivity(priceDeck, variable, pct),
      };
    case 'production':
    case 'capex':
    case 'opex':
      return {
        modifiedProject: applyProjectSensitivity(project, variable, pct),
        modifiedPriceDeck: priceDeck,
      };
    case 'pitaRate':
    case 'royaltyRate':
    case 'sarawakSstRate':
      return {
        modifiedProject: applyFiscalSensitivity(project, variable, pct),
        modifiedPriceDeck: priceDeck,
      };
    case 'discountRate':
    case 'reserves':
      // discountRate sensitivity is applied at calculateProjectEconomics
      // call site (the discount-rate argument), not as an input mutation.
      // reserves sensitivity scales production as a proxy for reserves
      // uncertainty (Phase 1b SAC delivery deepens this — D40).
      return variable === 'reserves'
        ? {
            modifiedProject: applyProjectSensitivity(project, 'production', pct),
            modifiedPriceDeck: priceDeck,
          }
        : { modifiedProject: project, modifiedPriceDeck: priceDeck };
  }
}
