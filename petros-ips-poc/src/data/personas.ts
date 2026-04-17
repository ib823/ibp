// ════════════════════════════════════════════════════════════════════════
// Demo personas for the POC Entra ID mock SSO flow
//
// Real Phase 1a will federate against the PETROS Entra tenant — roles
// will be derived from Entra group membership. The personas here exist
// so reviewers can feel the workflow from each SoD perspective.
// ════════════════════════════════════════════════════════════════════════

import type { User, Role } from '@/engine/auth/types';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join('');
}

function makeUser(
  id: string,
  displayName: string,
  email: string,
  role: Role,
  department: string,
): User {
  return {
    id,
    displayName,
    email,
    role,
    department,
    initials: initialsOf(displayName),
  };
}

export const PERSONAS: readonly User[] = [
  makeUser('u-aisha',   'Aisha Rahman',        'aisha.rahman@petros.com.my',     'analyst',  'FP&A — Upstream'),
  makeUser('u-ben',     'Benjamin Tan',        'benjamin.tan@petros.com.my',     'reviewer', 'Planning — Finance'),
  makeUser('u-liyana',  'Dr. Liyana Kamal',    'liyana.kamal@petros.com.my',     'approver', 'CFO Office'),
  makeUser('u-faisal',  'Faisal Othman',       'faisal.othman@petros.com.my',    'admin',    'IT — Planning Platform'),
  makeUser('u-board',   'Board Member (Demo)', 'board.viewer@petros.com.my',     'viewer',   'Board of Directors'),
];

export const DEFAULT_TENANT = 'petros.onmicrosoft.com';
