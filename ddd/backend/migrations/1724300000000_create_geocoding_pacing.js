export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE geocoding_pacing (
      singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
      available_at timestamptz NOT NULL
    );
    INSERT INTO geocoding_pacing (singleton, available_at)
    VALUES (true, '-infinity');
  `);
}

export function down(pgm) {
  pgm.dropTable('geocoding_pacing');
}
