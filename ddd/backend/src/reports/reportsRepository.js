const ORGANIZATION_SETTINGS_SQL = `
  SELECT rep_visibility, timezone
  FROM organization_settings
  WHERE organization_id = $1
  LIMIT 1
`;

const ACTIVITY_REPORT_SQL = `
  WITH actor_teams AS (
    SELECT tu.team_id
    FROM team_users tu
    WHERE tu.organization_id = $1
      AND tu.user_id = $2
  ),
  authorized_interactions AS (
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
      i.interaction_group_id,
      i.user_id,
      i.status_id,
      i.status_name,
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
  ),
  status_group_latest AS (
    SELECT DISTINCT ON (i.interaction_group_id)
      i.interaction_group_id,
      i.user_id,
      i.status_id,
      i.status_name,
      i.changed_at
    FROM authorized_interactions i
    WHERE i.changed_at >= $7::timestamp
      AND i.changed_at < $8::timestamp
    ORDER BY i.interaction_group_id, i.changed_at DESC, i.id DESC
  ),
  filtered_status_groups AS (
    SELECT *
    FROM status_group_latest
    WHERE ($9::uuid IS NULL OR status_id = $9::uuid)
  ),
  representative_counts AS (
    SELECT
      fkg.user_id,
      u.first_name,
      u.last_name,
      u.email,
      COUNT(*)::int AS knocks
    FROM filtered_knock_groups fkg
    INNER JOIN users u
      ON u.id = fkg.user_id
     AND u.organization_id = $1
    GROUP BY fkg.user_id, u.first_name, u.last_name, u.email
  ),
  status_counts AS (
    SELECT
      fsg.status_id,
      fsg.status_name,
      COUNT(*)::int AS knocks
    FROM filtered_status_groups fsg
    GROUP BY fsg.status_id, fsg.status_name
  )
  SELECT
    (SELECT COUNT(*)::int FROM filtered_knock_groups) AS total_knocks,
    (SELECT COUNT(*)::int FROM filtered_status_groups) AS total_status_groups,
    COALESCE(
      (
        SELECT json_agg(rep_row ORDER BY rep_row.knocks DESC, rep_row.last_name ASC, rep_row.first_name ASC, rep_row.user_id ASC)
        FROM (
          SELECT
            rc.user_id,
            rc.first_name,
            rc.last_name,
            rc.email,
            rc.knocks
          FROM representative_counts rc
        ) AS rep_row
      ),
      '[]'::json
    ) AS by_representative,
    COALESCE(
      (
        SELECT json_agg(status_row ORDER BY status_row.knocks DESC, status_row.status_name ASC, status_row.status_id ASC)
        FROM (
          SELECT
            sc.status_id,
            sc.status_name,
            sc.knocks
          FROM status_counts sc
        ) AS status_row
      ),
      '[]'::json
    ) AS by_status
`;

export const reportsRepository = {
  async getOrganizationSettings(client, { organizationId }) {
    const result = await client.query(ORGANIZATION_SETTINGS_SQL, [
      organizationId,
    ]);
    return result.rows[0] ?? null;
  },

  async getActivityReportRows(
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
    const result = await client.query(ACTIVITY_REPORT_SQL, [
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

    return result.rows[0] ?? null;
  },
};
