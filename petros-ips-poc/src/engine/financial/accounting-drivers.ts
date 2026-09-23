// ════════════════════════════════════════════════════════════════════════
// Accounting drivers — one source for the IS, BS, CFS and roll-forwards
// ════════════════════════════════════════════════════════════════════════
//
// The statements are built on the contractor's working-interest basis from
// the fiscal cash flows, so that over the project life
//
//     Σ profit before tax  =  Σ net cash flow + Σ current tax
//
// and the balance sheet balances without a plug:
//
//     cash (Σ NCF) + PP&E + E&E + DTA = provision + DTL + retained earnings
//
//   • Revenue          contractor entitlement (MFRS 15 entitlement method):
//                      cost oil + profit oil − SP. Royalty, export duty,
//                      Sarawak SST and the host share are not the
//                      contractor's barrels.
//   • Cost of sales    OPEX + research cess (contractor-borne)
//   • PP&E (MFRS 116)  capex (after E&E), E&E reclassified at FID, and the
//                      capitalised decommissioning asset (IFRIC 1);
//                      depreciated from the year the asset is available for
//                      use (first revenue year)
//   • E&E (MFRS 6)     pre-FID capex of exploration-phase projects
//   • Provision        MFRS 137 / IFRIC 1: unwinding → finance cost,
//                      abandonment spend → utilisation (not an expense)
//   • Tax (MFRS 112)   current tax = fiscal-engine tax paid; deferred tax on
//                      book vs tax base of assets, the provision and
//                      unused tax losses
// ════════════════════════════════════════════════════════════════════════

import type { ProjectInputs, YearlyCashflow } from '@/engine/types';
import { computeCosts, workingInterestCosts } from '@/engine/fiscal/shared';
import { generateDecommissioningSchedule, DECOMM_DISCOUNT_RATE } from './decommissioning';
import { generateEESchedule } from './exploration-evaluation';

export interface AccountingDriverYear {
  readonly year: number;
  readonly revenue: number;
  /** OPEX + contractor-borne research cess. */
  readonly costOfSales: number;
  readonly capex: number;
  readonly abandonmentSpend: number;
  readonly currentTax: number;
  readonly netCashFlow: number;
  readonly eeAdditions: number;
  readonly eeReclassified: number;
  readonly eeWrittenOff: number;
  readonly eeClosing: number;
  /** Capex capitalised directly to PP&E plus E&E reclassified at FID. */
  readonly ppeCapexAdditions: number;
  /** Decommissioning asset capitalised this year (IFRIC 1). */
  readonly aroAddition: number;
  readonly unwinding: number;
  readonly provisionClosing: number;
  /** Tax written-down value of qualifying capex (capex − capital allowances). */
  readonly taxWrittenDownValue: number;
  readonly taxLossCF: number;
}

export interface AccountingDrivers {
  readonly years: readonly AccountingDriverYear[];
  /** Index of the first year the assets are available for use (first
   *  revenue year); −1 when the project never earns revenue. */
  readonly firstAvailableIdx: number;
  /** Statutory rate for deferred tax (PITA or corporate). */
  readonly taxRate: number;
}

const cache = new WeakMap<readonly YearlyCashflow[], WeakMap<ProjectInputs, AccountingDrivers>>();

export function accountingDrivers(
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
): AccountingDrivers {
  let byProject = cache.get(cashflows);
  if (!byProject) {
    byProject = new WeakMap();
    cache.set(cashflows, byProject);
  }
  const hit = byProject.get(project);
  if (hit) return hit;

  const { project: proj, fiscalRegimeConfig: regime } = project;
  const costProfile = workingInterestCosts(project);
  // Under an LLA PSC PETRONAS assumes decommissioning, funded by the
  // abandonment cess — the contractor carries no provision.
  const contractorBearsAbex = regime.type !== 'PSC_LLA';
  // Under an RSC the research cess is not a contractor payment.
  const contractorPaysCess = regime.type !== 'RSC';

  const decomm = contractorBearsAbex
    ? generateDecommissioningSchedule(costProfile, proj.startYear, proj.endYear, DECOMM_DISCOUNT_RATE)
    : null;
  const ee = generateEESchedule(project);

  let cumCapex = 0;
  let cumCapitalAllowance = 0;
  const years: AccountingDriverYear[] = cashflows.map((cf, i) => {
    const cost = computeCosts(costProfile, cf.year);
    const eeYear = ee[i];
    const d = decomm?.[i];
    const eeAdditions = (eeYear?.additions as number | undefined) ?? 0;
    const eeReclassified = (eeYear?.reclassifiedToPPE as number | undefined) ?? 0;

    cumCapex += cost.totalCapex;
    cumCapitalAllowance += cf.capitalAllowance as number;

    return {
      year: cf.year,
      revenue: cf.contractorEntitlement as number,
      costOfSales: cost.totalOpex + (contractorPaysCess ? (cf.researchCess as number) : 0),
      capex: cost.totalCapex,
      abandonmentSpend: contractorBearsAbex ? cost.abandonmentCost : 0,
      currentTax: cf.pitaTax as number,
      netCashFlow: cf.netCashFlow as number,
      eeAdditions,
      eeReclassified,
      eeWrittenOff: (eeYear?.writtenOff as number | undefined) ?? 0,
      eeClosing: (eeYear?.closing as number | undefined) ?? 0,
      ppeCapexAdditions: Math.max(0, cost.totalCapex - eeAdditions) + eeReclassified,
      aroAddition: (d?.additions as number | undefined) ?? 0,
      unwinding: (d?.unwinding as number | undefined) ?? 0,
      provisionClosing: (d?.closing as number | undefined) ?? 0,
      taxWrittenDownValue: Math.max(0, cumCapex - cumCapitalAllowance),
      taxLossCF: cf.taxLossCF as number,
    };
  });

  const result: AccountingDrivers = {
    years,
    firstAvailableIdx: cashflows.findIndex((cf) => (cf.contractorEntitlement as number) > 0),
    taxRate: regime.type === 'DOWNSTREAM' ? regime.taxRate : regime.pitaRate,
  };
  byProject.set(project, result);
  return result;
}

/**
 * Net deferred tax position per year (positive = liability, negative =
 * asset) given the book PP&E closing balances. Taxable temporary
 * differences: book PP&E + E&E over their tax written-down value.
 * Deductible: the decommissioning provision (deductible when spent) and
 * unused tax losses. Any asset left at the end of the project life is not
 * recoverable and is derecognised.
 */
export function netDeferredTax(
  drivers: AccountingDrivers,
  ppeClosing: readonly number[],
): number[] {
  const n = drivers.years.length;
  return drivers.years.map((d, i) => {
    const bookAssets = ppeClosing[i]! + d.eeClosing;
    const net = drivers.taxRate * (bookAssets - d.taxWrittenDownValue - d.provisionClosing - d.taxLossCF);
    return i === n - 1 ? Math.max(0, net) : net;
  });
}

/** PP&E closing balances from the drivers and a DD&A series. */
export function ppeClosingBalances(
  drivers: AccountingDrivers,
  dda: readonly number[],
): number[] {
  let balance = 0;
  return drivers.years.map((d, i) => {
    balance += d.ppeCapexAdditions + d.aroAddition - dda[i]!;
    return balance;
  });
}
