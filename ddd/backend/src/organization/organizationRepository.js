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

const ORGANIZATION_SETTINGS_BY_ORG_SQL = `
  SELECT id, organization_id, rep_visibility, timezone, created_at, updated_at
  FROM organization_settings
  WHERE organization_id = $1
  LIMIT 1
`;

function buildOrganizationSettingsUpdateQuery({
  organizationId,
  repVisibility,
  timezone,
}) {
  const values = [organizationId];
  const setClauses = [];

  if (repVisibility !== undefined) {
    values.push(repVisibility);
    setClauses.push(`rep_visibility = $${values.length}`);
  }

  if (timezone !== undefined) {
    values.push(timezone);
    setClauses.push(`timezone = $${values.length}`);
  }

  return {
    text: `
      UPDATE organization_settings
      SET ${setClauses.join(', ')}, updated_at = now()
      WHERE organization_id = $1
      RETURNING id, organization_id, rep_visibility, timezone, created_at, updated_at
    `,
    values,
  };
}

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

  async findOrganizationSettingsByOrganizationId(client, { organizationId }) {
    const result = await client.query(ORGANIZATION_SETTINGS_BY_ORG_SQL, [
      organizationId,
    ]);

    return result.rows[0] ?? null;
  },

  async updateOrganizationSettings(
    client,
    { organizationId, repVisibility, timezone },
  ) {
    const sql = buildOrganizationSettingsUpdateQuery({
      organizationId,
      repVisibility,
      timezone,
    });

    const result = await client.query(sql.text, sql.values);
    return result.rows[0] ?? null;
  },
};
