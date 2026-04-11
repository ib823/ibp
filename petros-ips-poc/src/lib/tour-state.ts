// ════════════════════════════════════════════════════════════════════════
// Guided Tour — shared state (localStorage flag + event bus)
// ════════════════════════════════════════════════════════════════════════
//
// Lives in /lib (not alongside GuidedTour.tsx) so the tour component file
// only exports the React component — required for Vite fast-refresh.
// ════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'petros_tour_completed';

/** Check if the tour has been completed before */
export function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Mark the tour as completed */
export function markTourCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable
  }
}

/** Clear the tour completed flag */
export function resetTourFlag(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

// ── Shared event bus for starting the tour from anywhere ───────────────

type TourListener = () => void;
const listeners: Set<TourListener> = new Set();

export function startTour(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeToTourStart(cb: TourListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
