import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildEconomicsWorkbook } from '@/lib/excel-export';
import { DEFAULT_CONVERSIONS } from '@/engine/utils/unit-conversion';
import { usd } from '@/engine/fiscal/shared';
import type { EconomicsResult, YearlyCashflow } from '@/engine/types';

function makeCashflow(year: number): YearlyCashflow {
  return {
    year,
    grossRevenueOil: usd(100_000_000),
    grossRevenueGas: usd(50_000_000),
    grossRevenueCond: usd(10_000_000),
    totalGrossRevenue: usd(160_000_000),
    royalty: usd(16_000_000),
    exportDuty: usd(0),
    researchCess: usd(0),
    revenueAfterRoyalty: usd(144_000_000),
    costRecoveryCeiling: usd(115_200_000),
    costRecoveryAmount: usd(80_000_000),
    unrecoveredCostCF: usd(0),
    profitOilGas: usd(64_000_000),
    contractorProfitShare: usd(19_200_000),
    hostProfitShare: usd(44_800_000),
    contractorEntitlement: usd(99_200_000),
    supplementaryPayment: usd(0),
    capitalAllowance: usd(5_000_000),
    taxableIncome: usd(14_200_000),
    pitaTax: usd(5_680_000),
    netCashFlow: usd(13_520_000),
    cumulativeCashFlow: usd(13_520_000),
    discountedCashFlow: usd(12_290_909),
    cumulativeDiscountedCF: usd(12_290_909),
    rcIndex: 0.82,
    profitabilityIndex: 0.12,
    cumulativeProduction: 365_000,
  };
}

function makeResult(): EconomicsResult {
  return {
    projectId: 'TEST-001',
    npv10: usd(701_000_000),
    irr: 0.22,
    mirr: 0.18,
    paybackYears: 4.3,
    discountedPaybackYears: 5.1,
    profitabilityIndex: 1.42,
    governmentTakePct: 0.62,
    contractorTakePct: 0.38,
    totalCapex: usd(480_000_000),
    totalOpex: usd(120_000_000),
    totalRevenue: usd(1_600_000_000),
    peakFunding: usd(-280_000_000),
    totalTax: usd(56_800_000),
    yearlyCashflows: [makeCashflow(2025), makeCashflow(2026)],
    isNonInvestmentPattern: false,
  };
}

// Helper: pick a cell value from a sheet via A1-style address.
function cell(sheet: XLSX.WorkSheet, address: string): XLSX.CellObject['v'] {
  return sheet[address]?.v;
}

describe('buildEconomicsWorkbook — USD', () => {
  const wb = buildEconomicsWorkbook('Test Project', 'base', makeResult(), {
    currency: 'USD',
    conversions: DEFAULT_CONVERSIONS,
  });

  it('produces three sheets', () => {
    expect(wb.SheetNames).toEqual(['Summary', 'Cash Flows', 'Assumptions']);
  });

  it('Summary sheet labels include the currency', () => {
    const sheet = wb.Sheets.Summary!;
    // Row order: title, project, scenario, currency, date, blank, header, NPV, ...
    expect(cell(sheet, 'A8')).toBe('NPV₁₀ (USD)');
    expect(cell(sheet, 'A16')).toBe('Total CAPEX (USD)');
    expect(cell(sheet, 'A17')).toBe('Total OPEX (USD)');
    expect(cell(sheet, 'A18')).toBe('Total Revenue (USD)');
    expect(cell(sheet, 'A19')).toBe('Peak Funding (USD)');
  });

  it('Summary NPV cell equals raw USD value for USD display', () => {
    const sheet = wb.Sheets.Summary!;
    expect(cell(sheet, 'B8')).toBeCloseTo(701_000_000, 0);
  });

  it('Cash Flows header row carries the currency', () => {
    const sheet = wb.Sheets['Cash Flows']!;
    const header = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0] as string[];
    expect(header).toContain('Oil Rev (USD)');
    expect(header).toContain('NCF (USD)');
    expect(header).toContain('Cum Production (boe)'); // physics column unchanged
    expect(header).not.toContain('Oil Rev (MYR)');
  });

  it('Cash Flows row values are raw USD for USD display', () => {
    const sheet = wb.Sheets['Cash Flows']!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }).slice(1) as unknown[][];
    expect(rows[0]![0]).toBe(2025);              // year
    expect(rows[0]![1]).toBeCloseTo(100_000_000, 0); // Oil Rev
  });
});

describe('buildEconomicsWorkbook — MYR', () => {
  const wb = buildEconomicsWorkbook('Test Project', 'base', makeResult(), {
    currency: 'MYR',
    conversions: DEFAULT_CONVERSIONS,
  });

  it('Summary labels use MYR', () => {
    const sheet = wb.Sheets.Summary!;
    expect(cell(sheet, 'A8')).toBe('NPV₁₀ (MYR)');
    expect(cell(sheet, 'A19')).toBe('Peak Funding (MYR)');
  });

  it('NPV cell is multiplied by the USD→MYR factor (4.50)', () => {
    const sheet = wb.Sheets.Summary!;
    expect(cell(sheet, 'B8')).toBeCloseTo(701_000_000 * 4.5, 0);
  });

  it('Total CAPEX cell is converted', () => {
    const sheet = wb.Sheets.Summary!;
    expect(cell(sheet, 'B16')).toBeCloseTo(480_000_000 * 4.5, 0);
  });

  it('Cash Flows row values are converted', () => {
    const sheet = wb.Sheets['Cash Flows']!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }).slice(1) as unknown[][];
    // Oil Rev for 2025: $100M → MYR 450M
    expect(rows[0]![1]).toBeCloseTo(100_000_000 * 4.5, 0);
    // Cum Production stays unchanged (physics, not currency)
    expect(rows[0]![24]).toBe(365_000);
  });

  it('Assumptions sheet carries the display currency', () => {
    const sheet = wb.Sheets.Assumptions!;
    expect(cell(sheet, 'A3')).toBe('Display Currency');
    expect(cell(sheet, 'B3')).toBe('MYR');
  });
});

describe('buildEconomicsWorkbook — column count invariant', () => {
  it('Cash Flows header has exactly 25 columns', () => {
    const wb = buildEconomicsWorkbook('Test', 'base', makeResult(), {
      currency: 'USD',
      conversions: DEFAULT_CONVERSIONS,
    });
    const sheet = wb.Sheets['Cash Flows']!;
    const header = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0] as string[];
    expect(header.length).toBe(25);
  });
});
