// ════════════════════════════════════════════════════════════════════════
// Toast Adapter — provides a drop-in replacement for sonner's imperative
// `toast.success() / toast.error() / toast.info()` API using UI5 Toast.
//
// Exports both a React context provider and a module-level `toast` object
// so existing call sites that `import { toast } from 'sonner'` can simply
// swap to `import { toast } from '@/components/ui5/Ui5Toast'`.
// ════════════════════════════════════════════════════════════════════════

import { Toast } from '@ui5/webcomponents-react';
import type { ToastDomRef } from '@ui5/webcomponents-react';
import { useEffect, useRef, useState } from 'react';

type ToastKind = 'info' | 'success' | 'error';

interface ToastRequest {
  id: number;
  message: string;
  kind: ToastKind;
}

// ── Module-level event bus ─────────────────────────────────────────────

type Listener = (req: ToastRequest) => void;
const listeners: Set<Listener> = new Set();
let nextId = 1;

function emit(message: string, kind: ToastKind) {
  const req: ToastRequest = { id: nextId++, message, kind };
  listeners.forEach((fn) => fn(req));
}

/** Drop-in replacement for sonner's `toast` import */
export const toast = {
  info: (message: string) => emit(message, 'info'),
  success: (message: string) => emit(message, 'success'),
  error: (message: string) => emit(message, 'error'),
};

// ── Provider component mounted at app root ────────────────────────────

export function Toaster({ duration = 3500 }: { duration?: number } = {}) {
  const toastRef = useRef<ToastDomRef>(null);
  const [current, setCurrent] = useState<ToastRequest | null>(null);

  useEffect(() => {
    const onRequest: Listener = (req) => {
      setCurrent(req);
      // Allow React to render the new message, then show the UI5 Toast.
      // `show()` exists on the DOM element but is not exposed on the typed ref.
      requestAnimationFrame(() => {
        const el = toastRef.current as unknown as { show?: () => void } | null;
        el?.show?.();
      });
    };
    listeners.add(onRequest);
    return () => {
      listeners.delete(onRequest);
    };
  }, []);

  return (
    <Toast ref={toastRef} duration={duration} placement="BottomEnd">
      {current?.message ?? ''}
    </Toast>
  );
}

/** Hook alternative — returns the same `toast` object */
export function useToast() {
  return toast;
}
