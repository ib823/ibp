import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { InfoIcon } from '@/components/shared/InfoIcon';
import type { EducationalEntry } from '@/lib/educational-content';

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: number; // percentage change
  className?: string;
  eduEntry?: EducationalEntry;
}

export function KpiCard({ label, value, unit, delta, className, eduEntry }: KpiCardProps) {
  return (
    <div className={cn('border border-border bg-white p-4 min-w-[160px]', className)}>
      <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1 flex items-start gap-1 leading-tight">
        {eduEntry?.tooltip ? (
          <EduTooltip entry={eduEntry}><span className="cursor-help break-words">{label}</span></EduTooltip>
        ) : (
          <span className="break-words">{label}</span>
        )}
        {eduEntry?.infoPanel && <InfoIcon entry={eduEntry} />}
      </div>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className={cn(
            'text-2xl font-semibold font-data break-all',
            // Auto-detect parenthesized accounting negatives like "($701.0M)" or "(701.0)" → red
            value.trim().startsWith('(') && value.trim().endsWith(')')
              ? 'text-danger'
              : 'text-text-primary',
          )}
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
    </div>
  );
}
