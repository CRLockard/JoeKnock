export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    ALTER TABLE statuses
    ADD CONSTRAINT statuses_id_organization_unique
    UNIQUE (id, organization_id);
  `);

  pgm.createTable('interactions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    interaction_group_id: {
      type: 'uuid',
      notNull: true,
    },
    property_id: {
      type: 'uuid',
      notNull: true,
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
    },
    status_id: {
      type: 'uuid',
      notNull: false,
    },
    status_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    initial_interaction_at: {
      type: 'timestamp',
      notNull: true,
    },
    changed_at: {
      type: 'timestamp',
      notNull: true,
    },
    changed_by: {
      type: 'uuid',
      notNull: true,
    },
    is_current: {
      type: 'boolean',
      notNull: true,
    },
    contact_name: {
      type: 'varchar(255)',
      notNull: false,
    },
    contact_phone: {
      type: 'varchar(50)',
      notNull: false,
    },
    contact_email: {
      type: 'varchar(255)',
      notNull: false,
    },
    notes: {
      type: 'text',
      notNull: false,
    },
    client_request_id: {
      type: 'uuid',
      notNull: false,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.sql(`
    ALTER TABLE interactions
    ADD CONSTRAINT interactions_property_org_fk
    FOREIGN KEY (property_id, organization_id)
    REFERENCES properties(id, organization_id);
  `);

  pgm.sql(`
    ALTER TABLE interactions
    ADD CONSTRAINT interactions_user_org_fk
    FOREIGN KEY (user_id, organization_id)
    REFERENCES users(id, organization_id);
  `);

  pgm.sql(`
    ALTER TABLE interactions
    ADD CONSTRAINT interactions_changed_by_org_fk
    FOREIGN KEY (changed_by, organization_id)
    REFERENCES users(id, organization_id);
  `);

  pgm.sql(`
    ALTER TABLE interactions
    ADD CONSTRAINT interactions_status_org_fk
    FOREIGN KEY (status_id, organization_id)
    REFERENCES statuses(id, organization_id);
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX interactions_current_group_unique
    ON interactions (interaction_group_id)
    WHERE is_current = true;
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX interactions_org_client_request_unique
    ON interactions (organization_id, client_request_id)
    WHERE client_request_id IS NOT NULL;
  `);

  pgm.sql(`
    CREATE INDEX interactions_org_current_property_idx
    ON interactions (organization_id, property_id)
    WHERE is_current = true;
  `);
}

export function down(pgm) {
  pgm.sql('DROP INDEX IF EXISTS interactions_org_current_property_idx;');
  pgm.sql('DROP INDEX IF EXISTS interactions_org_client_request_unique;');
  pgm.sql('DROP INDEX IF EXISTS interactions_current_group_unique;');
  pgm.dropTable('interactions');
  pgm.sql(`
    ALTER TABLE statuses
    DROP CONSTRAINT IF EXISTS statuses_id_organization_unique;
  `);
}
