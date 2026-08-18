const TEAM_INSERT_SQL = `
  INSERT INTO teams (organization_id, name)
  VALUES ($1, $2)
  RETURNING id, organization_id, name, created_at, updated_at
`;

export const teamsRepository = {
  async createTeam(client, { organizationId, name }) {
    const result = await client.query(TEAM_INSERT_SQL, [organizationId, name]);
    return result.rows[0] ?? null;
  },
};
