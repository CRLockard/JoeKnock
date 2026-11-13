import { describe, expect, it, vi } from 'vitest';
import { createInteractionsService } from '../../src/interactions/interactionsService.js';

function fixture() {
  const first = {
    id: 'snapshot-1',
    interaction_group_id: 'group-1',
    organization_id: 'org-1',
    property_id: 'property-1',
    user_id: 'rep-1',
    status_id: 'status-1',
    status_name: 'No Answer',
    notes: 'original',
    is_current: true,
    initial_interaction_at: new Date(),
    changed_at: new Date(),
  };
  const snapshots = new Map([[first.id, first]]);
  let current = first;
  let lock = Promise.resolve();
  const queries = [];
  const repository = {
    findSnapshotById: vi.fn(async (_client, { interactionId }) =>
      snapshots.get(interactionId),
    ),
    hasSharedTeamMembership: vi.fn(async () => false),
    findCurrentSnapshotByGroup: vi.fn(async () => current),
    findActiveStatusById: vi.fn(async () => ({
      id: 'status-1',
      name: 'No Answer',
    })),
    clearCurrentForGroup: vi.fn(async () => {
      current.is_current = false;
    }),
    createSnapshot: vi.fn(async (_client, data) => {
      current = {
        ...current,
        id: `snapshot-${snapshots.size + 1}`,
        notes: data.notes,
        is_current: true,
      };
      snapshots.set(current.id, current);
      return { id: current.id };
    }),
  };
  const runInTransaction = async (callback) => {
    let release;
    try {
      return await callback({
        query: async (sql, values) => {
          queries.push({ sql, values });
          const previous = lock;
          lock = new Promise((resolve) => {
            release = resolve;
          });
          await previous;
        },
      });
    } finally {
      release?.();
    }
  };
  const service = createInteractionsService({ repository, runInTransaction });
  const request = {
    organizationId: 'org-1',
    userId: 'rep-1',
    role: 'rep',
    interactionId: 'snapshot-1',
  };
  return { service, repository, request, queries, snapshots };
}

describe('interaction optimistic concurrency', () => {
  it('preserves the winning revision and rejects a stale form before mutation', async () => {
    const f = fixture();
    await f.service.reviseInteraction({ ...f.request, notes: 'first edit' });
    await expect(
      f.service.reviseInteraction({ ...f.request, notes: 'stale overwrite' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(f.repository.createSnapshot).toHaveBeenCalledTimes(1);
    expect(f.snapshots.get('snapshot-2').notes).toBe('first edit');
    expect(f.queries[0]).toEqual({
      sql: expect.stringContaining('pg_advisory_xact_lock'),
      values: ['org-1', 'group-1'],
    });
  });
  it('queues overlapping revisions on stable group identity and yields one winner', async () => {
    const f = fixture();
    const results = await Promise.allSettled([
      f.service.reviseInteraction({ ...f.request, notes: 'A' }),
      f.service.reviseInteraction({ ...f.request, notes: 'B' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({
      statusCode: 409,
    });
    expect(f.repository.createSnapshot).toHaveBeenCalledTimes(1);
    expect([...f.snapshots.values()].filter((s) => s.is_current)).toHaveLength(
      1,
    );
    expect(f.snapshots.get('snapshot-1').notes).toBe('original');
  });
  it('keeps authorization ahead of revision and locking', async () => {
    const f = fixture();
    await expect(
      f.service.reviseInteraction({
        ...f.request,
        userId: 'other-rep',
        notes: 'forbidden',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(f.repository.createSnapshot).not.toHaveBeenCalled();
    expect(f.queries).toHaveLength(0);
  });
});
