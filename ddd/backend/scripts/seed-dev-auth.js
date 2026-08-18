import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const repositoryRootPath = path.resolve(currentDirPath, '../../..');
const repositoryEnvPath = path.resolve(repositoryRootPath, '.env');

dotenv.config({ path: repositoryEnvPath });

function must(value, key) {
  if (!value || String(value).trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return String(value).trim();
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function requireDevelopmentMode() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (nodeEnv === 'production') {
    throw new Error('Development seed is disabled when NODE_ENV=production.');
  }
}

function loadSeedConfig() {
  return {
    organizationName: must(
      process.env.DEV_SEED_ORGANIZATION_NAME,
      'DEV_SEED_ORGANIZATION_NAME',
    ),
    timezone: must(
      process.env.DEV_SEED_ORGANIZATION_TIMEZONE,
      'DEV_SEED_ORGANIZATION_TIMEZONE',
    ),
    firstName: must(
      process.env.DEV_SEED_ADMIN_FIRST_NAME,
      'DEV_SEED_ADMIN_FIRST_NAME',
    ),
    lastName: must(
      process.env.DEV_SEED_ADMIN_LAST_NAME,
      'DEV_SEED_ADMIN_LAST_NAME',
    ),
    email: normalizeEmail(
      must(process.env.DEV_SEED_ADMIN_EMAIL, 'DEV_SEED_ADMIN_EMAIL'),
    ),
    password: must(
      process.env.DEV_SEED_ADMIN_PASSWORD,
      'DEV_SEED_ADMIN_PASSWORD',
    ),
  };
}

async function resolveSeedOrganization(client, config) {
  const userResult = await client.query(
    `
      SELECT u.id, u.organization_id
      FROM users u
      WHERE lower(u.email) = lower($1)
      ORDER BY u.created_at ASC, u.id ASC
    `,
    [config.email],
  );

  const distinctOrganizationIds = [
    ...new Set(userResult.rows.map((row) => row.organization_id)),
  ];

  if (distinctOrganizationIds.length > 1) {
    throw new Error(
      [
        `Seed email ${config.email} already exists in multiple organizations.`,
        'Login resolves users by email only, so the seed cannot safely choose one organization.',
        'Use a unique DEV_SEED_ADMIN_EMAIL or clean the conflicting records.',
      ].join(' '),
    );
  }

  if (distinctOrganizationIds.length === 1) {
    const organizationId = distinctOrganizationIds[0];

    const updateResult = await client.query(
      `
        UPDATE organizations
        SET name = $2,
            updated_at = now()
        WHERE id = $1
        RETURNING id, name
      `,
      [organizationId, config.organizationName],
    );

    return updateResult.rows[0];
  }

  const orgResult = await client.query(
    `
      SELECT id, name
      FROM organizations
      WHERE name = $1
      ORDER BY created_at ASC, id ASC
    `,
    [config.organizationName],
  );

  if (orgResult.rows.length > 1) {
    throw new Error(
      [
        `Multiple organizations already exist with the name ${config.organizationName}.`,
        'Seeding cannot safely reuse one organization by name.',
        'Use a more specific DEV_SEED_ORGANIZATION_NAME or clean the conflicting rows.',
      ].join(' '),
    );
  }

  if (orgResult.rows.length === 1) {
    return orgResult.rows[0];
  }

  const createdResult = await client.query(
    `
      INSERT INTO organizations (name)
      VALUES ($1)
      RETURNING id, name
    `,
    [config.organizationName],
  );

  return createdResult.rows[0];
}

async function upsertOrganizationSettings(
  client,
  { organizationId, timezone },
) {
  const existingResult = await client.query(
    `
      SELECT id
      FROM organization_settings
      WHERE organization_id = $1
      LIMIT 1
    `,
    [organizationId],
  );

  if (existingResult.rows[0]) {
    await client.query(
      `
        UPDATE organization_settings
        SET rep_visibility = 'own',
            timezone = $2,
            updated_at = now()
        WHERE organization_id = $1
      `,
      [organizationId, timezone],
    );

    return;
  }

  await client.query(
    `
      INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
      VALUES ($1, 'own', $2)
    `,
    [organizationId, timezone],
  );
}

async function upsertAdminUser(client, config, organizationId, passwordHash) {
  const existingUserResult = await client.query(
    `
      SELECT id
      FROM users
      WHERE organization_id = $1 AND lower(email) = lower($2)
      LIMIT 1
    `,
    [organizationId, config.email],
  );

  if (existingUserResult.rows[0]) {
    const updatedUser = await client.query(
      `
        UPDATE users
        SET email = $2,
            password_hash = $3,
            first_name = $4,
            last_name = $5,
            role = 'admin',
            is_active = true,
            updated_at = now()
        WHERE id = $1
        RETURNING id, organization_id, email, first_name, last_name, role, is_active
      `,
      [
        existingUserResult.rows[0].id,
        config.email,
        passwordHash,
        config.firstName,
        config.lastName,
      ],
    );

    return {
      user: updatedUser.rows[0],
      action: 'updated',
    };
  }

  const createdUser = await client.query(
    `
      INSERT INTO users (
        organization_id,
        email,
        password_hash,
        first_name,
        last_name,
        role,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, 'admin', true)
      RETURNING id, organization_id, email, first_name, last_name, role, is_active
    `,
    [
      organizationId,
      config.email,
      passwordHash,
      config.firstName,
      config.lastName,
    ],
  );

  return {
    user: createdUser.rows[0],
    action: 'created',
  };
}

async function main() {
  requireDevelopmentMode();

  const config = loadSeedConfig();
  const [{ withTransaction }, { closePool }, { hashPassword }] =
    await Promise.all([
      import('../src/db/transaction.js'),
      import('../src/db/client.js'),
      import('../src/auth/password.js'),
    ]);

  try {
    const result = await withTransaction(async (client) => {
      const organization = await resolveSeedOrganization(client, config);

      await upsertOrganizationSettings(client, {
        organizationId: organization.id,
        timezone: config.timezone,
      });

      const passwordHash = await hashPassword(config.password);
      const userResult = await upsertAdminUser(
        client,
        config,
        organization.id,
        passwordHash,
      );

      return {
        organization,
        user: userResult.user,
        userAction: userResult.action,
      };
    });

    console.log('Development auth seed complete.');
    console.log(
      `Organization: ${result.organization.name} (${result.organization.id})`,
    );
    console.log(`Admin user: ${result.user.email} (${result.user.id})`);
    console.log(`User action: ${result.userAction}`);
    console.log(
      'Login via POST /api/auth/login using the configured DEV_SEED_ADMIN_* credentials.',
    );
  } finally {
    const { closePool } = await import('../src/db/client.js');
    await closePool();
  }
}

main().catch((error) => {
  console.error('Development auth seed failed.');
  console.error(error.message);
  process.exitCode = 1;
});
