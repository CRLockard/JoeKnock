const ACTIVE_STATUSES_BY_ORGANIZATION_SQL = `
  SELECT id, organization_id, name, description, display_order, is_active, created_at, updated_at
  FROM statuses
  WHERE organization_id = $1
    AND is_active = true
  ORDER BY display_order ASC, lower(name) ASC, id ASC
`;

const STATUS_INSERT_SQL = `
  INSERT INTO statuses (organization_id, name, description, display_order, is_active)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id, organization_id, name, description, display_order, is_active, created_at, updated_at
`;

function buildStatusUpdateQuery({
  organizationId,
  statusId,
  name,
  description,
  displayOrder,
}) {
  const values = [organizationId, statusId];
  const setClauses = [];

  if (name !== undefined) {
    values.push(name);
    setClauses.push(`name = $${values.length}`);
  }

  if (description !== undefined) {
    values.push(description);
    setClauses.push(`description = $${values.length}`);
  }

  if (displayOrder !== undefined) {
    values.push(displayOrder);
    setClauses.push(`display_order = $${values.length}`);
  }

  return {
    text: `
      UPDATE statuses
      SET ${setClauses.join(', ')}, updated_at = now()
      WHERE organization_id = $1 AND id = $2
      RETURNING id, organization_id, name, description, display_order, is_active, created_at, updated_at
    `,
    values,
  };
}

function buildStatusActiveUpdateQuery({ organizationId, statusId, isActive }) {
  return {
    text: `
      UPDATE statuses
      SET is_active = $3, updated_at = now()
      WHERE organization_id = $1 AND id = $2
      RETURNING id, organization_id, name, description, display_order, is_active, created_at, updated_at
    `,
    values: [organizationId, statusId, isActive],
  };
}

export const statusesRepository = {
  async listActiveStatuses(client, { organizationId }) {
    const result = await client.query(ACTIVE_STATUSES_BY_ORGANIZATION_SQL, [
      organizationId,
    ]);
    return result.rows;
  },

  async createStatus(
    client,
    { organizationId, name, description, displayOrder, isActive },
  ) {
    const result = await client.query(STATUS_INSERT_SQL, [
      organizationId,
      name,
      description,
      displayOrder,
      isActive,
    ]);

    return result.rows[0] ?? null;
  },

  async updateStatus(
    client,
    { organizationId, statusId, name, description, displayOrder },
  ) {
    const sql = buildStatusUpdateQuery({
      organizationId,
      statusId,
      name,
      description,
      displayOrder,
    });

    const result = await client.query(sql.text, sql.values);
    return result.rows[0] ?? null;
  },

  async setStatusActive(client, { organizationId, statusId, isActive }) {
    const sql = buildStatusActiveUpdateQuery({
      organizationId,
      statusId,
      isActive,
    });

    const result = await client.query(sql.text, sql.values);
    return result.rows[0] ?? null;
  },
};
