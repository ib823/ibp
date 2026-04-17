// ════════════════════════════════════════════════════════════════════════
// ChartShell — fixes the Recharts ResponsiveContainer measurement race
//
// Background: Recharts' ResponsiveContainer measures its parent via
// getBoundingClientRect() inside useEffect. If the parent is briefly
// zero-width at that moment (lazy tab mount, below-the-fold scroll
// container, layout transition), the chart renders at width 0 — which
// for number-domain x-axes like Spider's [-30, 30] compresses all
// points into a 1-2 px strip at the left edge. ResizeObserver *should*
// fire when width becomes non-zero, but in practice the event is
// unreliable across combinations of UI5 tab visibility + overflow
// containers + fast scroll.
//
// The fix: measure the outer container ourselves with useLayoutEffect
// + ResizeObserver, and only mount the chart children once width > 0.
// This guarantees that when Recharts' own useEffect runs, it reads a
// valid parent size on the first attempt — no race, no 0-width render.
// ════════════════════════════════════════════════════════════════════════

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChartShellProps {
  /** Children MUST be a Recharts ResponsiveContainer (or anything that
   *  benefits from a guaranteed non-zero parent width on mount). */
  children: ReactNode;
  /** Height of the reserved slot. Pass the same value you would pass to
   *  ResponsiveContainer's `height` prop so layout is identical. */
  height: number;
  className?: string;
  /** Optional aria-label forwarded to the outer div. */
  'aria-label'?: string;
}

export function ChartShell({ children, height, className, 'aria-label': ariaLabel }: ChartShellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      if (!ref.current) return false;
      if (ref.current.getBoundingClientRect().width > 0) {
        setReady(true);
        return true;
      }
      return false;
    };

    if (measure()) return;

    const ro = new ResizeObserver(() => { measure(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-label={ariaLabel}
      className={cn('relative', className)}
      style={{ width: '100%', height, minHeight: height }}
    >
      {ready ? children : null}
    </div>
  );
}
