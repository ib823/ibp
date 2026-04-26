// ════════════════════════════════════════════════════════════════════════
// EmptyState / LoadingState / ErrorState — three primitives for the three
// non-content modes every data view needs. Pages had been rolling these
// inline (fixed h-64, plain "Calculating..." text with no spinner, toast-
// based errors). Centralising removes drift and makes the demo flow
// resilient to data hiccups.
// ════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { Loader2, AlertTriangle, FileX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BaseProps {
  /** Optional override; defaults vary per state. */
  className?: string;
  /** Min height: defaults to a moderate 12rem; pass 'sm' / 'md' / 'lg' or a className. */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = {
  sm: 'min-h-[8rem]',
  md: 'min-h-[12rem]',
  lg: 'min-h-[16rem]',
} as const;

const SHELL =
  'flex flex-col items-center justify-center text-center gap-2 px-4 py-6';

// ── Empty ────────────────────────────────────────────────────────────

interface EmptyStateProps extends BaseProps {
  /** Headline shown larger; e.g. "No project selected". */
  title: string;
  /** Sub-text describing what to do; e.g. "Choose a project then click Calculate". */
  hint?: ReactNode;
  /** Optional icon override; default is FileX. */
  icon?: ReactNode;
}

export function EmptyState({
  title,
  hint,
  icon,
  size = 'md',
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(SHELL, SIZE_CLASS[size], 'text-text-muted', className)}
    >
      {icon ?? <FileX size={28} aria-hidden="true" className="text-text-muted/70" />}
      <p className="text-body font-medium text-text-secondary">{title}</p>
      {hint && <p className="text-xs text-text-muted max-w-md">{hint}</p>}
    </div>
  );
}

// ── Loading ──────────────────────────────────────────────────────────

interface LoadingStateProps extends BaseProps {
  /** What's happening; e.g. "Calculating portfolio…". */
  label?: string;
  /** Optional sub-text e.g. "10,000 iterations". */
  detail?: string;
}

export function LoadingState({
  label = 'Loading…',
  detail,
  size = 'md',
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(SHELL, SIZE_CLASS[size], 'text-text-secondary', className)}
    >
      <Loader2 size={24} aria-hidden="true" className="animate-spin text-petrol" />
      <p className="text-body font-medium">{label}</p>
      {detail && <p className="text-xs text-text-muted">{detail}</p>}
    </div>
  );
}

// ── Error ────────────────────────────────────────────────────────────

interface ErrorStateProps extends BaseProps {
  /** Headline; e.g. "Calculation failed". */
  title: string;
  /** Explanation; e.g. "The fiscal regime is missing required parameters." */
  hint?: ReactNode;
  /** Optional retry handler — renders a button when provided. */
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title,
  hint,
  onRetry,
  retryLabel = 'Try again',
  size = 'md',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(SHELL, SIZE_CLASS[size], className)}
    >
      <AlertTriangle size={28} aria-hidden="true" className="text-danger" />
      <p className="text-body font-medium text-danger">{title}</p>
      {hint && <p className="text-xs text-text-muted max-w-md">{hint}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-xs font-semibold text-petrol hover:text-petrol-light underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
