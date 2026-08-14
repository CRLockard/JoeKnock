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
};
