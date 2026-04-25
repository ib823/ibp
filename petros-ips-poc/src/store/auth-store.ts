// ════════════════════════════════════════════════════════════════════════
// Auth + Audit Store
//
// The POC boots already signed in as a default persona — there is no
// login or MFA screen. The header "Switch persona" menu lets a demo
// reviewer feel the workflow from each role's perspective. Session is
// persisted to sessionStorage so a page reload preserves the chosen
// persona within a tab. Production SAC will replace this with a real
// MSAL integration federated to the PETROS Entra ID tenant; roles will
// then come from Entra group membership rather than this picker.
// ════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type {
  User,
  Session,
  AuditEntry,
  AuditEventKind,
} from '@/engine/auth/types';
import { PERSONAS, DEFAULT_TENANT } from '@/data/personas';

const SESSION_KEY = 'petros-ips-session';
const AUDIT_KEY = 'petros-ips-audit';
const AUDIT_MAX = 500;
const DEFAULT_PERSONA: User = PERSONAS[0]!; // Analyst — Aisha Rahman

function safeRead<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or denied — non-fatal */
  }
}

function createSession(user: User): Session {
  return {
    user,
    tenant: DEFAULT_TENANT,
    signedInAt: new Date().toISOString(),
  };
}

interface AuthStoreState {
  session: Session;
  auditLog: AuditEntry[];
}

interface AuthStoreActions {
  switchPersona: (user: User) => void;
  recordAudit: (input: Omit<AuditEntry, 'id' | 'timestamp' | 'actorId' | 'actorName' | 'actorRole'> & {
    actor?: User; // optional override; defaults to current session user
  }) => void;
  clearAudit: () => void; // admin only
}

export type AuthStore = AuthStoreState & AuthStoreActions;

const initialSession = safeRead<Session>(SESSION_KEY) ?? createSession(DEFAULT_PERSONA);
safeWrite(SESSION_KEY, initialSession);

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: initialSession,
  auditLog: safeRead<AuditEntry[]>(AUDIT_KEY) ?? [],

  switchPersona: (user) => {
    if (user.id === get().session.user.id) return;
    const session = createSession(user);
    safeWrite(SESSION_KEY, session);
    set({ session });

    const entry: AuditEntry = {
      id: cryptoId(),
      timestamp: session.signedInAt,
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      kind: 'auth.signed_in',
      targetId: user.id,
      targetLabel: user.email,
      detail: `Switched persona to ${user.displayName} (${user.role})`,
    };
    const nextLog = trim([entry, ...get().auditLog]);
    safeWrite(AUDIT_KEY, nextLog);
    set({ auditLog: nextLog });
  },

  recordAudit: (input) => {
    const actor = input.actor ?? get().session.user;
    const entry: AuditEntry = {
      id: cryptoId(),
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      kind: input.kind,
      targetId: input.targetId,
      targetLabel: input.targetLabel,
      detail: input.detail,
    };
    const nextLog = trim([entry, ...get().auditLog]);
    safeWrite(AUDIT_KEY, nextLog);
    set({ auditLog: nextLog });
  },

  clearAudit: () => {
    try { sessionStorage.removeItem(AUDIT_KEY); } catch { /* ignore */ }
    set({ auditLog: [] });
  },
}));

// ── Selectors ───────────────────────────────────────────────────────

export function useCurrentUser(): User {
  return useAuthStore((s) => s.session.user);
}

// ── Helpers ─────────────────────────────────────────────────────────

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function trim(log: AuditEntry[]): AuditEntry[] {
  return log.slice(0, AUDIT_MAX);
}

// Convenience for filtering audit by kind
export function filterAudit(
  log: readonly AuditEntry[],
  kinds: readonly AuditEventKind[] | 'all',
): AuditEntry[] {
  if (kinds === 'all') return [...log];
  const set = new Set(kinds);
  return log.filter((e) => set.has(e.kind));
}
