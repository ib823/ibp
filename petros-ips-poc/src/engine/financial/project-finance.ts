// ════════════════════════════════════════════════════════════════════════
// Project Finance — Debt Service Waterfall + Coverage Ratios (D6, RFP §5)
// ════════════════════════════════════════════════════════════════════════
//
// Standard project-finance evaluation framework for capital-intensive
// upstream / midstream / LNG developments. Models:
//
//   - Capital structure: senior debt + sponsor equity.
//   - Debt drawdown during construction (CAPEX phase).
//   - Repayment schedule during operations (typical: equal-instalment or
//     mortgage-style).
//   - Interest accrued at fixed rate (POC) or floating (Phase 1b extension).
//   - Tax shield from interest deduction.
//   - Cash-sweep mechanic: surplus cash above DSCR floor sweeps to early
//     repayment (lender protection).
//
// Coverage ratios per industry standard:
//
//   - DSCR (Debt Service Coverage Ratio) per period:
//       DSCR = CFADS / (Interest + Principal)   (target ≥ 1.20 for upstream)
//
//   - LLCR (Loan Life Coverage Ratio):
//       LLCR = NPV(CFADS over loan life) / Outstanding Debt   (target ≥ 1.30)
//
//   - PLCR (Project Life Coverage Ratio):
//       PLCR = NPV(CFADS over project life) / Outstanding Debt
//
// Reference: Yescombe E.R. (2013) "Principles of Project Finance"; Moody's
// Project Finance Methodology.
// ════════════════════════════════════════════════════════════════════════

import type { USD } from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { calculateNPV } from '@/engine/economics/npv';

export interface ProjectFinanceInputs {
  /** Cash Flow Available for Debt Service per year (operating CF less tax,
   *  before interest and principal repayments). */
  readonly cfads: readonly number[];
  /** Total project CAPEX during construction (year 0). */
  readonly totalCapex: number;
  /** Debt fraction of total CAPEX (e.g. 0.65 = 65% gearing). */
  readonly debtFraction: number;
  /** Interest rate on senior debt (e.g. 0.07 = 7%). */
  readonly interestRate: number;
  /** Loan tenor in years from start of operations. */
  readonly tenorYears: number;
  /** Number of construction years (debt drawn down progressively).
   *  POC default: 1. */
  readonly constructionYears?: number;
  /** Tax rate for interest tax-shield calculation. */
  readonly taxRate: number;
  /** Minimum DSCR at which cash-sweep activates (e.g. 1.30). */
  readonly cashSweepThreshold?: number;
}

export interface YearlyDebtSchedule {
  readonly year: number;
  readonly opening: USD;
  readonly drawdown: USD;
  readonly interest: USD;
  readonly scheduledPrincipal: USD;
  readonly cashSweep: USD;
  readonly closing: USD;
  readonly cfads: USD;
  readonly dscr: number; // CFADS / (interest + principal)
  readonly cfadsAfterDebtService: USD;
}

export interface ProjectFinanceResult {
  readonly schedule: readonly YearlyDebtSchedule[];
  readonly totalDebt: USD;
  readonly totalEquity: USD;
  readonly minDscr: number;
  readonly avgDscr: number;
  readonly llcr: number;
  readonly plcr: number;
  readonly taxShieldNpv: USD;
}

export function buildDebtServiceSchedule(inputs: ProjectFinanceInputs): ProjectFinanceResult {
  const constructionYears = inputs.constructionYears ?? 1;
  const totalDebt = inputs.totalCapex * inputs.debtFraction;
  const totalEquity = inputs.totalCapex * (1 - inputs.debtFraction);
  const sweepThreshold = inputs.cashSweepThreshold ?? 1.30;

  // Mortgage-style equal-payment schedule:  PMT = P × (r × (1+r)^n) / ((1+r)^n − 1)
  const r = inputs.interestRate;
  const n = inputs.tenorYears;
  const annualPayment = n > 0 && r > 0
    ? totalDebt * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    : totalDebt / Math.max(1, n);

  const schedule: YearlyDebtSchedule[] = [];
  let opening = 0;
  const debtTimelineYears = constructionYears + n;

  for (let i = 0; i < debtTimelineYears; i++) {
    const inConstruction = i < constructionYears;
    const drawdown = inConstruction ? totalDebt / constructionYears : 0;
    const balanceForInterest = opening + drawdown;
    const interest = balanceForInterest * r;
    const cfadsThisYear = inputs.cfads[i] ?? 0;

    let scheduledPrincipal = 0;
    let cashSweep = 0;

    if (!inConstruction) {
      scheduledPrincipal = Math.min(annualPayment - interest, opening);
      // Cash sweep: surplus CFADS above the DSCR threshold goes to early repayment.
      const minDebtService = (interest + scheduledPrincipal) * sweepThreshold;
      const surplus = Math.max(0, cfadsThisYear - minDebtService);
      cashSweep = Math.min(surplus, opening - scheduledPrincipal);
    }

    const closing = Math.max(0, opening + drawdown - scheduledPrincipal - cashSweep);
    const dscr = (interest + scheduledPrincipal) > 0
      ? cfadsThisYear / (interest + scheduledPrincipal)
      : Infinity;

    schedule.push({
      year: i,
      opening: usd(opening),
      drawdown: usd(drawdown),
      interest: usd(interest),
      scheduledPrincipal: usd(scheduledPrincipal),
      cashSweep: usd(cashSweep),
      closing: usd(closing),
      cfads: usd(cfadsThisYear),
      dscr: Number.isFinite(dscr) ? dscr : 99.99,
      cfadsAfterDebtService: usd(cfadsThisYear - interest - scheduledPrincipal - cashSweep),
    });

    opening = closing;
  }

  const operationalDscrs = schedule
    .filter((y) => y.year >= constructionYears && Number.isFinite(y.dscr) && y.dscr > 0)
    .map((y) => y.dscr);
  const minDscr = operationalDscrs.length ? Math.min(...operationalDscrs) : 0;
  const avgDscr = operationalDscrs.length
    ? operationalDscrs.reduce((s, x) => s + x, 0) / operationalDscrs.length
    : 0;

  // LLCR: NPV of CFADS over loan life ÷ outstanding debt at construction end
  const loanLifeCfads = inputs.cfads.slice(constructionYears, constructionYears + n);
  const outstandingAtCommercialOps = totalDebt; // simplified — pre-amortisation
  const llcr = outstandingAtCommercialOps > 0
    ? calculateNPV(loanLifeCfads, r) / outstandingAtCommercialOps
    : 0;

  // PLCR: NPV of CFADS over project life ÷ outstanding debt
  const plcr = outstandingAtCommercialOps > 0
    ? calculateNPV(inputs.cfads.slice(constructionYears), r) / outstandingAtCommercialOps
    : 0;

  // Tax shield from interest deduction
  const interestStream = schedule.map((y) => y.interest as number);
  const taxShieldStream = interestStream.map((i) => i * inputs.taxRate);
  const taxShieldNpv = calculateNPV(taxShieldStream, r);

  return {
    schedule,
    totalDebt: usd(totalDebt),
    totalEquity: usd(totalEquity),
    minDscr,
    avgDscr,
    llcr,
    plcr,
    taxShieldNpv: usd(taxShieldNpv),
  };
}
