const ORGANIZATION_VISIBILITY_SQL = `
  SELECT rep_visibility
  FROM organization_settings
  WHERE organization_id = $1
  LIMIT 1
`;

const VISIBLE_PROPERTY_MARKERS_SQL = `
  WITH actor_teams AS (
    SELECT tu.team_id
    FROM team_users tu
    WHERE tu.organization_id = $1
      AND tu.user_id = $2
  ),
  visible_current_interactions AS (
    SELECT i.property_id
    FROM interactions i
    INNER JOIN properties p
      ON p.id = i.property_id
     AND p.organization_id = i.organization_id
    WHERE i.organization_id = $1
      AND i.is_current = true
      AND p.latitude BETWEEN $3 AND $4
      AND p.longitude BETWEEN $5 AND $6
      AND (
        $7 = 'admin'
        OR $8 = 'organization'
        OR (
          $8 = 'own'
          AND (
            i.user_id = $2
            OR (
              $7 = 'manager'
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
          $8 = 'team'
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
  )
  SELECT DISTINCT
    p.id AS property_id,
    p.latitude,
    p.longitude
  FROM properties p
  INNER JOIN visible_current_interactions vci
    ON vci.property_id = p.id
  WHERE p.organization_id = $1
  ORDER BY p.id ASC
`;

export const mapRepository = {
  async getRepVisibility(client, { organizationId }) {
    const result = await client.query(ORGANIZATION_VISIBILITY_SQL, [
      organizationId,
    ]);

    return result.rows[0]?.rep_visibility ?? null;
  },

  async listVisiblePropertyMarkers(
    client,
    { organizationId, userId, role, repVisibility, north, south, east, west },
  ) {
    const result = await client.query(VISIBLE_PROPERTY_MARKERS_SQL, [
      organizationId,
      userId,
      south,
      north,
      west,
      east,
      role,
      repVisibility,
    ]);

    return result.rows;
  },
};
