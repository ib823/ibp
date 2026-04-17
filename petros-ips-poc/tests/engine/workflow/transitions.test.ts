import { describe, expect, it } from 'vitest';
import { canTransition, applyTransition, availableActions } from '@/engine/workflow/transitions';
import type { VersionedProjectData, DataStatus } from '@/engine/types';
import type { User, Role } from '@/engine/auth/types';

function makeUser(id: string, role: Role): User {
  return {
    id,
    displayName: id,
    email: `${id}@test`,
    role,
    department: 'test',
    initials: id.slice(0, 2).toUpperCase(),
  };
}

function makeRecord(overrides: Partial<VersionedProjectData> = {}): VersionedProjectData {
  return {
    projectId: 'sk-410',
    dataVersion: 'budget',
    scenarioVersion: 'base',
    status: 'open',
    lastModified: '2026-01-01',
    modifiedBy: 'seed',
    productionProfile: {} as unknown as VersionedProjectData['productionProfile'],
    costProfile: {} as unknown as VersionedProjectData['costProfile'],
    ...overrides,
  };
}

describe('workflow transitions', () => {
  it('allows an analyst to submit an open draft', () => {
    const actor = makeUser('u-a', 'analyst');
    const r = makeRecord({ status: 'open' });
    const check = canTransition(r, 'submit', actor);
    expect(check.allowed).toBe(true);
    expect(check.nextStatus).toBe('submitted');
  });

  it('rejects submit from an approver (no submit capability)', () => {
    const actor = makeUser('u-ap', 'approver');
    const r = makeRecord({ status: 'open' });
    const check = canTransition(r, 'submit', actor);
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/approver/);
  });

  it('rejects submit from an invalid state', () => {
    const actor = makeUser('u-a', 'analyst');
    const r = makeRecord({ status: 'approved' });
    const check = canTransition(r, 'submit', actor);
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/from status/);
  });

  describe('Segregation of Duty', () => {
    it('rejects approve when submitter equals approver', () => {
      const actor = makeUser('u-a', 'approver');
      const r = makeRecord({ status: 'submitted', submittedBy: 'u-a' });
      const check = canTransition(r, 'approve', actor);
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/Segregation of Duty/);
    });

    it('allows approve by a different approver', () => {
      const submitter = makeUser('u-a', 'analyst');
      const approver = makeUser('u-b', 'approver');
      // Simulate a prior submission
      const submitted = applyTransition(
        makeRecord({ status: 'open' }),
        'submit',
        submitter,
        { now: '2026-02-01' },
      );
      expect(submitted.status).toBe('submitted');
      expect(submitted.submittedBy).toBe('u-a');

      const check = canTransition(submitted, 'approve', approver);
      expect(check.allowed).toBe(true);
    });

    it('rejects admin self-approval', () => {
      const admin = makeUser('u-x', 'admin');
      const submitted = applyTransition(
        makeRecord({ status: 'open' }),
        'submit',
        admin,
      );
      const check = canTransition(submitted, 'approve', admin);
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/Segregation of Duty/);
    });
  });

  it('supports the full submitted → to_change → submitted → approved loop', () => {
    const analyst = makeUser('u-a', 'analyst');
    const reviewer = makeUser('u-r', 'reviewer');
    const approver = makeUser('u-ap', 'approver');

    let r = makeRecord({ status: 'open' });
    r = applyTransition(r, 'submit', analyst);
    expect(r.status).toBe('submitted');

    r = applyTransition(r, 'request_changes', reviewer, { comment: 'Please revisit cost profile.' });
    expect(r.status).toBe('to_change');
    expect(r.reviewComment).toBe('Please revisit cost profile.');

    r = applyTransition(r, 'resubmit', analyst);
    expect(r.status).toBe('submitted');
    expect(r.submittedBy).toBe('u-a');

    r = applyTransition(r, 'approve', approver);
    expect(r.status).toBe('approved');
  });

  it('throws when applyTransition is called without passing the guard', () => {
    const actor = makeUser('u-v', 'viewer');
    const r = makeRecord({ status: 'submitted' });
    expect(() => applyTransition(r, 'approve', actor)).toThrow();
  });

  describe('availableActions', () => {
    const cases: { status: DataStatus; expected: string[] }[] = [
      { status: 'open',      expected: ['submit'] },
      { status: 'submitted', expected: ['approve', 'request_changes'] },
      { status: 'to_change', expected: ['resubmit'] },
      { status: 'approved',  expected: [] },
    ];
    for (const { status, expected } of cases) {
      it(`returns ${JSON.stringify(expected)} for status=${status}`, () => {
        expect([...availableActions(status)]).toEqual(expected);
      });
    }
  });
});
