// ════════════════════════════════════════════════════════════════════════
// WorkflowActionBar — shown inline next to a VersionedProjectData status
//
// Surfaces only the actions available to the current user for the given
// record state. Disabled actions include a tooltip explaining why (role,
// SoD). Destructive / irreversible actions (approve, request_changes)
// expand into a confirmation form with an optional comment field before
// the transition fires.
// ════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore, useCurrentUser } from '@/store/auth-store';
import { canTransition, availableActions } from '@/engine/workflow/transitions';
import type { WorkflowAction } from '@/engine/workflow/transitions';
import type { VersionedProjectData, DataVersion } from '@/engine/types';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Send, CheckCircle2, MessageSquareWarning, RotateCcw, X, ChevronRight, type LucideIcon } from 'lucide-react';

interface WorkflowActionBarProps {
  projectId: string;
  dataVersion: DataVersion;
  record: VersionedProjectData;
  /** Shown beside the status — compact mode hides help text. */
  compact?: boolean;
}

const ACTION_META: Record<WorkflowAction, {
  label: string;
  icon: LucideIcon;
  eduId: string;
  tone: 'petrol' | 'success' | 'amber';
  needsComment: boolean;
  needsConfirm: boolean;
}> = {
  submit:          { label: 'Submit',          icon: Send,                 eduId: 'W-02', tone: 'petrol',  needsComment: false, needsConfirm: false },
  resubmit:        { label: 'Resubmit',        icon: RotateCcw,            eduId: 'W-05', tone: 'petrol',  needsComment: false, needsConfirm: false },
  approve:         { label: 'Approve',         icon: CheckCircle2,         eduId: 'W-03', tone: 'success', needsComment: false, needsConfirm: true },
  request_changes: { label: 'Request Changes', icon: MessageSquareWarning, eduId: 'W-04', tone: 'amber',   needsComment: true,  needsConfirm: false },
};

export function WorkflowActionBar({ projectId, dataVersion, record, compact }: WorkflowActionBarProps) {
  const user = useCurrentUser();
  const apply = useProjectStore((s) => s.applyWorkflowTransition);
  const recordAudit = useAuthStore((s) => s.recordAudit);

  const [active, setActive] = useState<WorkflowAction | null>(null);
  const [comment, setComment] = useState('');

  if (!user) return null;

  const actions = availableActions(record.status);
  if (actions.length === 0) return null;

  const handleFire = (action: WorkflowAction, commentToSubmit?: string) => {
    const result = apply(projectId, dataVersion, action, user, { comment: commentToSubmit });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    const meta = ACTION_META[action];
    const targetId = `${projectId}::${dataVersion}`;
    const nextStatusMap: Record<WorkflowAction, string> = {
      submit: 'submitted',
      resubmit: 'submitted',
      approve: 'approved',
      request_changes: 'to_change',
    };
    recordAudit({
      kind: ({
        submit: 'workflow.submitted',
        resubmit: 'workflow.resubmitted',
        approve: 'workflow.approved',
        request_changes: 'workflow.changes_requested',
      } as const)[action],
      targetId,
      targetLabel: `${dataVersion} plan`,
      detail: commentToSubmit ? `Comment: ${commentToSubmit}` : `Transitioned to ${nextStatusMap[action]}`,
    });
    // Audit entry for simulated notification to the next role
    const nextActorHint: Record<WorkflowAction, string> = {
      submit: 'Reviewers & Approvers',
      resubmit: 'Reviewers & Approvers',
      approve: 'Analyst & Admin',
      request_changes: 'Analyst (original submitter)',
    };
    toast.success(`${meta.label} recorded. Notification sent to ${nextActorHint[action]}.`);
    setActive(null);
    setComment('');
  };

  // Inline expanded form for the active action
  if (active) {
    const meta = ACTION_META[active];
    const Icon = meta.icon;
    const submitDisabled = meta.needsComment && comment.trim().length < 3;

    return (
      <div className="flex flex-col gap-2 p-3 bg-content-alt/60 border border-border">
        <div className="flex items-center gap-2">
          <Icon size={14} className={toneFg(meta.tone)} aria-hidden="true" />
          <span className="text-xs font-semibold text-text-primary">
            {meta.needsConfirm ? `Confirm: ${meta.label}` : meta.label}
          </span>
          <button
            type="button"
            onClick={() => { setActive(null); setComment(''); }}
            className="ml-auto text-text-muted hover:text-text-primary p-1 -m-1"
            aria-label="Cancel"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        {active === 'approve' && (
          <p className="text-xs text-text-secondary leading-relaxed">
            This will lock the version as the approved plan. The action is recorded in the audit trail with
            your identity, role, and timestamp.
          </p>
        )}
        {meta.needsComment && (
          <>
            <label htmlFor="wf-comment" className="text-caption uppercase tracking-wider text-text-muted font-semibold">
              Reviewer note <span className="text-danger">*</span>
            </label>
            <textarea
              id="wf-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Describe what needs to change before resubmission…"
              className="w-full px-2 py-1.5 text-xs border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-petrol focus:border-petrol resize-y"
            />
          </>
        )}
        <div className="flex flex-col sm:flex-row-reverse gap-2">
          <button
            type="button"
            disabled={submitDisabled}
            onClick={() => handleFire(active, meta.needsComment ? comment.trim() : undefined)}
            className={cn(
              'h-9 px-3 text-xs font-semibold text-white flex items-center justify-center gap-1.5',
              'disabled:bg-border disabled:text-text-muted',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol',
              toneBg(meta.tone),
              toneHover(meta.tone),
            )}
          >
            <Icon size={13} aria-hidden="true" />
            Confirm {meta.label}
          </button>
          <button
            type="button"
            onClick={() => { setActive(null); setComment(''); }}
            className="h-9 px-3 text-xs border border-border hover:bg-content-alt text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', compact && 'gap-1')}>
      {actions.map((action) => {
        const meta = ACTION_META[action];
        const Icon = meta.icon;
        const gate = canTransition(record, action, user);
        const disabled = !gate.allowed;

        const onClick = () => {
          if (meta.needsConfirm || meta.needsComment) {
            setActive(action);
          } else {
            handleFire(action);
          }
        };

        return (
          <EduTooltip key={action} entryId={meta.eduId}>
            <button
              type="button"
              onClick={onClick}
              disabled={disabled}
              className={cn(
                'inline-flex items-center gap-1 h-7 px-2 text-caption font-semibold rounded-none',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol',
                disabled
                  ? 'border border-border bg-content-alt/60 text-text-muted cursor-not-allowed'
                  : cn('border text-white', toneBg(meta.tone), toneHover(meta.tone), toneBorder(meta.tone)),
              )}
              title={disabled ? gate.reason : undefined}
              aria-label={disabled ? `${meta.label} (disabled: ${gate.reason})` : meta.label}
            >
              <Icon size={12} aria-hidden="true" />
              {meta.label}
              {!disabled && <ChevronRight size={11} aria-hidden="true" />}
            </button>
          </EduTooltip>
        );
      })}
    </div>
  );
}

function toneBg(t: 'petrol' | 'success' | 'amber'): string {
  return t === 'success' ? 'bg-success' : t === 'amber' ? 'bg-amber' : 'bg-petrol';
}
function toneHover(t: 'petrol' | 'success' | 'amber'): string {
  return t === 'success' ? 'hover:bg-success/90' : t === 'amber' ? 'hover:bg-amber/90' : 'hover:bg-petrol-light';
}
function toneBorder(t: 'petrol' | 'success' | 'amber'): string {
  return t === 'success' ? 'border-success' : t === 'amber' ? 'border-amber' : 'border-petrol';
}
function toneFg(t: 'petrol' | 'success' | 'amber'): string {
  return t === 'success' ? 'text-success' : t === 'amber' ? 'text-amber' : 'text-petrol';
}
