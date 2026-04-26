// ════════════════════════════════════════════════════════════════════════
// UserMenu — header-right user avatar + popover menu
//
// Mobile: avatar-only button. Desktop: avatar + name + role chip.
// Popover closes on outside click or Escape. Keyboard-navigable via tab.
//
// The POC has no login; the bottom of the menu lists all five demo
// personas so a reviewer can switch role on the fly to feel the SoD
// workflow from each perspective.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore, useCurrentUser } from '@/store/auth-store';
import { RoleBadge } from '@/components/shared/RoleBadge';
import { ROLE_DESCRIPTIONS } from '@/engine/auth/types';
import { PERSONAS } from '@/data/personas';
import { ShieldCheck, History, ChevronDown, Check, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const user = useCurrentUser();
  const switchPersona = useAuthStore((s) => s.switchPersona);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Outside click + escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 min-h-[44px] px-2 py-1 hover:bg-content-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.displayName}`}
      >
        <span
          className="w-8 h-8 rounded-full bg-petrol text-white text-caption font-semibold flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          {user.initials}
        </span>
        <span className="hidden md:flex flex-col items-start leading-tight min-w-0">
          <span className="text-xs font-semibold text-text-primary truncate max-w-[140px]">{user.displayName}</span>
          <RoleBadge role={user.role} />
        </span>
        <ChevronDown size={14} className="text-text-muted hidden md:block" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="menu"
          aria-label="User menu"
          className="absolute right-0 top-full mt-1 w-[300px] bg-white border border-border shadow-lg z-50"
        >
          {/* Profile summary */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full bg-petrol text-white text-body font-semibold flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                {user.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body font-semibold text-text-primary truncate">{user.displayName}</div>
                <div className="text-caption text-text-muted truncate">{user.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <RoleBadge role={user.role} />
              <span className="text-caption text-text-muted truncate">{user.department}</span>
            </div>
            <p className="text-caption text-text-muted mt-2 leading-snug">
              {ROLE_DESCRIPTIONS[user.role]}
            </p>
          </div>

          {/* Actions */}
          <div className="py-1">
            <MenuItem
              icon={<History size={14} aria-hidden="true" />}
              onClick={() => { setOpen(false); navigate('/audit'); }}
            >
              Audit trail
            </MenuItem>
            <MenuItem
              icon={<ShieldCheck size={14} aria-hidden="true" />}
              onClick={() => { setOpen(false); navigate('/settings'); }}
            >
              Security &amp; connections
            </MenuItem>
          </div>

          {/* Persona switcher */}
          <div className="border-t border-border">
            <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-text-muted">
              <Users size={12} aria-hidden="true" />
              Switch persona
            </div>
            <div className="pb-1">
              {PERSONAS.map((p) => {
                const active = p.id === user.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (!active) switchPersona(p);
                      setOpen(false);
                    }}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-content-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-petrol',
                      active && 'bg-content-alt',
                    )}
                  >
                    <span
                      className="w-7 h-7 rounded-full bg-petrol/10 text-petrol text-caption font-semibold flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      {p.initials}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium text-text-primary truncate">
                        {p.displayName}
                      </span>
                      <span className="block text-caption text-text-muted truncate">
                        {p.department}
                      </span>
                    </span>
                    <RoleBadge role={p.role} />
                    {active && <Check size={14} className="text-petrol shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-left text-text-primary hover:bg-content-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-petrol"
    >
      {icon}
      {children}
    </button>
  );
}
