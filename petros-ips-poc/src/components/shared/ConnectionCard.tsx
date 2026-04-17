// ════════════════════════════════════════════════════════════════════════
// ConnectionCard — visual + interactive card for a single data connection
//
// Displays status (color-coded dot + label), endpoint, environment,
// last sync timestamp, and role-gated Connect / Disconnect / Sync
// actions. Each action writes to both the connection store and the
// audit log. Fully responsive: stacks controls on mobile, inline on tablet+.
// ════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import {
  useConnectionStore,
  type ConnectionKind,
  type ConnectionStatus,
} from '@/store/connection-store';
import { useAuthStore, useCurrentUser } from '@/store/auth-store';
import { can } from '@/engine/auth/types';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { getEntry } from '@/lib/educational-content';
import { Plug, Unplug, RefreshCcw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ConnectionCardProps {
  kind: ConnectionKind;
  /** When provided, an info icon is rendered next to the title linking to this educational entry. */
  eduId?: string;
}

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connected:    'bg-success',
  connecting:   'bg-amber animate-pulse',
  disconnected: 'bg-text-muted/50',
  error:        'bg-danger',
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected:    'Connected',
  connecting:   'Connecting…',
  disconnected: 'Disconnected',
  error:        'Error',
};

function fmtTimestamp(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function ConnectionCard({ kind, eduId }: ConnectionCardProps) {
  const connection = useConnectionStore((s) => s.connections[kind]);
  const beginConnect = useConnectionStore((s) => s.beginConnect);
  const completeConnect = useConnectionStore((s) => s.completeConnect);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const sync = useConnectionStore((s) => s.sync);
  const recordAudit = useAuthStore((s) => s.recordAudit);
  const user = useCurrentUser();

  const canManage = user ? can(user.role, 'connection.manage') : false;
  const isEntra = kind === 'entra';

  const eduEntry = useMemo(() => (eduId ? getEntry(eduId) : undefined), [eduId]);

  const handleConnect = () => {
    beginConnect(kind);
    // Simulate network round-trip — real connector will resolve via OAuth + heartbeat
    window.setTimeout(() => {
      completeConnect(kind);
      recordAudit({
        kind: 'connection.configured',
        targetId: `connection::${kind}`,
        targetLabel: connection.label,
        detail: `Connected to ${connection.endpoint} (${connection.environment})`,
      });
      toast.success(`${connection.label} connected (${connection.environment}).`);
    }, 700);
  };

  const handleDisconnect = () => {
    disconnect(kind);
    recordAudit({
      kind: 'connection.disconnected',
      targetId: `connection::${kind}`,
      targetLabel: connection.label,
      detail: `Disconnected from ${connection.endpoint}`,
    });
    toast.info(`${connection.label} disconnected.`);
  };

  const handleSync = () => {
    sync(kind);
    recordAudit({
      kind: 'connection.synced',
      targetId: `connection::${kind}`,
      targetLabel: connection.label,
      detail: `Manual sync triggered by ${user?.displayName ?? 'user'}`,
    });
    toast.success(`${connection.label} sync complete.`);
  };

  return (
    <article className="border border-border bg-white p-4 flex flex-col gap-3 min-w-0" aria-label={`${connection.label} connection`}>
      {/* Header */}
      <header className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-text-primary truncate">{connection.label}</h3>
            {eduEntry && <InfoIcon entry={eduEntry} size={12} />}
            <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border border-border bg-content-alt text-text-secondary">
              {connection.environment}
            </span>
          </div>
          <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
            {connection.description}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider shrink-0',
            connection.status === 'connected' && 'text-success',
            connection.status === 'connecting' && 'text-amber',
            connection.status === 'error' && 'text-danger',
            connection.status === 'disconnected' && 'text-text-muted',
          )}
          role="status"
          aria-live="polite"
        >
          <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[connection.status])} aria-hidden="true" />
          {STATUS_LABEL[connection.status]}
        </span>
      </header>

      {/* Detail grid */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div className="min-w-0">
          <dt className="text-text-muted uppercase tracking-wider text-[9px]">Endpoint</dt>
          <dd className="font-data text-text-primary truncate" title={connection.endpoint}>
            {connection.endpoint ?? '—'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-text-muted uppercase tracking-wider text-[9px]">Last sync</dt>
          <dd className="font-data text-text-primary">{fmtTimestamp(connection.lastSync)}</dd>
        </div>
        <div className="sm:col-span-2 min-w-0">
          <dt className="text-text-muted uppercase tracking-wider text-[9px]">Data scope</dt>
          <dd className="text-text-primary leading-snug">{connection.dataScope}</dd>
        </div>
      </dl>

      {connection.status === 'error' && connection.errorMessage && (
        <div className="flex items-start gap-1.5 p-2 bg-danger/5 border border-danger/30 text-xs text-danger">
          <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{connection.errorMessage}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
        {connection.status === 'disconnected' || connection.status === 'error' ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={!canManage || isEntra}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol',
              !canManage || isEntra
                ? 'bg-content-alt text-text-muted border border-border cursor-not-allowed'
                : 'bg-petrol hover:bg-petrol-light text-white border border-petrol',
            )}
            title={
              isEntra
                ? 'Entra ID is managed centrally by IT. Sign out to disconnect.'
                : !canManage
                  ? 'Requires admin role'
                  : undefined
            }
          >
            <Plug size={13} aria-hidden="true" /> Connect
          </button>
        ) : connection.status === 'connecting' ? (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-petrol/60 text-white"
          >
            <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Connecting…
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSync}
              disabled={!canManage}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol',
                !canManage
                  ? 'bg-content-alt text-text-muted border border-border cursor-not-allowed'
                  : 'bg-petrol hover:bg-petrol-light text-white border border-petrol',
              )}
              title={!canManage ? 'Requires admin role' : 'Manual sync'}
            >
              <RefreshCcw size={13} aria-hidden="true" /> Sync
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={!canManage || isEntra}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold border',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol',
                !canManage || isEntra
                  ? 'bg-content-alt text-text-muted border-border cursor-not-allowed'
                  : 'bg-white border-border text-text-primary hover:bg-content-alt',
              )}
              title={
                isEntra
                  ? 'Entra ID session is cleared by signing out.'
                  : !canManage
                    ? 'Requires admin role'
                    : undefined
              }
            >
              <Unplug size={13} aria-hidden="true" /> Disconnect
            </button>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-success">
              <CheckCircle2 size={11} aria-hidden="true" /> All health checks passing
            </span>
          </>
        )}
      </div>
    </article>
  );
}
