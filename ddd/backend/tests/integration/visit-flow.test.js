import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/client.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { createInteractionsService } from '../../src/interactions/interactionsService.js';
import {
  ensureTestMigrations,
  hasTestDatabase,
} from '../helpers/dbTestHarness.js';

const describeDb = hasTestDatabase() ? describe : describe.skip;

// America/New_York is UTC-4 on these dates: local midnight is 04:00Z.
const DAY1_LATE = '2026-07-02T03:30:00.000Z'; // Jul 1 23:30 local
const DAY1_LAST_SECOND = '2026-07-02T03:59:59.000Z';
const DAY2_FIRST_SECOND = '2026-07-02T04:00:00.000Z';
const DAY2_MORNING = '2026-07-02T13:00:00.000Z';

async function fixture({ role = 'rep', timezone = 'America/New_York' } = {}) {
  const org = (
    await query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [
      `Visit org ${randomUUID()}`,
    ])
  ).rows[0].id;
  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, 'own', $2)`,
    [org, timezone],
  );
  const user = (
    await query(
      `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, 'x', 'V', 'Rep', $3, true) RETURNING id`,
      [org, `visit.${randomUUID()}@example.com`, role],
    )
  ).rows[0].id;
  const status = (
    await query(
      `INSERT INTO statuses (organization_id, name, display_order, is_active)
       VALUES ($1, 'No Answer', 1, true) RETURNING id`,
      [org],
    )
  ).rows[0].id;
  const property = (
    await query(
      `INSERT INTO properties (organization_id, address_line_1, city, state, postal_code, country, normalized_address, latitude, longitude)
       VALUES ($1, '1 Main St', 'X', 'TN', '37901', 'US', $2, 35.5, -84.1) RETURNING id`,
      [org, `n-${randomUUID()}`],
    )
  ).rows[0].id;
  return { org, user, role, status, property };
}

describeDb('log a visit across company-local midnight', () => {
  let clock = new Date(DAY1_LATE);
  const service = createInteractionsService({ now: () => clock });
  const at = (iso) => {
    clock = new Date(iso);
  };

  beforeAll(async () => {
    await ensureTestMigrations();
  });

  const visit = (f, extra = {}) =>
    service.createInteractionForProperty({
      organizationId: f.org,
      userId: f.user,
      propertyId: f.property,
      statusId: f.status,
      clientRequestId: randomUUID(),
      notes: 'visit',
      ...extra,
    });

  const state = async (f) => {
    const rows = (
      await query(
        `SELECT knock_date::text AS d, count(*) FILTER (WHERE counts_as_daily_knock)::int AS counted,
                count(*)::int AS snapshots, count(DISTINCT interaction_group_id)::int AS groups,
                count(*) FILTER (WHERE is_current)::int AS currents
         FROM interactions WHERE organization_id = $1 GROUP BY knock_date ORDER BY knock_date`,
        [f.org],
      )
    ).rows;
    return rows;
  };

  it('earns one new knock on the next local day, in a new history', async () => {
    const f = await fixture();
    at(DAY1_LATE);
    const first = await visit(f);
    at(DAY2_FIRST_SECOND);
    const second = await visit(f);
    expect(second.interactionGroupId).not.toBe(first.interactionGroupId);
    expect(await state(f)).toEqual([
      { d: '2026-07-01', counted: 1, snapshots: 1, groups: 1, currents: 1 },
      { d: '2026-07-02', counted: 1, snapshots: 1, groups: 1, currents: 1 },
    ]);
  });

  it('treats the last second before local midnight as the same day', async () => {
    const f = await fixture();
    at(DAY1_LATE);
    await visit(f);
    at(DAY1_LAST_SECOND);
    await expect(visit(f)).rejects.toMatchObject({
      statusCode: 409,
      code: 'SAME_DAY_VISIT_EXISTS',
    });
    expect((await state(f))[0].counted).toBe(1);
  });

  it('never earns a knock when yesterday is edited today', async () => {
    const f = await fixture();
    at(DAY1_LATE);
    const yesterday = await visit(f);
    at(DAY2_MORNING);
    await service.reviseInteraction({
      organizationId: f.org,
      userId: f.user,
      role: f.role,
      interactionId: yesterday.interactionId,
      notes: 'edited today',
    });
    expect(await state(f)).toEqual([
      { d: '2026-07-01', counted: 1, snapshots: 2, groups: 1, currents: 1 },
    ]);
  });

  it('shows the editor and true save time, not the visit time, after an edit', async () => {
    const f = await fixture();
    at(DAY1_LATE);
    const first = await visit(f);
    expect(first.initialInteractionAt).toBe(DAY1_LATE);
    const editor = (
      await query(
        `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
         VALUES ($1, $2, 'x', 'Ada', 'Editor', 'admin', true) RETURNING id`,
        [f.org, `editor.${randomUUID()}@example.com`],
      )
    ).rows[0].id;

    const before = Date.now();
    const edited = await service.reviseInteraction({
      organizationId: f.org,
      userId: editor,
      role: 'admin',
      interactionId: first.interactionId,
      notes: 'edited',
    });
    const after = Date.now();

    const reread = await service.getInteractionSnapshotById({
      organizationId: f.org,
      userId: editor,
      role: 'admin',
      interactionId: edited.interactionId,
    });
    for (const view of [edited, reread]) {
      expect(view.lastEditedBy).toEqual({
        firstName: 'Ada',
        lastName: 'Editor',
      });
      expect(view.initialInteractionAt).toBe(DAY1_LATE);
      const saved = new Date(view.changedAt).getTime();
      expect(saved).toBeGreaterThanOrEqual(before - 2000);
      expect(saved).toBeLessThanOrEqual(after + 2000);
    }
  });

  it('saves a same-day return as extra details without a second knock', async () => {
    const f = await fixture();
    at(DAY2_FIRST_SECOND);
    const first = await visit(f);
    at(DAY2_MORNING);
    const extra = await visit(f, { sameDayReturn: true, notes: 'returned' });
    expect(extra.interactionGroupId).toBe(first.interactionGroupId);
    expect(extra.notes).toBe('returned');
    expect(await state(f)).toEqual([
      { d: '2026-07-02', counted: 1, snapshots: 2, groups: 1, currents: 1 },
    ]);
  });

  it('treats sameDayReturn as a normal first visit when none exists today', async () => {
    const f = await fixture();
    at(DAY2_MORNING);
    await visit(f, { sameDayReturn: true });
    expect((await state(f))[0].counted).toBe(1);
  });

  it('returns the original result when the same request is retried, even after midnight', async () => {
    const f = await fixture();
    const clientRequestId = randomUUID();
    at(DAY1_LAST_SECOND);
    const original = await visit(f, { clientRequestId });
    at(DAY2_FIRST_SECOND);
    const retry = await visit(f, { clientRequestId });
    expect(retry.interactionId).toBe(original.interactionId);
    expect(await state(f)).toEqual([
      { d: '2026-07-01', counted: 1, snapshots: 1, groups: 1, currents: 1 },
    ]);
  });

  it('creates exactly one history and knock for concurrent first visits on the new day', async () => {
    const f = await fixture();
    at(DAY1_LATE);
    await visit(f);
    at(DAY2_FIRST_SECOND);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => visit(f)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results.filter((x) => x.status === 'rejected')) {
      expect(r.reason.code).toBe('SAME_DAY_VISIT_EXISTS');
    }
    expect(await state(f)).toEqual([
      { d: '2026-07-01', counted: 1, snapshots: 1, groups: 1, currents: 1 },
      { d: '2026-07-02', counted: 1, snapshots: 1, groups: 1, currents: 1 },
    ]);
  });

  it('serializes concurrent same-day returns with one current snapshot and no extra knock', async () => {
    const f = await fixture();
    at(DAY2_FIRST_SECOND);
    await visit(f);
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        visit(f, { sameDayReturn: true, notes: `return ${i}` }),
      ),
    );
    expect(new Set(results.map((r) => r.interactionGroupId)).size).toBe(1);
    expect(await state(f)).toEqual([
      { d: '2026-07-02', counted: 1, snapshots: 5, groups: 1, currents: 1 },
    ]);
  });

  it('concurrent retries of one request create a single record', async () => {
    const f = await fixture();
    at(DAY2_MORNING);
    const clientRequestId = randomUUID();
    const results = await Promise.all([
      visit(f, { clientRequestId }),
      visit(f, { clientRequestId }),
      visit(f, { clientRequestId }),
    ]);
    expect(new Set(results.map((r) => r.interactionId)).size).toBe(1);
    expect((await state(f))[0].snapshots).toBe(1);
  });

  it('uses the organization timezone, not the server or UTC, for the day boundary', async () => {
    const f = await fixture({ timezone: 'Asia/Tokyo' });
    // 14:59Z = 23:59 Tokyo; 15:00Z = 00:00 next Tokyo day.
    at('2026-07-01T14:59:00.000Z');
    await visit(f);
    at('2026-07-01T15:00:00.000Z');
    await visit(f);
    expect((await state(f)).map((r) => r.d)).toEqual([
      '2026-07-01',
      '2026-07-02',
    ]);
  });
});

describeDb('organization settings timezone validation', () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestMigrations();
  });

  const patch = async (f, timezone) =>
    request(app)
      .patch('/api/organization/settings')
      .set(
        'Authorization',
        `Bearer ${signAccessToken({ userId: f.user, organizationId: f.org, role: 'admin' })}`,
      )
      .send({ timezone });

  it.each([
    ['unknown zone', 'Mars/Olympus'],
    ['wrong-case name the database does not resolve', 'america/new_york'],
    ['empty value', ''],
  ])('rejects %s and keeps the saved timezone', async (_l, timezone) => {
    const f = await fixture({ role: 'admin' });
    const response = await patch(f, timezone);
    expect(response.status).toBe(400);
    const saved = await query(
      'SELECT timezone FROM organization_settings WHERE organization_id = $1',
      [f.org],
    );
    expect(saved.rows[0].timezone).toBe('America/New_York');
  });

  it('accepts a valid zone and keeps earlier knock dates frozen', async () => {
    const f = await fixture({ role: 'admin' });
    const service = createInteractionsService({
      now: () => new Date(DAY1_LATE),
    });
    await service.createInteractionForProperty({
      organizationId: f.org,
      userId: f.user,
      propertyId: f.property,
      statusId: f.status,
    });
    expect((await patch(f, 'Asia/Tokyo')).status).toBe(200);
    const row = await query(
      'SELECT knock_date::text AS d, knock_timezone FROM interactions WHERE organization_id = $1',
      [f.org],
    );
    expect(row.rows[0]).toEqual({
      d: '2026-07-01',
      knock_timezone: 'America/New_York',
    });
  });
});
