// MFRS 137 / IFRIC 1 driver-based decommissioning provision tests (D32 / D58).
import { describe, it, expect } from 'vitest';
import { generateDecommissioningSchedule } from '@/engine/financial/decommissioning';
import type { CostProfile, USD } from '@/engine/types';

const usd = (n: number): USD => n as USD;

function makeCostProfile(startYear: number, endYear: number, abandonmentByYear: Record<number, number>): CostProfile {
  const zeros: Record<number, USD> = {};
  for (let y = startYear; y <= endYear; y++) zeros[y] = usd(0);
  const abex: Record<number, USD> = {};
  for (let y = startYear; y <= endYear; y++) abex[y] = usd(abandonmentByYear[y] ?? 0);
  // Place a small first-year capex so initial recognition triggers in startYear
  const drilling: Record<number, USD> = { ...zeros };
  drilling[startYear] = usd(1_000_000);
  return {
    capexDrilling: drilling,
    capexFacilities: zeros,
    capexSubsea: zeros,
    capexOther: zeros,
    opexFixed: zeros,
    opexVariable: zeros,
    abandonmentCost: abex,
  };
}

describe('Decommissioning — MFRS 137 / IFRIC 1', () => {
  it('initial recognition lands in the first capex year as PV of future ABEX', () => {
    const startYear = 2030;
    const endYear = 2034;
    const profile = makeCostProfile(startYear, endYear, { 2034: 100_000_000 });
    const schedule = generateDecommissioningSchedule(profile, startYear, endYear, 0.08);

    // Year 0: opening 0, additions = PV of $100M four years out at 8%
    const expectedPV = 100_000_000 / Math.pow(1.08, 4);
    expect(schedule[0]!.additions).toBeCloseTo(expectedPV, 0);
    expect(schedule[0]!.opening).toBe(0);
  });

  it('annual unwinding equals opening × discount rate', () => {
    const startYear = 2030;
    const endYear = 2034;
    const profile = makeCostProfile(startYear, endYear, { 2034: 100_000_000 });
    const schedule = generateDecommissioningSchedule(profile, startYear, endYear, 0.08);

    // After year 0 (initial recognition), year 1 unwinding = opening × 8%
    const yr1Opening = schedule[1]!.opening as number;
    const yr1Unwind = schedule[1]!.unwinding as number;
    expect(yr1Unwind).toBeCloseTo(yr1Opening * 0.08, 1);
  });

  it('utilisation reduces closing balance in the abandonment year', () => {
    const startYear = 2030;
    const endYear = 2034;
    const profile = makeCostProfile(startYear, endYear, { 2034: 100_000_000 });
    const schedule = generateDecommissioningSchedule(profile, startYear, endYear, 0.08);

    const lastYear = schedule[4]!;
    expect(lastYear.utilisations).toBe(100_000_000);
    // Closing should be ≈ 0 since the entire obligation has been settled
    expect(lastYear.closing as number).toBeLessThan(1);
  });
});
