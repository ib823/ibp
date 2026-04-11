import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CURRENCY_SYMBOLS,
  convertSafe,
  getConversionFactor,
  normalizeZero,
  __resetWarnCacheForTests,
} from '@/lib/display-units';
import { DEFAULT_CONVERSIONS } from '@/engine/utils/unit-conversion';
import type { UnitConversion } from '@/engine/types';

describe('CURRENCY_SYMBOLS', () => {
  it('maps known ISO codes to symbols', () => {
    expect(CURRENCY_SYMBOLS.USD).toBe('$');
    expect(CURRENCY_SYMBOLS.MYR).toBe('RM');
  });
});

describe('convertSafe', () => {
  beforeEach(() => {
    __resetWarnCacheForTests();
  });

  it('returns value unchanged when from === to', () => {
    expect(convertSafe(42, 'USD', 'USD', DEFAULT_CONVERSIONS)).toBe(42);
  });

  it('applies a direct conversion', () => {
    const result = convertSafe(1, 'USD', 'MYR', DEFAULT_CONVERSIONS);
    expect(result).toBeCloseTo(4.5, 10);
  });

  it('applies a reverse conversion', () => {
    const result = convertSafe(4.5, 'MYR', 'USD', DEFAULT_CONVERSIONS);
    expect(result).toBeCloseTo(1, 10);
  });

  it('round-trips USD → MYR → USD within FP tolerance', () => {
    const x = 701_000_000;
    const there = convertSafe(x, 'USD', 'MYR', DEFAULT_CONVERSIONS);
    const back = convertSafe(there, 'MYR', 'USD', DEFAULT_CONVERSIONS);
    expect(back).toBeCloseTo(x, 3);
  });

  it('returns original value on missing path and warns once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = convertSafe(100, 'unobtanium', 'ether', DEFAULT_CONVERSIONS);
    expect(result).toBe(100);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    convertSafe(200, 'unobtanium', 'ether', DEFAULT_CONVERSIONS);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('returns original value when factor is zero (engine throws, caught)', () => {
    const badConversions: UnitConversion[] = [
      { id: 'bad', fromUnit: 'A', toUnit: 'B', factor: 0, category: 'currency', isDefault: false, description: '' },
    ];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(convertSafe(10, 'A', 'B', badConversions)).toBe(10);
    warnSpy.mockRestore();
  });

  it('returns original value when factor is negative', () => {
    const badConversions: UnitConversion[] = [
      { id: 'bad', fromUnit: 'A', toUnit: 'B', factor: -2, category: 'currency', isDefault: false, description: '' },
    ];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(convertSafe(10, 'A', 'B', badConversions)).toBe(10);
    warnSpy.mockRestore();
  });

  it('returns original value when factor is NaN', () => {
    const badConversions: UnitConversion[] = [
      { id: 'bad', fromUnit: 'A', toUnit: 'B', factor: NaN, category: 'currency', isDefault: false, description: '' },
    ];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(convertSafe(10, 'A', 'B', badConversions)).toBe(10);
    warnSpy.mockRestore();
  });

  it('applies a 1-hop chained conversion (MMscf → MMBtu → GJ)', () => {
    const result = convertSafe(1, 'MMscf', 'GJ', DEFAULT_CONVERSIONS);
    // 1 MMscf × 1.055 (→MMBtu) × 1.05506 (→GJ) ≈ 1.11308
    expect(result).toBeCloseTo(1.055 * 1.05506, 6);
  });
});

describe('getConversionFactor', () => {
  it('returns 1 for identity', () => {
    expect(getConversionFactor('USD', 'USD', DEFAULT_CONVERSIONS)).toBe(1);
  });

  it('returns the direct factor for USD → MYR', () => {
    expect(getConversionFactor('USD', 'MYR', DEFAULT_CONVERSIONS)).toBeCloseTo(4.5, 10);
  });

  it('returns 1 (fallback) for an unknown path', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    __resetWarnCacheForTests();
    expect(getConversionFactor('unobtanium', 'ether', DEFAULT_CONVERSIONS)).toBe(1);
    warnSpy.mockRestore();
  });
});

describe('normalizeZero', () => {
  it('maps -0 to 0', () => {
    expect(Object.is(normalizeZero(-0), 0)).toBe(true);
    expect(Object.is(normalizeZero(-0), -0)).toBe(false);
  });

  it('passes 0 through', () => {
    expect(Object.is(normalizeZero(0), 0)).toBe(true);
  });

  it('passes non-zero values through unchanged', () => {
    expect(normalizeZero(42)).toBe(42);
    expect(normalizeZero(-42)).toBe(-42);
  });
});
