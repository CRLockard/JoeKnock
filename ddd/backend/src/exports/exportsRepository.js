import { AUTHORIZED_KNOCKS_CTES } from '../reports/knockScopeSql.js';

// One row per counted knock (one per history), listed with the latest saved
// details of that history. Qualification uses knock_date only.
const EXPORT_PROPERTIES_SQL = `
  WITH ${AUTHORIZED_KNOCKS_CTES}
  SELECT
    ak.current_id AS id,
    ak.interaction_group_id,
    ak.knock_date_text,
    ak.changed_at,
    ak.contact_name,
    ak.contact_phone,
    ak.status_name,
    ak.address_line_1,
    ak.address_line_2,
    ak.city,
    ak.state,
    ak.postal_code,
    ak.first_name,
    ak.last_name
  FROM authorized_knocks ak
  ORDER BY ak.knock_date DESC, ak.changed_at DESC, ak.current_id DESC
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
      dateFrom,
      dateTo,
    },
  ) {
    const result = await client.query(EXPORT_PROPERTIES_SQL, [
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

    return result.rows;
  },
};
