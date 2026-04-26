import { useState, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calculator, X as XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { InfoIcon } from '@/components/shared/InfoIcon';
import type { EducationalEntry } from '@/lib/educational-content';

/**
 * KPI provenance metadata — when supplied, renders a small "fx" button on
 * the tile that opens a popover showing the calculation formula, bound
 * input values, the engine module that owns the math, and the parity
 * test that asserts Excel-equivalence. Closes RFP §2 evaluation criterion:
 * "transparent to support excel-based economic calculations".
 */
export interface KpiTrace {
  formula: string;
  /** e.g. "tests/lib/excel-export-parity.test.ts → 'NPV at 10% discount'" */
  reference?: string;
  /** e.g. "src/engine/economics/npv.ts" */
  engineSrc?: string;
  /** Snapshot of the bound inputs at the moment the value was computed. */
  inputs?: Record<string, string | number>;
}

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: number; // percentage change
  className?: string;
  eduEntry?: EducationalEntry;
  trace?: KpiTrace;
}

export function KpiCard({ label, value, unit, delta, className, eduEntry, trace }: KpiCardProps) {
  // KPI numeric size is now a single semantic token (--text-display, 24px).
  // Previously this branched on value.length to pick from text-base/lg/xl/2xl,
  // which made the same KPI render at different sizes across pages depending
  // on the formatted value's character count (audit S9). Long values are now
  // handled via truncate + title={value} so the full value is still
  // discoverable on hover / by screen readers.

  const [traceOpen, setTraceOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!traceOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setTraceOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTraceOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [traceOpen]);

  return (
    <div className={cn('border border-border bg-white p-4 min-w-0 relative', className)}>
      <div className="text-caption font-medium text-text-muted uppercase tracking-wider mb-1 flex items-start gap-1 leading-tight">
        {eduEntry?.tooltip ? (
          <EduTooltip entry={eduEntry}><span className="cursor-help break-words">{label}</span></EduTooltip>
        ) : (
          <span className="break-words">{label}</span>
        )}
        {eduEntry?.infoPanel && <InfoIcon entry={eduEntry} />}
        {trace && (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setTraceOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={traceOpen}
            aria-label={`Show calculation trace for ${label}`}
            title={`Trace ${label} to its formula and Excel-parity reference`}
            className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded text-text-muted hover:text-petrol hover:bg-petrol/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-petrol shrink-0"
          >
            <Calculator size={12} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className={cn(
            'font-semibold font-data tabular-nums tracking-tight text-display truncate min-w-0',
            value.trim().startsWith('(') && value.trim().endsWith(')')
              ? 'text-danger'
              : 'text-text-primary',
          )}
          title={value}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-text-secondary shrink-0">{unit}</span>
        )}
      </div>
      {delta !== undefined && delta !== 0 && (
        <div
          className={cn(
            'flex items-center gap-1 mt-1.5 text-xs font-medium',
            delta > 0 ? 'text-success' : 'text-danger',
          )}
        >
          {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</span>
        </div>
      )}

      {trace && traceOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Calculation trace for ${label}`}
          className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-petrol/30 shadow-lg p-3 text-xs space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-caption font-semibold uppercase tracking-wider text-petrol">
              Trace · {label}
            </div>
            <button
              type="button"
              onClick={() => setTraceOpen(false)}
              aria-label="Close trace panel"
              className="text-text-muted hover:text-text-primary"
            >
              <XIcon size={12} aria-hidden="true" />
            </button>
          </div>

          <div>
            <div className="text-caption font-semibold uppercase tracking-wider text-text-muted mb-0.5">
              Formula
            </div>
            <div className="font-data text-caption text-text-primary bg-content-alt/60 p-2 rounded leading-snug whitespace-pre-wrap break-words">
              {trace.formula}
            </div>
          </div>

          {trace.inputs && Object.keys(trace.inputs).length > 0 && (
            <div>
              <div className="text-caption font-semibold uppercase tracking-wider text-text-muted mb-0.5">
                Bound inputs
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-caption">
                {Object.entries(trace.inputs).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-text-secondary truncate">{k}</dt>
                    <dd className="font-data text-text-primary text-right truncate">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="text-caption text-text-muted leading-snug">
            Result: <span className="font-data text-text-primary">{value}</span>
          </div>

          {(trace.engineSrc || trace.reference) && (
            <div className="border-t border-border pt-2 space-y-0.5">
              {trace.engineSrc && (
                <div className="text-caption text-text-muted">
                  Engine:{' '}
                  <span className="font-data text-text-secondary break-words">{trace.engineSrc}</span>
                </div>
              )}
              {trace.reference && (
                <div className="text-caption text-text-muted">
                  Excel-parity test:{' '}
                  <span className="font-data text-text-secondary break-words">{trace.reference}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
