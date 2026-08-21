const PROPERTY_BY_ID_SQL = `
  SELECT id
  FROM properties
  WHERE organization_id = $1
    AND id = $2
  LIMIT 1
`;

const ACTIVE_STATUS_BY_ID_SQL = `
  SELECT id, name
  FROM statuses
  WHERE organization_id = $1
    AND id = $2
    AND is_active = true
  LIMIT 1
`;

const ORGANIZATION_VISIBILITY_SQL = `
  SELECT rep_visibility
  FROM organization_settings
  WHERE organization_id = $1
  LIMIT 1
`;

const SNAPSHOT_BY_ID_SQL = `
  SELECT
    i.id,
    i.interaction_group_id,
    i.property_id,
    i.organization_id,
    i.user_id,
    i.status_id,
    i.status_name,
    i.initial_interaction_at,
    i.changed_at,
    i.changed_by,
    i.is_current,
    i.contact_name,
    i.contact_phone,
    i.contact_email,
    i.notes,
    i.client_request_id,
    u.first_name AS owner_first_name,
    u.last_name AS owner_last_name,
    u.email AS owner_email
  FROM interactions i
  INNER JOIN users u
    ON u.id = i.user_id
   AND u.organization_id = i.organization_id
  WHERE i.organization_id = $1
    AND i.id = $2
  LIMIT 1
`;

const SNAPSHOT_BY_CLIENT_REQUEST_ID_SQL = `
  SELECT
    i.id,
    i.interaction_group_id,
    i.property_id,
    i.organization_id,
    i.user_id,
    i.status_id,
    i.status_name,
    i.initial_interaction_at,
    i.changed_at,
    i.changed_by,
    i.is_current,
    i.contact_name,
    i.contact_phone,
    i.contact_email,
    i.notes,
    i.client_request_id,
    u.first_name AS owner_first_name,
    u.last_name AS owner_last_name,
    u.email AS owner_email
  FROM interactions i
  INNER JOIN users u
    ON u.id = i.user_id
   AND u.organization_id = i.organization_id
  WHERE i.organization_id = $1
    AND i.client_request_id = $2
  LIMIT 1
`;

const CURRENT_SNAPSHOT_BY_GROUP_SQL = `
  SELECT
    i.id,
    i.interaction_group_id,
    i.property_id,
    i.organization_id,
    i.user_id,
    i.status_id,
    i.status_name,
    i.initial_interaction_at,
    i.changed_at,
    i.changed_by,
    i.is_current,
    i.contact_name,
    i.contact_phone,
    i.contact_email,
    i.notes,
    i.client_request_id,
    u.first_name AS owner_first_name,
    u.last_name AS owner_last_name,
    u.email AS owner_email
  FROM interactions i
  INNER JOIN users u
    ON u.id = i.user_id
   AND u.organization_id = i.organization_id
  WHERE i.organization_id = $1
    AND i.interaction_group_id = $2
    AND i.is_current = true
  ORDER BY i.changed_at DESC, i.id DESC
  LIMIT 1
`;

const EXISTING_GROUP_BY_USER_AND_PROPERTY_SQL = `
  SELECT
    i.interaction_group_id,
    i.id,
    i.changed_at
  FROM interactions i
  WHERE i.organization_id = $1
    AND i.user_id = $2
    AND i.property_id = $3
  ORDER BY i.changed_at DESC, i.id DESC
  LIMIT 1
`;

const ACTOR_TEAM_MEMBERSHIP_SQL = `
  SELECT 1
  FROM team_users actor_membership
  INNER JOIN team_users owner_membership
    ON owner_membership.organization_id = actor_membership.organization_id
   AND owner_membership.team_id = actor_membership.team_id
  WHERE actor_membership.organization_id = $1
    AND actor_membership.user_id = $2
    AND owner_membership.user_id = $3
  LIMIT 1
`;

const VISIBLE_SNAPSHOT_BY_ID_SQL = `
  WITH actor_teams AS (
    SELECT tu.team_id
    FROM team_users tu
    WHERE tu.organization_id = $1
      AND tu.user_id = $2
  )
  SELECT
    i.id,
    i.interaction_group_id,
    i.property_id,
    i.organization_id,
    i.user_id,
    i.status_id,
    i.status_name,
    i.initial_interaction_at,
    i.changed_at,
    i.changed_by,
    i.is_current,
    i.contact_name,
    i.contact_phone,
    i.contact_email,
    i.notes,
    i.client_request_id,
    u.first_name AS owner_first_name,
    u.last_name AS owner_last_name,
    u.email AS owner_email
  FROM interactions i
  INNER JOIN users u
    ON u.id = i.user_id
   AND u.organization_id = i.organization_id
  WHERE i.organization_id = $1
    AND i.id = $3
    AND (
      $4 = 'admin'
      OR $5 = 'organization'
      OR (
        $5 = 'own'
        AND (
          i.user_id = $2
          OR (
            $4 = 'manager'
            AND EXISTS (
              SELECT 1
              FROM team_users tu2
              INNER JOIN actor_teams at
                ON at.team_id = tu2.team_id
              WHERE tu2.organization_id = $1
                AND tu2.user_id = i.user_id
            )
          )
        )
      )
      OR (
        $5 = 'team'
        AND (
          i.user_id = $2
          OR EXISTS (
            SELECT 1
            FROM team_users tu2
            INNER JOIN actor_teams at
              ON at.team_id = tu2.team_id
            WHERE tu2.organization_id = $1
              AND tu2.user_id = i.user_id
          )
        )
      )
    )
  LIMIT 1
`;

const VISIBLE_CURRENT_SNAPSHOT_BY_GROUP_SQL = `
  WITH actor_teams AS (
    SELECT tu.team_id
    FROM team_users tu
    WHERE tu.organization_id = $1
      AND tu.user_id = $2
  )
  SELECT
    i.id,
    i.interaction_group_id,
    i.property_id,
    i.organization_id,
    i.user_id,
    i.status_id,
    i.status_name,
    i.initial_interaction_at,
    i.changed_at,
    i.changed_by,
    i.is_current,
    i.contact_name,
    i.contact_phone,
    i.contact_email,
    i.notes,
    i.client_request_id,
    u.first_name AS owner_first_name,
    u.last_name AS owner_last_name,
    u.email AS owner_email
  FROM interactions i
  INNER JOIN users u
    ON u.id = i.user_id
   AND u.organization_id = i.organization_id
  WHERE i.organization_id = $1
    AND i.interaction_group_id = $3
    AND i.is_current = true
    AND (
      $4 = 'admin'
      OR $5 = 'organization'
      OR (
        $5 = 'own'
        AND (
          i.user_id = $2
          OR (
            $4 = 'manager'
            AND EXISTS (
              SELECT 1
              FROM team_users tu2
              INNER JOIN actor_teams at
                ON at.team_id = tu2.team_id
              WHERE tu2.organization_id = $1
                AND tu2.user_id = i.user_id
            )
          )
        )
      )
      OR (
        $5 = 'team'
        AND (
          i.user_id = $2
          OR EXISTS (
            SELECT 1
            FROM team_users tu2
            INNER JOIN actor_teams at
              ON at.team_id = tu2.team_id
            WHERE tu2.organization_id = $1
              AND tu2.user_id = i.user_id
          )
        )
      )
    )
  ORDER BY i.changed_at DESC, i.id DESC
  LIMIT 1
`;

const INSERT_SNAPSHOT_SQL = `
  INSERT INTO interactions (
    interaction_group_id,
    property_id,
    organization_id,
    user_id,
    status_id,
    status_name,
    initial_interaction_at,
    changed_at,
    changed_by,
    is_current,
    contact_name,
    contact_phone,
    contact_email,
    notes,
    client_request_id
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    now(),
    $8,
    true,
    $9,
    $10,
    $11,
    $12,
    $13
  )
  RETURNING id
`;

const CLEAR_CURRENT_FOR_GROUP_SQL = `
  -- Maintain exactly one current snapshot pointer per interaction group.
  UPDATE interactions
  SET is_current = false
  WHERE organization_id = $1
    AND interaction_group_id = $2
    AND is_current = true
`;

export const interactionsRepository = {
  async findPropertyById(client, { organizationId, propertyId }) {
    const result = await client.query(PROPERTY_BY_ID_SQL, [
      organizationId,
      propertyId,
    ]);

    return result.rows[0] ?? null;
  },

  async findActiveStatusById(client, { organizationId, statusId }) {
    const result = await client.query(ACTIVE_STATUS_BY_ID_SQL, [
      organizationId,
      statusId,
    ]);

    return result.rows[0] ?? null;
  },

  async getRepVisibility(client, { organizationId }) {
    const result = await client.query(ORGANIZATION_VISIBILITY_SQL, [
      organizationId,
    ]);

    return result.rows[0]?.rep_visibility ?? null;
  },

  async findSnapshotById(client, { organizationId, interactionId }) {
    const result = await client.query(SNAPSHOT_BY_ID_SQL, [
      organizationId,
      interactionId,
    ]);

    return result.rows[0] ?? null;
  },

  async findSnapshotByClientRequestId(
    client,
    { organizationId, clientRequestId },
  ) {
    const result = await client.query(SNAPSHOT_BY_CLIENT_REQUEST_ID_SQL, [
      organizationId,
      clientRequestId,
    ]);

    return result.rows[0] ?? null;
  },

  async findCurrentSnapshotByGroup(
    client,
    { organizationId, interactionGroupId },
  ) {
    const result = await client.query(CURRENT_SNAPSHOT_BY_GROUP_SQL, [
      organizationId,
      interactionGroupId,
    ]);

    return result.rows[0] ?? null;
  },

  async findExistingGroupForUserProperty(
    client,
    { organizationId, userId, propertyId },
  ) {
    const result = await client.query(EXISTING_GROUP_BY_USER_AND_PROPERTY_SQL, [
      organizationId,
      userId,
      propertyId,
    ]);

    return result.rows[0] ?? null;
  },

  async hasSharedTeamMembership(
    client,
    { organizationId, actorUserId, ownerUserId },
  ) {
    const result = await client.query(ACTOR_TEAM_MEMBERSHIP_SQL, [
      organizationId,
      actorUserId,
      ownerUserId,
    ]);

    return Boolean(result.rows[0]);
  },

  async findVisibleSnapshotById(
    client,
    { organizationId, actorUserId, actorRole, repVisibility, interactionId },
  ) {
    const result = await client.query(VISIBLE_SNAPSHOT_BY_ID_SQL, [
      organizationId,
      actorUserId,
      interactionId,
      actorRole,
      repVisibility,
    ]);

    return result.rows[0] ?? null;
  },

  async findVisibleCurrentSnapshotByGroup(
    client,
    {
      organizationId,
      actorUserId,
      actorRole,
      repVisibility,
      interactionGroupId,
    },
  ) {
    const result = await client.query(VISIBLE_CURRENT_SNAPSHOT_BY_GROUP_SQL, [
      organizationId,
      actorUserId,
      interactionGroupId,
      actorRole,
      repVisibility,
    ]);

    return result.rows[0] ?? null;
  },

  async clearCurrentForGroup(client, { organizationId, interactionGroupId }) {
    await client.query(CLEAR_CURRENT_FOR_GROUP_SQL, [
      organizationId,
      interactionGroupId,
    ]);
  },

  async createSnapshot(
    client,
    {
      interactionGroupId,
      propertyId,
      organizationId,
      ownerUserId,
      statusId,
      statusName,
      initialInteractionAt,
      changedBy,
      contactName,
      contactPhone,
      contactEmail,
      notes,
      clientRequestId,
    },
  ) {
    const result = await client.query(INSERT_SNAPSHOT_SQL, [
      interactionGroupId,
      propertyId,
      organizationId,
      ownerUserId,
      statusId,
      statusName,
      initialInteractionAt,
      changedBy,
      contactName,
      contactPhone,
      contactEmail,
      notes,
      clientRequestId,
    ]);

    return result.rows[0] ?? null;
  },
};
