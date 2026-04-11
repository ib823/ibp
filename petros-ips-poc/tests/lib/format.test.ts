import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatMoney,
  formatOilVolume,
  formatOilRate,
  formatGasVolume,
  formatGasRate,
  formatEnergy,
  formatMass,
  formatPricePerUnit,
  formatOilPricePerUnit,
} from '@/lib/format';
import { DEFAULT_CONVERSIONS } from '@/engine/utils/unit-conversion';
import { __resetWarnCacheForTests } from '@/lib/display-units';

const conv = DEFAULT_CONVERSIONS;

beforeEach(() => {
  __resetWarnCacheForTests();
});

describe('formatMoney — currency selection', () => {
  it('USD with default M suffix', () => {
    expect(formatMoney(701_000_000, { currency: 'USD', conversions: conv })).toBe('$701.0M');
  });

  it('MYR applies 4.5 factor before scaling', () => {
    // 701e6 USD × 4.5 = 3.1545e9 MYR, ÷ 1e6 = 3154.5
    expect(formatMoney(701_000_000, { currency: 'MYR', conversions: conv })).toBe('RM 3,154.5M');
  });

  it('B suffix divides by 1e9', () => {
    expect(formatMoney(2_000_000_000, { currency: 'USD', conversions: conv, suffix: 'B' })).toBe('$2.0B');
  });

  it('empty suffix leaves value unscaled', () => {
    expect(formatMoney(42, { currency: 'USD', conversions: conv, suffix: '' })).toBe('$42.0');
  });
});

describe('formatMoney — accounting negatives', () => {
  it('USD negative with accounting=true uses parens', () => {
    expect(formatMoney(-701_000_000, { currency: 'USD', conversions: conv, accounting: true })).toBe('($701.0M)');
  });

  it('MYR negative with accounting=true uses parens', () => {
    const result = formatMoney(-1_000_000_000, { currency: 'MYR', conversions: conv, accounting: true });
    expect(result.trim().startsWith('(')).toBe(true);
    expect(result.trim().endsWith(')')).toBe(true);
  });

  it('negative without accounting prefixes with -', () => {
    expect(formatMoney(-701_000_000, { currency: 'USD', conversions: conv })).toBe('-$701.0M');
  });

  it('-0 does not trigger accounting parens', () => {
    expect(formatMoney(-0, { currency: 'USD', conversions: conv, accounting: true })).toBe('$0.0M');
  });
});

describe('formatMoney — fallback cases', () => {
  it('null → em-dash', () => {
    expect(formatMoney(null, { currency: 'USD', conversions: conv })).toBe('—');
  });

  it('undefined → em-dash', () => {
    expect(formatMoney(undefined, { currency: 'USD', conversions: conv })).toBe('—');
  });

  it('NaN → em-dash', () => {
    expect(formatMoney(NaN, { currency: 'USD', conversions: conv })).toBe('—');
  });

  it('Infinity → em-dash', () => {
    expect(formatMoney(Infinity, { currency: 'USD', conversions: conv })).toBe('—');
    expect(formatMoney(-Infinity, { currency: 'USD', conversions: conv })).toBe('—');
  });

  it('custom fallback respected', () => {
    expect(formatMoney(null, { currency: 'USD', conversions: conv, fallback: 'n/a' })).toBe('n/a');
  });
});

describe('formatOilVolume', () => {
  it('bbl scale=MM', () => {
    // 180 MMbbl value in base bbl: 180e6. Convert bbl→bbl = identity. /1e6 = 180.
    expect(formatOilVolume(180_000_000, { unit: 'bbl', conversions: conv, scale: 'MM' })).toBe('180.0 MMbbl');
  });

  it('m³ scale=MM converts through factor 0.158987', () => {
    // 180e6 bbl × 0.158987 = 2.861766e7 m³, /1e6 = 28.61766 ≈ 28.6
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = formatOilVolume(180_000_000, { unit: 'm³', conversions: conv, scale: 'MM' });
    warnSpy.mockRestore();
    expect(result).toBe('28.6 MMm³');
  });

  it('null → em-dash', () => {
    expect(formatOilVolume(null, { unit: 'bbl', conversions: conv })).toBe('—');
  });
});

describe('formatOilRate', () => {
  it('bpd with no scale', () => {
    expect(formatOilRate(25_000, { unit: 'bbl', conversions: conv })).toBe('25,000 bbl/d');
  });
});

describe('formatGasVolume', () => {
  it('Bcf with scale=""', () => {
    // 320 MMscf × 0.001 = 0.32 Bcf
    expect(formatGasVolume(320, { unit: 'Bcf', conversions: conv })).toBe('0.3 Bcf');
  });
});

describe('formatGasRate', () => {
  it('MMscfd identity', () => {
    expect(formatGasRate(120, { unit: 'MMscf', conversions: conv })).toBe('120.0 MMscf/d');
  });
});

describe('formatEnergy', () => {
  it('GJ conversion (1055 MMBtu × 1.05506)', () => {
    const result = formatEnergy(1055, { unit: 'GJ', conversions: conv });
    // 1055 × 1.05506 = 1113.0883 → "1,113.1 GJ"
    expect(result).toBe('1,113.1 GJ');
  });

  it('MMBtu identity', () => {
    expect(formatEnergy(1000, { unit: 'MMBtu', conversions: conv })).toBe('1,000.0 MMBtu');
  });
});

describe('formatMass', () => {
  it('kg conversion (1 tonne × 1000)', () => {
    expect(formatMass(1, { unit: 'kg', conversions: conv })).toBe('1,000.0 kg');
  });
});

describe('formatPricePerUnit — gas price', () => {
  it('USD/MMBtu identity', () => {
    expect(formatPricePerUnit(8, { energy: 'MMBtu', conversions: conv, currency: 'USD' })).toBe('$8.00/MMBtu');
  });

  it('USD/GJ inverted conversion', () => {
    // 1 MMBtu = 1.05506 GJ → $8/MMBtu = $8/1.05506/GJ ≈ $7.58/GJ
    expect(formatPricePerUnit(8, { energy: 'GJ', conversions: conv, currency: 'USD' })).toBe('$7.58/GJ');
  });
});

describe('formatOilPricePerUnit — oil price', () => {
  it('USD/bbl identity', () => {
    expect(formatOilPricePerUnit(80, { oilVolume: 'bbl', conversions: conv, currency: 'USD' })).toBe('$80.00/bbl');
  });

  it('USD/m³ inverted conversion', () => {
    // 1 bbl = 0.158987 m³ → $80/bbl = $80/0.158987/m³ ≈ $503.19/m³
    expect(formatOilPricePerUnit(80, { oilVolume: 'm³', conversions: conv, currency: 'USD' })).toBe('$503.19/m³');
  });
});

describe('KpiCard red-negative invariant', () => {
  it('formatMoney with accounting=true produces a string KpiCard will flag as negative', () => {
    const result = formatMoney(-1_000_000_000, { currency: 'MYR', conversions: conv, accounting: true });
    // KpiCard.tsx:32 checks value.trim().startsWith('(') && endsWith(')')
    expect(result.trim().startsWith('(')).toBe(true);
    expect(result.trim().endsWith(')')).toBe(true);
  });
});
