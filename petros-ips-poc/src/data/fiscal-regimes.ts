// ILLUSTRATIVE fiscal parameters based on publicly available PETRONAS MPM
// descriptions. Not actual PETROS contract terms.

import type {
  FiscalRegime_PSC_RC,
  FiscalRegime_PSC_EPT,
  FiscalRegime_PSC_SFA,
  FiscalRegime_PSC_DW,
  FiscalRegime_DOWNSTREAM,
} from '@/engine/types';

// ── R/C PSC ───────────────────────────────────────────────────────────

export const RC_PSC: FiscalRegime_PSC_RC = {
  type: 'PSC_RC',
  royaltyRate: 0.10,
  pitaRate: 0.38,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  tranches: [
    {
      rcFloor: 0,
      rcCeiling: 1.0,
      costRecoveryCeilingPct: 0.70,
      contractorProfitSharePct: 0.70,
      petronasProfitSharePct: 0.30,
    },
    {
      rcFloor: 1.0,
      rcCeiling: 1.4,
      costRecoveryCeilingPct: 0.60,
      contractorProfitSharePct: 0.60,
      petronasProfitSharePct: 0.40,
    },
    {
      rcFloor: 1.4,
      rcCeiling: 2.0,
      costRecoveryCeilingPct: 0.50,
      contractorProfitSharePct: 0.50,
      petronasProfitSharePct: 0.50,
    },
    {
      rcFloor: 2.0,
      rcCeiling: 2.5,
      costRecoveryCeilingPct: 0.30,
      contractorProfitSharePct: 0.30,
      petronasProfitSharePct: 0.70,
    },
    {
      rcFloor: 2.5,
      rcCeiling: Infinity,
      costRecoveryCeilingPct: 0.20,
      contractorProfitSharePct: 0.20,
      petronasProfitSharePct: 0.80,
    },
  ],
};

// ── Deepwater R/C PSC ─────────────────────────────────────────────────

export const DW_PSC: FiscalRegime_PSC_DW = {
  type: 'PSC_DW',
  royaltyRate: 0.10,
  pitaRate: 0.38,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  deepwaterAllowance: 0.10,
  tranches: [
    {
      rcFloor: 0,
      rcCeiling: 1.0,
      costRecoveryCeilingPct: 0.75,
      contractorProfitSharePct: 0.75,
      petronasProfitSharePct: 0.25,
    },
    {
      rcFloor: 1.0,
      rcCeiling: 1.4,
      costRecoveryCeilingPct: 0.65,
      contractorProfitSharePct: 0.65,
      petronasProfitSharePct: 0.35,
    },
    {
      rcFloor: 1.4,
      rcCeiling: 2.0,
      costRecoveryCeilingPct: 0.55,
      contractorProfitSharePct: 0.55,
      petronasProfitSharePct: 0.45,
    },
    {
      rcFloor: 2.0,
      rcCeiling: 2.5,
      costRecoveryCeilingPct: 0.35,
      contractorProfitSharePct: 0.35,
      petronasProfitSharePct: 0.65,
    },
    {
      rcFloor: 2.5,
      rcCeiling: Infinity,
      costRecoveryCeilingPct: 0.25,
      contractorProfitSharePct: 0.25,
      petronasProfitSharePct: 0.75,
    },
  ],
};

// ── EPT ───────────────────────────────────────────────────────────────

export const EPT_PSC: FiscalRegime_PSC_EPT = {
  type: 'PSC_EPT',
  royaltyRate: 0.10,
  pitaRate: 0.38,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  piLower: 1.50,
  piUpper: 2.50,
  contractorShareAtLower: 0.90,
  contractorShareAtUpper: 0.30,
  fixedCostRecoveryCeiling: 0.70,
};

// ── SFA ───────────────────────────────────────────────────────────────

export const SFA_PSC: FiscalRegime_PSC_SFA = {
  type: 'PSC_SFA',
  royaltyRate: 0.10,
  pitaRate: 0.25,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  costRecoveryCeilingPct: 0.80,
  contractorProfitSharePct: 0.70,
  petronasProfitSharePct: 0.30,
};

// ── Downstream (corporate tax) ────────────────────────────────────────

export const DOWNSTREAM_TAX: FiscalRegime_DOWNSTREAM = {
  type: 'DOWNSTREAM',
  royaltyRate: 0,
  pitaRate: 0,
  exportDutyRate: 0,
  researchCessRate: 0,
  taxRate: 0.24,
};

// ── RSC (Risk Service Contract) ───────────────────────────────────────
//
// Fee-based contractual model — contractor produces under a per-barrel
// fee, with cost reimbursement (capped) and a performance bonus paid
// when cumulative production crosses a threshold. PITA reduced to 25%.
// Numbers below are illustrative for the Berantai-style RSC framework.
import type { FiscalRegime_RSC } from '@/engine/types';
export const RSC_CONTRACT: FiscalRegime_RSC = {
  type: 'RSC',
  royaltyRate: 0.10,
  pitaRate: 0.25,
  exportDutyRate: 0,
  researchCessRate: 0.005,
  feePerBarrel: 12.50,           // USD per oil-equivalent barrel produced
  performanceBonus: 25_000_000,  // USD lump-sum at the 30 MMboe milestone
  costReimbursementPct: 0.60,    // 60% of contractor's CAPEX/OPEX reimbursed
};

// ── Lookup map ────────────────────────────────────────────────────────

export const FISCAL_REGIMES = {
  PSC_RC: RC_PSC,
  PSC_DW: DW_PSC,
  PSC_EPT: EPT_PSC,
  PSC_SFA: SFA_PSC,
  RSC: RSC_CONTRACT,
  DOWNSTREAM: DOWNSTREAM_TAX,
} as const;
