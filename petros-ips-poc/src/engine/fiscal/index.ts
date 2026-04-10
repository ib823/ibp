// ════════════════════════════════════════════════════════════════════════
// Fiscal Engine Dispatcher
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  PriceDeck,
  YearlyCashflow,
  FiscalRegime,
  CostProfile,
  USD,
  TimeSeriesData,
} from '@/engine/types';
import { calculatePscRc } from './psc-rc';
import { calculatePscEpt } from './psc-ept';
import { calculatePscSfa } from './psc-sfa';
import { calculatePscLegacy } from './psc-legacy';
import { calculateDownstream } from './downstream';

export { calculatePscRc } from './psc-rc';
export { calculatePscEpt } from './psc-ept';
export { calculatePscSfa } from './psc-sfa';
export { calculatePscLegacy } from './psc-legacy';
export { calculateDownstream } from './downstream';

/** Scale all CAPEX line items by a factor (e.g., 0.90 for 10% DW allowance) */
function reduceCapex(costs: CostProfile, factor: number): CostProfile {
  function scale(series: TimeSeriesData<USD>): TimeSeriesData<USD> {
    const out: Record<number, USD> = {};
    for (const [y, v] of Object.entries(series)) {
      out[Number(y)] = ((v as number) * factor) as USD;
    }
    return out;
  }
  return {
    ...costs,
    capexDrilling: scale(costs.capexDrilling),
    capexFacilities: scale(costs.capexFacilities),
    capexSubsea: scale(costs.capexSubsea),
    capexOther: scale(costs.capexOther),
  };
}

/**
 * Route a project to the correct fiscal engine based on regime type.
 * Returns yearly cashflows for the full project life.
 *
 * TypeScript exhaustive check: adding a new FiscalRegime variant
 * without handling it here causes a compile error.
 */
export function calculateFiscalCashflows(
  project: ProjectInputs,
  priceDeck: PriceDeck,
): YearlyCashflow[] {
  const { productionProfile, costProfile, fiscalRegimeConfig, project: proj } = project;
  const base = {
    yearlyProduction: productionProfile,
    yearlyCosts: costProfile,
    priceDeck,
    equityShare: proj.equityShare,
    startYear: proj.startYear,
    endYear: proj.endYear,
  };

  const regime: FiscalRegime = fiscalRegimeConfig;

  switch (regime.type) {
    case 'PSC_RC':
      return calculatePscRc({ ...base, fiscalConfig: regime });

    case 'PSC_DW':
      // Deepwater: apply DW allowance as CAPEX reduction, then use R/C engine
      return calculatePscRc({
        ...base,
        yearlyCosts: reduceCapex(costProfile, 1 - regime.deepwaterAllowance),
        fiscalConfig: {
          type: 'PSC_RC',
          royaltyRate: regime.royaltyRate,
          pitaRate: regime.pitaRate,
          exportDutyRate: regime.exportDutyRate,
          researchCessRate: regime.researchCessRate,
          tranches: regime.tranches,
        },
      });

    case 'PSC_HPHT':
      // HPHT: apply HPHT allowance as CAPEX reduction, then use R/C engine
      return calculatePscRc({
        ...base,
        yearlyCosts: reduceCapex(costProfile, 1 - regime.hphtAllowance),
        fiscalConfig: {
          type: 'PSC_RC',
          royaltyRate: regime.royaltyRate,
          pitaRate: regime.pitaRate,
          exportDutyRate: regime.exportDutyRate,
          researchCessRate: regime.researchCessRate,
          tranches: regime.tranches,
        },
      });

    case 'PSC_EPT':
      return calculatePscEpt({ ...base, fiscalConfig: regime });

    case 'PSC_SFA':
      return calculatePscSfa({ ...base, fiscalConfig: regime });

    case 'PSC_LLA':
      // LLA uses SFA engine with same fixed-percentage mechanics
      return calculatePscSfa({
        ...base,
        fiscalConfig: {
          type: 'PSC_SFA',
          royaltyRate: regime.royaltyRate,
          pitaRate: regime.pitaRate,
          exportDutyRate: regime.exportDutyRate,
          researchCessRate: regime.researchCessRate,
          costRecoveryCeilingPct: regime.costRecoveryCeilingPct,
          contractorProfitSharePct: regime.contractorProfitSharePct,
          petronasProfitSharePct: regime.petronasProfitSharePct,
        },
      });

    case 'PSC_1976':
    case 'PSC_1985':
      return calculatePscLegacy({ ...base, fiscalConfig: regime });

    case 'RSC':
      // RSC (Risk Service Contract) is a fee-based contractual model distinct from PSCs.
      // For this POC, RSC projects use a simplified corporate-tax-based calculation.
      // In the production SAC implementation, a dedicated RSC engine will model:
      // fee-per-barrel, performance bonuses, cost reimbursement, and reduced PITA (25%).
      return calculateDownstream({
        ...base,
        fiscalConfig: {
          type: 'DOWNSTREAM',
          royaltyRate: regime.royaltyRate,
          pitaRate: regime.pitaRate,
          exportDutyRate: regime.exportDutyRate,
          researchCessRate: regime.researchCessRate,
          taxRate: regime.pitaRate, // use PITA rate as corporate tax proxy
        },
      });

    case 'DOWNSTREAM':
      return calculateDownstream({ ...base, fiscalConfig: regime });

    default: {
      // Exhaustive check — compiler error if a new type is unhandled
      const _exhaustive: never = regime;
      throw new Error(`Unhandled fiscal regime: ${(_exhaustive as FiscalRegime).type}`);
    }
  }
}
