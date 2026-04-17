// ════════════════════════════════════════════════════════════════════════
// Excel Export — Economics and Financial Statements
// ════════════════════════════════════════════════════════════════════════
//
// Split in two for testability:
//   - `buildEconomicsWorkbook(...)` returns an in-memory XLSX.WorkBook so
//     tests can inspect cells via `XLSX.utils.sheet_to_json` without
//     mocking `writeFile`.
//   - `exportEconomicsToExcel(...)` is a thin wrapper that calls the
//     builder and writes to disk via `XLSX.writeFile`.
//
// All currency values respect the user's display-unit preferences: labels
// carry the selected ISO code and cell values are pre-converted through
// `convertSafe('USD', currency, conversions)` before writing.
// ════════════════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import type { EconomicsResult, UnitConversion, YearlyCashflow } from '@/engine/types';
import { convertSafe } from '@/lib/display-units';
import { PROJECTS_BY_ID } from '@/data/projects';

export interface ExportOptions {
  currency: string;
  conversions: readonly UnitConversion[];
}

const DEFAULT_OPTIONS: ExportOptions = {
  currency: 'USD',
  conversions: [],
};

function getFiscalParameterRows(projectId: string): string[][] {
  const project = PROJECTS_BY_ID[projectId];
  if (!project) return [];

  const regime = project.fiscalRegimeConfig;
  const rows: string[][] = [
    ['Fiscal Regime', regime.type],
    ['Royalty Rate', `${(regime.royaltyRate * 100).toFixed(1)}%`],
    ['Export Duty Rate', `${((regime.exportDutyRate ?? 0) * 100).toFixed(1)}%`],
    ['Research Cess Rate', `${((regime.researchCessRate ?? 0) * 100).toFixed(1)}%`],
  ];

  if ('pitaRate' in regime) {
    rows.push(['Tax Rate', `${(regime.pitaRate * 100).toFixed(1)}%`]);
  }
  if ('taxRate' in regime) {
    rows.push(['Tax Rate', `${(regime.taxRate * 100).toFixed(1)}%`]);
  }
  if ('tranches' in regime) {
    rows.push(['Tranche Count', String(regime.tranches.length)]);
  }
  if ('fixedCostRecoveryCeiling' in regime) {
    rows.push(['Cost Recovery Ceiling', `${(regime.fixedCostRecoveryCeiling * 100).toFixed(1)}%`]);
    rows.push(['PI Lower / Upper', `${regime.piLower.toFixed(2)} / ${regime.piUpper.toFixed(2)}`]);
  }
  if ('costRecoveryCeilingPct' in regime) {
    rows.push(['Cost Recovery Ceiling', `${(regime.costRecoveryCeilingPct * 100).toFixed(1)}%`]);
  }
  if ('contractorProfitSharePct' in regime) {
    rows.push(['Contractor Share', `${(regime.contractorProfitSharePct * 100).toFixed(1)}%`]);
  }
  if ('deepwaterAllowance' in regime) {
    rows.push(['Deepwater Allowance', `${(regime.deepwaterAllowance * 100).toFixed(1)}%`]);
  }

  return rows;
}

/**
 * Build an in-memory Excel workbook from an `EconomicsResult`.
 * Pure function — does NOT touch the filesystem. Use for tests.
 */
export function buildEconomicsWorkbook(
  projectName: string,
  scenario: string,
  result: EconomicsResult,
  opts: ExportOptions = DEFAULT_OPTIONS,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const cashflows = result.yearlyCashflows;
  const { currency, conversions } = opts;
  const convert = (v: number): number => convertSafe(v, 'USD', currency, conversions);

  // ── Sheet 1: Summary ────────────────────────────────────────────────
  const summaryData = [
    ['PETROS IPS POC — Economics Summary'],
    ['Project', projectName],
    ['Scenario', scenario],
    ['Currency', currency],
    ['Date', new Date().toISOString().split('T')[0]],
    [],
    ['Key Metrics'],
    [`NPV₁₀ (${currency})`, convert(result.npv10 as number)],
    ['IRR (%)', result.irr !== null ? result.irr * 100 : 'N/A'],
    ['MIRR (%)', result.mirr * 100],
    ['Payback (years)', result.paybackYears],
    ['Disc. Payback (years)', result.discountedPaybackYears],
    ['Prof. Index', result.profitabilityIndex],
    ['Govt Take (%)', result.governmentTakePct],
    ['Contractor Take (%)', result.contractorTakePct],
    [`Total CAPEX (${currency})`, convert(result.totalCapex as number)],
    [`Total OPEX (${currency})`, convert(result.totalOpex as number)],
    [`Total Revenue (${currency})`, convert(result.totalRevenue as number)],
    [`Peak Funding (${currency})`, convert(result.peakFunding as number)],
    [],
    ['DISCLAIMER: Sample data — not actual PETROS project data'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 26 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // ── Sheet 2: Yearly Cash Flows ──────────────────────────────────────
  const cfHeaders = [
    'Year',
    `Oil Rev (${currency})`,
    `Gas Rev (${currency})`,
    `Cond Rev (${currency})`,
    `Total Revenue (${currency})`,
    `Royalty (${currency})`,
    `Rev After Royalty (${currency})`,
    `Cost Recovery Ceiling (${currency})`,
    `Cost Recovery (${currency})`,
    `Unrecovered CF (${currency})`,
    `Profit Oil/Gas (${currency})`,
    `Contractor Profit Share (${currency})`,
    `PETRONAS Share (${currency})`,
    `Suppl Payment (${currency})`,
    `Contractor Entitlement (${currency})`,
    `Capital Allowance (${currency})`,
    `Taxable Income (${currency})`,
    `PITA Tax (${currency})`,
    `NCF (${currency})`,
    `Cum NCF (${currency})`,
    `DCF (${currency})`,
    `Cum DCF (${currency})`,
    'R/C Index',
    'Prof. Index',
    'Cum Production (boe)',
  ];
  const cfRows = cashflows.map((cf: YearlyCashflow) => [
    cf.year,
    convert(cf.grossRevenueOil as number),
    convert(cf.grossRevenueGas as number),
    convert(cf.grossRevenueCond as number),
    convert(cf.totalGrossRevenue as number),
    convert(cf.royalty as number),
    convert(cf.revenueAfterRoyalty as number),
    convert(cf.costRecoveryCeiling as number),
    convert(cf.costRecoveryAmount as number),
    convert(cf.unrecoveredCostCF as number),
    convert(cf.profitOilGas as number),
    convert(cf.contractorProfitShare as number),
    convert(cf.petronasProfitShare as number),
    convert(cf.supplementaryPayment as number),
    convert(cf.contractorEntitlement as number),
    convert(cf.capitalAllowance as number),
    convert(cf.taxableIncome as number),
    convert(cf.pitaTax as number),
    convert(cf.netCashFlow as number),
    convert(cf.cumulativeCashFlow as number),
    convert(cf.discountedCashFlow as number),
    convert(cf.cumulativeDiscountedCF as number),
    cf.rcIndex,
    cf.profitabilityIndex,
    cf.cumulativeProduction,
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([cfHeaders, ...cfRows]);
  ws2['!cols'] = cfHeaders.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws2, 'Cash Flows');

  // ── Sheet 3: Assumptions ────────────────────────────────────────────
  const assumptionsData = [
    ['Assumptions'],
    ['Project ID', result.projectId],
    ['Display Currency', currency],
    ['Discount Rate', '10%'],
    [],
    ['DISCLAIMER: Illustrative fiscal parameters — not actual PETROS contract terms'],
    [],
    ...getFiscalParameterRows(result.projectId),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(assumptionsData);
  ws3['!cols'] = [{ wch: 22 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Assumptions');

  return wb;
}

/**
 * Build the workbook and write it to disk via `XLSX.writeFile`.
 * Used by the Export button in the Economics page.
 */
export function exportEconomicsToExcel(
  projectName: string,
  scenario: string,
  result: EconomicsResult,
  opts: ExportOptions = DEFAULT_OPTIONS,
): void {
  const wb = buildEconomicsWorkbook(projectName, scenario, result, opts);
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}_Economics_${scenario}_${opts.currency}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ════════════════════════════════════════════════════════════════════════
// Financial Statements workbook — 4 sheets (IS, BS, CF, Account Movements)
// ════════════════════════════════════════════════════════════════════════

export interface FinancialRowsBundle {
  years: (number | string)[];
  incomeStatement: ReadonlyArray<{ label: string; values: number[] }>;
  balanceSheet:    ReadonlyArray<{ label: string; values: number[] }>;
  cashFlow:        ReadonlyArray<{ label: string; values: number[] }>;
  accountMovements: ReadonlyArray<{ section: string; rows: ReadonlyArray<{ label: string; values: number[] }> }>;
}

function rowsToSheet(
  periodLabels: (number | string)[],
  rows: ReadonlyArray<{ label: string; values: number[] }>,
  currencyFactor: number,
): XLSX.WorkSheet {
  const header = ['Line item', ...periodLabels.map((p) => String(p))];
  const body = rows.map((r) => [
    r.label,
    ...r.values.map((v) => (v === 0 ? 0 : Number(((v * currencyFactor) / 1e6).toFixed(2)))),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws['!cols'] = [{ wch: 26 }, ...periodLabels.map(() => ({ wch: 12 }))];
  return ws;
}

export function buildFinancialWorkbook(
  projectName: string,
  scenario: string,
  bundle: FinancialRowsBundle,
  opts: ExportOptions = DEFAULT_OPTIONS,
): XLSX.WorkBook {
  // convertSafe takes (value, fromUnit, toUnit, conversions) — here we
  // pre-compute the factor by converting 1 USD to the display currency.
  const factor = convertSafe(1, 'USD', opts.currency, opts.conversions);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, rowsToSheet(bundle.years, bundle.incomeStatement, factor), 'Income Statement');
  XLSX.utils.book_append_sheet(wb, rowsToSheet(bundle.years, bundle.balanceSheet, factor), 'Balance Sheet');
  XLSX.utils.book_append_sheet(wb, rowsToSheet(bundle.years, bundle.cashFlow, factor), 'Cash Flow');

  // Account movements: multiple subsections stacked vertically
  const amRows: (string | number)[][] = [];
  const amHeader = ['Line item', ...bundle.years.map((p) => String(p))];
  amRows.push(amHeader);
  for (const section of bundle.accountMovements) {
    amRows.push([`— ${section.section} —`]);
    for (const r of section.rows) {
      amRows.push([
        r.label,
        ...r.values.map((v) => (v === 0 ? 0 : Number(((v * factor) / 1e6).toFixed(2)))),
      ]);
    }
    amRows.push([]);
  }
  const wsAm = XLSX.utils.aoa_to_sheet(amRows);
  wsAm['!cols'] = [{ wch: 26 }, ...bundle.years.map(() => ({ wch: 12 }))];
  XLSX.utils.book_append_sheet(wb, wsAm, 'Account Movements');

  // Title/metadata sheet
  const meta = [
    ['PETROS IPS — Financial Statements Export'],
    ['Project', projectName],
    ['Scenario', scenario],
    ['Currency', opts.currency],
    ['Units', 'Millions'],
    ['Exported', new Date().toISOString()],
    [],
    ['POC note', 'Derived from a cash-based economic model. In the production SAC implementation, Financial Statements will be generated from an accrual-based accounting engine integrated with SAP S/4HANA.'],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta['!cols'] = [{ wch: 20 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, 'About', true);

  return wb;
}

export function exportFinancialStatementsToExcel(
  projectName: string,
  scenario: string,
  bundle: FinancialRowsBundle,
  opts: ExportOptions = DEFAULT_OPTIONS,
): void {
  const wb = buildFinancialWorkbook(projectName, scenario, bundle, opts);
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}_Financials_${scenario}_${opts.currency}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}
