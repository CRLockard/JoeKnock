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
};
