import { cn } from '@/lib/utils';
import type { Role } from '@/engine/auth/types';
import { ROLE_LABELS } from '@/engine/auth/types';

const ROLE_CLASS: Record<Role, string> = {
  analyst:  'bg-petrol/10 text-petrol border-petrol/30',
  reviewer: 'bg-amber/10 text-amber border-amber/30',
  approver: 'bg-success/10 text-success border-success/30',
  admin:    'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/30',
  viewer:   'bg-content-alt text-text-secondary border-border',
};

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border whitespace-nowrap',
        ROLE_CLASS[role],
        className,
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
