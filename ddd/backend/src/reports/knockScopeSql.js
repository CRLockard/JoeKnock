// Single source of truth for "which knocks can this actor see, for these
// filters". Reports and exports both select from authorized_knocks so their
// totals cannot drift apart.
//
// Parameters: $1 organization, $2 actor user, $3 actor role, $4 rep visibility,
// $5 user filter, $6 team filter, $7 dateFrom, $8 dateTo (organization-local
// calendar dates compared to the stored knock_date), $9 status filter.
//
// Qualification uses daily_knocks (counted knock dates only). Details come from
// the group's current snapshot, so later edits change what is shown but never
// whether or when a knock was earned. The status filter and status breakdown
// use that current status.
export const AUTHORIZED_KNOCKS_CTES = `
  actor_teams AS (
    SELECT tu.team_id
    FROM team_users tu
    WHERE tu.organization_id = $1
      AND tu.user_id = $2
  ),
  authorized_knocks AS (
    SELECT
      dk.interaction_group_id,
      dk.knock_interaction_id,
      dk.user_id,
      dk.property_id,
      dk.knock_date,
      dk.knock_date::text AS knock_date_text,
      cur.id AS current_id,
      cur.status_id,
      cur.status_name,
      cur.changed_at,
      cur.contact_name,
      cur.contact_phone,
      u.first_name,
      u.last_name,
      u.email,
      p.address_line_1,
      p.address_line_2,
      p.city,
      p.state,
      p.postal_code
    FROM daily_knocks dk
    INNER JOIN interactions cur
      ON cur.interaction_group_id = dk.interaction_group_id
     AND cur.organization_id = dk.organization_id
     AND cur.is_current IS TRUE
    INNER JOIN users u
      ON u.id = dk.user_id
     AND u.organization_id = dk.organization_id
    INNER JOIN properties p
      ON p.id = dk.property_id
     AND p.organization_id = dk.organization_id
    WHERE dk.organization_id = $1
      AND dk.knock_date >= $7::date
      AND dk.knock_date <= $8::date
      AND (
        $3 = 'admin'
        OR $4 = 'organization'
        OR (
          $4 = 'own'
          AND (
            dk.user_id = $2
            OR (
              $3 = 'manager'
              AND EXISTS (
                SELECT 1
                FROM team_users tu2
                INNER JOIN actor_teams at
                  ON at.team_id = tu2.team_id
                WHERE tu2.organization_id = $1
                  AND tu2.user_id = dk.user_id
              )
            )
          )
        )
        OR (
          $4 = 'team'
          AND (
            dk.user_id = $2
            OR EXISTS (
              SELECT 1
              FROM team_users tu2
              INNER JOIN actor_teams at
                ON at.team_id = tu2.team_id
              WHERE tu2.organization_id = $1
                AND tu2.user_id = dk.user_id
            )
          )
        )
      )
      AND ($5::uuid IS NULL OR dk.user_id = $5::uuid)
      AND (
        $6::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM team_users filter_team
          WHERE filter_team.organization_id = $1
            AND filter_team.team_id = $6::uuid
            AND filter_team.user_id = dk.user_id
        )
      )
      AND ($9::uuid IS NULL OR cur.status_id = $9::uuid)
  )
`;
