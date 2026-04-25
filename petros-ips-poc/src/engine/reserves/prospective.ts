// ════════════════════════════════════════════════════════════════════════
// SPE PRMS Prospective Resources
//
// Prospective Resources are estimated quantities of petroleum that may
// be recoverable from undiscovered accumulations. Volumes are reported
// for an exploration prospect or play and are subject to two stacked
// risk multipliers:
//
//   • Pg (Probability of geological success): the chance that
//     hydrocarbons exist in the trap. Typical range 0.10–0.40.
//   • Pc (Probability of commercial development given discovery):
//     the chance that, if discovered, the accumulation can be
//     commercially developed. Typical range 0.40–0.85.
//
// "Risked" prospective volumes = Unrisked volume × Pg × Pc.
// "Unrisked" volumes are reported alongside (Low / Best / High) for
// regulators / partners that prefer to apply their own risk weighting.
//
// Reference: SPE-PRMS 2018, §2.1.4 (Prospective Resources Classification).
// ════════════════════════════════════════════════════════════════════════

export type ProspectiveCase = 'low' | 'best' | 'high';

export interface ProjectProspective {
  readonly projectId: string;
  readonly playName: string;
  /** MMstb — unrisked volumes per case */
  readonly unriskedOil: Record<ProspectiveCase, number>;
  /** Bcf — unrisked volumes per case */
  readonly unriskedGas: Record<ProspectiveCase, number>;
  /** 0..1 — probability of geological success (hydrocarbons present) */
  readonly pg: number;
  /** 0..1 — probability of commercial success given discovery */
  readonly pc: number;
}

export interface RiskedProspective {
  readonly oilMmstb: Record<ProspectiveCase, number>;
  readonly gasBcf: Record<ProspectiveCase, number>;
  readonly cosFactor: number; // = pg × pc
}

/** Apply Pg × Pc to convert unrisked to risked prospective volumes. */
export function riskWeightProspective(p: ProjectProspective): RiskedProspective {
  const cos = p.pg * p.pc;
  const risk = (n: number): number => Number((n * cos).toFixed(2));
  return {
    cosFactor: cos,
    oilMmstb: {
      low:  risk(p.unriskedOil.low),
      best: risk(p.unriskedOil.best),
      high: risk(p.unriskedOil.high),
    },
    gasBcf: {
      low:  risk(p.unriskedGas.low),
      best: risk(p.unriskedGas.best),
      high: risk(p.unriskedGas.high),
    },
  };
}

// ── Sample prospective resources for POC fixture ────────────────────
// Volumes inspired by publicly available SK Block exploration plays;
// numbers are illustrative.

export const PROJECT_PROSPECTIVE: readonly ProjectProspective[] = [
  {
    projectId: 'sk-410',
    playName: 'SK-410 Deep Carbonate Lead',
    unriskedOil: { low: 0,   best: 0,   high: 0   },
    unriskedGas: { low: 80,  best: 220, high: 480 },
    pg: 0.25,
    pc: 0.65,
  },
  {
    projectId: 'sk-612',
    playName: 'SK-612 South Lobe Prospect',
    unriskedOil: { low: 35,  best: 90,  high: 180 },
    unriskedGas: { low: 8,   best: 22,  high: 45  },
    pg: 0.20,
    pc: 0.55,
  },
  {
    projectId: 'balingian',
    playName: 'Balingian NE Lead',
    unriskedOil: { low: 12,  best: 28,  high: 55  },
    unriskedGas: { low: 0,   best: 0,   high: 0   },
    pg: 0.18,
    pc: 0.70,
  },
];
