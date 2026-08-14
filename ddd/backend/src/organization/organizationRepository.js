const ORGANIZATION_BY_ID_SQL = `
  SELECT id, name, created_at, updated_at
  FROM organizations
  WHERE id = $1
  LIMIT 1
`;

const ORGANIZATION_UPDATE_SQL = `
  UPDATE organizations
  SET name = $2,
      updated_at = now()
  WHERE id = $1
  RETURNING id, name, created_at, updated_at
`;

export const organizationRepository = {
  async findOrganizationById(client, { organizationId }) {
    const result = await client.query(ORGANIZATION_BY_ID_SQL, [organizationId]);
    return result.rows[0] ?? null;
  },

  async updateOrganizationName(client, { organizationId, name }) {
    const result = await client.query(ORGANIZATION_UPDATE_SQL, [
      organizationId,
      name,
    ]);
    return result.rows[0] ?? null;
  },
};
