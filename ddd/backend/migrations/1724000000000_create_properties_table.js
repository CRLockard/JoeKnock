export const shorthands = undefined;

export function up(pgm) {
  pgm.createTable('properties', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
    },
    address_line_1: {
      type: 'varchar(255)',
      notNull: true,
    },
    address_line_2: {
      type: 'varchar(255)',
      notNull: false,
    },
    city: {
      type: 'varchar(100)',
      notNull: true,
    },
    state: {
      type: 'varchar(100)',
      notNull: true,
    },
    postal_code: {
      type: 'varchar(20)',
      notNull: true,
    },
    country: {
      type: 'varchar(100)',
      notNull: true,
    },
    normalized_address: {
      type: 'text',
      notNull: true,
    },
    latitude: {
      type: 'numeric(9,6)',
      notNull: true,
    },
    longitude: {
      type: 'numeric(9,6)',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.sql(`
    ALTER TABLE properties
    ADD CONSTRAINT properties_id_organization_unique
    UNIQUE (id, organization_id);
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX properties_org_normalized_address_unique
    ON properties (organization_id, normalized_address);
  `);
}

export function down(pgm) {
  pgm.sql('DROP INDEX IF EXISTS properties_org_normalized_address_unique;');
  pgm.dropTable('properties');
}
