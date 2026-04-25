// ════════════════════════════════════════════════════════════════════════
// PETROS IPS — Auth domain types
//
// Five-role model aligned with SoW Section 2.10 (role-based access,
// Segregation of Duty). Used by the mock Entra ID SSO flow in the POC;
// the production SAC implementation will federate against the real
// tenant directory, and role assignments will be driven by Entra ID
// group membership rather than the in-memory persona selector.
// ════════════════════════════════════════════════════════════════════════

export type Role =
  | 'analyst'   // Can edit drafts and submit for review
  | 'reviewer'  // Can request changes on submitted items; cannot approve
  | 'approver'  // Can approve (SoD: cannot approve own submission)
  | 'admin'     // All permissions + connection + role management
  | 'viewer';   // Read-only

export interface User {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: Role;
  readonly department: string;
  /** Initials derived from displayName — cached for avatar tiles */
  readonly initials: string;
}

export interface Session {
  readonly user: User;
  readonly signedInAt: string; // ISO date
  readonly tenant: string;     // e.g. "petros.onmicrosoft.com"
}

// ── Audit Trail ──────────────────────────────────────────────────────
//
// Every privileged action writes an AuditEntry. The log is append-only
// (no edit, no delete at the UI layer). `targetId` is polymorphic —
// typically `projectId::dataVersion` for workflow events or `<resource>`
// for connection/admin events.

export type AuditEventKind =
  | 'auth.signed_in'
  | 'auth.signed_out'
  | 'auth.mfa_verified'
  | 'workflow.submitted'
  | 'workflow.changes_requested'
  | 'workflow.approved'
  | 'workflow.resubmitted'
  | 'connection.configured'
  | 'connection.disconnected'
  | 'connection.synced'
  | 'data.template_downloaded'
  | 'data.template_uploaded';

export interface AuditEntry {
  readonly id: string;
  readonly timestamp: string; // ISO date
  readonly actorId: string;
  readonly actorName: string;
  readonly actorRole: Role;
  readonly kind: AuditEventKind;
  readonly targetId: string;
  readonly targetLabel: string;
  readonly detail?: string;
}

// ── Role capability matrix ───────────────────────────────────────────
//
// Keep this narrow and explicit. When UI needs to disable a button, it
// calls `can(role, capability)` rather than encoding role logic inline.

export type Capability =
  | 'data.edit'
  | 'workflow.submit'
  | 'workflow.request_changes'
  | 'workflow.approve'
  | 'connection.manage'
  | 'role.manage'
  | 'audit.view';

const CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  analyst:  new Set(['data.edit', 'workflow.submit', 'audit.view']),
  reviewer: new Set(['workflow.request_changes', 'audit.view']),
  approver: new Set(['workflow.request_changes', 'workflow.approve', 'audit.view']),
  admin:    new Set(['data.edit', 'workflow.submit', 'workflow.request_changes', 'workflow.approve', 'connection.manage', 'role.manage', 'audit.view']),
  viewer:   new Set(['audit.view']),
};

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[role].has(capability);
}

export const ROLE_LABELS: Record<Role, string> = {
  analyst: 'Analyst',
  reviewer: 'Reviewer',
  approver: 'Approver',
  admin: 'Admin',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  analyst: 'Edits drafts and submits working data for review. Cannot approve.',
  reviewer: 'Reviews submitted data and can request changes. Cannot approve.',
  approver: 'Approves submitted data. Cannot approve own submission (Segregation of Duty).',
  admin: 'All permissions including connection, role, and audit management.',
  viewer: 'Read-only access to all planning data and audit trail.',
};
