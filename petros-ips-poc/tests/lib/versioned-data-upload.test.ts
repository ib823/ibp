import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildDiff, parseVersionedDataXlsx, type ParsedRow } from '@/lib/versioned-data-upload';
import type { DataStatus, DataVersion } from '@/engine/types';

function makeFile(rows: (string | number)[][], name = 'test.xlsx'): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'VersionedData');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const HEADER = ['project_id', 'data_version', 'scenario_version', 'status', 'last_modified', 'modified_by'];

describe('versioned data xlsx parser', () => {
  it('parses a valid template', async () => {
    const file = makeFile([
      HEADER,
      ['string', 'string', 'string', 'string', 'ISO date', 'string'],
      ['FK to Projects', 'budget/forecast/...', 'base/...', 'open/...', 'YYYY-MM-DD', 'Name (Role)'],
      ['sk-410', 'budget', 'base', 'approved', '2026-03-15', 'A. Karim (FP&A)'],
    ]);
    const result = await parseVersionedDataXlsx(file);
    expect(result.issues).toEqual([]);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]).toMatchObject({
      projectId: 'sk-410',
      dataVersion: 'budget',
      scenarioVersion: 'base',
      status: 'approved',
    });
  });

  it('reports missing required columns', async () => {
    const file = makeFile([
      ['project_id', 'status'],
      ['sk-410', 'approved'],
    ]);
    const result = await parseVersionedDataXlsx(file);
    expect(result.validRows).toHaveLength(0);
    expect(result.issues[0]?.message).toMatch(/Missing required columns/);
  });

  it('rejects unknown enum values with per-row issues', async () => {
    const file = makeFile([
      HEADER,
      ['sk-410', 'yearly',   'base', 'approved', '2026-03-15', 'A. K'],
      ['sk-420', 'budget',   'base', 'GOOD',     '2026-03-15', 'A. K'],
      ['sk-430', 'forecast', 'ultra','approved', '2026-03-15', 'A. K'],
    ]);
    const result = await parseVersionedDataXlsx(file);
    expect(result.validRows).toHaveLength(0);
    const fields = result.issues.map((i) => i.field);
    expect(fields).toContain('data_version');
    expect(fields).toContain('status');
    expect(fields).toContain('scenario_version');
  });

  it('rejects non-ISO dates', async () => {
    const file = makeFile([
      HEADER,
      ['sk-410', 'budget', 'base', 'approved', '15/03/2026', 'A. K'],
    ]);
    const result = await parseVersionedDataXlsx(file);
    expect(result.issues[0]?.field).toBe('last_modified');
  });
});

describe('buildDiff', () => {
  it('labels rows as added / updated / unchanged correctly', () => {
    const current = new Map<string, Map<DataVersion, { status: DataStatus; lastModified: string; modifiedBy: string }>>([
      ['sk-410', new Map([
        ['budget', { status: 'approved' as DataStatus, lastModified: '2026-01-01', modifiedBy: 'old' }],
      ])],
    ]);
    const parsed: ParsedRow[] = [
      { projectId: 'sk-410', dataVersion: 'budget',   scenarioVersion: 'base', status: 'approved', lastModified: '2026-01-01', modifiedBy: 'old' }, // unchanged
      { projectId: 'sk-410', dataVersion: 'forecast', scenarioVersion: 'base', status: 'submitted', lastModified: '2026-03-01', modifiedBy: 'new' }, // added
      { projectId: 'sk-999', dataVersion: 'budget',   scenarioVersion: 'base', status: 'open',      lastModified: '2026-03-01', modifiedBy: 'new' }, // added (no project)
    ];
    const diff = buildDiff(parsed, current);
    expect(diff.find((d) => d.parsed.projectId === 'sk-410' && d.parsed.dataVersion === 'budget')?.kind).toBe('unchanged');
    expect(diff.find((d) => d.parsed.dataVersion === 'forecast')?.kind).toBe('added');
    expect(diff.find((d) => d.parsed.projectId === 'sk-999')?.kind).toBe('added');
  });

  it('detects status changes as updated', () => {
    const current = new Map<string, Map<DataVersion, { status: DataStatus; lastModified: string; modifiedBy: string }>>([
      ['sk-410', new Map([
        ['budget', { status: 'submitted' as DataStatus, lastModified: '2026-01-01', modifiedBy: 'old' }],
      ])],
    ]);
    const parsed: ParsedRow[] = [
      { projectId: 'sk-410', dataVersion: 'budget', scenarioVersion: 'base', status: 'approved', lastModified: '2026-01-01', modifiedBy: 'old' },
    ];
    const diff = buildDiff(parsed, current);
    expect(diff[0]?.kind).toBe('updated');
    expect(diff[0]?.previous?.status).toBe('submitted');
  });
});
