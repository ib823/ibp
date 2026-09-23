// ════════════════════════════════════════════════════════════════════════
// Fiscal Engine Dispatcher
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  PriceDeck,
  YearlyCashflow,
  FiscalRegime,
} from '@/engine/types';
import { calculatePscRc } from './psc-rc';
import { calculatePscEpt } from './psc-ept';
import { calculatePscSfa } from './psc-sfa';
import { calculatePscLegacy } from './psc-legacy';
import { calculateDownstream } from './downstream';
import { calculateRsc } from './psc-rsc';
import { calculatePscLla } from './psc-lla';
import { workingInterestCosts } from './shared';

export { calculatePscRc } from './psc-rc';
export { calculatePscEpt } from './psc-ept';
export { calculatePscSfa } from './psc-sfa';
export { calculatePscLegacy } from './psc-legacy';
export { calculateDownstream } from './downstream';
export { calculateRsc } from './psc-rsc';
export { calculatePscLla } from './psc-lla';

/** Fields shared by every regime. Variants that delegate to another engine
 *  must forward all of them — dropping `sarawakSstRate` silently zeroes the
 *  Sarawak State Sales Tax of a Sarawak deepwater / late-life block. */
function baseTerms(regime: FiscalRegime) {
  return {
    royaltyRate: regime.royaltyRate,
    pitaRate: regime.pitaRate,
    exportDutyRate: regime.exportDutyRate,
    researchCessRate: regime.researchCessRate,
    sarawakSstRate: regime.sarawakSstRate,
    host: regime.host,
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
  const { productionProfile, fiscalRegimeConfig, project: proj } = project;
  // Revenue is taken at the equity share inside the engines; costs must be
  // on the same working-interest basis.
  const costProfile = workingInterestCosts(project);
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
    case 'PSC_HPHT':
      // Deepwater R/C PSC (MPM, awards from June 2018) and HPHT PSC run on
      // the R/C engine with their own tranches, Threshold Volume and SP
      // terms. The deepwater / HPHT incentive is the PITA investment
      // allowance on qualifying capex — a tax deduction, not a reduction of
      // the contractor's actual spend. No PSC_HPHT regime data is exported
      // in `data/fiscal-regimes.ts`; Phase 1a Discovery: confirm HPHT
      // applicability with PETROS. (D22)
      return calculatePscRc({
        ...base,
        fiscalConfig: {
          type: 'PSC_RC',
          ...baseTerms(regime),
          tranches: regime.tranches,
          thresholdVolume: regime.thresholdVolume,
          supplementaryPayment: regime.supplementaryPayment,
          investmentAllowance: regime.investmentAllowance,
        },
      });

    case 'PSC_EPT':
      return calculatePscEpt({ ...base, fiscalConfig: regime });

    case 'PSC_SFA':
      return calculatePscSfa({ ...base, fiscalConfig: regime });

    case 'PSC_LLA':
      // Late Life Asset PSC — no cost recovery / profit split; cash payment
      // + abandonment cess, contractor keeps the rest. See psc-lla.ts.
      return calculatePscLla({ ...base, fiscalConfig: regime });

    case 'PSC_1976':
    case 'PSC_1985':
      return calculatePscLegacy({ ...base, fiscalConfig: regime });

    case 'RSC':
      // RSC (Risk Service Contract) — dedicated fee-based engine.
      // Models: feePerBarrel × oil-equivalent production, cost
      // reimbursement (capped at 70% of fee revenue), one-shot
      // performance bonus at 30 MMboe cumulative production threshold,
      // and income tax at the regime's rate on net contractor income
      // (service fees are taxed under ITA 1967, not PITA). See psc-rsc.ts.
      return calculateRsc({ ...base, fiscalConfig: regime });

    case 'DOWNSTREAM':
      return calculateDownstream({ ...base, fiscalConfig: regime });

    default: {
      // Exhaustive check — compiler error if a new type is unhandled
      const _exhaustive: never = regime;
      throw new Error(`Unhandled fiscal regime: ${(_exhaustive as FiscalRegime).type}`);
    }
  }
}
