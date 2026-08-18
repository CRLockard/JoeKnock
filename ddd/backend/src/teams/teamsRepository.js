const TEAM_INSERT_SQL = `
  INSERT INTO teams (organization_id, name)
  VALUES ($1, $2)
  RETURNING id, organization_id, name, created_at, updated_at
`;

const TEAMS_BY_ORGANIZATION_SQL = `
  SELECT id, organization_id, name, created_at, updated_at
  FROM teams
  WHERE organization_id = $1
  ORDER BY lower(name) ASC, created_at ASC, id ASC
`;

const TEAM_BY_ID_AND_ORGANIZATION_SQL = `
  SELECT id, organization_id, name, created_at, updated_at
  FROM teams
  WHERE id = $1 AND organization_id = $2
  LIMIT 1
`;

const USER_BY_ID_AND_ORGANIZATION_SQL = `
  SELECT id, organization_id
  FROM users
  WHERE id = $1 AND organization_id = $2
  LIMIT 1
`;

const TEAM_USER_INSERT_SQL = `
  INSERT INTO team_users (organization_id, team_id, user_id)
  VALUES ($1, $2, $3)
  RETURNING organization_id, team_id, user_id, created_at
`;

const TEAM_USER_DELETE_SQL = `
  DELETE FROM team_users
  WHERE organization_id = $1
    AND team_id = $2
    AND user_id = $3
  RETURNING organization_id, team_id, user_id, created_at
`;

const TEAM_MEMBERS_SQL = `
  SELECT
    u.id,
    u.organization_id,
    u.first_name,
    u.last_name,
    u.email,
    u.role,
    u.is_active
  FROM team_users tu
  INNER JOIN users u
    ON u.id = tu.user_id
   AND u.organization_id = tu.organization_id
  WHERE tu.team_id = $1
    AND tu.organization_id = $2
  ORDER BY lower(u.last_name) ASC, lower(u.first_name) ASC, lower(u.email) ASC
`;

export const teamsRepository = {
  async createTeam(client, { organizationId, name }) {
    const result = await client.query(TEAM_INSERT_SQL, [organizationId, name]);
    return result.rows[0] ?? null;
  },

  async listTeamsByOrganization(client, { organizationId }) {
    const result = await client.query(TEAMS_BY_ORGANIZATION_SQL, [
      organizationId,
    ]);
    return result.rows;
  },

  async findTeamByIdAndOrganization(client, { teamId, organizationId }) {
    const result = await client.query(TEAM_BY_ID_AND_ORGANIZATION_SQL, [
      teamId,
      organizationId,
    ]);

    return result.rows[0] ?? null;
  },

  async findUserByIdAndOrganization(client, { userId, organizationId }) {
    const result = await client.query(USER_BY_ID_AND_ORGANIZATION_SQL, [
      userId,
      organizationId,
    ]);

    return result.rows[0] ?? null;
  },

  async listTeamMembers(client, { teamId, organizationId }) {
    const result = await client.query(TEAM_MEMBERS_SQL, [
      teamId,
      organizationId,
    ]);
    return result.rows;
  },

  async addUserToTeam(client, { organizationId, teamId, userId }) {
    const result = await client.query(TEAM_USER_INSERT_SQL, [
      organizationId,
      teamId,
      userId,
    ]);

    return result.rows[0] ?? null;
  },

  async removeUserFromTeam(client, { organizationId, teamId, userId }) {
    const result = await client.query(TEAM_USER_DELETE_SQL, [
      organizationId,
      teamId,
      userId,
    ]);

    return result.rows[0] ?? null;
  },
};
