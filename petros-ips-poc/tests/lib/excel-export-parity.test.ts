import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildEconomicsWorkbook } from '@/lib/excel-export';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { SK410_INPUTS } from '@/data/projects';
import { BASE_PRICE_DECK } from '@/data/price-decks';
import { DEFAULT_CONVERSIONS } from '@/engine/utils/unit-conversion';

function cell(sheet: XLSX.WorkSheet, address: string) {
  return sheet[address]?.v;
}

describe('buildEconomicsWorkbook parity with live engine output', () => {
  const result = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK, 'base');

  it('exports real summary metrics without numeric drift in USD', () => {
    const workbook = buildEconomicsWorkbook(SK410_INPUTS.project.name, 'base', result, {
      currency: 'USD',
      conversions: DEFAULT_CONVERSIONS,
    });
    const summary = workbook.Sheets.Summary!;

    expect(cell(summary, 'B8')).toBeCloseTo(result.npv10 as number, 6);
    expect(cell(summary, 'B11')).toBeCloseTo(result.paybackYears, 6);
    expect(cell(summary, 'B16')).toBeCloseTo(result.totalCapex as number, 6);
    expect(cell(summary, 'B19')).toBeCloseTo(result.peakFunding as number, 6);
  });

  it('exports yearly cashflow rows without numeric drift in USD', () => {
    const workbook = buildEconomicsWorkbook(SK410_INPUTS.project.name, 'base', result, {
      currency: 'USD',
      conversions: DEFAULT_CONVERSIONS,
    });
    const cashFlows = workbook.Sheets['Cash Flows']!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(cashFlows, { header: 1 }).slice(1) as unknown[][];
    const first = result.yearlyCashflows[0]!;
    const last = result.yearlyCashflows[result.yearlyCashflows.length - 1]!;

    expect(rows[0]![0]).toBe(first.year);
    expect(rows[0]![4]).toBeCloseTo(first.totalGrossRevenue as number, 6);
    expect(rows[0]![18]).toBeCloseTo(first.netCashFlow as number, 6);
    expect(rows[rows.length - 1]![24]).toBeCloseTo(last.cumulativeProduction, 6);
  });

  it('applies the configured currency conversion consistently for real data', () => {
    const workbook = buildEconomicsWorkbook(SK410_INPUTS.project.name, 'base', result, {
      currency: 'MYR',
      conversions: DEFAULT_CONVERSIONS,
    });
    const summary = workbook.Sheets.Summary!;
    const myrFactor = 4.5;

    expect(cell(summary, 'B8')).toBeCloseTo((result.npv10 as number) * myrFactor, 6);
    expect(cell(summary, 'B16')).toBeCloseTo((result.totalCapex as number) * myrFactor, 6);
    expect(cell(summary, 'B18')).toBeCloseTo((result.totalRevenue as number) * myrFactor, 6);
  });
});
