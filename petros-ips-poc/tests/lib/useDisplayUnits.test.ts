import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { useProjectStore } from '@/store/project-store';

// Reset store to defaults between tests so we don't leak currency switches.
function resetPreferences() {
  useProjectStore.setState({
    unitPreferences: {
      oilVolume: 'bbl',
      gasVolume: 'MMscf',
      mass: 'tonne',
      currency: 'USD',
      energy: 'MMBtu',
    },
  });
}

describe('useDisplayUnits', () => {
  beforeEach(() => {
    resetPreferences();
  });

  it('returns the default USD configuration on first render', () => {
    const { result } = renderHook(() => useDisplayUnits());
    expect(result.current.currencyCode).toBe('USD');
    expect(result.current.currencySymbol).toBe('$');
    expect(result.current.currencyFactor).toBe(1);
    expect(result.current.oilUnit).toBe('bbl');
    expect(result.current.gasUnit).toBe('MMscf');
  });

  it('money() honors live currency selection (USD → MYR)', () => {
    const { result, rerender } = renderHook(() => useDisplayUnits());

    expect(result.current.money(701_000_000)).toBe('$701.0M');

    act(() => {
      useProjectStore.getState().setUnitPreference('currency', 'MYR');
    });
    rerender();

    expect(result.current.currencyCode).toBe('MYR');
    expect(result.current.currencySymbol).toBe('RM');
    expect(result.current.money(701_000_000)).toBe('RM 3,154.5M');
  });

  it('oilFactor updates when oilVolume preference changes', () => {
    const { result, rerender } = renderHook(() => useDisplayUnits());
    expect(result.current.oilFactor).toBe(1);

    act(() => {
      useProjectStore.getState().setUnitPreference('oilVolume', 'm³');
    });
    rerender();

    expect(result.current.oilFactor).toBeCloseTo(0.158987, 6);
  });

  it('returns a stable reference across re-renders when prefs unchanged', () => {
    const { result, rerender } = renderHook(() => useDisplayUnits());
    const first = result.current;
    rerender();
    const second = result.current;
    expect(second).toBe(first);
  });

  it('does not re-render on unrelated store mutations', () => {
    const { result, rerender } = renderHook(() => useDisplayUnits());
    const first = result.current;

    // Mutate something the hook should not subscribe to.
    act(() => {
      useProjectStore.setState({ sidebarCollapsed: true });
    });
    rerender();

    expect(result.current).toBe(first);

    // Reset for next test
    act(() => {
      useProjectStore.setState({ sidebarCollapsed: false });
    });
  });

  it('gasPrice honors the energy preference', () => {
    const { result, rerender } = renderHook(() => useDisplayUnits());
    expect(result.current.gasPrice(8)).toBe('$8.00/MMBtu');

    act(() => {
      useProjectStore.getState().setUnitPreference('energy', 'GJ');
    });
    rerender();

    expect(result.current.gasPrice(8)).toBe('$7.58/GJ');
  });
});
