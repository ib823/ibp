// ════════════════════════════════════════════════════════════════════════
// Workflow state machine + SoD guard
//
// Pure functions, no store coupling — easy to unit test.
// UI calls `canTransition(...)` before enabling an action button; when the
// user clicks, the store calls `applyTransition(...)` to produce the next
// record. Failure reasons are returned as user-facing strings.
// ════════════════════════════════════════════════════════════════════════

import type {
  DataStatus,
  VersionedProjectData,
} from '@/engine/types';
import type {
  User,
  Capability,
  AuditEventKind,
} from '@/engine/auth/types';
import { can } from '@/engine/auth/types';

export type WorkflowAction = 'submit' | 'approve' | 'request_changes' | 'resubmit';

export interface TransitionResult {
  readonly allowed: boolean;
  readonly reason?: string;
  /** New status that would result from this action. */
  readonly nextStatus?: DataStatus;
  /** Which capability was (or would be) required. */
  readonly requiredCapability?: Capability;
  /** Audit event kind that the store should emit on success. */
  readonly auditKind?: AuditEventKind;
}

// Deterministic mapping from (currentStatus, action) → (nextStatus, required capability).
// Absent rows mean "action not allowed from that state".
const TRANSITION_MATRIX: Partial<Record<`${DataStatus}::${WorkflowAction}`, {
  next: DataStatus;
  cap: Capability;
  kind: AuditEventKind;
  enforceSoD: boolean;
}>> = {
  'open::submit':              { next: 'submitted',  cap: 'workflow.submit',          kind: 'workflow.submitted',         enforceSoD: false },
  'to_change::resubmit':       { next: 'submitted',  cap: 'workflow.submit',          kind: 'workflow.resubmitted',       enforceSoD: false },
  'submitted::approve':        { next: 'approved',   cap: 'workflow.approve',         kind: 'workflow.approved',          enforceSoD: true  },
  'submitted::request_changes':{ next: 'to_change',  cap: 'workflow.request_changes', kind: 'workflow.changes_requested', enforceSoD: false },
};

export function canTransition(
  current: VersionedProjectData,
  action: WorkflowAction,
  actor: User,
): TransitionResult {
  const key = `${current.status}::${action}` as keyof typeof TRANSITION_MATRIX;
  const rule = TRANSITION_MATRIX[key];
  if (!rule) {
    return { allowed: false, reason: `Cannot ${describeAction(action)} from status "${current.status}".` };
  }
  if (!can(actor.role, rule.cap)) {
    return {
      allowed: false,
      reason: `Your role (${actor.role}) does not have the "${rule.cap}" capability.`,
      requiredCapability: rule.cap,
    };
  }
  if (rule.enforceSoD && current.submittedBy === actor.id) {
    return {
      allowed: false,
      reason: 'Segregation of Duty: the user who submitted a version cannot also approve it. Ask a different Approver to sign off.',
      requiredCapability: rule.cap,
    };
  }
  return {
    allowed: true,
    nextStatus: rule.next,
    requiredCapability: rule.cap,
    auditKind: rule.kind,
  };
}

/**
 * Returns the next VersionedProjectData after applying `action`. Throws if the
 * transition is not allowed — callers must have gated on `canTransition` first.
 */
export function applyTransition(
  current: VersionedProjectData,
  action: WorkflowAction,
  actor: User,
  options?: { comment?: string; now?: string },
): VersionedProjectData {
  const check = canTransition(current, action, actor);
  if (!check.allowed || !check.nextStatus) {
    throw new Error(check.reason ?? 'Transition not allowed');
  }
  const now = options?.now ?? new Date().toISOString();
  const isSubmission = action === 'submit' || action === 'resubmit';
  return {
    ...current,
    status: check.nextStatus,
    lastModified: now,
    modifiedBy: actor.displayName,
    submittedBy: isSubmission ? actor.id : current.submittedBy,
    reviewComment: options?.comment ?? current.reviewComment,
  };
}

export function describeAction(action: WorkflowAction): string {
  switch (action) {
    case 'submit': return 'submit';
    case 'resubmit': return 'resubmit';
    case 'approve': return 'approve';
    case 'request_changes': return 'request changes';
  }
}

export function availableActions(status: DataStatus): WorkflowAction[] {
  switch (status) {
    case 'open':      return ['submit'];
    case 'submitted': return ['approve', 'request_changes'];
    case 'to_change': return ['resubmit'];
    case 'approved':  return [];
    default:          return [];
  }
}
