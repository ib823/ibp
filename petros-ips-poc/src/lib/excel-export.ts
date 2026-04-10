// ════════════════════════════════════════════════════════════════════════
// Excel Export — Economics and Financial Statements
// ════════════════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import type { EconomicsResult, YearlyCashflow } from '@/engine/types';

/**
 * Export project economics to an Excel workbook.
 * Generates: Summary sheet + Yearly Cash Flows sheet + Assumptions sheet.
 */
export function exportEconomicsToExcel(
  projectName: string,
  scenario: string,
  result: EconomicsResult,
): void {
  const wb = XLSX.utils.book_new();
  const cashflows = result.yearlyCashflows;

  // ── Sheet 1: Summary ────────────────────────────────────────────────
  const summaryData = [
    ['PETROS IPS POC — Economics Summary'],
    ['Project', projectName],
    ['Scenario', scenario],
    ['Date', new Date().toISOString().split('T')[0]],
    [],
    ['Key Metrics'],
    ['NPV₁₀ ($)', result.npv10],
    ['IRR (%)', result.irr !== null ? result.irr * 100 : 'N/A'],
    ['MIRR (%)', result.mirr * 100],
    ['Payback (years)', result.paybackYears],
    ['Disc. Payback (years)', result.discountedPaybackYears],
    ['Prof. Index', result.profitabilityIndex],
    ['Govt Take (%)', result.governmentTakePct],
    ['Contractor Take (%)', result.contractorTakePct],
    ['Total CAPEX ($)', result.totalCapex],
    ['Total OPEX ($)', result.totalOpex],
    ['Total Revenue ($)', result.totalRevenue],
    ['Peak Funding ($)', result.peakFunding],
    [],
    ['DISCLAIMER: Sample data — not actual PETROS project data'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // ── Sheet 2: Yearly Cash Flows ──────────────────────────────────────
  const cfHeaders = [
    'Year', 'Oil Rev ($)', 'Gas Rev ($)', 'Cond Rev ($)',
    'Total Revenue ($)', 'Royalty ($)', 'Rev After Royalty ($)',
    'Cost Recovery Ceiling ($)', 'Cost Recovery ($)', 'Unrecovered CF ($)',
    'Profit Oil/Gas ($)', 'Contractor Profit Share ($)', 'PETRONAS Share ($)',
    'Suppl Payment ($)', 'Contractor Entitlement ($)',
    'Capital Allowance ($)', 'Taxable Income ($)', 'PITA Tax ($)',
    'NCF ($)', 'Cum NCF ($)', 'DCF ($)', 'Cum DCF ($)',
    'R/C Index', 'Prof. Index', 'Cum Production (boe)',
  ];
  const cfRows = cashflows.map((cf: YearlyCashflow) => [
    cf.year,
    cf.grossRevenueOil, cf.grossRevenueGas, cf.grossRevenueCond,
    cf.totalGrossRevenue, cf.royalty, cf.revenueAfterRoyalty,
    cf.costRecoveryCeiling, cf.costRecoveryAmount, cf.unrecoveredCostCF,
    cf.profitOilGas, cf.contractorProfitShare, cf.petronasProfitShare,
    cf.supplementaryPayment, cf.contractorEntitlement,
    cf.capitalAllowance, cf.taxableIncome, cf.pitaTax,
    cf.netCashFlow, cf.cumulativeCashFlow,
    cf.discountedCashFlow, cf.cumulativeDiscountedCF,
    cf.rcIndex, cf.profitabilityIndex, cf.cumulativeProduction,
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([cfHeaders, ...cfRows]);
  ws2['!cols'] = cfHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws2, 'Cash Flows');

  // ── Sheet 3: Assumptions ────────────────────────────────────────────
  const assumptionsData = [
    ['Assumptions'],
    ['Project ID', result.projectId],
    ['Discount Rate', '10%'],
    [],
    ['DISCLAIMER: Illustrative fiscal parameters — not actual PETROS contract terms'],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(assumptionsData);
  ws3['!cols'] = [{ wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Assumptions');

  // ── Write file ──────────────────────────────────────────────────────
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}_Economics_${scenario}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}
