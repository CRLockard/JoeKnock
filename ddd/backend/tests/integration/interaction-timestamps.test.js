import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getPool, query } from '../../src/db/client.js';
import { interactionsRepository } from '../../src/interactions/interactionsRepository.js';
import {
  ensureTestMigrations,
  hasTestDatabase,
} from '../helpers/dbTestHarness.js';

const describeDb = hasTestDatabase() ? describe : describe.skip;

async function fixture({ timezone = 'America/New_York' } = {}) {
  const org = (
    await query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [
      `TS org ${randomUUID()}`,
    ])
  ).rows[0].id;
  if (timezone) {
    await query(
      `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
       VALUES ($1, 'own', $2)`,
      [org, timezone],
    );
  }
  const user = (
    await query(
      `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, 'x', 'T', 'U', 'rep', true) RETURNING id`,
      [org, `ts.${randomUUID()}@example.com`],
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
  return { org, user, status, property };
}

async function create(f, instant) {
  const client = await getPool().connect();
  try {
    const created = await interactionsRepository.createSnapshot(client, {
      interactionGroupId: randomUUID(),
      propertyId: f.property,
      organizationId: f.org,
      ownerUserId: f.user,
      statusId: f.status,
      statusName: 'No Answer',
      initialInteractionAt: instant,
      submittedAt: instant,
      changedBy: f.user,
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      notes: null,
      clientRequestId: null,
    });
    return created.id;
  } finally {
    client.release();
  }
}

async function revise(f, source) {
  const client = await getPool().connect();
  try {
    const src = (
      await client.query('SELECT * FROM interactions WHERE id = $1', [source])
    ).rows[0];
    await interactionsRepository.clearCurrentForGroup(client, {
      organizationId: f.org,
      interactionGroupId: src.interaction_group_id,
    });
    const created = await interactionsRepository.createSnapshot(client, {
      interactionGroupId: src.interaction_group_id,
      propertyId: src.property_id,
      organizationId: f.org,
      ownerUserId: src.user_id,
      statusId: f.status,
      statusName: 'No Answer',
      initialInteractionAt: src.initial_interaction_at,
      timingSourceSnapshotId: src.id,
      changedBy: f.user,
      contactName: 'edited',
      contactPhone: null,
      contactEmail: null,
      notes: null,
      clientRequestId: null,
    });
    return created.id;
  } finally {
    client.release();
  }
}

async function row(id) {
  return (
    await query(
      `SELECT initial_interaction_at::text AS legacy_initial,
              initial_interaction_at_utc, changed_at_utc,
              knock_date::text AS knock_date, knock_timezone
       FROM interactions WHERE id = $1`,
      [id],
    )
  ).rows[0];
}

describeDb('interaction timestamp correction', () => {
  beforeAll(async () => {
    await ensureTestMigrations();
  });

  it.each([
    // [label, instant, expected knock date in America/New_York]
    [
      'before spring-forward gap (01:59 EST)',
      '2026-03-08T06:59:00.000Z',
      '2026-03-08',
    ],
    [
      'after spring-forward gap (03:01 EDT)',
      '2026-03-08T07:01:00.000Z',
      '2026-03-08',
    ],
    ['first fall-back 01:30 (EDT)', '2026-11-01T05:30:00.000Z', '2026-11-01'],
    [
      'repeated fall-back 01:30 (EST)',
      '2026-11-01T06:30:00.000Z',
      '2026-11-01',
    ],
    ['23:30 local is next UTC day', '2026-07-01T03:30:00.000Z', '2026-06-30'],
    ['00:30 local same UTC day', '2026-07-01T04:30:00.000Z', '2026-07-01'],
    [
      'winter 19:30 local is next UTC day',
      '2026-01-16T00:30:00.000Z',
      '2026-01-15',
    ],
  ])('freezes the org-local knock date: %s', async (_label, instant, date) => {
    const f = await fixture();
    const id = await create(f, instant);
    const r = await row(id);
    expect(r.initial_interaction_at_utc.toISOString()).toBe(instant);
    expect(r.knock_date).toBe(date);
    expect(r.knock_timezone).toBe('America/New_York');
    // Original column keeps its legacy UTC-wall semantics.
    expect(r.legacy_initial).toBe(
      instant
        .replace('T', ' ')
        .replace('Z', '')
        .replace(/\.000$/, ''),
    );
  });

  it('keeps both daily knocks for one relationship on different days', async () => {
    const f = await fixture();
    const a = await create(f, '2026-08-01T03:30:00.000Z');
    const b = await create(f, '2026-08-01T04:30:00.000Z');
    expect((await row(a)).knock_date).toBe('2026-07-31');
    expect((await row(b)).knock_date).toBe('2026-08-01');
  });

  it('keeps the original instant, knock date and zone frozen across edits and org timezone changes', async () => {
    const f = await fixture();
    const first = await create(f, '2026-07-01T03:30:00.000Z');
    await query(
      `UPDATE organization_settings SET timezone = 'Asia/Tokyo' WHERE organization_id = $1`,
      [f.org],
    );
    const second = await revise(f, first);
    const third = await revise(f, second);
    const [r1, r3] = [await row(first), await row(third)];
    expect(r3.initial_interaction_at_utc.toISOString()).toBe(
      r1.initial_interaction_at_utc.toISOString(),
    );
    expect(r3.legacy_initial).toBe(r1.legacy_initial);
    expect(r3.knock_date).toBe('2026-06-30');
    expect(r3.knock_timezone).toBe('America/New_York');
    expect(r3.changed_at_utc.getTime()).toBeGreaterThanOrEqual(
      r1.changed_at_utc.getTime(),
    );
  });
});
