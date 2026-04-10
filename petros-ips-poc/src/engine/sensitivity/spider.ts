// ════════════════════════════════════════════════════════════════════════
// Spider Diagram Sensitivity Analysis
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  PriceDeck,
  SensitivityVariable,
  USD,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { applyPriceSensitivity, applyProjectSensitivity } from './apply';

export interface SpiderPoint {
  readonly percentChange: number;
  readonly npv: USD;
}

export interface SpiderLine {
  readonly variable: SensitivityVariable;
  readonly points: readonly SpiderPoint[];
}

export interface SpiderResult {
  readonly baseNpv: USD;
  readonly lines: readonly SpiderLine[];
}

export function calculateSpider(
  project: ProjectInputs,
  priceDeck: PriceDeck,
  variables: SensitivityVariable[],
  rangePercent: number = 0.30,
  steps: number = 13,
): SpiderResult {
  const baseResult = calculateProjectEconomics(project, priceDeck);
  const baseNpv = baseResult.npv10 as number;

  const lines: SpiderLine[] = [];

  for (const variable of variables) {
    const points: SpiderPoint[] = [];

    for (let i = 0; i < steps; i++) {
      const pct = -rangePercent + (2 * rangePercent * i) / (steps - 1);

      let modifiedProject = project;
      let modifiedPriceDeck = priceDeck;

      if (variable === 'oilPrice' || variable === 'gasPrice') {
        modifiedPriceDeck = applyPriceSensitivity(priceDeck, variable, pct);
      } else {
        modifiedProject = applyProjectSensitivity(project, variable, pct);
      }

      const result = calculateProjectEconomics(modifiedProject, modifiedPriceDeck);
      points.push({
        percentChange: Math.round(pct * 1e6) / 1e6, // avoid float noise
        npv: usd(result.npv10 as number),
      });
    }

    lines.push({ variable, points });
  }

  return { baseNpv: usd(baseNpv), lines };
}
