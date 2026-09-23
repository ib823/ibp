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
  /** CFADS / (interest + scheduled principal); NaN when no debt service. */
  readonly dscr: number;
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
  const r = inputs.interestRate;
  const n = inputs.tenorYears;

  const schedule: YearlyDebtSchedule[] = [];
  let opening = 0;
  let annualPayment = 0;
  let debtAtCommercialOps = 0;
  const debtTimelineYears = constructionYears + n;

  for (let i = 0; i < debtTimelineYears; i++) {
    const inConstruction = i < constructionYears;
    const drawdown = inConstruction ? totalDebt / constructionYears : 0;
    const cfadsThisYear = inputs.cfads[i] ?? 0;

    if (i === constructionYears) {
      // Commercial operations: size the mortgage-style instalment on the
      // balance then outstanding (drawdowns + capitalised construction
      // interest). PMT = P × r(1+r)^n / ((1+r)^n − 1)
      debtAtCommercialOps = opening;
      annualPayment = n > 0 && r > 0
        ? opening * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        : opening / Math.max(1, n);
    }

    let interest: number;
    let scheduledPrincipal = 0;
    let cashSweep = 0;
    let capitalisedInterest = 0;

    if (inConstruction) {
      // Interest during construction on the average balance is capitalised
      // (rolled up into the loan), not paid.
      interest = (opening + drawdown / 2) * r;
      capitalisedInterest = interest;
    } else {
      interest = opening * r;
      scheduledPrincipal = Math.min(Math.max(0, annualPayment - interest), opening);
      // Cash sweep: surplus CFADS above the DSCR threshold goes to early repayment.
      const minDebtService = (interest + scheduledPrincipal) * sweepThreshold;
      const surplus = Math.max(0, cfadsThisYear - minDebtService);
      cashSweep = Math.min(surplus, opening - scheduledPrincipal);
    }

    const closing = Math.max(0, opening + drawdown + capitalisedInterest - scheduledPrincipal - cashSweep);
    const debtService = inConstruction ? 0 : interest + scheduledPrincipal;
    // DSCR is undefined (NaN) in years with no debt service — construction,
    // or after the loan has been swept — and those years are excluded from
    // the min / average below.
    const dscr = debtService > 0 ? cfadsThisYear / debtService : Number.NaN;

    schedule.push({
      year: i,
      opening: usd(opening),
      drawdown: usd(drawdown),
      interest: usd(interest),
      scheduledPrincipal: usd(scheduledPrincipal),
      cashSweep: usd(cashSweep),
      closing: usd(closing),
      cfads: usd(cfadsThisYear),
      dscr,
      cfadsAfterDebtService: usd(cfadsThisYear - debtService - cashSweep),
    });

    opening = closing;
  }

  // Coverage over every year with debt service — negative DSCRs included
  // so covenant breaches are visible.
  const operationalDscrs = schedule.filter((y) => Number.isFinite(y.dscr)).map((y) => y.dscr);
  const minDscr = operationalDscrs.length ? Math.min(...operationalDscrs) : 0;
  const avgDscr = operationalDscrs.length
    ? operationalDscrs.reduce((s, x) => s + x, 0) / operationalDscrs.length
    : 0;

  // LLCR / PLCR: PV at commercial operations of CFADS ÷ debt outstanding
  // then. The first operating year's CFADS arrives one year after that
  // date, so year k of operations is discounted by (1+r)^(k+1).
  const pvFromCod = (flows: readonly number[]) =>
    flows.reduce((acc, cf, k) => acc + cf / Math.pow(1 + r, k + 1), 0);
  const llcr = debtAtCommercialOps > 0
    ? pvFromCod(inputs.cfads.slice(constructionYears, constructionYears + n)) / debtAtCommercialOps
    : 0;
  const plcr = debtAtCommercialOps > 0
    ? pvFromCod(inputs.cfads.slice(constructionYears)) / debtAtCommercialOps
    : 0;

  // Tax shield on interest expensed during operations (capitalised
  // construction interest is recovered through capital allowances instead).
  const taxShieldStream = schedule.map((y, i) => (i < constructionYears ? 0 : (y.interest as number) * inputs.taxRate));
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
