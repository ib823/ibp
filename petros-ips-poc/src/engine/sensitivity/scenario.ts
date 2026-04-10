// ════════════════════════════════════════════════════════════════════════
// Scenario Comparison
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  PriceDeck,
  EconomicsResult,
  ScenarioVersion,
} from '@/engine/types';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';

export function compareScenarios(
  project: ProjectInputs,
  priceDecks: Record<ScenarioVersion, PriceDeck>,
): Record<ScenarioVersion, EconomicsResult> {
  const results = {} as Record<ScenarioVersion, EconomicsResult>;

  for (const scenario of ['base', 'high', 'low', 'stress'] as const) {
    results[scenario] = calculateProjectEconomics(project, priceDecks[scenario], scenario);
  }

  return results;
}
