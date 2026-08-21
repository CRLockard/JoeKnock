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

function buildListUsersQuery({ organizationId, active, role }) {
  const values = [organizationId];
  const whereClauses = ['organization_id = $1'];

  if (typeof active === 'boolean') {
    values.push(active);
    whereClauses.push(`is_active = $${values.length}`);
  }

  if (role) {
    values.push(role);
    whereClauses.push(`role = $${values.length}`);
  }

  // Optional filters are appended while preserving parameterized SQL.
  return {
    text: `
      SELECT id, organization_id, email, first_name, last_name, role, is_active, created_at, updated_at
      FROM users
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY last_name ASC, first_name ASC, email ASC
    `,
    values,
  };
}

function buildUpdateUserQuery({
  organizationId,
  userId,
  firstName,
  lastName,
  role,
}) {
  const values = [organizationId, userId];
  const setClauses = [];

  if (firstName !== undefined) {
    values.push(firstName);
    setClauses.push(`first_name = $${values.length}`);
  }

  if (lastName !== undefined) {
    values.push(lastName);
    setClauses.push(`last_name = $${values.length}`);
  }

  if (role !== undefined) {
    values.push(role);
    setClauses.push(`role = $${values.length}`);
  }

  // PATCH updates only provided mutable columns and bumps updated_at.
  return {
    text: `
      UPDATE users
      SET ${setClauses.join(', ')}, updated_at = now()
      WHERE organization_id = $1 AND id = $2
      RETURNING id, organization_id, email, first_name, last_name, role, is_active, created_at, updated_at
    `,
    values,
  };
}

function buildUpdateUserActiveQuery({ organizationId, userId, isActive }) {
  return {
    text: `
      UPDATE users
      SET is_active = $3, updated_at = now()
      WHERE organization_id = $1 AND id = $2
      RETURNING id, organization_id, email, first_name, last_name, role, is_active, created_at, updated_at
    `,
    values: [organizationId, userId, isActive],
  };
}

export const usersRepository = {
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

    return result.rows[0] ?? null;
  },

  async listUsers(client, { organizationId, active, role }) {
    const sql = buildListUsersQuery({ organizationId, active, role });
    const result = await client.query(sql.text, sql.values);
    return result.rows;
  },

  async updateUser(
    client,
    { organizationId, userId, firstName, lastName, role },
  ) {
    const sql = buildUpdateUserQuery({
      organizationId,
      userId,
      firstName,
      lastName,
      role,
    });

    const result = await client.query(sql.text, sql.values);
    return result.rows[0] ?? null;
  },

  async setUserActiveStatus(client, { organizationId, userId, isActive }) {
    const sql = buildUpdateUserActiveQuery({
      organizationId,
      userId,
      isActive,
    });

    const result = await client.query(sql.text, sql.values);
    return result.rows[0] ?? null;
  },
};
