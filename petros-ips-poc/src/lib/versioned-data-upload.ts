// ════════════════════════════════════════════════════════════════════════
// Versioned Data Upload — xlsx parser + validator + diff
//
// Reads the Versioned Data template format emitted by
// `downloadVersionedDataTemplate`, validates each row, and produces a
// structured diff against the current versionedData registry. The UI
// renders the diff for user confirmation; on confirm, an adapter in the
// project store applies the accepted rows and emits audit entries.
//
// This is a POC — validation messages are user-friendly but the
// production pipeline will do server-side schema validation, conflict
// resolution, and optimistic locking. No rows are persisted without an
// explicit confirm click.
// ════════════════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import type { DataStatus, DataVersion, ScenarioVersion } from '@/engine/types';

export interface ParsedRow {
  readonly projectId: string;
  readonly dataVersion: DataVersion;
  readonly scenarioVersion: ScenarioVersion;
  readonly status: DataStatus;
  readonly lastModified: string;
  readonly modifiedBy: string;
}

export interface ValidationIssue {
  readonly row: number; // 1-indexed after header
  readonly field: string;
  readonly message: string;
}

export interface DiffRow {
  readonly key: string; // `${projectId}::${dataVersion}`
  readonly kind: 'added' | 'updated' | 'unchanged';
  readonly parsed: ParsedRow;
  readonly previous?: {
    status: DataStatus;
    lastModified: string;
    modifiedBy: string;
  };
}

export interface ParseResult {
  readonly fileName: string;
  readonly rowsRead: number;
  readonly validRows: readonly ParsedRow[];
  readonly issues: readonly ValidationIssue[];
}

const VERSION_VALUES = new Set<DataVersion>(['actuals', 'budget', 'forecast', 'submitted', 'approved', 'working']);
const SCENARIO_VALUES = new Set<ScenarioVersion>(['base', 'high', 'low', 'stress']);
const STATUS_VALUES = new Set<DataStatus>(['open', 'submitted', 'to_change', 'approved']);

export async function parseVersionedDataXlsx(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { fileName: file.name, rowsRead: 0, validRows: [], issues: [{ row: 0, field: 'workbook', message: 'Workbook contains no sheets.' }] };
  }
  const sheet = wb.Sheets[sheetName]!;
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];

  if (rows.length === 0) {
    return { fileName: file.name, rowsRead: 0, validRows: [], issues: [{ row: 0, field: 'sheet', message: `Sheet "${sheetName}" is empty.` }] };
  }

  const headerRow = rows[0]!.map((c) => String(c).trim().toLowerCase());
  const headerIdx = (name: string) => headerRow.indexOf(name);
  const required = ['project_id', 'data_version', 'scenario_version', 'status', 'last_modified', 'modified_by'] as const;

  const missing = required.filter((h) => headerIdx(h) === -1);
  if (missing.length > 0) {
    return {
      fileName: file.name,
      rowsRead: rows.length - 1,
      validRows: [],
      issues: [{
        row: 1,
        field: 'header',
        message: `Missing required columns: ${missing.join(', ')}. Download the template to see the expected schema.`,
      }],
    };
  }

  const idx = {
    projectId: headerIdx('project_id'),
    version: headerIdx('data_version'),
    scenario: headerIdx('scenario_version'),
    status: headerIdx('status'),
    modified: headerIdx('last_modified'),
    modifiedBy: headerIdx('modified_by'),
  };

  // Skip the type-annotation and note rows that the template generator emits
  // (rows 2 and 3 when present). Detect by sentinel values in the first column.
  const dataStart = detectDataStart(rows);

  const validRows: ParsedRow[] = [];
  const issues: ValidationIssue[] = [];

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row || row.every((c) => c === undefined || c === null || String(c).trim() === '')) continue;

    const rowNum = i + 1; // 1-indexed sheet row
    const projectId = String(row[idx.projectId] ?? '').trim();
    const version = String(row[idx.version] ?? '').trim().toLowerCase();
    const scenario = String(row[idx.scenario] ?? '').trim().toLowerCase();
    const status = String(row[idx.status] ?? '').trim().toLowerCase();
    const modified = String(row[idx.modified] ?? '').trim();
    const modifiedBy = String(row[idx.modifiedBy] ?? '').trim();

    if (!projectId) { issues.push({ row: rowNum, field: 'project_id', message: 'Required.' }); continue; }
    if (!VERSION_VALUES.has(version as DataVersion)) { issues.push({ row: rowNum, field: 'data_version', message: `Unknown value "${version}". Allowed: ${[...VERSION_VALUES].join(', ')}.` }); continue; }
    if (!SCENARIO_VALUES.has(scenario as ScenarioVersion)) { issues.push({ row: rowNum, field: 'scenario_version', message: `Unknown value "${scenario}". Allowed: ${[...SCENARIO_VALUES].join(', ')}.` }); continue; }
    if (!STATUS_VALUES.has(status as DataStatus)) { issues.push({ row: rowNum, field: 'status', message: `Unknown value "${status}". Allowed: ${[...STATUS_VALUES].join(', ')}.` }); continue; }
    if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(modified)) { issues.push({ row: rowNum, field: 'last_modified', message: 'Must be ISO date (YYYY-MM-DD).' }); continue; }
    if (!modifiedBy) { issues.push({ row: rowNum, field: 'modified_by', message: 'Required.' }); continue; }

    validRows.push({
      projectId,
      dataVersion: version as DataVersion,
      scenarioVersion: scenario as ScenarioVersion,
      status: status as DataStatus,
      lastModified: modified,
      modifiedBy,
    });
  }

  return {
    fileName: file.name,
    rowsRead: rows.length - dataStart,
    validRows,
    issues,
  };
}

function detectDataStart(rows: unknown[][]): number {
  // The template generator produces: header / types / notes / example+ rows.
  // We detect the first row whose first cell looks like a real project_id
  // (non-empty, contains no whitespace + reasonable length).
  for (let i = 1; i < Math.min(rows.length, 5); i++) {
    const first = String(rows[i]?.[0] ?? '').trim();
    if (first && !first.includes(' ') && !first.startsWith('FK') && !first.match(/^(string|number|integer|decimal|ISO)/i)) {
      return i;
    }
  }
  return 1;
}

export function buildDiff(
  parsed: readonly ParsedRow[],
  current: ReadonlyMap<string, ReadonlyMap<DataVersion, { status: DataStatus; lastModified: string; modifiedBy: string }>>,
): DiffRow[] {
  const out: DiffRow[] = [];
  for (const row of parsed) {
    const key = `${row.projectId}::${row.dataVersion}`;
    const existing = current.get(row.projectId)?.get(row.dataVersion);
    if (!existing) {
      out.push({ key, kind: 'added', parsed: row });
      continue;
    }
    const changed =
      existing.status !== row.status ||
      existing.lastModified !== row.lastModified ||
      existing.modifiedBy !== row.modifiedBy;
    out.push({
      key,
      kind: changed ? 'updated' : 'unchanged',
      parsed: row,
      previous: { status: existing.status, lastModified: existing.lastModified, modifiedBy: existing.modifiedBy },
    });
  }
  return out;
}
