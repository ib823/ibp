// ════════════════════════════════════════════════════════════════════════
// Toast — module-level event bus + imperative API
// ════════════════════════════════════════════════════════════════════════
//
// Drop-in replacement for sonner's `toast.success() / toast.error() /
// toast.info()` API. The Toaster component in `Ui5Toast.tsx` subscribes
// to the listener Set and renders UI5 Toasts.
//
// Lives in /lib so the Toaster component file only exports React
// components — required for Vite fast-refresh.
// ════════════════════════════════════════════════════════════════════════

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastRequest {
  id: number;
  message: string;
  kind: ToastKind;
}

type Listener = (req: ToastRequest) => void;

const listeners: Set<Listener> = new Set();
let nextId = 1;

function emit(message: string, kind: ToastKind): void {
  const req: ToastRequest = { id: nextId++, message, kind };
  listeners.forEach((fn) => fn(req));
}

/** Drop-in replacement for sonner's `toast` import */
export const toast = {
  info: (message: string) => emit(message, 'info'),
  success: (message: string) => emit(message, 'success'),
  error: (message: string) => emit(message, 'error'),
};

/** Subscribe to toast requests. Returns an unsubscribe function. */
export function subscribeToToasts(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
