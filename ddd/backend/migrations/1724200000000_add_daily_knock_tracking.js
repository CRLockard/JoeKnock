// Corrected interaction timing and the daily knock count.
//
// Original columns (initial_interaction_at, changed_at, created_at) are kept
// untouched. New columns hold unambiguous instants (timestamptz) and the
// organization-local knock date frozen at submission time.
//
// There is deliberately no backfill: this schema targets clean installs. Rows
// written before this migration keep NULL in the new columns, are never
// counted, and do not appear in reports or exports. Reseed or recreate such a
// database instead of migrating it in place.

export const shorthands = undefined;

export function up(pgm) {
  pgm.addColumns('interactions', {
    initial_interaction_at_utc: { type: 'timestamptz', notNull: false },
    changed_at_utc: { type: 'timestamptz', notNull: false },
    knock_timezone: { type: 'varchar(64)', notNull: false },
    knock_date: { type: 'date', notNull: false },
    counts_as_daily_knock: { type: 'boolean', notNull: false },
  });

  pgm.addConstraint('interactions', 'interactions_daily_knock_needs_date', {
    check: 'counts_as_daily_knock IS NOT TRUE OR knock_date IS NOT NULL',
  });

  // At most one counted snapshot per organization, rep, property and local day.
  pgm.sql(`
    CREATE UNIQUE INDEX interactions_daily_knock_unique
    ON interactions (organization_id, user_id, property_id, knock_date)
    WHERE counts_as_daily_knock IS TRUE;
  `);

  // One row per counted knock.
  pgm.sql(`
    CREATE VIEW daily_knocks AS
    SELECT organization_id, user_id, property_id, knock_date,
           1::int AS knocks,
           interaction_group_id,
           id AS knock_interaction_id
    FROM interactions
    WHERE counts_as_daily_knock IS TRUE;
  `);
}

export function down(pgm) {
  pgm.sql('DROP VIEW IF EXISTS daily_knocks;');
  pgm.sql('DROP INDEX IF EXISTS interactions_daily_knock_unique;');
  pgm.dropConstraint('interactions', 'interactions_daily_knock_needs_date', {
    ifExists: true,
  });
  pgm.dropColumns('interactions', [
    'counts_as_daily_knock',
    'knock_date',
    'knock_timezone',
    'changed_at_utc',
    'initial_interaction_at_utc',
  ]);
}
