import { describe, expect, it, vi } from 'vitest';
import { createUsersService } from '../../src/users/usersService.js';

function fixture(count, role = 'admin') {
  const target = {
    id: 'user-1',
    organization_id: 'org-1',
    role,
    is_active: true,
  };
  const query = vi.fn(async (sql) =>
    sql.includes('COUNT') ? { rows: [{ count }] } : { rows: [] },
  );
  const repository = {
    findUserForUpdate: vi.fn(async () => target),
    updateUser: vi.fn(async () => target),
    setUserActiveStatus: vi.fn(async () => target),
  };
  return {
    repository,
    query,
    service: createUsersService({
      repository,
      runInTransaction: (fn) => fn({ query }),
    }),
  };
}
describe('last active administrator protection', () => {
  it('blocks deactivation and demotion before any write', async () => {
    const f = fixture(1);
    await expect(
      f.service.setUserActiveStatus({
        organizationId: 'org-1',
        userId: 'user-1',
        isActive: false,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      f.service.updateUser({
        organizationId: 'org-1',
        userId: 'user-1',
        actorRole: 'admin',
        role: 'rep',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(f.repository.updateUser).not.toHaveBeenCalled();
    expect(f.repository.setUserActiveStatus).not.toHaveBeenCalled();
    expect(f.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
  });
  it('permits handoff after another active administrator exists', async () => {
    const f = fixture(2);
    await f.service.setUserActiveStatus({
      organizationId: 'org-1',
      userId: 'user-1',
      isActive: false,
    });
    expect(f.repository.setUserActiveStatus).toHaveBeenCalledTimes(1);
  });
  it('does not apply admin-count restrictions to a representative', async () => {
    const f = fixture(1, 'rep');
    await f.service.setUserActiveStatus({
      organizationId: 'org-1',
      userId: 'user-1',
      isActive: false,
    });
    expect(f.repository.setUserActiveStatus).toHaveBeenCalledTimes(1);
    expect(f.query.mock.calls.some(([sql]) => sql.includes('COUNT'))).toBe(
      false,
    );
  });
});
