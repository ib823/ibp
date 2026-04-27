// MFRS 16 right-of-use lease tests (D34 / D58).
import { describe, it, expect } from 'vitest';
import { buildLeaseSchedule } from '@/engine/financial/lease';

describe('Lease — MFRS 16 right-of-use', () => {
  it('initial RoU equals PV of lease payments', () => {
    // 5-year FPSO charter, $100M/yr at 7% IBR
    const result = buildLeaseSchedule({
      annualPayment: 100_000_000,
      termYears: 5,
      ibr: 0.07,
      startYear: 2030,
    });

    const expectedPV = 100_000_000 * (1 - Math.pow(1.07, -5)) / 0.07;
    expect(result.totalPV).toBeCloseTo(expectedPV, 0);
  });

  it('liability amortises to zero at end of term', () => {
    const result = buildLeaseSchedule({
      annualPayment: 100_000_000,
      termYears: 5,
      ibr: 0.07,
      startYear: 2030,
    });
    const last = result.schedule[4]!;
    expect(last.liabilityClosing as number).toBeLessThan(1);
  });

  it('depreciation is straight-line over term', () => {
    const result = buildLeaseSchedule({
      annualPayment: 100_000_000,
      termYears: 5,
      ibr: 0.07,
      startYear: 2030,
    });
    const dep0 = result.schedule[0]!.depreciation as number;
    const dep4 = result.schedule[4]!.depreciation as number;
    expect(dep0).toBeCloseTo(dep4, 1);
  });
});
