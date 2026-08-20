const PROPERTY_BY_ORG_AND_NORMALIZED_ADDRESS_SQL = `
  SELECT
    id,
    organization_id,
    latitude,
    longitude
  FROM properties
  WHERE organization_id = $1
    AND normalized_address = $2
  LIMIT 1
`;

const PROPERTY_INSERT_SQL = `
  INSERT INTO properties (
    organization_id,
    address_line_1,
    address_line_2,
    city,
    state,
    postal_code,
    country,
    normalized_address,
    latitude,
    longitude
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  RETURNING id, organization_id, latitude, longitude
`;

const PROPERTY_BY_ID_SQL = `
  SELECT
    id,
    organization_id,
    address_line_1,
    address_line_2,
    city,
    state,
    postal_code,
    country,
    latitude,
    longitude
  FROM properties
  WHERE organization_id = $1
    AND id = $2
  LIMIT 1
`;

const ORGANIZATION_VISIBILITY_SQL = `
  SELECT rep_visibility
  FROM organization_settings
  WHERE organization_id = $1
  LIMIT 1
`;

const CURRENT_VISIBLE_PROPERTY_INTERACTIONS_SQL = `
  WITH actor_teams AS (
    SELECT tu.team_id
    FROM team_users tu
    WHERE tu.organization_id = $1
      AND tu.user_id = $2
  )
  SELECT
    i.interaction_group_id,
    i.user_id,
    i.status_id,
    i.status_name,
    i.initial_interaction_at,
    i.changed_at,
    i.contact_name,
    i.contact_phone,
    i.contact_email,
    i.notes
  FROM interactions i
  WHERE i.organization_id = $1
    AND i.property_id = $3
    AND i.is_current = true
    AND (
      $4 = 'admin'
      OR $5 = 'organization'
      OR (
        $5 = 'own'
        AND (
          i.user_id = $2
          OR (
            $4 = 'manager'
            AND EXISTS (
              SELECT 1
              FROM team_users tu2
              INNER JOIN actor_teams at
                ON at.team_id = tu2.team_id
              WHERE tu2.organization_id = $1
                AND tu2.user_id = i.user_id
            )
          )
        )
      )
      OR (
        $5 = 'team'
        AND (
          i.user_id = $2
          OR EXISTS (
            SELECT 1
            FROM team_users tu2
            INNER JOIN actor_teams at
              ON at.team_id = tu2.team_id
            WHERE tu2.organization_id = $1
              AND tu2.user_id = i.user_id
          )
        )
      )
    )
  ORDER BY i.changed_at DESC, i.id DESC
`;

export const propertiesRepository = {
  async findByNormalizedAddress(client, { organizationId, normalizedAddress }) {
    const result = await client.query(
      PROPERTY_BY_ORG_AND_NORMALIZED_ADDRESS_SQL,
      [organizationId, normalizedAddress],
    );

    return result.rows[0] ?? null;
  },

  async createProperty(
    client,
    {
      organizationId,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      normalizedAddress,
      latitude,
      longitude,
    },
  ) {
    const result = await client.query(PROPERTY_INSERT_SQL, [
      organizationId,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      normalizedAddress,
      latitude,
      longitude,
    ]);

    return result.rows[0] ?? null;
  },

  async findById(client, { organizationId, propertyId }) {
    const result = await client.query(PROPERTY_BY_ID_SQL, [
      organizationId,
      propertyId,
    ]);

    return result.rows[0] ?? null;
  },

  async getRepVisibility(client, { organizationId }) {
    const result = await client.query(ORGANIZATION_VISIBILITY_SQL, [
      organizationId,
    ]);

    return result.rows[0]?.rep_visibility ?? null;
  },

  async listCurrentVisibleInteractions(
    client,
    { organizationId, userId, role, repVisibility, propertyId },
  ) {
    const result = await client.query(
      CURRENT_VISIBLE_PROPERTY_INTERACTIONS_SQL,
      [organizationId, userId, propertyId, role, repVisibility],
    );

    return result.rows;
  },
};
