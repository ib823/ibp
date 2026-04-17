// ════════════════════════════════════════════════════════════════════════
// Connection Store — SAP S/4HANA, SAP Analytics Cloud, Entra ID
//
// Simulates the lifecycle of live data-system connections for the POC.
// In production, this layer will be owned by the SAC integration service
// and the browser will only see read-only connection status derived from
// server-emitted heartbeats.
// ════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';

export type ConnectionKind = 's4hana' | 'sac' | 'entra';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface Connection {
  readonly kind: ConnectionKind;
  readonly label: string;
  readonly description: string;
  readonly status: ConnectionStatus;
  /** URL, tenant, or environment identifier for the current connection */
  readonly endpoint?: string;
  /** ISO date of last successful sync */
  readonly lastSync?: string;
  /** ISO date when the connection was established */
  readonly connectedAt?: string;
  /** Error message when status === 'error' */
  readonly errorMessage?: string;
  /** Which PETROS environment we're pointed at */
  readonly environment: 'sandbox' | 'uat' | 'production';
  /** Simulated scope of data visible on this connection */
  readonly dataScope: string;
}

interface ConnectionStoreState {
  connections: Record<ConnectionKind, Connection>;
}

interface ConnectionStoreActions {
  /** Begins the connect flow (sets status=connecting); completion handled by `completeConnect`. */
  beginConnect: (kind: ConnectionKind) => void;
  /** Finalises the connect flow (typically fired after a short simulated delay). */
  completeConnect: (kind: ConnectionKind) => void;
  disconnect: (kind: ConnectionKind) => void;
  sync: (kind: ConnectionKind) => void;
  fail: (kind: ConnectionKind, message: string) => void;
}

export type ConnectionStore = ConnectionStoreState & ConnectionStoreActions;

const INITIAL: Record<ConnectionKind, Connection> = {
  s4hana: {
    kind: 's4hana',
    label: 'SAP S/4HANA',
    description: 'Actuals, master data, chart of accounts',
    status: 'disconnected',
    environment: 'sandbox',
    endpoint: 's4hana-sandbox.petros.internal',
    dataScope: 'Upstream + Downstream actuals, CO finance postings, WBS hierarchy',
  },
  sac: {
    kind: 'sac',
    label: 'SAP Analytics Cloud',
    description: 'BI model, Power BI-equivalent live connection, scheduled import jobs',
    status: 'disconnected',
    environment: 'sandbox',
    endpoint: 'sac-sandbox.petros.ondemand.com',
    dataScope: 'Planning stories, scheduled data imports, predictive models',
  },
  entra: {
    kind: 'entra',
    label: 'Microsoft Entra ID',
    description: 'Identity provider, SSO, MFA, role assignment via group membership',
    status: 'connected',
    connectedAt: new Date().toISOString(),
    environment: 'sandbox',
    endpoint: 'petros.onmicrosoft.com',
    dataScope: 'User identity, tenant groups, MFA policy',
  },
};

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connections: INITIAL,

  beginConnect: (kind) => set((s) => ({
    connections: {
      ...s.connections,
      [kind]: { ...s.connections[kind], status: 'connecting', errorMessage: undefined },
    },
  })),

  completeConnect: (kind) => {
    const current = get().connections[kind];
    set((s) => ({
      connections: {
        ...s.connections,
        [kind]: {
          ...current,
          status: 'connected',
          connectedAt: new Date().toISOString(),
          lastSync: new Date().toISOString(),
          errorMessage: undefined,
        },
      },
    }));
  },

  disconnect: (kind) => set((s) => ({
    connections: {
      ...s.connections,
      [kind]: {
        ...s.connections[kind],
        status: 'disconnected',
        connectedAt: undefined,
        lastSync: undefined,
        errorMessage: undefined,
      },
    },
  })),

  sync: (kind) => set((s) => ({
    connections: {
      ...s.connections,
      [kind]: { ...s.connections[kind], lastSync: new Date().toISOString() },
    },
  })),

  fail: (kind, message) => set((s) => ({
    connections: {
      ...s.connections,
      [kind]: { ...s.connections[kind], status: 'error', errorMessage: message },
    },
  })),
}));
