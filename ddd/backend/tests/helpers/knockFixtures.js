import { query } from '../../src/db/client.js';

// Gives a hand-inserted snapshot the same knock fields the service writes: the
// first snapshot inserted into a history earns the knock; every snapshot
// carries the history's knock date in the organization's timezone.
// Pass knockDate / countsAsKnock to override.
export async function stampKnockFields(id, { knockDate, countsAsKnock } = {}) {
  await query(
    `UPDATE interactions i
        SET knock_timezone = s.timezone,
            knock_date = COALESCE($2::date,
              (i.initial_interaction_at AT TIME ZONE 'UTC' AT TIME ZONE s.timezone)::date),
            initial_interaction_at_utc = i.initial_interaction_at AT TIME ZONE 'UTC',
            changed_at_utc = i.changed_at AT TIME ZONE 'UTC',
            counts_as_daily_knock = COALESCE($3::boolean, NOT EXISTS (
              SELECT 1 FROM interactions o
              WHERE o.interaction_group_id = i.interaction_group_id AND o.id <> i.id))
       FROM organization_settings s
      WHERE i.id = $1 AND s.organization_id = i.organization_id`,
    [id, knockDate ?? null, countsAsKnock ?? null],
  );
}
