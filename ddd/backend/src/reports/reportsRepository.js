import { AUTHORIZED_KNOCKS_CTES } from './knockScopeSql.js';

const ORGANIZATION_SETTINGS_SQL = `
  SELECT rep_visibility, timezone
  FROM organization_settings
  WHERE organization_id = $1
  LIMIT 1
`;

const ACTIVITY_REPORT_SQL = `
  WITH ${AUTHORIZED_KNOCKS_CTES},
  property_counts AS (
    SELECT
      ak.user_id,
      ak.property_id,
      MIN(ak.address_line_1) AS address_line_1,
      MIN(ak.address_line_2) AS address_line_2,
      MIN(ak.city) AS city,
      MIN(ak.state) AS state,
      MIN(ak.postal_code) AS postal_code,
      COUNT(*)::int AS knocks
    FROM authorized_knocks ak
    GROUP BY ak.user_id, ak.property_id
  ),
  representative_counts AS (
    SELECT
      ak.user_id,
      MIN(ak.first_name) AS first_name,
      MIN(ak.last_name) AS last_name,
      MIN(ak.email) AS email,
      COUNT(*)::int AS knocks
    FROM authorized_knocks ak
    GROUP BY ak.user_id
  ),
  status_counts AS (
    SELECT
      ak.status_id,
      ak.status_name,
      COUNT(*)::int AS knocks
    FROM authorized_knocks ak
    GROUP BY ak.status_id, ak.status_name
  )
  SELECT
    COALESCE((SELECT SUM(rc.knocks) FROM representative_counts rc), 0)::int AS total_knocks,
    COALESCE(
      (
        SELECT json_agg(rep_row ORDER BY rep_row.knocks DESC, rep_row.last_name ASC, rep_row.first_name ASC, rep_row.user_id ASC)
        FROM (
          SELECT
            rc.user_id,
            rc.first_name,
            rc.last_name,
            rc.email,
            rc.knocks,
            (
              SELECT json_agg(prop_row ORDER BY prop_row.knocks DESC, prop_row.address_line_1 ASC, prop_row.property_id ASC)
              FROM (
                SELECT pc.property_id, pc.address_line_1, pc.address_line_2,
                       pc.city, pc.state, pc.postal_code, pc.knocks
                FROM property_counts pc
                WHERE pc.user_id = rc.user_id
              ) AS prop_row
            ) AS properties
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
      dateFrom,
      dateTo,
    },
  ) {
    const result = await client.query(ACTIVITY_REPORT_SQL, [
      organizationId,
      actorUserId,
      actorRole,
      repVisibility,
      userId ?? null,
      teamId ?? null,
      dateFrom,
      dateTo,
      statusId ?? null,
    ]);

    return result.rows[0] ?? null;
  },
};
