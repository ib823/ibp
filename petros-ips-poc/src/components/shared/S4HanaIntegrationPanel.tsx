// ════════════════════════════════════════════════════════════════════════
// S4HanaIntegrationPanel — RFP §8 evidence: "integration using standard
// and open APIs with existing applications and database (e.g., SAP S/4HANA)"
//
// Renders three CDS-view feed cards representing the actual SAP S/4HANA
// data sources that Phase 1a will integrate against:
//   • CSKS    — Cost Centre Master
//   • PRPS    — WBS Element / Project Hierarchy
//   • ACDOCA  — Universal Journal (GL Actuals)
//
// Sync is mocked client-side: clicking "Sync now" spins for 1.5s, sets
// the last-sync timestamp, emits a connection.synced audit entry, and
// toasts the result. In Phase 1a the same UI is wired through SAC's
// Data Integration agent against the live S/4HANA tenant.
// ════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useAuthStore, useCurrentUser } from '@/store/auth-store';
import { can } from '@/engine/auth/types';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Database, RefreshCcw, CheckCircle2, Loader2 } from 'lucide-react';

interface CdsFeed {
  id: 'csks' | 'prps' | 'acdoca';
  cdsView: string;
  description: string;
  sourceTable: string;
  sampleColumns: readonly string[];
  rowEstimate: string;
  scopeLabel: string;
}

const FEEDS: readonly CdsFeed[] = [
  {
    id: 'csks',
    cdsView: 'I_CostCenter',
    description: 'Cost Centre master data — used to align project OPEX postings to PETROS controlling structure.',
    sourceTable: 'CSKS',
    sampleColumns: ['CostCenter', 'ControllingArea', 'CompanyCode', 'CostCenterCategory', 'ResponsibleUser', 'ValidFrom', 'ValidTo'],
    rowEstimate: '~3,200 active centres',
    scopeLabel: 'Master · daily delta',
  },
  {
    id: 'prps',
    cdsView: 'I_WBSElement',
    description: 'WBS hierarchy — feeds the Project dimension and links upstream-asset codes to controlling.',
    sourceTable: 'PRPS',
    sampleColumns: ['WBSElement', 'ProjectDefinition', 'Description', 'CostCenter', 'ResponsibleCostCenter', 'ProjectStatus'],
    rowEstimate: '~12,800 elements',
    scopeLabel: 'Master · weekly delta',
  },
  {
    id: 'acdoca',
    cdsView: 'I_GLAccountLineItemRawData',
    description: 'Universal Journal — actuals fact source. Filtered by ledger / period and aggregated to monthly grain in SAC.',
    sourceTable: 'ACDOCA',
    sampleColumns: ['CompanyCode', 'FiscalYear', 'FiscalPeriod', 'GLAccount', 'CostCenter', 'WBSElement', 'AmountInCompanyCodeCurrency'],
    rowEstimate: '~450M lines / year (PETROS-wide)',
    scopeLabel: 'Fact · daily delta',
  },
];

export function S4HanaIntegrationPanel() {
  const recordAudit = useAuthStore((s) => s.recordAudit);
  const user = useCurrentUser();
  const canManage = can(user.role, 'connection.manage');

  const [lastSync, setLastSync] = useState<Record<string, string | undefined>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  const handleSync = (feed: CdsFeed) => {
    if (!canManage) {
      toast.error('Requires admin role to trigger an S/4HANA sync.');
      return;
    }
    setSyncing((s) => ({ ...s, [feed.id]: true }));
    window.setTimeout(() => {
      const ts = new Date().toISOString();
      setLastSync((s) => ({ ...s, [feed.id]: ts }));
      setSyncing((s) => ({ ...s, [feed.id]: false }));
      recordAudit({
        kind: 'connection.synced',
        targetId: `s4hana::${feed.id}`,
        targetLabel: `${feed.cdsView} (${feed.sourceTable})`,
        detail: `Manual sync of ${feed.cdsView} — ${feed.scopeLabel}`,
      });
      toast.success(`${feed.cdsView} sync complete (${feed.sourceTable}).`);
    }, 1500);
  };

  return (
    <section
      aria-labelledby="s4hana-heading"
      className="border border-petrol/30 bg-petrol/5 p-4"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-petrol shrink-0" aria-hidden="true" />
          <h3
            id="s4hana-heading"
            className="text-caption font-semibold uppercase tracking-wider text-petrol"
          >
            SAP S/4HANA Integration — Phase 1a feeds
          </h3>
        </div>
        <span className="text-caption text-text-muted">
          Live connection via SAC Data Integration agent against{' '}
          <span className="font-data text-text-secondary">s4hana-sandbox.petros.internal</span>
        </span>
      </header>
      <p className="text-xs text-text-secondary mb-3 max-w-3xl">
        Three SAP CDS views power the production system: Cost Centre master, WBS hierarchy, and
        the Universal Journal. The POC mocks each feed so the SAC import sequence and audit
        emission can be validated end-to-end before Phase 1a delivery.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {FEEDS.map((feed) => {
          const isSyncing = !!syncing[feed.id];
          const ts = lastSync[feed.id];
          return (
            <article
              key={feed.id}
              className="border border-petrol/20 bg-white p-3 flex flex-col gap-2 min-w-0"
              aria-label={`${feed.cdsView} feed`}
            >
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h4 className="text-xs font-semibold text-text-primary font-data truncate">
                      {feed.cdsView}
                    </h4>
                  </div>
                  <div className="text-caption text-text-muted">
                    Source table:{' '}
                    <span className="font-data text-text-secondary">{feed.sourceTable}</span>
                    <span className="mx-1.5">·</span>
                    {feed.scopeLabel}
                  </div>
                </div>
              </header>

              <p className="text-caption text-text-secondary leading-snug">
                {feed.description}
              </p>

              <dl className="grid grid-cols-1 gap-1 text-caption mt-1">
                <div>
                  <dt className="text-text-muted uppercase tracking-wider text-caption">Sample columns</dt>
                  <dd className="font-data text-text-primary leading-relaxed mt-0.5">
                    {feed.sampleColumns.join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted uppercase tracking-wider text-caption">Volume estimate</dt>
                  <dd className="text-text-primary">{feed.rowEstimate}</dd>
                </div>
                <div>
                  <dt className="text-text-muted uppercase tracking-wider text-caption">Last sync</dt>
                  <dd className="font-data text-text-secondary">
                    {ts
                      ? new Date(ts).toLocaleString('en-GB', {
                          year: 'numeric', month: 'short', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : 'Not synced (POC mock)'}
                  </dd>
                </div>
              </dl>

              <div className="mt-auto pt-2 border-t border-border flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleSync(feed)}
                  disabled={!canManage || isSyncing}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-7 px-3 text-caption font-semibold rounded',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol',
                    isSyncing
                      ? 'bg-petrol/60 text-white cursor-wait'
                      : !canManage
                        ? 'bg-content-alt text-text-muted border border-border cursor-not-allowed'
                        : 'bg-petrol hover:bg-petrol-light text-white border border-petrol',
                  )}
                  title={!canManage ? 'Requires admin role to sync.' : 'Trigger a manual sync of this CDS feed.'}
                >
                  {isSyncing ? (
                    <>
                      <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                      Syncing…
                    </>
                  ) : (
                    <>
                      <RefreshCcw size={12} aria-hidden="true" />
                      Sync now
                    </>
                  )}
                </button>
                {ts && !isSyncing && (
                  <span className="inline-flex items-center gap-1 text-caption text-success">
                    <CheckCircle2 size={11} aria-hidden="true" />
                    Healthy
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <footer className="mt-3 text-caption text-text-muted">
        SAC Data Integration agent → S/4HANA OData v4 service · CDS view authentication via service
        account in PETROS Entra ID · sync runs are appended to the Audit Trail (
        <span className="font-data">connection.synced</span> event kind).
      </footer>
    </section>
  );
}
