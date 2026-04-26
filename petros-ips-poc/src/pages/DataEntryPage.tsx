// ════════════════════════════════════════════════════════════════════════
// DataEntryPage — RFP §2 UI requirement: "Basic functionality as per
// PETROS Business Planning (BP) Central". Demonstrates:
//
//   • multi-user-style data entry grid (accounts × years)
//   • mocked concurrent-editor presence indicators
//   • per-row workflow status badges (open / submitted / approved /
//     to_change) sourced from the existing engine
//   • capability-gated Save / Submit / Approve / Request Changes
//     buttons via canTransition()
//   • Segregation of Duty enforcement (submitter ≠ approver)
//   • audit-trail emission for every workflow transition
//
// All economics state stays untouched — this page is a parallel data
// entry surface aligned with the SoW UI specification.
// ════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore, useCurrentUser } from '@/store/auth-store';
import { Select } from '@/components/ui5/Ui5Select';
import { Button } from '@/components/ui5/Ui5Button';
import { Input } from '@/components/ui5/Ui5Input';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RoleBadge } from '@/components/shared/RoleBadge';
import { Pill } from '@/components/shared/Pill';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { canTransition } from '@/engine/workflow/transitions';
import { PERSONAS } from '@/data/personas';
import { fmtNum } from '@/lib/format';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { DataStatus, VersionedProjectData } from '@/engine/types';
import type { WorkflowAction } from '@/engine/workflow/transitions';
import { Users, Save, Send, Check, RotateCcw, AlertCircle } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────

interface AccountRow {
  id: string;
  label: string;
  unit: string;
  group: 'production' | 'capex' | 'opex';
  /** Reads from the project profile by year. */
  read: (year: number, projectId: string) => number;
}

const ACCOUNT_ROWS: AccountRow[] = [
  { id: 'oil',         label: 'Oil Production',     unit: 'bpd',     group: 'production',
    read: (y, pid) => readProduction(pid, 'oil', y) },
  { id: 'gas',         label: 'Gas Production',     unit: 'MMscfd',  group: 'production',
    read: (y, pid) => readProduction(pid, 'gas', y) },
  { id: 'condensate',  label: 'Condensate',         unit: 'bpd',     group: 'production',
    read: (y, pid) => readProduction(pid, 'condensate', y) },
  { id: 'capexDrill',  label: 'CAPEX — Drilling',   unit: 'USD M',   group: 'capex',
    read: (y, pid) => readCost(pid, 'capexDrilling', y) / 1e6 },
  { id: 'capexFac',    label: 'CAPEX — Facilities', unit: 'USD M',   group: 'capex',
    read: (y, pid) => readCost(pid, 'capexFacilities', y) / 1e6 },
  { id: 'capexSubsea', label: 'CAPEX — Subsea',     unit: 'USD M',   group: 'capex',
    read: (y, pid) => readCost(pid, 'capexSubsea', y) / 1e6 },
  { id: 'opexFixed',   label: 'OPEX — Fixed',       unit: 'USD M',   group: 'opex',
    read: (y, pid) => readCost(pid, 'opexFixed', y) / 1e6 },
  { id: 'opexVar',     label: 'OPEX — Variable',    unit: 'USD M',   group: 'opex',
    read: (y, pid) => readCost(pid, 'opexVariable', y) / 1e6 },
];

// ── Page component ────────────────────────────────────────────────────

export default function DataEntryPage() {
  usePageTitle('Data Entry');
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProjectId = useProjectStore((s) => s.setActiveProject);
  const recordAudit = useAuthStore((s) => s.recordAudit);
  const user = useCurrentUser();

  const [status, setStatus] = useState<DataStatus>('open');
  const [submittedBy, setSubmittedBy] = useState<string | undefined>(undefined);
  const [reviewComment, setReviewComment] = useState<string | undefined>(undefined);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [savedEdits, setSavedEdits] = useState<Record<string, number>>({});

  const project = useMemo(
    () => projects.find((p) => p.project.id === activeProjectId) ?? projects[0],
    [projects, activeProjectId],
  );

  // Display 5 years from project start
  const years = useMemo(() => {
    if (!project) return [];
    const start = project.project.startYear;
    return Array.from({ length: 5 }, (_, i) => start + i);
  }, [project]);

  // Mock "concurrent editors" — show two other personas as if they were
  // also editing this submission. Excludes the current user.
  const otherEditors = useMemo(
    () => PERSONAS.filter((p) => p.id !== user.id).slice(0, 2),
    [user.id],
  );

  const editable = status === 'open' || status === 'to_change';

  const setCellValue = useCallback((rowId: string, year: number, value: number) => {
    setEdits((prev) => ({ ...prev, [`${rowId}::${year}`]: value }));
  }, []);

  const cellValue = (rowId: string, year: number, projectId: string): number => {
    const key = `${rowId}::${year}`;
    if (key in edits) return edits[key]!;
    if (key in savedEdits) return savedEdits[key]!;
    const row = ACCOUNT_ROWS.find((r) => r.id === rowId)!;
    return row.read(year, projectId);
  };

  const isModified = (rowId: string, year: number): boolean => {
    const key = `${rowId}::${year}`;
    if (!(key in edits)) return false;
    return edits[key] !== savedEdits[key];
  };

  const dirtyCount = Object.entries(edits).filter(([k, v]) => v !== savedEdits[k]).length;

  // Build a synthetic VersionedProjectData so we can use the existing
  // canTransition() guard without coupling this demo page to a real store.
  const versionedRecord: VersionedProjectData = useMemo(() => ({
    projectId: project?.project.id ?? '',
    dataVersion: 'working',
    scenarioVersion: 'base',
    status,
    lastModified: new Date().toISOString(),
    modifiedBy: user.id,
    productionProfile: project?.productionProfile ?? { oil: {}, gas: {}, condensate: {}, water: {} },
    costProfile: project?.costProfile ?? {
      capexDrilling: {}, capexFacilities: {}, capexSubsea: {}, capexOther: {},
      opexFixed: {}, opexVariable: {}, abandonmentCost: {},
    },
    submittedBy,
    reviewComment,
  }), [project, status, user.id, submittedBy, reviewComment]);

  const submitGuard = canTransition(versionedRecord, 'submit', user);
  const resubmitGuard = canTransition(versionedRecord, 'resubmit', user);
  const approveGuard = canTransition(versionedRecord, 'approve', user);
  const requestChangesGuard = canTransition(versionedRecord, 'request_changes', user);

  const handleSave = () => {
    const next = { ...savedEdits, ...edits };
    setSavedEdits(next);
    setEdits({});
    toast.success(`Saved ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}`);
    if (project) {
      recordAudit({
        kind: 'data.template_uploaded',
        targetId: `${project.project.id}::working`,
        targetLabel: project.project.name,
        detail: `Saved ${dirtyCount} cell edit${dirtyCount === 1 ? '' : 's'} (Data Entry)`,
      });
    }
  };

  const handleWorkflowAction = (action: WorkflowAction) => {
    const guard = canTransition(versionedRecord, action, user);
    if (!guard.allowed) {
      toast.error(guard.reason ?? 'Action not allowed');
      return;
    }
    setStatus(guard.nextStatus!);
    if (action === 'submit' || action === 'resubmit') setSubmittedBy(user.id);
    if (action === 'request_changes') setReviewComment('Reviewer requested changes via Data Entry page');
    if (action === 'approve') setReviewComment(undefined);
    if (project && guard.auditKind) {
      recordAudit({
        kind: guard.auditKind,
        targetId: `${project.project.id}::working`,
        targetLabel: project.project.name,
        detail: `${describeAction(action)} via Data Entry page`,
      });
    }
    toast.success(`${describeAction(action)} successful`);
  };

  const handleReset = () => {
    setEdits({});
    setSavedEdits({});
    setStatus('open');
    setSubmittedBy(undefined);
    setReviewComment(undefined);
    toast.info('Data Entry reset to original project values');
  };

  if (!project) {
    return <div />;
  }

  return (
    <div className="space-y-4 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Data Entry</h1>
          <p className="text-xs text-text-secondary mt-0.5 max-w-2xl">
            BP Central-style entry grid: parallel multi-user data entry with status prompts
            (saved, submitted, approved), Segregation of Duty enforcement, and audit-trail
            emission. Every action goes through the same workflow engine that powers the
            Audit Trail page.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select
            value={project.project.id}
            onValueChange={(v) => setActiveProjectId(v)}
            options={projects.map((p) => ({ value: p.project.id, label: p.project.name }))}
            className="w-[220px]"
            aria-label="Project"
          />
        </div>
      </div>

      {/* Workflow status banner */}
      <div className="border border-border bg-white p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-caption font-semibold uppercase tracking-wider text-text-secondary">
            Status
          </span>
          <StatusBadge status={status} />
          {submittedBy && (
            <span className="text-caption text-text-muted">
              Submitted by{' '}
              <span className="font-medium text-text-primary">
                {PERSONAS.find((p) => p.id === submittedBy)?.displayName ?? submittedBy}
              </span>
            </span>
          )}
          {reviewComment && (
            <span className="text-caption text-amber inline-flex items-center gap-1">
              <AlertCircle size={11} aria-hidden="true" />
              {reviewComment}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-caption text-text-muted hidden sm:inline">
            {dirtyCount > 0
              ? `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}`
              : 'no unsaved changes'}
          </span>
          <Button
            variant="outline"
            size="sm"
            icon="reset"
            className="text-xs"
            onClick={handleReset}
            title="Discard all edits and return the page to a fresh open status."
          >
            <span className="hidden sm:inline">Reset</span>
            <RotateCcw size={12} className="sm:hidden" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Active editors — mocked presence */}
      <div className="border border-petrol/30 bg-petrol/5 px-3 py-2 flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-petrol">
          <Users size={11} aria-hidden="true" />
          Active editors
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Current user */}
          <PresenceChip name={user.displayName} initials={user.initials} role={user.role} isYou />
          {/* Mocked others */}
          {otherEditors.map((p) => (
            <PresenceChip key={p.id} name={p.displayName} initials={p.initials} role={p.role} />
          ))}
        </div>
        <span className="text-caption text-text-muted ml-auto">
          Live presence is illustrative; SAC Calendar tasks deliver real concurrent-editor
          indicators in production.
        </span>
      </div>

      {/* Grid */}
      <div className="border border-border bg-white">
        <div className="px-4 pt-3 pb-1">
          <h4 className="text-caption font-semibold uppercase tracking-wider text-text-secondary mb-1">
            Plan submission — {project.project.name}
          </h4>
          <p className="text-caption text-text-muted mb-2 max-w-3xl">
            Edit individual cells, then Save Draft. Submit transitions the row to a reviewer;
            Approve requires a different user (Segregation of Duty). The Economics page is where
            the full PSC run consumes these inputs.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-y border-border bg-content-alt/50">
                <th className="text-left px-3 py-2 sticky left-0 bg-content-alt/50 z-10 w-[200px]">
                  Account
                </th>
                <th className="text-left px-2 py-2 w-[80px]">Unit</th>
                {years.map((y) => (
                  <th key={y} className="text-right px-2 py-2 w-[110px] font-data">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['production', 'capex', 'opex'] as const).map((group) => (
                <GroupRows
                  key={group}
                  group={group}
                  rows={ACCOUNT_ROWS.filter((r) => r.group === group)}
                  years={years}
                  projectId={project.project.id}
                  cellValue={cellValue}
                  isModified={isModified}
                  setCellValue={setCellValue}
                  editable={editable}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workflow toolbar */}
      <div className="border border-border bg-white p-3 flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          icon="save"
          className="text-xs"
          onClick={handleSave}
          disabled={!editable || dirtyCount === 0}
          title={!editable
            ? 'Editing is locked — submit a request_changes to reopen.'
            : dirtyCount === 0
              ? 'No unsaved changes.'
              : `Save ${dirtyCount} cell edit${dirtyCount === 1 ? '' : 's'} as draft.`}
        >
          <Save size={12} className="inline mr-1" aria-hidden="true" />
          Save Draft
        </Button>
        <WorkflowButton
          label="Submit for Review"
          icon={<Send size={12} aria-hidden="true" />}
          guard={status === 'to_change' ? resubmitGuard : submitGuard}
          onClick={() => handleWorkflowAction(status === 'to_change' ? 'resubmit' : 'submit')}
          allowedStatus={status === 'open' || status === 'to_change'}
        />
        <WorkflowButton
          label="Request Changes"
          icon={<RotateCcw size={12} aria-hidden="true" />}
          guard={requestChangesGuard}
          onClick={() => handleWorkflowAction('request_changes')}
          allowedStatus={status === 'submitted'}
        />
        <WorkflowButton
          label="Approve"
          icon={<Check size={12} aria-hidden="true" />}
          guard={approveGuard}
          onClick={() => handleWorkflowAction('approve')}
          allowedStatus={status === 'submitted'}
          variant="default"
        />
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function PresenceChip({
  name,
  initials,
  role,
  isYou,
}: {
  name: string;
  initials: string;
  role: 'analyst' | 'reviewer' | 'approver' | 'admin' | 'viewer';
  isYou?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-border rounded text-caption"
      title={`${name} (${role})${isYou ? ' — you' : ''}`}
    >
      <span className="w-5 h-5 rounded-full bg-petrol text-white text-caption font-semibold flex items-center justify-center shrink-0">
        {initials}
      </span>
      <span className="text-text-primary font-medium">{name}</span>
      {isYou && <Pill tone="petrol" size="xs">You</Pill>}
      <RoleBadge role={role} />
    </span>
  );
}

function GroupRows({
  group,
  rows,
  years,
  projectId,
  cellValue,
  isModified,
  setCellValue,
  editable,
}: {
  group: 'production' | 'capex' | 'opex';
  rows: AccountRow[];
  years: number[];
  projectId: string;
  cellValue: (rowId: string, year: number, projectId: string) => number;
  isModified: (rowId: string, year: number) => boolean;
  setCellValue: (rowId: string, year: number, value: number) => void;
  editable: boolean;
}) {
  const groupLabels = {
    production: 'Production Profile',
    capex: 'Capital Expenditure',
    opex: 'Operating Expenditure',
  };
  return (
    <>
      <tr className="border-b border-border">
        <td
          colSpan={years.length + 2}
          className="px-3 py-1.5 bg-content-alt/30 text-caption font-semibold uppercase tracking-wider text-text-secondary sticky left-0"
        >
          {groupLabels[group]}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.id} className="border-b border-border/50 hover:bg-content-alt/30 group">
          <td className="px-3 py-1.5 sticky left-0 bg-white group-hover:bg-content-alt/30 z-10">
            <span className="text-text-primary">{row.label}</span>
          </td>
          <td className="px-2 py-1.5 text-text-muted text-caption">{row.unit}</td>
          {years.map((y) => {
            const value = cellValue(row.id, y, projectId);
            const modified = isModified(row.id, y);
            return (
              <td
                key={y}
                className={cn(
                  'px-1 py-1 text-right',
                  modified && 'bg-amber/10',
                )}
              >
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setCellValue(row.id, y, v);
                  }}
                  disabled={!editable}
                  className="h-7 text-xs font-data text-right"
                  aria-label={`${row.label} year ${y}`}
                />
                {modified && (
                  <div className="text-caption text-amber font-medium mt-0.5 leading-none">
                    modified
                  </div>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function WorkflowButton({
  label,
  icon,
  guard,
  onClick,
  allowedStatus,
  variant = 'outline',
}: {
  label: string;
  icon: React.ReactNode;
  guard: ReturnType<typeof canTransition>;
  onClick: () => void;
  allowedStatus: boolean;
  variant?: 'default' | 'outline';
}) {
  const visible = allowedStatus;
  if (!visible) return null;
  const disabled = !guard.allowed;
  return (
    <EduTooltip text={disabled ? guard.reason ?? '' : `Click to ${label.toLowerCase()}.`}>
      <span>
        <Button
          variant={variant}
          size="sm"
          className="text-xs"
          onClick={onClick}
          disabled={disabled}
        >
          {icon}
          <span className="ml-1">{label}</span>
        </Button>
      </span>
    </EduTooltip>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function readProduction(
  projectId: string,
  field: 'oil' | 'gas' | 'condensate',
  year: number,
): number {
  const project = useProjectStore.getState().projects.find((p) => p.project.id === projectId);
  if (!project) return 0;
  return project.productionProfile[field]?.[year] ?? 0;
}

function readCost(
  projectId: string,
  field: 'capexDrilling' | 'capexFacilities' | 'capexSubsea' | 'capexOther' | 'opexFixed' | 'opexVariable' | 'abandonmentCost',
  year: number,
): number {
  const project = useProjectStore.getState().projects.find((p) => p.project.id === projectId);
  if (!project) return 0;
  return project.costProfile[field]?.[year] ?? 0;
}

function describeAction(a: WorkflowAction): string {
  switch (a) {
    case 'submit': return 'Submit';
    case 'resubmit': return 'Resubmit';
    case 'approve': return 'Approve';
    case 'request_changes': return 'Request changes';
  }
}

// silence "unused" on fmtNum import (may be used in future)
void fmtNum;
