import type { DataStatus } from '@/engine/types';
import { Pill, type PillTone } from '@/components/shared/Pill';

const STATUS_CONFIG: Record<DataStatus, { label: string; tone: PillTone }> = {
  open:      { label: 'Open',      tone: 'petrol' },
  submitted: { label: 'Submitted', tone: 'amber' },
  approved:  { label: 'Approved',  tone: 'success' },
  to_change: { label: 'To Change', tone: 'amber' },
};

interface StatusBadgeProps {
  status: DataStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Pill tone={config.tone} size="sm">
      {config.label}
    </Pill>
  );
}
