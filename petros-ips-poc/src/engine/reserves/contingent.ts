// ════════════════════════════════════════════════════════════════════════
// SPE PRMS Contingent Resources
//
// Contingent Resources are discovered (i.e. an actual accumulation has
// been confirmed by drilling/well-test data) but not yet classified as
// reserves because their production is contingent on one or more
// commercial, technical, or regulatory uncertainties — typically: cost
// economics under prevailing prices, an outstanding development
// approval, or unresolved technology selection.
//
// Volumetric estimates use the same low/best/high probability bands
// as reserves (P90/P50/P10 cumulative-probability-of-exceedance) but
// are written 1C/2C/3C to keep the classification distinct.
//
// PRMS subclasses (PRMS 2018 §2.1.3.2):
//   • Development Pending     — awaiting commercial/regulatory go
//   • Development Unclarified — uncertain forward path
//   • Development Not Viable  — not currently economic but discovered
//
// Reference: SPE-PRMS 2018, §2.1.3 (Contingent Resources Classification).
// ════════════════════════════════════════════════════════════════════════

export type ContingentCategory = '1C' | '2C' | '3C';

export type ContingentSubclass =
  | 'development_pending'
  | 'development_unclarified'
  | 'development_not_viable';

export interface ProjectContingent {
  readonly projectId: string;
  /** MMstb (oil-equivalent for the contingent estimate) */
  readonly oil: Record<ContingentCategory, number>;
  /** Bcf */
  readonly gas: Record<ContingentCategory, number>;
  readonly subclass: ContingentSubclass;
  readonly contingencyNote: string;
}

const SUBCLASS_LABEL: Record<ContingentSubclass, string> = {
  development_pending:     'Development Pending',
  development_unclarified: 'Development Unclarified',
  development_not_viable:  'Development Not Viable',
};

export function contingentSubclassLabel(s: ContingentSubclass): string {
  return SUBCLASS_LABEL[s];
}

// ── Sample contingent resources for POC fixture ─────────────────────

export const PROJECT_CONTINGENT: readonly ProjectContingent[] = [
  {
    projectId: 'sk-410',
    oil: { '1C': 0, '2C': 0, '3C': 0 },
    gas: { '1C': 60, '2C': 95, '3C': 140 }, // Bcf — undeveloped accumulation pending FID
    subclass: 'development_pending',
    contingencyNote: 'Awaiting Final Investment Decision; gas-export capacity TBD.',
  },
  {
    projectId: 'sk-612',
    oil: { '1C': 18, '2C': 30, '3C': 48 },  // MMstb deeper sands, drilled but not commercial @ current oil price
    gas: { '1C': 4, '2C': 7, '3C': 11 },
    subclass: 'development_not_viable',
    contingencyNote: 'Below break-even at $55/bbl floor; reclassifies to reserves at $70/bbl long-term.',
  },
  {
    projectId: 'balingian',
    oil: { '1C': 8, '2C': 14, '3C': 22 },
    gas: { '1C': 0, '2C': 0, '3C': 0 },
    subclass: 'development_pending',
    contingencyNote: 'Waterflood expansion pending technical FEED.',
  },
  {
    projectId: 'tukau',
    oil: { '1C': 0, '2C': 0, '3C': 0 },
    gas: { '1C': 0, '2C': 0, '3C': 0 },
    subclass: 'development_pending',
    contingencyNote: 'Single-pool field; no contingent volumes identified.',
  },
  {
    projectId: 'm3-ccs',
    oil: { '1C': 0, '2C': 0, '3C': 0 },
    gas: { '1C': 0, '2C': 0, '3C': 0 },
    subclass: 'development_pending',
    contingencyNote: 'CCS storage; no hydrocarbon contingent volumes.',
  },
];
