// ════════════════════════════════════════════════════════════════════════
// AuditTrailPage — append-only log of privileged actions
//
// Provides the evidence trail required by SoW Section 2.10 "audit trail
// for change tracking and compliance". Filters: event kind + actor.
// Table is horizontally scrollable at narrow widths with a sticky first
// column so the timestamp stays visible while the user scrolls detail.
// ════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Select } from '@/components/ui5/Ui5Select';
import { Button } from '@/components/ui5/Ui5Button';
import { useAuthStore, useCurrentUser, filterAudit } from '@/store/auth-store';
import { RoleBadge } from '@/components/shared/RoleBadge';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { SectionHelp } from '@/components/shared/SectionHelp';
import { toast } from '@/lib/toast';
import { getPageEntries } from '@/lib/educational-content';
import type { AuditEventKind } from '@/engine/auth/types';
import { cn } from '@/lib/utils';
import {
  LogIn, LogOut, ShieldCheck,
  Send, MessageSquareWarning, CheckCircle2, RotateCcw,
  Plug2, PlugZap, RefreshCcw, Download, Upload,
} from 'lucide-react';

const edu = getPageEntries('audit');

const KIND_LABELS: Record<AuditEventKind, string> = {
  'auth.signed_in':          'User signed in',
  'auth.signed_out':         'User signed out',
  'auth.mfa_verified':       'MFA verified',
  'workflow.submitted':      'Submitted for review',
  'workflow.changes_requested': 'Changes requested',
  'workflow.approved':       'Approved',
  'workflow.resubmitted':    'Resubmitted',
  'connection.configured':   'Connection configured',
  'connection.disconnected': 'Connection disconnected',
  'connection.synced':       'Connection synced',
  'data.template_downloaded':'Template downloaded',
  'data.template_uploaded':  'Template uploaded',
};

const KIND_ICON: Record<AuditEventKind, React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>> = {
  'auth.signed_in':             LogIn,
  'auth.signed_out':            LogOut,
  'auth.mfa_verified':          ShieldCheck,
  'workflow.submitted':         Send,
  'workflow.changes_requested': MessageSquareWarning,
  'workflow.approved':          CheckCircle2,
  'workflow.resubmitted':       RotateCcw,
  'connection.configured':      PlugZap,
  'connection.disconnected':    Plug2,
  'connection.synced':          RefreshCcw,
  'data.template_downloaded':   Download,
  'data.template_uploaded':     Upload,
};

const KIND_TONE: Record<AuditEventKind, 'neutral' | 'success' | 'amber' | 'danger' | 'petrol'> = {
  'auth.signed_in':             'petrol',
  'auth.signed_out':            'neutral',
  'auth.mfa_verified':          'success',
  'workflow.submitted':         'petrol',
  'workflow.changes_requested': 'amber',
  'workflow.approved':          'success',
  'workflow.resubmitted':       'petrol',
  'connection.configured':      'success',
  'connection.disconnected':    'neutral',
  'connection.synced':          'petrol',
  'data.template_downloaded':   'neutral',
  'data.template_uploaded':     'petrol',
};

const CATEGORY_KINDS: Record<'all' | 'auth' | 'workflow' | 'data', readonly AuditEventKind[] | 'all'> = {
  all:      'all',
  auth:     ['auth.signed_in', 'auth.signed_out', 'auth.mfa_verified'],
  workflow: ['workflow.submitted', 'workflow.changes_requested', 'workflow.approved', 'workflow.resubmitted'],
  data:     ['connection.configured', 'connection.disconnected', 'connection.synced', 'data.template_downloaded', 'data.template_uploaded'],
};

function fmtTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AuditTrailPage() {
  usePageTitle('Audit Trail');
  const log = useAuthStore((s) => s.auditLog);
  const clearAudit = useAuthStore((s) => s.clearAudit);
  const currentUser = useCurrentUser();

  const [category, setCategory] = useState<'all' | 'auth' | 'workflow' | 'data'>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');

  const actors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of log) if (!seen.has(e.actorId)) seen.set(e.actorId, e.actorName);
    return [...seen.entries()];
  }, [log]);

  const filtered = useMemo(() => {
    const byKind = filterAudit(log, CATEGORY_KINDS[category]);
    return actorFilter === 'all' ? byKind : byKind.filter((e) => e.actorId === actorFilter);
  }, [log, category, actorFilter]);

  const canClear = currentUser?.role === 'admin';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-text-primary">Audit Trail</h1>
          {edu['A-01'] && <InfoIcon entry={edu['A-01']} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as typeof category)}
            options={[
              { value: 'all', label: 'All events' },
              { value: 'auth', label: 'Authentication' },
              { value: 'workflow', label: 'Workflow' },
              { value: 'data', label: 'Data & connections' },
            ]}
            className="w-[170px]"
            aria-label="Filter by event category"
          />
          <Select
            value={actorFilter}
            onValueChange={setActorFilter}
            options={[
              { value: 'all', label: 'All users' },
              ...actors.map(([id, name]) => ({ value: id, label: name })),
            ]}
            className="w-[170px]"
            aria-label="Filter by user"
          />
          {canClear && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                clearAudit();
                toast.info('Audit log cleared for this demo session.');
              }}
              title="Admin-only: clears the demo audit log"
            >
              Clear log
            </Button>
          )}
        </div>
      </div>

      {edu['A-01']?.sectionHelp && <SectionHelp entry={edu['A-01']} />}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Events shown" value={filtered.length.toString()} />
        <SummaryCard label="Total in log" value={log.length.toString()} />
        <SummaryCard label="Distinct users" value={actors.length.toString()} />
        <SummaryCard label="Earliest" value={log.length ? fmtTimestamp(log[log.length - 1]!.timestamp).split(',')[0]! : '—'} />
      </div>

      {/* Table */}
      <div className="border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums min-w-[760px]" aria-label="Audit entries">
            <thead>
              <tr className="border-b border-border bg-content-alt text-text-secondary">
                <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-content-alt z-10 min-w-[170px]">Timestamp</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[180px]">Event</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[180px]">Actor</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[80px]">Role</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[180px]">Target</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[240px]">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-text-muted">
                    No audit entries match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const Icon = KIND_ICON[e.kind];
                  return (
                    <tr key={e.id} className="border-b border-border/30 hover:bg-content-alt/40">
                      <td className="px-3 py-1.5 font-data sticky left-0 bg-white z-10 whitespace-nowrap">
                        {fmtTimestamp(e.timestamp)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1.5 text-text-primary">
                          <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded shrink-0', toneBg(KIND_TONE[e.kind]))} aria-hidden="true">
                            <Icon size={11} className={toneFg(KIND_TONE[e.kind])} aria-hidden={true} />
                          </span>
                          {KIND_LABELS[e.kind]}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-text-primary">{e.actorName}</td>
                      <td className="px-3 py-1.5">
                        <RoleBadge role={e.actorRole} />
                      </td>
                      <td className="px-3 py-1.5 text-text-secondary font-data break-all">{e.targetLabel}</td>
                      <td className="px-3 py-1.5 text-text-muted">{e.detail ?? '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-text-muted leading-relaxed">
        Append-only demo audit log — production SAC will persist entries to a tamper-evident store with retention per
        PETROS IT security policy. Sign-in, approval, and data-change events are emitted automatically; admins can filter
        by event kind or actor and export for forensic review.
      </p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-white p-3 min-w-0">
      <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</div>
      <div className="text-lg sm:text-xl font-semibold font-data text-text-primary mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function toneBg(t: 'neutral' | 'success' | 'amber' | 'danger' | 'petrol'): string {
  switch (t) {
    case 'success': return 'bg-success/10';
    case 'amber':   return 'bg-amber/10';
    case 'danger':  return 'bg-danger/10';
    case 'petrol':  return 'bg-petrol/10';
    default:        return 'bg-content-alt';
  }
}
function toneFg(t: 'neutral' | 'success' | 'amber' | 'danger' | 'petrol'): string {
  switch (t) {
    case 'success': return 'text-success';
    case 'amber':   return 'text-amber';
    case 'danger':  return 'text-danger';
    case 'petrol':  return 'text-petrol';
    default:        return 'text-text-muted';
  }
}
