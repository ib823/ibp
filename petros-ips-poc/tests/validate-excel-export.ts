import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { SK410_INPUTS } from '@/data/projects';
import { BASE_PRICE_DECK } from '@/data/price-decks';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { buildEconomicsWorkbook } from '@/lib/excel-export';
import { DEFAULT_CONVERSIONS } from '@/engine/utils/unit-conversion';

type CheckResult = {
  id: string;
  ok: boolean;
  expected: string | number;
  actual: string | number | undefined;
  delta?: number;
};

const results: CheckResult[] = [];

function cell(sheet: XLSX.WorkSheet, address: string) {
  return sheet[address]?.v;
}

function record(id: string, ok: boolean, expected: string | number, actual: string | number | undefined, delta?: number) {
  results.push({ id, ok, expected, actual, delta });
}

function checkEqual(id: string, actual: string | number | undefined, expected: string | number) {
  record(id, actual === expected, expected, actual);
}

function checkClose(id: string, actual: number | undefined, expected: number, tolerance: number) {
  const delta = actual === undefined ? Number.POSITIVE_INFINITY : Math.abs(actual - expected);
  record(id, delta <= tolerance, expected, actual, delta);
}

function findRow(rows: unknown[][], matcher: (row: unknown[]) => boolean) {
  return rows.find(matcher);
}

const result = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK, 'base');
const workbook = buildEconomicsWorkbook(SK410_INPUTS.project.name, 'base', result, {
  currency: 'USD',
  conversions: DEFAULT_CONVERSIONS,
});

const tempDir = mkdtempSync(join(tmpdir(), 'petros-excel-audit-'));
const filePath = join(tempDir, 'sk410-base.xlsx');

try {
  const workbookBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  writeFileSync(filePath, workbookBuffer);
  const reread = XLSX.read(readFileSync(filePath), { type: 'buffer' });
  const summary = reread.Sheets.Summary!;
  const cashFlows = reread.Sheets['Cash Flows']!;
  const assumptions = reread.Sheets.Assumptions!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(cashFlows, { header: 1 }) as unknown[][];
  const dataRows = rows.slice(1);
  const assumptionRows = XLSX.utils.sheet_to_json<unknown[]>(assumptions, { header: 1 }) as unknown[][];

  checkEqual('6.1 Excel: Year column matches engine years', dataRows[0]?.[0] as number, result.yearlyCashflows[0]!.year);
  checkClose('6.2 Excel: Revenue column matches engine revenue (±0.01)', dataRows[0]?.[4] as number, result.yearlyCashflows[0]!.totalGrossRevenue as number, 0.01);
  checkClose('6.3 Excel: Royalty column matches engine royalty (±0.01)', dataRows[0]?.[5] as number, result.yearlyCashflows[0]!.royalty as number, 0.01);
  checkClose('6.4 Excel: Cost Recovery column matches (±0.01)', dataRows[0]?.[8] as number, result.yearlyCashflows[0]!.costRecoveryAmount as number, 0.01);
  checkClose('6.5 Excel: Profit Split column matches (±0.01)', dataRows[0]?.[11] as number, result.yearlyCashflows[0]!.contractorProfitShare as number, 0.01);
  checkClose('6.6 Excel: Tax column matches (±0.01)', dataRows[0]?.[17] as number, result.yearlyCashflows[0]!.pitaTax as number, 0.01);
  checkClose('6.7 Excel: NCF column matches (±0.01)', dataRows[0]?.[18] as number, result.yearlyCashflows[0]!.netCashFlow as number, 0.01);
  checkClose('6.8 Excel: Cumulative NCF column matches (±0.01)', dataRows[dataRows.length - 1]?.[19] as number, result.yearlyCashflows[result.yearlyCashflows.length - 1]!.cumulativeCashFlow as number, 0.01);
  checkClose('6.9 Excel: NPV summary matches engine NPV (±0.1)', cell(summary, 'B8') as number, result.npv10 as number, 0.1);
  checkClose('6.10 Excel: IRR summary matches engine IRR (±0.1%)', cell(summary, 'B9') as number, (result.irr ?? 0) * 100, 0.1);

  const disclaimerRow = findRow(assumptionRows, (row) => String(row[0] ?? '').includes('DISCLAIMER'));
  checkEqual(
    '6.11 Excel: Assumptions sheet contains disclaimer text',
    Boolean(disclaimerRow),
    true,
  );

  const fiscalRegimeRow = findRow(assumptionRows, (row) => row[0] === 'Fiscal Regime');
  const royaltyRow = findRow(assumptionRows, (row) => row[0] === 'Royalty Rate');
  const taxRow = findRow(assumptionRows, (row) => row[0] === 'Tax Rate');
  checkEqual(
    '6.12 Excel: Assumptions sheet contains fiscal regime parameters',
    Boolean(fiscalRegimeRow && royaltyRow && taxRow),
    true,
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

const passed = results.filter((resultRow) => resultRow.ok);
const failed = results.filter((resultRow) => !resultRow.ok);

for (const resultRow of results) {
  if (resultRow.ok) {
    console.log(`${resultRow.id}: PASS`);
  } else {
    console.log(`${resultRow.id}: FAIL`);
    console.log(`  Expected: ${String(resultRow.expected)}`);
    console.log(`  Actual: ${String(resultRow.actual)}`);
    if (resultRow.delta !== undefined) console.log(`  Delta: ${resultRow.delta}`);
  }
}

console.log(`Total checks: ${results.length}`);
console.log(`Passed: ${passed.length}`);
console.log(`Failed: ${failed.length}`);

if (failed.length > 0) {
  process.exitCode = 1;
}
