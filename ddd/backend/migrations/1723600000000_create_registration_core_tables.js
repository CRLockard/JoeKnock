export const shorthands = undefined;

export function up(pgm) {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  pgm.createTable('organizations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
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

  pgm.createTable('organization_settings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      unique: true,
    },
    rep_visibility: {
      type: 'varchar(50)',
      notNull: true,
      default: 'own',
    },
    timezone: {
      type: 'varchar(100)',
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

  pgm.addConstraint(
    'organization_settings',
    'organization_settings_rep_visibility_check',
    {
      check: "rep_visibility IN ('own', 'team', 'organization')",
    },
  );

  pgm.createTable('users', {
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
    email: {
      type: 'varchar(255)',
      notNull: true,
    },
    password_hash: {
      type: 'text',
      notNull: true,
    },
    first_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    last_name: {
      type: 'varchar(100)',
      notNull: true,
    },
    role: {
      type: 'varchar(50)',
      notNull: true,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  pgm.addConstraint('users', 'users_role_check', {
    check: "role IN ('admin', 'manager', 'rep')",
  });

  pgm.sql(
    'CREATE UNIQUE INDEX users_org_email_unique ON users (organization_id, lower(email));',
  );
}

export function down(pgm) {
  pgm.sql('DROP INDEX IF EXISTS users_org_email_unique;');
  pgm.dropTable('users');
  pgm.dropTable('organization_settings');
  pgm.dropTable('organizations');
}
