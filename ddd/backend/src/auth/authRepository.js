const ORGANIZATION_INSERT_SQL = `
  INSERT INTO organizations (name)
  VALUES ($1)
  RETURNING id, name, created_at, updated_at
`;

const ORGANIZATION_SETTINGS_INSERT_SQL = `
  INSERT INTO organization_settings (organization_id, rep_visibility, timezone)
  VALUES ($1, $2, $3)
  RETURNING id, organization_id, rep_visibility, timezone, created_at, updated_at
`;

const USER_INSERT_SQL = `
  INSERT INTO users (
    organization_id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    is_active
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING id, organization_id, email, first_name, last_name, role, is_active, created_at, updated_at
`;

const USER_BY_EMAIL_LOGIN_SQL = `
  SELECT
    u.id,
    u.organization_id,
    u.email,
    u.password_hash,
    u.first_name,
    u.last_name,
    u.role,
    u.is_active
  FROM users u
  INNER JOIN organizations o ON o.id = u.organization_id
  WHERE lower(u.email) = lower($1)
  LIMIT 1
`;

const USER_BY_ID_AND_ORG_SQL = `
  SELECT
    u.id,
    u.organization_id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.is_active
  FROM users u
  INNER JOIN organizations o ON o.id = u.organization_id
  WHERE u.id = $1 AND u.organization_id = $2
  LIMIT 1
`;

export const authRepository = {
  async findUserByIdAndOrganization(client, { userId, organizationId }) {
    const result = await client.query(USER_BY_ID_AND_ORG_SQL, [
      userId,
      organizationId,
    ]);

    return result.rows[0] ?? null;
  },

  async findUserByEmail(client, { email }) {
    // Email lookup is intentionally global across organizations in MVP login;
    // org context is then carried in token claims from resolved user row.
    const result = await client.query(USER_BY_EMAIL_LOGIN_SQL, [email]);
    return result.rows[0] ?? null;
  },

  async createOrganization(client, { name }) {
    const result = await client.query(ORGANIZATION_INSERT_SQL, [name]);
    return result.rows[0];
  },

  async createOrganizationSettings(
    client,
    { organizationId, repVisibility, timezone },
  ) {
    const result = await client.query(ORGANIZATION_SETTINGS_INSERT_SQL, [
      organizationId,
      repVisibility,
      timezone,
    ]);

    return result.rows[0];
  },

  async createUser(
    client,
    {
      organizationId,
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      isActive,
    },
  ) {
    const result = await client.query(USER_INSERT_SQL, [
      organizationId,
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      isActive,
    ]);

    return result.rows[0];
  },
};
