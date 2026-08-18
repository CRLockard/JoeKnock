export const shorthands = undefined;

export function up(pgm) {
  pgm.sql(`
    ALTER TABLE teams
    ADD CONSTRAINT teams_id_organization_unique
    UNIQUE (id, organization_id);
  `);

  pgm.sql(`
    ALTER TABLE users
    ADD CONSTRAINT users_id_organization_unique
    UNIQUE (id, organization_id);
  `);

  pgm.createTable('team_users', {
    organization_id: {
      type: 'uuid',
      notNull: true,
    },
    team_id: {
      type: 'uuid',
      notNull: true,
    },
    user_id: {
      type: 'uuid',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.sql(`
    ALTER TABLE team_users
    ADD CONSTRAINT team_users_pk PRIMARY KEY (team_id, user_id);
  `);

  pgm.sql(`
    ALTER TABLE team_users
    ADD CONSTRAINT team_users_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id);
  `);

  pgm.sql(`
    ALTER TABLE team_users
    ADD CONSTRAINT team_users_team_org_fk
    FOREIGN KEY (team_id, organization_id)
    REFERENCES teams(id, organization_id);
  `);

  pgm.sql(`
    ALTER TABLE team_users
    ADD CONSTRAINT team_users_user_org_fk
    FOREIGN KEY (user_id, organization_id)
    REFERENCES users(id, organization_id);
  `);
}

export function down(pgm) {
  pgm.dropTable('team_users');
  pgm.sql(`
    ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_id_organization_unique;
  `);
  pgm.sql(`
    ALTER TABLE teams
    DROP CONSTRAINT IF EXISTS teams_id_organization_unique;
  `);
}
