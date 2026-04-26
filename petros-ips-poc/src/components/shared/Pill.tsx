// ════════════════════════════════════════════════════════════════════════
// Pill — small inline tone tag (replaces ad-hoc tone class strings)
//
// Why: tone classes were rebuilt in 6+ places (RoleBadge, StatusBadge,
// VersionedDataUpload, ConnectionCard, DataSourcesPage, AuditTrailPage)
// each with subtly different padding (px-1.5 py-0 vs px-1.5 py-0.5 vs
// px-2 py-0.5) and font sizing. Centralising removes drift.
//
// Visual spec: tinted background, semantic foreground, semantic border —
// follows the established RoleBadge pattern (lightest-weight). Two sizes:
// 'xs' for inline marker (matches RoleBadge default), 'sm' for status
// chips (matches StatusBadge legacy size).
// ════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PillTone =
  | 'petrol'
  | 'amber'
  | 'success'
  | 'danger'
  | 'admin'
  | 'navy'
  | 'neutral';

export type PillSize = 'xs' | 'sm';

const TONE_CLASS: Record<PillTone, string> = {
  petrol:  'bg-petrol/10 text-petrol border-petrol/30',
  amber:   'bg-amber/10 text-amber border-amber/30',
  success: 'bg-success/10 text-success border-success/30',
  danger:  'bg-danger/10 text-danger border-danger/30',
  admin:   'bg-admin/10 text-admin border-admin/30',
  navy:    'bg-navy/10 text-navy border-navy/30',
  neutral: 'bg-content-alt text-text-secondary border-border',
};

const SIZE_CLASS: Record<PillSize, string> = {
  // xs raised from 9px → text-caption (11px) per S10. 9px breached the
  // WCAG/Fiori legibility floor; consumers are RoleBadge (every persona
  // indicator) and the "You" marker on Data Entry. xs stays uppercase +
  // semibold, so the visual role ("inline marker") still differs from
  // sm ("mixed-case status chip") despite both now being ≥10px.
  xs: 'text-caption font-semibold tracking-wider uppercase px-1.5 py-0.5',
  sm: 'text-caption font-medium px-2 py-0.5',
};

interface PillProps {
  tone: PillTone;
  size?: PillSize;
  className?: string;
  children: ReactNode;
  /** Optional title for native tooltip; prefer EduTooltip wrapper for richer help. */
  title?: string;
}

export function Pill({
  tone,
  size = 'xs',
  className,
  children,
  title,
}: PillProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center rounded border whitespace-nowrap',
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
