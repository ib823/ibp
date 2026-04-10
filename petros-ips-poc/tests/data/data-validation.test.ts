import { describe, it, expect } from 'vitest';
import { ALL_PROJECTS } from '@/data/projects';
import { PRICE_DECKS } from '@/data/price-decks';
import { FISCAL_REGIMES } from '@/data/fiscal-regimes';
import type { FiscalRegime, USD, TimeSeriesData } from '@/engine/types';

// ── Helpers ───────────────────────────────────────────────────────────

function years(series: TimeSeriesData<number> | TimeSeriesData<USD>): number[] {
  return Object.keys(series).map(Number).sort((a, b) => a - b);
}

function values(series: TimeSeriesData<number> | TimeSeriesData<USD>): number[] {
  return Object.values(series).map(Number);
}

// ── Production profile coverage ───────────────────────────────────────

describe('Production profiles match project year ranges', () => {
  for (const inputs of ALL_PROJECTS) {
    const { project, productionProfile } = inputs;

    it(`${project.name}: oil profile covers startYear to endYear`, () => {
      const yrs = years(productionProfile.oil);
      expect(yrs[0]).toBeLessThanOrEqual(project.startYear);
      expect(yrs[yrs.length - 1]).toBeGreaterThanOrEqual(project.endYear);
    });

    it(`${project.name}: gas profile covers startYear to endYear`, () => {
      const yrs = years(productionProfile.gas);
      expect(yrs[0]).toBeLessThanOrEqual(project.startYear);
      expect(yrs[yrs.length - 1]).toBeGreaterThanOrEqual(project.endYear);
    });

    it(`${project.name}: condensate profile covers startYear to endYear`, () => {
      const yrs = years(productionProfile.condensate);
      expect(yrs[0]).toBeLessThanOrEqual(project.startYear);
      expect(yrs[yrs.length - 1]).toBeGreaterThanOrEqual(project.endYear);
    });

    it(`${project.name}: water profile covers startYear to endYear`, () => {
      const yrs = years(productionProfile.water);
      expect(yrs[0]).toBeLessThanOrEqual(project.startYear);
      expect(yrs[yrs.length - 1]).toBeGreaterThanOrEqual(project.endYear);
    });
  }
});

// ── Non-negative production values ────────────────────────────────────

describe('All production values are non-negative', () => {
  for (const inputs of ALL_PROJECTS) {
    const { project, productionProfile } = inputs;

    it(`${project.name}: oil >= 0`, () => {
      expect(values(productionProfile.oil).every((v) => v >= 0)).toBe(true);
    });

    it(`${project.name}: gas >= 0`, () => {
      expect(values(productionProfile.gas).every((v) => v >= 0)).toBe(true);
    });

    it(`${project.name}: condensate >= 0`, () => {
      expect(values(productionProfile.condensate).every((v) => v >= 0)).toBe(true);
    });

    it(`${project.name}: water >= 0`, () => {
      expect(values(productionProfile.water).every((v) => v >= 0)).toBe(true);
    });
  }
});

// ── Non-negative CAPEX values ─────────────────────────────────────────

describe('All CAPEX values are non-negative', () => {
  for (const inputs of ALL_PROJECTS) {
    const { project, costProfile } = inputs;

    it(`${project.name}: capexDrilling >= 0`, () => {
      expect(values(costProfile.capexDrilling).every((v) => v >= 0)).toBe(true);
    });

    it(`${project.name}: capexFacilities >= 0`, () => {
      expect(values(costProfile.capexFacilities).every((v) => v >= 0)).toBe(true);
    });

    it(`${project.name}: capexSubsea >= 0`, () => {
      expect(values(costProfile.capexSubsea).every((v) => v >= 0)).toBe(true);
    });

    it(`${project.name}: capexOther >= 0`, () => {
      expect(values(costProfile.capexOther).every((v) => v >= 0)).toBe(true);
    });

    it(`${project.name}: abandonmentCost >= 0`, () => {
      expect(values(costProfile.abandonmentCost).every((v) => v >= 0)).toBe(true);
    });
  }
});

// ── Fiscal regime percentage ranges ───────────────────────────────────

describe('Fiscal regime configs have valid percentage ranges (0 to 1)', () => {
  function assertPctRange(val: number, label: string) {
    expect(val, `${label} = ${val}`).toBeGreaterThanOrEqual(0);
    expect(val, `${label} = ${val}`).toBeLessThanOrEqual(1);
  }

  for (const [key, regime] of Object.entries(FISCAL_REGIMES)) {
    const fr = regime as FiscalRegime;

    it(`${key}: common rates in [0, 1]`, () => {
      assertPctRange(fr.royaltyRate, 'royaltyRate');
      assertPctRange(fr.pitaRate, 'pitaRate');
      assertPctRange(fr.exportDutyRate, 'exportDutyRate');
      assertPctRange(fr.researchCessRate, 'researchCessRate');
    });

    if (fr.type === 'PSC_RC' || fr.type === 'PSC_DW' || fr.type === 'PSC_HPHT') {
      it(`${key}: tranche percentages in [0, 1]`, () => {
        for (const tranche of fr.tranches) {
          assertPctRange(tranche.costRecoveryCeilingPct, 'costRecoveryCeilingPct');
          assertPctRange(tranche.contractorProfitSharePct, 'contractorProfitSharePct');
          assertPctRange(tranche.petronasProfitSharePct, 'petronasProfitSharePct');
        }
      });
    }

    if (fr.type === 'PSC_EPT') {
      it(`${key}: EPT shares in [0, 1]`, () => {
        assertPctRange(fr.contractorShareAtLower, 'contractorShareAtLower');
        assertPctRange(fr.contractorShareAtUpper, 'contractorShareAtUpper');
        assertPctRange(fr.fixedCostRecoveryCeiling, 'fixedCostRecoveryCeiling');
      });
    }

    if (fr.type === 'PSC_SFA') {
      it(`${key}: SFA shares in [0, 1]`, () => {
        assertPctRange(fr.costRecoveryCeilingPct, 'costRecoveryCeilingPct');
        assertPctRange(fr.contractorProfitSharePct, 'contractorProfitSharePct');
        assertPctRange(fr.petronasProfitSharePct, 'petronasProfitSharePct');
      });
    }

    if (fr.type === 'DOWNSTREAM') {
      it(`${key}: tax rate in [0, 1]`, () => {
        assertPctRange(fr.taxRate, 'taxRate');
      });
    }
  }
});

// ── Price decks cover all project year ranges ─────────────────────────

describe('Price decks have values for all years in project ranges', () => {
  for (const [scenario, deck] of Object.entries(PRICE_DECKS)) {
    const oilYears = new Set(years(deck.oil));
    const gasYears = new Set(years(deck.gas));
    const condYears = new Set(years(deck.condensate));
    const fxYears = new Set(years(deck.exchangeRate));

    for (const inputs of ALL_PROJECTS) {
      const { project } = inputs;

      it(`${scenario}: covers ${project.name} (${project.startYear}-${project.endYear})`, () => {
        for (let y = project.startYear; y <= project.endYear; y++) {
          expect(oilYears.has(y), `oil price missing for ${y}`).toBe(true);
          expect(gasYears.has(y), `gas price missing for ${y}`).toBe(true);
          expect(condYears.has(y), `condensate price missing for ${y}`).toBe(true);
          expect(fxYears.has(y), `exchange rate missing for ${y}`).toBe(true);
        }
      });
    }
  }
});

// ── Price deck values are positive ────────────────────────────────────

describe('Price deck values are positive', () => {
  for (const [scenario, deck] of Object.entries(PRICE_DECKS)) {
    it(`${scenario}: oil prices > 0`, () => {
      expect(values(deck.oil).every((v) => v > 0)).toBe(true);
    });

    it(`${scenario}: gas prices > 0`, () => {
      expect(values(deck.gas).every((v) => v > 0)).toBe(true);
    });

    it(`${scenario}: condensate prices > 0`, () => {
      expect(values(deck.condensate).every((v) => v > 0)).toBe(true);
    });

    it(`${scenario}: exchange rates > 0`, () => {
      expect(values(deck.exchangeRate).every((v) => v > 0)).toBe(true);
    });
  }
});
