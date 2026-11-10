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

// America/New_York is UTC-4 in July.
const JUL1 = '2026-07-01T15:00:00.000Z';
const JUL2 = '2026-07-02T15:00:00.000Z';
const JUL5 = '2026-07-05T15:00:00.000Z';

let clock = new Date(JUL1);
const service = createInteractionsService({ now: () => clock });
const at = (iso) => {
  clock = new Date(iso);
};

async function makeOrg({
  visibility = 'organization',
  timezone = 'America/New_York',
} = {}) {
  const org = (
    await query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [
      `Report org ${randomUUID()}`,
    ])
  ).rows[0].id;
  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, $2, $3)`,
    [org, visibility, timezone],
  );
  const statuses = {};
  for (const [i, name] of ['No Answer', 'Interested'].entries()) {
    statuses[name] = (
      await query(
        `INSERT INTO statuses (organization_id, name, display_order, is_active)
         VALUES ($1, $2, $3, true) RETURNING id`,
        [org, name, i + 1],
      )
    ).rows[0].id;
  }
  return { org, statuses };
}

async function makeUser(org, role, label) {
  const row = (
    await query(
      `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, 'x', $3, 'Tester', $4, true) RETURNING id`,
      [org, `${label}.${randomUUID()}@example.com`, label, role],
    )
  ).rows[0];
  return {
    id: row.id,
    org,
    role,
    label,
    token: signAccessToken({ userId: row.id, organizationId: org, role }),
  };
}

async function makeProperty(org, street) {
  return (
    await query(
      `INSERT INTO properties (organization_id, address_line_1, city, state, postal_code, country, normalized_address, latitude, longitude)
       VALUES ($1, $2, 'Knoxville', 'TN', '37901', 'US', $3, 35.5, -84.1) RETURNING id`,
      [org, street, `n-${randomUUID()}`],
    )
  ).rows[0].id;
}

async function makeTeam(org, members) {
  const team = (
    await query(
      'INSERT INTO teams (organization_id, name) VALUES ($1, $2) RETURNING id',
      [org, `Team ${randomUUID()}`],
    )
  ).rows[0].id;
  for (const user of members) {
    await query(
      'INSERT INTO team_users (organization_id, team_id, user_id) VALUES ($1, $2, $3)',
      [org, team, user.id],
    );
  }
  return team;
}

const visit = (org, user, property, statusId, extra = {}) =>
  service.createInteractionForProperty({
    organizationId: org,
    userId: user.id,
    propertyId: property,
    statusId,
    clientRequestId: randomUUID(),
    ...extra,
  });

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

describeDb('knock reports and exports', () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestMigrations();
  });

  const report = (user, qs) =>
    request(app)
      .get(`/api/reports/activity?${qs}`)
      .set('Authorization', `Bearer ${user.token}`);
  const exportCsv = (user, qs) =>
    request(app)
      .get(`/api/exports/properties?${qs}`)
      .set('Authorization', `Bearer ${user.token}`);

  // Admin-visible world: R1 knocks P1 on Jul 1 and Jul 2, P2 on Jul 2; R2
  // knocks P1 on Jul 2; R1 returns to P1 on Jul 2 (same-day) and the Jul 1
  // record is edited on Jul 5.
  async function buildWorld() {
    const { org, statuses } = await makeOrg();
    const admin = await makeUser(org, 'admin', 'admin');
    const r1 = await makeUser(org, 'rep', 'rep1');
    const r2 = await makeUser(org, 'rep', 'rep2');
    const p1 = await makeProperty(org, '1 Alpha St');
    const p2 = await makeProperty(org, '2 Beta St');
    at(JUL1);
    const r1p1Jul1 = await visit(org, r1, p1, statuses['No Answer'], {
      contactName: 'Original Name',
    });
    at(JUL2);
    await visit(org, r1, p1, statuses['No Answer']);
    await visit(org, r1, p2, statuses['No Answer']);
    await visit(org, r2, p1, statuses['No Answer']);
    await visit(org, r1, p1, statuses.Interested, {
      sameDayReturn: true,
      contactName: 'Returned Later',
    });
    at(JUL5);
    await service.reviseInteraction({
      organizationId: org,
      userId: r1.id,
      role: 'rep',
      interactionId: r1p1Jul1.interactionId,
      statusId: statuses.Interested,
      contactName: '=1+1',
    });
    return { org, statuses, admin, r1, r2, p1, p2 };
  }

  const sum = (items) => items.reduce((total, item) => total + item.knocks, 0);

  it('counts one knock per rep, property and local day and ignores edits and same-day returns', async () => {
    const w = await buildWorld();
    const res = await report(w.admin, 'dateFrom=2026-07-01&dateTo=2026-07-05');
    expect(res.status).toBe(200);
    expect(res.body.summary.totalKnocks).toBe(4);
    const reps = Object.fromEntries(
      res.body.byRepresentative.map((r) => [r.userId, r]),
    );
    expect(reps[w.r1.id].knocks).toBe(3);
    expect(reps[w.r2.id].knocks).toBe(1);
    expect(
      reps[w.r1.id].properties.map((p) => [p.address, p.knocks]).sort(),
    ).toEqual([
      ['1 Alpha St, Knoxville TN 37901', 2],
      ['2 Beta St, Knoxville TN 37901', 1],
    ]);
  });

  it('keeps organization total, rep totals, property counts and status counts in agreement', async () => {
    const w = await buildWorld();
    for (const qs of [
      'dateFrom=2026-07-01&dateTo=2026-07-05',
      'dateFrom=2026-07-02&dateTo=2026-07-02',
      `dateFrom=2026-07-01&dateTo=2026-07-05&statusId=${w.statuses.Interested}`,
      `dateFrom=2026-07-01&dateTo=2026-07-05&userId=${w.r1.id}`,
    ]) {
      const res = await report(w.admin, qs);
      const { totalKnocks } = res.body.summary;
      expect(sum(res.body.byRepresentative)).toBe(totalKnocks);
      expect(sum(res.body.byStatus)).toBe(totalKnocks);
      for (const rep of res.body.byRepresentative) {
        expect(sum(rep.properties)).toBe(rep.knocks);
        expect(new Set(rep.properties.map((p) => p.propertyId)).size).toBe(
          rep.properties.length,
        );
      }
    }
  });

  it('applies the status breakdown to the latest saved status without adding for edits', async () => {
    const w = await buildWorld();
    const res = await report(w.admin, 'dateFrom=2026-07-01&dateTo=2026-07-05');
    // Jul 1 (edited) and Jul 2 P1 (same-day return) are now Interested.
    expect(
      Object.fromEntries(
        res.body.byStatus.map((s) => [s.statusName, s.knocks]),
      ),
    ).toEqual({ Interested: 2, 'No Answer': 2 });
    const edited = await report(
      w.admin,
      'dateFrom=2026-07-05&dateTo=2026-07-05',
    );
    expect(edited.body.summary.totalKnocks).toBe(0);
    expect(edited.body.byStatus).toEqual([]);
  });

  it('uses inclusive stored knock dates for ranges', async () => {
    const w = await buildWorld();
    const total = async (from, to) =>
      (await report(w.admin, `dateFrom=${from}&dateTo=${to}`)).body.summary
        .totalKnocks;
    expect(await total('2026-07-01', '2026-07-01')).toBe(1);
    expect(await total('2026-07-02', '2026-07-02')).toBe(3);
    expect(await total('2026-07-03', '2026-07-31')).toBe(0);
    expect(await total('2026-06-01', '2026-06-30')).toBe(0);
    expect(
      (await report(w.admin, 'dateFrom=2026-02-31&dateTo=2026-03-01')).status,
    ).toBe(400);
  });

  it('does not move existing knocks when the organization timezone changes later', async () => {
    const w = await buildWorld();
    const before = await report(
      w.admin,
      'dateFrom=2026-07-01&dateTo=2026-07-01',
    );
    await query(
      `UPDATE organization_settings SET timezone = 'Pacific/Auckland' WHERE organization_id = $1`,
      [w.org],
    );
    const after = await report(
      w.admin,
      'dateFrom=2026-07-01&dateTo=2026-07-01',
    );
    expect(after.body.summary.totalKnocks).toBe(
      before.body.summary.totalKnocks,
    );
    expect(after.body.summary.totalKnocks).toBe(1);
  });

  it('exports counted knocks with the latest saved details and the same columns', async () => {
    const w = await buildWorld();
    const res = await exportCsv(
      w.admin,
      'dateFrom=2026-07-01&dateTo=2026-07-05',
    );
    expect(res.status).toBe(200);
    const rows = parseCsv(res.text);
    expect(rows[0]).toEqual([
      'address',
      'contactName',
      'phone',
      'currentStatus',
      'representative',
      'interactionDate',
    ]);
    expect(rows).toHaveLength(5);
    const jul1 = rows.find((r) => r[5] === '2026-07-01');
    expect(jul1[3]).toBe('Interested');
    // Edited value is exported, with the existing formula protection.
    expect(jul1[1]).toBe('\t=1+1');
    expect(res.text).toContain('"\t=1+1"');
    const returned = rows.find(
      (r) => r[5] === '2026-07-02' && r[1] === 'Returned Later',
    );
    expect(returned[3]).toBe('Interested');
    // The edit on Jul 5 does not create or move any exported row.
    expect(
      rows
        .slice(1)
        .map((r) => r[5])
        .sort(),
    ).toEqual(['2026-07-01', '2026-07-02', '2026-07-02', '2026-07-02']);
    expect(
      (
        await exportCsv(w.admin, 'dateFrom=2026-07-05&dateTo=2026-07-05')
      ).text.split('\r\n').length,
    ).toBe(1);
  });

  it('matches report and export for every permission scope and filter', async () => {
    const { org, statuses } = await makeOrg({ visibility: 'own' });
    const admin = await makeUser(org, 'admin', 'admin');
    const manager = await makeUser(org, 'manager', 'mgr');
    const rep1 = await makeUser(org, 'rep', 'rep1');
    const rep2 = await makeUser(org, 'rep', 'rep2');
    const outsider = await makeUser(org, 'rep', 'out');
    const team = await makeTeam(org, [manager, rep1, rep2]);
    const otherTeam = await makeTeam(org, [outsider]);
    const p1 = await makeProperty(org, '10 Gamma St');
    const p2 = await makeProperty(org, '11 Delta St');
    at(JUL2);
    await visit(org, rep1, p1, statuses['No Answer']);
    await visit(org, rep2, p2, statuses.Interested);
    await visit(org, outsider, p1, statuses['No Answer']);
    await visit(org, manager, p2, statuses['No Answer']);

    const cases = [
      [admin, '', 4],
      [admin, `&teamId=${team}`, 3],
      [admin, `&teamId=${otherTeam}`, 1],
      [admin, `&statusId=${statuses.Interested}`, 1],
      [manager, '', 3],
      [manager, `&userId=${rep1.id}`, 1],
      [manager, `&userId=${outsider.id}`, 0],
    ];
    for (const [actor, extra, expected] of cases) {
      const qs = `dateFrom=2026-07-01&dateTo=2026-07-31${extra}`;
      const rep = await report(actor, qs);
      const exp = await exportCsv(actor, qs);
      expect(rep.status).toBe(200);
      expect(rep.body.summary.totalKnocks).toBe(expected);
      expect(sum(rep.body.byRepresentative)).toBe(expected);
      expect(parseCsv(exp.text).length - 1).toBe(expected);
    }

    expect(
      (await report(rep1, 'dateFrom=2026-07-01&dateTo=2026-07-31')).status,
    ).toBe(403);
    expect(
      (await exportCsv(rep1, 'dateFrom=2026-07-01&dateTo=2026-07-31')).status,
    ).toBe(403);
  });

  it('never includes another organization', async () => {
    const a = await makeOrg();
    const b = await makeOrg();
    const adminA = await makeUser(a.org, 'admin', 'adminA');
    const repB = await makeUser(b.org, 'rep', 'repB');
    const propB = await makeProperty(b.org, '99 Other St');
    at(JUL2);
    await visit(b.org, repB, propB, b.statuses['No Answer']);
    const res = await report(adminA, 'dateFrom=2026-07-01&dateTo=2026-07-31');
    expect(res.body.summary.totalKnocks).toBe(0);
    expect(
      (await exportCsv(adminA, 'dateFrom=2026-07-01&dateTo=2026-07-31')).text,
    ).not.toContain('Other St');
  });
});
