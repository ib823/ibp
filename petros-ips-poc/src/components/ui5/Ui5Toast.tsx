// ════════════════════════════════════════════════════════════════════════
// Toaster component — mounts at the app root and renders UI5 Toasts in
// response to `toast()` calls from `@/lib/toast`.
// ════════════════════════════════════════════════════════════════════════

import { Toast } from '@ui5/webcomponents-react';
import type { ToastDomRef } from '@ui5/webcomponents-react';
import { useEffect, useRef, useState } from 'react';
import { subscribeToToasts, type ToastRequest } from '@/lib/toast';

export function Toaster({ duration = 3500 }: { duration?: number } = {}) {
  const toastRef = useRef<ToastDomRef>(null);
  const [current, setCurrent] = useState<ToastRequest | null>(null);

  useEffect(
    () =>
      subscribeToToasts((req) => {
        setCurrent(req);
        // Allow React to render the new message, then show the UI5 Toast.
        // `show()` exists on the DOM element but is not exposed on the typed ref.
        requestAnimationFrame(() => {
          const el = toastRef.current as unknown as { show?: () => void } | null;
          el?.show?.();
        });
      }),
    [],
  );

  return (
    <Toast ref={toastRef} duration={duration} placement="BottomEnd">
      {current?.message ?? ''}
    </Toast>
  );
}
