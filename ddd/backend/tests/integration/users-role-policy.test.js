import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/db/client.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import {
  ensureTestMigrations,
  hasTestDatabase,
  resetRegistrationTables,
} from '../helpers/dbTestHarness.js';

const describeDb = hasTestDatabase() ? describe : describe.skip;
const PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$V3vXhCRVQuZx3qYQ0k5rA3i0fY+GFq2ThJalxU4b9YI';

async function ensureSchemaReady() {
  const check = () =>
    query(`SELECT to_regclass('public.users') AS users_table`);

  if ((await check()).rows[0].users_table) {
    return;
  }

  try {
    await ensureTestMigrations();
  } catch (error) {
    if (!(await check()).rows[0].users_table) {
      throw error;
    }
  }
}

async function createOrganization() {
  const result = await query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
    [`Role Policy Org ${Date.now()}-${Math.random()}`],
  );
  const organizationId = result.rows[0].id;

  await query(
    `INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
     VALUES ($1, 'own', 'UTC')`,
    [organizationId],
  );

  return organizationId;
}

async function createUser({ organizationId, role, label }) {
  const result = await query(
    `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, 'Person', $5, true)
     RETURNING id, organization_id, role`,
    [
      organizationId,
      `${label}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`,
      PASSWORD_HASH,
      label,
      role,
    ],
  );

  return result.rows[0];
}

function tokenFor(user) {
  return signAccessToken({
    userId: user.id,
    organizationId: user.organization_id,
    role: user.role,
  });
}

function bearer(user) {
  return `Bearer ${tokenFor(user)}`;
}

async function roleOf(userId) {
  const result = await query('SELECT role FROM users WHERE id = $1', [userId]);
  return result.rows[0].role;
}

function newUserBody(role) {
  return {
    firstName: 'New',
    lastName: 'Hire',
    email: `new.${role}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`,
    password: 'Sup3r-Secret-Pass!',
    role,
  };
}

describeDb('user role management policy', () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureSchemaReady();
  });

  beforeEach(async () => {
    await resetRegistrationTables();
  });

  it('prevents a manager from promoting themselves or anyone else', async () => {
    const organizationId = await createOrganization();
    const manager = await createUser({
      organizationId,
      role: 'manager',
      label: 'mgr',
    });
    const rep = await createUser({ organizationId, role: 'rep', label: 'rep' });

    for (const [target, role] of [
      [manager, 'admin'],
      [rep, 'admin'],
      [rep, 'manager'],
      [rep, 'rep'],
    ]) {
      const response = await request(app)
        .patch(`/api/users/${target.id}`)
        .set('Authorization', bearer(manager))
        .send({ role });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }

    expect(await roleOf(manager.id)).toBe('manager');
    expect(await roleOf(rep.id)).toBe('rep');
  });

  it('prevents a manager from creating admin or manager accounts', async () => {
    const organizationId = await createOrganization();
    const manager = await createUser({
      organizationId,
      role: 'manager',
      label: 'mgr',
    });

    for (const role of ['admin', 'manager']) {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(manager))
        .send(newUserBody(role));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }

    const count = await query(
      'SELECT COUNT(*)::int AS count FROM users WHERE organization_id = $1',
      [organizationId],
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('prevents a manager from modifying admin or manager accounts', async () => {
    const organizationId = await createOrganization();
    const manager = await createUser({
      organizationId,
      role: 'manager',
      label: 'mgr',
    });
    const otherManager = await createUser({
      organizationId,
      role: 'manager',
      label: 'mgr2',
    });
    const admin = await createUser({
      organizationId,
      role: 'admin',
      label: 'adm',
    });

    for (const target of [admin, otherManager, manager]) {
      const response = await request(app)
        .patch(`/api/users/${target.id}`)
        .set('Authorization', bearer(manager))
        .send({ firstName: 'Changed' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }

    const names = await query(
      `SELECT first_name FROM users WHERE id = ANY($1::uuid[])`,
      [[admin.id, otherManager.id, manager.id]],
    );
    expect(names.rows.map((row) => row.first_name)).not.toContain('Changed');
  });

  it('still lets managers create reps and edit rep names', async () => {
    const organizationId = await createOrganization();
    const manager = await createUser({
      organizationId,
      role: 'manager',
      label: 'mgr',
    });
    const rep = await createUser({ organizationId, role: 'rep', label: 'rep' });

    const created = await request(app)
      .post('/api/users')
      .set('Authorization', bearer(manager))
      .send(newUserBody('rep'));
    expect(created.status).toBe(201);
    expect(created.body.role).toBe('rep');

    const edited = await request(app)
      .patch(`/api/users/${rep.id}`)
      .set('Authorization', bearer(manager))
      .send({ firstName: 'Renamed', lastName: 'Rep' });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      firstName: 'Renamed',
      lastName: 'Rep',
      role: 'rep',
    });
  });

  it('still lets admins create users of any role and change roles', async () => {
    const organizationId = await createOrganization();
    const admin = await createUser({
      organizationId,
      role: 'admin',
      label: 'adm',
    });
    const rep = await createUser({ organizationId, role: 'rep', label: 'rep' });

    for (const role of ['admin', 'manager', 'rep']) {
      const created = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(admin))
        .send(newUserBody(role));
      expect(created.status).toBe(201);
      expect(created.body.role).toBe(role);
    }

    const promoted = await request(app)
      .patch(`/api/users/${rep.id}`)
      .set('Authorization', bearer(admin))
      .send({ role: 'manager' });
    expect(promoted.status).toBe(200);
    expect(await roleOf(rep.id)).toBe('manager');

    const renamedManager = await request(app)
      .patch(`/api/users/${rep.id}`)
      .set('Authorization', bearer(admin))
      .send({ firstName: 'AdminEdit' });
    expect(renamedManager.status).toBe(200);
  });

  it('blocks cross-organization changes for managers and admins', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const managerA = await createUser({
      organizationId: orgA,
      role: 'manager',
      label: 'mgr-a',
    });
    const adminA = await createUser({
      organizationId: orgA,
      role: 'admin',
      label: 'adm-a',
    });
    const repB = await createUser({
      organizationId: orgB,
      role: 'rep',
      label: 'rep-b',
    });

    const managerEdit = await request(app)
      .patch(`/api/users/${repB.id}`)
      .set('Authorization', bearer(managerA))
      .send({ firstName: 'Hijack' });
    expect(managerEdit.status).toBe(404);

    const adminRole = await request(app)
      .patch(`/api/users/${repB.id}`)
      .set('Authorization', bearer(adminA))
      .send({ role: 'admin' });
    expect(adminRole.status).toBe(404);

    const created = await request(app)
      .post('/api/users')
      .set('Authorization', bearer(adminA))
      .send({ ...newUserBody('rep'), organizationId: orgB });
    expect(created.status).toBe(201);
    expect(created.body.organizationId).toBe(orgA);

    const orgBUsers = await query(
      'SELECT COUNT(*)::int AS count FROM users WHERE organization_id = $1',
      [orgB],
    );
    expect(orgBUsers.rows[0].count).toBe(1);

    const row = await query(
      'SELECT first_name, role FROM users WHERE id = $1',
      [repB.id],
    );
    expect(row.rows[0]).toEqual({ first_name: 'rep-b', role: 'rep' });
  });
});
