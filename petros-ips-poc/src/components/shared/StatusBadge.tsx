import { Badge } from '@/components/ui/badge';
import type { DataStatus } from '@/engine/types';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<DataStatus, { label: string; className: string }> = {
  open: {
    label: 'Open',
    className: 'bg-petrol/10 text-petrol border-petrol/30',
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-amber/10 text-amber border-amber/30',
  },
  approved: {
    label: 'Approved',
    className: 'bg-success/10 text-success border-success/30',
  },
  to_change: {
    label: 'To Change',
    className: 'bg-danger/10 text-danger border-danger/30',
  },
};

interface StatusBadgeProps {
  status: DataStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
