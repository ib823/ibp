// ════════════════════════════════════════════════════════════════════════
// UI Preferences Store
//
// Small, focused store for purely-visual user preferences that don't
// belong in auth (session/audit) or the project store (data state).
// Today: SAC Preview toggle. Future: density, theme variants, etc.
//
// Persisted to sessionStorage so the demo state survives page reload
// inside a tab but resets when the tab closes — matches the rest of
// the POC's session model.
// ════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const STORAGE_KEY = 'petros-ips-ui-prefs';

interface UiPrefs {
  /** When true, the app renders with SAC Story visual conventions on top
   *  of the same underlying data. Visual-only — no engine changes. */
  sacPreviewMode: boolean;
}

interface UiPrefsActions {
  setSacPreviewMode: (on: boolean) => void;
  toggleSacPreviewMode: () => void;
}

const DEFAULTS: UiPrefs = {
  sacPreviewMode: false,
};

function read(): UiPrefs {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function write(state: UiPrefs): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or denied — non-fatal */
  }
}

export const useUiPrefs = create<UiPrefs & UiPrefsActions>((set, get) => ({
  ...read(),

  setSacPreviewMode: (on) => {
    const next = { sacPreviewMode: on };
    write(next);
    set(next);
  },

  toggleSacPreviewMode: () => {
    const next = { sacPreviewMode: !get().sacPreviewMode };
    write(next);
    set(next);
  },
}));

// ── Selectors ───────────────────────────────────────────────────────

export function useSacPreviewMode(): boolean {
  return useUiPrefs((s) => s.sacPreviewMode);
}
