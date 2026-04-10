import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: number; // percentage change
  className?: string;
}

export function KpiCard({ label, value, unit, delta, className }: KpiCardProps) {
  return (
    <div className={cn('border border-border bg-white p-4', className)}>
      <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold font-data text-text-primary">
          {value}
        </span>
        {unit && (
          <span className="text-xs text-text-secondary">{unit}</span>
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
