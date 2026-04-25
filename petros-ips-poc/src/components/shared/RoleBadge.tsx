import type { Role } from '@/engine/auth/types';
import { ROLE_LABELS } from '@/engine/auth/types';
import { Pill, type PillTone } from '@/components/shared/Pill';

const ROLE_TONE: Record<Role, PillTone> = {
  analyst:  'petrol',
  reviewer: 'amber',
  approver: 'success',
  admin:    'admin',
  viewer:   'neutral',
};

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <Pill tone={ROLE_TONE[role]} size="xs" className={className}>
      {ROLE_LABELS[role]}
    </Pill>
  );
}
