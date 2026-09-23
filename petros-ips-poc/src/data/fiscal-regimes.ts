// Fiscal parameters based on publicly available PETRONAS MPM fiscal-terms
// pages, PwC Worldwide Tax Summaries (reviewed 16 Jun 2026) and Malaysian
// Budget measures — reviewed September 2026. Not actual PETROS contract
// terms: signed PSCs vary block by block (see PETROS_DELTAS.md D18–D21).
//
// Sources
//   MPM fiscal terms   https://www.petronas.com/mpm/investment-opportunities/fiscal-terms
//     • Deepwater R/C PSC (awards from June 2018) — Deepwater-R_C-PSC-Terms.pdf
//     • EPT, SFA, LLA pages
//   PITA incentives    https://taxsummaries.pwc.com/malaysia/corporate/tax-credits-and-incentives
//   CCS incentives     Budget 2023 (BDO Corporate Tax News, Nov 2022)
//   Sarawak SST        State Sales Tax Ordinance 1998 (Sarawak), petroleum
//                      products from 1 January 2019
//   Export duty        Customs Duties Order 2025 (P.U.(A) 384/2025)

import type {
  FiscalRegime_PSC_RC,
  FiscalRegime_PSC_EPT,
  FiscalRegime_PSC_SFA,
  FiscalRegime_PSC_DW,
  FiscalRegime_PSC_LLA,
  FiscalRegime_DOWNSTREAM,
} from '@/engine/types';

// ── R/C PSC ───────────────────────────────────────────────────────────
// Illustrative 1997-style R/C PSC — MPM does not publish the tranche table.
// Supplementary Payment uses the engine defaults (30 MMstb / 0.75 Tscf,
// 70%) — contract-specific, verify per signed PSC (D18).

export const RC_PSC: FiscalRegime_PSC_RC = {
  type: 'PSC_RC',
  royaltyRate: 0.10,
  pitaRate: 0.38,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  // Sarawak State Sales Tax 5% on petroleum products from 2019 (D1).
  sarawakSstRate: 0.05,
  host: 'PETROS' as const, // post-CSA 2020 (D2)
  tranches: [
    {
      rcFloor: 0,
      rcCeiling: 1.0,
      costRecoveryCeilingPct: 0.70,
      contractorProfitSharePct: 0.70,
      hostProfitSharePct: 0.30,
    },
    {
      rcFloor: 1.0,
      rcCeiling: 1.4,
      costRecoveryCeilingPct: 0.60,
      contractorProfitSharePct: 0.60,
      hostProfitSharePct: 0.40,
    },
    {
      rcFloor: 1.4,
      rcCeiling: 2.0,
      costRecoveryCeilingPct: 0.50,
      contractorProfitSharePct: 0.50,
      hostProfitSharePct: 0.50,
    },
    {
      rcFloor: 2.0,
      rcCeiling: 2.5,
      costRecoveryCeilingPct: 0.30,
      contractorProfitSharePct: 0.30,
      hostProfitSharePct: 0.70,
    },
    {
      rcFloor: 2.5,
      rcCeiling: Infinity,
      costRecoveryCeilingPct: 0.20,
      contractorProfitSharePct: 0.20,
      hostProfitSharePct: 0.80,
    },
  ],
};

// ── Deepwater R/C PSC ─────────────────────────────────────────────────
// MPM Deepwater R/C PSC term — all new deepwater PSCs awarded from June
// 2018. Cost ceiling self-adjusts from 80%; contractor profit share differs
// for oil and gas and below / above the Threshold Volume (300 MMstb oil,
// 2 Tcf gas per PSC). Supplementary payment (claw-back on excess profit)
// only triggers after "breakeven" at R/C 1.2 (oil) / 1.4 (gas); its rate is
// contract-specific and not published, so none is modelled by default.
// MPM keeps separate oil and gas cost banks; the engine uses one pool.
// PITA investment allowance for deepwater (> 200 m): 60% of qualifying
// capex against up to 70% of statutory income, for ten years.

export const DW_PSC: FiscalRegime_PSC_DW = {
  type: 'PSC_DW',
  royaltyRate: 0.10,
  pitaRate: 0.38,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  sarawakSstRate: 0.05, // Sarawak deepwater (D1)
  host: 'PETROS' as const,
  thresholdVolume: { liquidsMmstb: 300, gasTscf: 2 },
  supplementaryPayment: null,
  investmentAllowance: { rate: 0.60, statutoryIncomeCap: 0.70, periodYears: 10 },
  tranches: [
    {
      rcFloor: 0,
      rcCeiling: 1.0,
      costRecoveryCeilingPct: 0.80,
      contractorProfitSharePct: 0.80,
      hostProfitSharePct: 0.20,
      contractorProfitSharePctAboveThv: 0.60,
      gasContractorProfitSharePct: 0.80,
      gasContractorProfitSharePctAboveThv: 0.60,
    },
    {
      rcFloor: 1.0,
      rcCeiling: 1.4,
      costRecoveryCeilingPct: 0.80,
      contractorProfitSharePct: 0.70,
      hostProfitSharePct: 0.30,
      contractorProfitSharePctAboveThv: 0.50,
      gasContractorProfitSharePct: 0.80,
      gasContractorProfitSharePctAboveThv: 0.60,
    },
    {
      rcFloor: 1.4,
      rcCeiling: 2.0,
      costRecoveryCeilingPct: 0.70,
      contractorProfitSharePct: 0.60,
      hostProfitSharePct: 0.40,
      contractorProfitSharePctAboveThv: 0.40,
      gasContractorProfitSharePct: 0.70,
      gasContractorProfitSharePctAboveThv: 0.50,
    },
    {
      rcFloor: 2.0,
      rcCeiling: 2.5,
      costRecoveryCeilingPct: 0.70,
      contractorProfitSharePct: 0.50,
      hostProfitSharePct: 0.50,
      contractorProfitSharePctAboveThv: 0.40,
      gasContractorProfitSharePct: 0.60,
      gasContractorProfitSharePctAboveThv: 0.40,
    },
    {
      rcFloor: 2.5,
      rcCeiling: 3.0,
      costRecoveryCeilingPct: 0.60,
      contractorProfitSharePct: 0.50,
      hostProfitSharePct: 0.50,
      contractorProfitSharePctAboveThv: 0.40,
      gasContractorProfitSharePct: 0.50,
      gasContractorProfitSharePctAboveThv: 0.40,
    },
    {
      rcFloor: 3.0,
      rcCeiling: Infinity,
      costRecoveryCeilingPct: 0.60,
      contractorProfitSharePct: 0.50,
      hostProfitSharePct: 0.50,
      contractorProfitSharePctAboveThv: 0.40,
      gasContractorProfitSharePct: 0.50,
      gasContractorProfitSharePctAboveThv: 0.40,
    },
  ],
};

// ── EPT ───────────────────────────────────────────────────────────────
// MPM Enhanced Profitability Terms: cost ceiling fixed at 70% of gross
// production; contractor profit share 90% at PI ≤ 1.5, 1.8 − 0.6 × PI up
// to 2.5, 30% above; single oil-and-gas cost pool; no THV / SP.

export const EPT_PSC: FiscalRegime_PSC_EPT = {
  type: 'PSC_EPT',
  royaltyRate: 0.10,
  pitaRate: 0.38,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  sarawakSstRate: 0.05, // Sarawak block default (D1)
  host: 'PETROS' as const,
  piLower: 1.50,
  piUpper: 2.50,
  contractorShareAtLower: 0.90,
  contractorShareAtUpper: 0.30,
  fixedCostRecoveryCeiling: 0.70,
};

// ── SFA ───────────────────────────────────────────────────────────────

// MPM SFA: research cess, training / education commitments and
// supplementary payment are not applicable; the cost ceiling and profit
// split are not published (80% / 70:30 below are illustrative). PITA 25% is
// the marginal-field effective rate, available where the Minister of
// Finance designates the field.
export const SFA_PSC: FiscalRegime_PSC_SFA = {
  type: 'PSC_SFA',
  royaltyRate: 0.10,
  pitaRate: 0.25,
  exportDutyRate: 0.10,
  researchCessRate: 0,
  sarawakSstRate: 0.05, // Sarawak marginal field default (D1)
  host: 'PETROS' as const,
  costRecoveryCeilingPct: 0.80,
  contractorProfitSharePct: 0.70,
  hostProfitSharePct: 0.30,
};

// ── LLA (Late Life Asset) ─────────────────────────────────────────────
// MPM LLA: cash payment max 10%, abandonment cess of Y% of gross production
// (biddable) until the abandonment cost commitment is funded, contractor
// keeps the rest; no cost recovery, research cess or SP. PITA incentives
// for LLA PSCs signed 2020–2029: 25% rate, two-year capital allowances,
// export duty exemption. Y% and the commitment below are illustrative; no
// sample project uses LLA.

export const LLA_PSC: FiscalRegime_PSC_LLA = {
  type: 'PSC_LLA',
  royaltyRate: 0.10,
  pitaRate: 0.25,
  exportDutyRate: 0,
  researchCessRate: 0,
  sarawakSstRate: 0.05,
  host: 'PETROS' as const,
  abandonmentCessRate: 0.05,
  abandonmentCostCommitment: 60_000_000,
};

// ── Downstream (corporate tax) ────────────────────────────────────────

export const DOWNSTREAM_TAX: FiscalRegime_DOWNSTREAM = {
  type: 'DOWNSTREAM',
  royaltyRate: 0,
  pitaRate: 0,
  exportDutyRate: 0,
  researchCessRate: 0,
  sarawakSstRate: 0, // SST applies to upstream petroleum only; CCS/downstream excluded
  host: 'PETROS' as const,
  taxRate: 0.24, // Malaysian corporate income tax, YA 2026
  // CCS incentive (Budget 2023, applications 1 Jan 2023 – 31 Dec 2027;
  // D62). A CCS service provider elects EITHER a 100% Investment Tax
  // Allowance on qualifying capex for 10 years, set off against up to 100%
  // of statutory income, OR a 70% income-tax exemption for 10 years — not
  // both. M3 CCS is capex-heavy, so the allowance is the better election.
  // Equipment is also exempt from import duty and sales tax to 2027 (not
  // modelled). PETROS to confirm the election in Phase 1a Discovery.
  ccsIncentive: {
    type: 'investment-tax-allowance',
    allowanceRate: 1.0,
    statutoryIncomeCap: 1.0,
    periodYears: 10,
  },
};

// ── RSC (Risk Service Contract) ───────────────────────────────────────
//
// Fee-based contractual model — contractor produces under a per-barrel
// fee, with cost reimbursement (capped) and a performance bonus paid
// when cumulative production crosses a threshold. The contractor's fee
// income is taxed under the Income Tax Act 1967 at the corporate rate
// (24%), not PITA; PETRONAS, as owner of the production, bears royalty,
// export duty and SST, and the contractor pays no research cess.
// Numbers below are illustrative for the Berantai-style RSC framework.
import type { FiscalRegime_RSC } from '@/engine/types';
export const RSC_CONTRACT: FiscalRegime_RSC = {
  type: 'RSC',
  royaltyRate: 0.10,
  pitaRate: 0.24,                // income tax (ITA 1967) on fee income
  exportDutyRate: 0.10,          // borne by PETRONAS from its share, not the contractor
  researchCessRate: 0,
  sarawakSstRate: 0.05, // Sarawak RSC default (D1)
  host: 'PETROS' as const,
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
  PSC_LLA: LLA_PSC,
  RSC: RSC_CONTRACT,
  DOWNSTREAM: DOWNSTREAM_TAX,
} as const;
