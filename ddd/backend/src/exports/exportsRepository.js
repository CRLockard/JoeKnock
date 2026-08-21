const EXPORT_PROPERTIES_SQL = `
  WITH actor_teams AS (
    SELECT tu.team_id
    FROM team_users tu
    WHERE tu.organization_id = $1
      AND tu.user_id = $2
  ),
  authorized_interactions AS (
    -- Apply organization + role + rep_visibility filter before any export
    -- shaping so CSV cannot bypass visibility controls.
    SELECT i.*
    FROM interactions i
    WHERE i.organization_id = $1
      AND (
        $3 = 'admin'
        OR $4 = 'organization'
        OR (
          $4 = 'own'
          AND (
            i.user_id = $2
            OR (
              $3 = 'manager'
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
          $4 = 'team'
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
      AND ($5::uuid IS NULL OR i.user_id = $5::uuid)
      AND (
        $6::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM team_users filter_team
          WHERE filter_team.organization_id = $1
            AND filter_team.team_id = $6::uuid
            AND filter_team.user_id = i.user_id
        )
      )
  ),
  knock_group_latest AS (
    SELECT DISTINCT ON (i.interaction_group_id)
      i.id,
      i.interaction_group_id,
      i.property_id,
      i.user_id,
      i.status_id,
      i.status_name,
      i.changed_at,
      i.contact_name,
      i.contact_phone,
      i.initial_interaction_at
    FROM authorized_interactions i
    WHERE i.initial_interaction_at >= $7::timestamp
      AND i.initial_interaction_at < $8::timestamp
    ORDER BY i.interaction_group_id, i.changed_at DESC, i.id DESC
  ),
  filtered_knock_groups AS (
    SELECT *
    FROM knock_group_latest
    WHERE ($9::uuid IS NULL OR status_id = $9::uuid)
  )
  SELECT
    fkg.id,
    fkg.interaction_group_id,
    fkg.initial_interaction_at,
    fkg.changed_at,
    fkg.contact_name,
    fkg.contact_phone,
    fkg.status_name,
    p.address_line_1,
    p.address_line_2,
    p.city,
    p.state,
    p.postal_code,
    u.first_name,
    u.last_name
  FROM filtered_knock_groups fkg
  INNER JOIN properties p
    ON p.id = fkg.property_id
   AND p.organization_id = $1
  INNER JOIN users u
    ON u.id = fkg.user_id
   AND u.organization_id = $1
  ORDER BY fkg.changed_at DESC, fkg.id DESC
`;

export const exportsRepository = {
  async getPropertyExportRows(
    client,
    {
      organizationId,
      actorUserId,
      actorRole,
      repVisibility,
      userId,
      teamId,
      statusId,
      utcStartInclusive,
      utcEndExclusive,
    },
  ) {
    const result = await client.query(EXPORT_PROPERTIES_SQL, [
      organizationId,
      actorUserId,
      actorRole,
      repVisibility,
      userId ?? null,
      teamId ?? null,
      utcStartInclusive,
      utcEndExclusive,
      statusId ?? null,
    ]);

    return result.rows;
  },
};
