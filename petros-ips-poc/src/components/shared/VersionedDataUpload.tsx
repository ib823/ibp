// ════════════════════════════════════════════════════════════════════════
// VersionedDataUpload — round-trip xlsx upload for Versioned Data
//
// Flow: user selects / drops an .xlsx → we parse and validate → show diff
// summary + per-row list (added / updated / unchanged + issues) → on
// confirm, the store applies metadata updates and an audit entry is
// written. Cancellation discards everything before applying.
//
// Responsive: the drop zone stacks buttons on mobile; the diff list uses
// horizontal scroll and collapses long error text on narrow screens.
// ════════════════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import {
  parseVersionedDataXlsx,
  buildDiff,
  type DiffRow,
  type ParseResult,
} from '@/lib/versioned-data-upload';
import { downloadVersionedDataTemplate } from '@/lib/data-source-templates';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore, useCurrentUser } from '@/store/auth-store';
import { can } from '@/engine/auth/types';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { getEntry } from '@/lib/educational-content';
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react';

export function VersionedDataUpload() {
  const versionedData = useProjectStore((s) => s.versionedData);
  const applyUpdates = useProjectStore((s) => s.applyVersionedDataUpdates);
  const recordAudit = useAuthStore((s) => s.recordAudit);
  const user = useCurrentUser();

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [diff, setDiff] = useState<DiffRow[]>([]);

  const canUpload = user ? can(user.role, 'data.edit') || can(user.role, 'connection.manage') : false;
  const canDownload = !!user;
  const eduEntry = getEntry('CONN-02');

  const resetAll = () => {
    setParseResult(null);
    setDiff([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0]!;
    if (!/\.xlsx?$/i.test(file.name)) {
      toast.error('Expected an .xlsx file. Download the template to see the expected format.');
      return;
    }
    setParsing(true);
    try {
      const result = await parseVersionedDataXlsx(file);
      setParseResult(result);
      // Build lightweight current-state map for diff
      const current = new Map<string, Map<import('@/engine/types').DataVersion, { status: import('@/engine/types').DataStatus; lastModified: string; modifiedBy: string }>>();
      for (const [projectId, versionMap] of versionedData.entries()) {
        const inner = new Map<import('@/engine/types').DataVersion, { status: import('@/engine/types').DataStatus; lastModified: string; modifiedBy: string }>();
        for (const [version, rec] of versionMap.entries()) {
          inner.set(version, { status: rec.status, lastModified: rec.lastModified, modifiedBy: rec.modifiedBy });
        }
        current.set(projectId, inner);
      }
      setDiff(buildDiff(result.validRows, current));
      if (result.issues.length > 0) {
        toast.error(`Parsed with ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}. Review and fix before applying.`);
      } else {
        toast.success(`Parsed ${result.validRows.length} row${result.validRows.length === 1 ? '' : 's'}. Review the diff before applying.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse file.');
    } finally {
      setParsing(false);
    }
  };

  const handleDownload = () => {
    downloadVersionedDataTemplate();
    recordAudit({
      kind: 'data.template_downloaded',
      targetId: 'template::versioned-data',
      targetLabel: 'Versioned Data template',
      detail: 'Template_Versioned_Data.xlsx downloaded',
    });
  };

  const handleApply = () => {
    if (!parseResult) return;
    const actionable = diff.filter((d) => d.kind !== 'unchanged').map((d) => d.parsed);
    if (actionable.length === 0) {
      toast.info('Nothing to apply — all rows are unchanged.');
      return;
    }
    const { updated, added } = applyUpdates(actionable);
    recordAudit({
      kind: 'data.template_uploaded',
      targetId: 'template::versioned-data',
      targetLabel: parseResult.fileName,
      detail: `${parseResult.validRows.length} rows parsed • ${updated} updated • ${added} new pair${added === 1 ? '' : 's'} skipped (no master data)`,
    });
    toast.success(`Applied ${updated} update${updated === 1 ? '' : 's'}. ${added} new project+version pair${added === 1 ? '' : 's'} were skipped.`);
    resetAll();
  };

  const summary = parseResult ? {
    added: diff.filter((d) => d.kind === 'added').length,
    updated: diff.filter((d) => d.kind === 'updated').length,
    unchanged: diff.filter((d) => d.kind === 'unchanged').length,
    issues: parseResult.issues.length,
  } : null;

  return (
    <section className="border border-border bg-white p-4 sm:p-5 flex flex-col gap-4" aria-labelledby="vd-upload-title">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id="vd-upload-title" className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            Versioned Data — Round-trip upload
            {eduEntry && <InfoIcon entry={eduEntry} size={12} />}
          </h3>
          <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
            Download the template, edit offline in Excel, upload to apply. All uploads are recorded in the audit trail.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!canDownload}
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold shrink-0',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol',
            !canDownload
              ? 'bg-content-alt text-text-muted border border-border cursor-not-allowed'
              : 'bg-white border border-petrol/40 text-petrol hover:bg-petrol/5',
          )}
        >
          <Download size={13} aria-hidden="true" /> Download template
        </button>
      </header>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!canUpload) { toast.error('Your role does not permit data uploads.'); return; }
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'border-2 border-dashed p-5 sm:p-6 flex flex-col items-center gap-2 text-center transition-colors',
          isDragging ? 'border-petrol bg-petrol/5' : 'border-border bg-content-alt/40',
          !canUpload && 'opacity-60',
        )}
      >
        <FileSpreadsheet size={28} className="text-petrol/70" aria-hidden="true" />
        <div className="text-xs text-text-primary font-semibold">
          {parsing ? 'Parsing file…' : 'Drop an .xlsx here or click to select'}
        </div>
        <div className="text-[10px] text-text-muted max-w-md leading-snug">
          Required columns: <span className="font-data">project_id, data_version, scenario_version, status, last_modified, modified_by</span>.
          Validation happens before any changes are applied.
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label="Select Versioned Data xlsx file"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={!canUpload}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload || parsing}
          className={cn(
            'inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold mt-1',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol',
            !canUpload
              ? 'bg-content-alt text-text-muted border border-border cursor-not-allowed'
              : 'bg-petrol hover:bg-petrol-light text-white border border-petrol',
          )}
          title={!canUpload ? 'Requires Analyst or Admin role' : 'Select xlsx file'}
        >
          <Upload size={13} aria-hidden="true" />
          {parsing ? 'Parsing…' : 'Select file'}
        </button>
      </div>

      {/* Summary + diff */}
      {summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryTile label="Rows read" value={parseResult?.rowsRead.toString() ?? '0'} tone="neutral" />
            <SummaryTile label="Updated" value={summary.updated.toString()} tone={summary.updated > 0 ? 'petrol' : 'neutral'} />
            <SummaryTile label="Added (skipped)" value={summary.added.toString()} tone={summary.added > 0 ? 'amber' : 'neutral'} />
            <SummaryTile label="Issues" value={summary.issues.toString()} tone={summary.issues > 0 ? 'danger' : 'success'} />
          </div>

          {/* Issues */}
          {parseResult && parseResult.issues.length > 0 && (
            <div role="alert" aria-live="polite" className="border border-danger/30 bg-danger/5 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                <AlertCircle size={13} aria-hidden="true" />
                Validation issues ({parseResult.issues.length})
              </div>
              <ul className="text-[11px] text-danger space-y-0.5 pl-5 list-disc">
                {parseResult.issues.slice(0, 8).map((iss, i) => (
                  <li key={i}>
                    Row {iss.row}, <span className="font-data">{iss.field}</span>: {iss.message}
                  </li>
                ))}
                {parseResult.issues.length > 8 && (
                  <li>…and {parseResult.issues.length - 8} more.</li>
                )}
              </ul>
            </div>
          )}

          {/* Diff table */}
          {diff.length > 0 && (
            <div className="border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-xs tabular-nums min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border bg-content-alt text-text-secondary">
                      <th className="text-left px-2 py-1.5 font-semibold sticky left-0 bg-content-alt z-10 min-w-[100px]">Change</th>
                      <th className="text-left px-2 py-1.5 font-semibold min-w-[120px]">Project</th>
                      <th className="text-left px-2 py-1.5 font-semibold min-w-[90px]">Version</th>
                      <th className="text-left px-2 py-1.5 font-semibold min-w-[110px]">Status</th>
                      <th className="text-left px-2 py-1.5 font-semibold min-w-[110px]">Modified</th>
                      <th className="text-left px-2 py-1.5 font-semibold min-w-[120px]">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.slice(0, 30).map((row) => (
                      <tr
                        key={row.key}
                        className={cn(
                          'border-b border-border/30',
                          row.kind === 'added' && 'bg-amber/5',
                          row.kind === 'updated' && 'bg-petrol/5',
                        )}
                      >
                        <td className={cn(
                          'px-2 py-1.5 font-semibold sticky left-0 z-10',
                          row.kind === 'added' ? 'bg-amber/10 text-amber' :
                          row.kind === 'updated' ? 'bg-petrol/10 text-petrol' :
                          'bg-white text-text-muted',
                        )}>
                          {row.kind.charAt(0).toUpperCase() + row.kind.slice(1)}
                        </td>
                        <td className="px-2 py-1.5 font-data text-text-primary">{row.parsed.projectId}</td>
                        <td className="px-2 py-1.5 font-data">{row.parsed.dataVersion}</td>
                        <td className="px-2 py-1.5">
                          {row.previous && row.previous.status !== row.parsed.status ? (
                            <span className="text-text-muted">
                              <span className="line-through">{row.previous.status}</span>
                              {' → '}
                              <span className="text-text-primary font-semibold">{row.parsed.status}</span>
                            </span>
                          ) : (
                            <span className="text-text-primary">{row.parsed.status}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-data text-text-secondary">{row.parsed.lastModified}</td>
                        <td className="px-2 py-1.5 text-text-primary">{row.parsed.modifiedBy}</td>
                      </tr>
                    ))}
                    {diff.length > 30 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-2 text-center text-[10px] text-text-muted">
                          …and {diff.length - 30} more rows (all will be applied).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Apply / cancel */}
          <div className="flex flex-col sm:flex-row-reverse gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={!canUpload || summary.issues > 0 || summary.updated === 0}
              className={cn(
                'h-9 px-4 text-xs font-semibold inline-flex items-center justify-center gap-1.5',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol',
                !canUpload || summary.issues > 0 || summary.updated === 0
                  ? 'bg-content-alt text-text-muted border border-border cursor-not-allowed'
                  : 'bg-success hover:bg-success/90 text-white border border-success',
              )}
              title={summary.issues > 0 ? 'Resolve validation issues first' : summary.updated === 0 ? 'No updates to apply' : undefined}
            >
              <CheckCircle2 size={13} aria-hidden="true" />
              Apply {summary.updated} update{summary.updated === 1 ? '' : 's'}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="h-9 px-4 text-xs font-semibold border border-border bg-white hover:bg-content-alt text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol inline-flex items-center justify-center gap-1.5"
            >
              <X size={13} aria-hidden="true" /> Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'petrol' | 'amber' | 'danger' | 'success' }) {
  const toneClass =
    tone === 'petrol' ? 'border-petrol/40 bg-petrol/5' :
    tone === 'amber' ? 'border-amber/40 bg-amber/5' :
    tone === 'danger' ? 'border-danger/40 bg-danger/5' :
    tone === 'success' ? 'border-success/40 bg-success/5' :
    'border-border bg-content-alt/30';
  const valueClass =
    tone === 'petrol' ? 'text-petrol' :
    tone === 'amber' ? 'text-amber' :
    tone === 'danger' ? 'text-danger' :
    tone === 'success' ? 'text-success' :
    'text-text-primary';
  return (
    <div className={cn('border p-2 min-w-0', toneClass)}>
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">{label}</div>
      <div className={cn('text-xl font-semibold font-data tabular-nums mt-0.5', valueClass)}>{value}</div>
    </div>
  );
}
