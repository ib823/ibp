// ════════════════════════════════════════════════════════════════════════
// Auth + Audit Store
//
// In-memory Zustand store for the POC auth flow. Session is persisted
// to sessionStorage so the app survives a page reload inside a demo
// without losing context, but clears on tab close — appropriate for a
// demo tenant. Production SAC will replace this with a real MSAL
// integration federated to the PETROS Entra ID tenant.
// ════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type {
  User,
  Session,
  AuditEntry,
  AuditEventKind,
} from '@/engine/auth/types';

const SESSION_KEY = 'petros-ips-session';
const AUDIT_KEY = 'petros-ips-audit';
const AUDIT_MAX = 500;

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

function safeClear(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}

interface AuthStoreState {
  session: Session | null;
  auditLog: AuditEntry[];
}

interface AuthStoreActions {
  signIn: (user: User, mfaVerifiedAt: string, tenant: string) => void;
  signOut: () => void;
  recordAudit: (input: Omit<AuditEntry, 'id' | 'timestamp' | 'actorId' | 'actorName' | 'actorRole'> & {
    actor?: User; // optional override; defaults to current session user
  }) => void;
  clearAudit: () => void; // admin only
}

export type AuthStore = AuthStoreState & AuthStoreActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: safeRead<Session>(SESSION_KEY),
  auditLog: safeRead<AuditEntry[]>(AUDIT_KEY) ?? [],

  signIn: (user, mfaVerifiedAt, tenant) => {
    const session: Session = {
      user,
      tenant,
      signedInAt: new Date().toISOString(),
      mfaVerifiedAt,
    };
    safeWrite(SESSION_KEY, session);
    set({ session });

    const mfaEntry: AuditEntry = {
      id: cryptoId(),
      timestamp: mfaVerifiedAt,
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      kind: 'auth.mfa_verified',
      targetId: user.id,
      targetLabel: user.email,
      detail: `MFA verified via Microsoft Authenticator (mock)`,
    };
    const signInEntry: AuditEntry = {
      id: cryptoId(),
      timestamp: session.signedInAt,
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      kind: 'auth.signed_in',
      targetId: user.id,
      targetLabel: user.email,
      detail: `Tenant: ${tenant}`,
    };
    const nextLog = trim([mfaEntry, signInEntry, ...get().auditLog]);
    safeWrite(AUDIT_KEY, nextLog);
    set({ auditLog: nextLog });
  },

  signOut: () => {
    const cur = get().session;
    if (cur) {
      const entry: AuditEntry = {
        id: cryptoId(),
        timestamp: new Date().toISOString(),
        actorId: cur.user.id,
        actorName: cur.user.displayName,
        actorRole: cur.user.role,
        kind: 'auth.signed_out',
        targetId: cur.user.id,
        targetLabel: cur.user.email,
      };
      const nextLog = trim([entry, ...get().auditLog]);
      safeWrite(AUDIT_KEY, nextLog);
      set({ auditLog: nextLog });
    }
    safeClear(SESSION_KEY);
    set({ session: null });
  },

  recordAudit: (input) => {
    const cur = get().session;
    const actor = input.actor ?? cur?.user;
    if (!actor) return;
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
    safeClear(AUDIT_KEY);
    set({ auditLog: [] });
  },
}));

// ── Selectors ───────────────────────────────────────────────────────

export function useCurrentUser(): User | null {
  return useAuthStore((s) => s.session?.user ?? null);
}

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.session !== null);
}

// ── Helpers ─────────────────────────────────────────────────────────

function cryptoId(): string {
  // Use Web Crypto when available, fall back to time + random
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
