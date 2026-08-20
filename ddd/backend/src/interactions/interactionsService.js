import { randomUUID } from 'node:crypto';
import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { interactionsRepository as defaultRepository } from './interactionsRepository.js';

function isUniqueViolation(error) {
  return error && error.code === '23505';
}

function toIsoTimestamp(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : String(value);
}

function toInteractionSnapshotResponse(row) {
  return {
    interactionId: row.id,
    interactionGroupId: row.interaction_group_id,
    propertyId: row.property_id,
    userId: row.user_id,
    statusId: row.status_id,
    statusName: row.status_name,
    initialInteractionAt: toIsoTimestamp(row.initial_interaction_at),
    changedAt: toIsoTimestamp(row.changed_at),
    changedBy: row.changed_by,
    isCurrent: row.is_current,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    notes: row.notes,
    representative: {
      firstName: row.owner_first_name,
      lastName: row.owner_last_name,
      email: row.owner_email,
    },
  };
}

function normalizeNullableText(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length === 0 ? null : normalized;
}

function isEditAllowed({ actorRole, actorUserId, ownerUserId, sharesTeam }) {
  if (actorRole === 'admin') {
    return true;
  }

  if (actorRole === 'rep') {
    return actorUserId === ownerUserId;
  }

  if (actorRole === 'manager') {
    return actorUserId === ownerUserId || sharesTeam;
  }

  return false;
}

export function createInteractionsService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
} = {}) {
  return {
    async createInteractionForProperty({
      organizationId,
      userId,
      propertyId,
      statusId,
      contactName,
      contactPhone,
      contactEmail,
      notes,
      clientRequestId,
    }) {
      const normalizedPayload = {
        contactName: normalizeNullableText(contactName),
        contactPhone: normalizeNullableText(contactPhone),
        contactEmail: normalizeNullableText(contactEmail),
        notes: normalizeNullableText(notes),
        clientRequestId: clientRequestId ?? null,
      };

      try {
        const snapshot = await runInTransaction(async (client) => {
          const property = await repository.findPropertyById(client, {
            organizationId,
            propertyId,
          });

          if (!property) {
            throw new AppError(
              404,
              'RESOURCE_NOT_FOUND',
              'Property not found.',
            );
          }

          const status = await repository.findActiveStatusById(client, {
            organizationId,
            statusId,
          });

          if (!status) {
            throw new AppError(
              400,
              'VALIDATION_ERROR',
              'statusId must reference an active status in this organization.',
            );
          }

          if (normalizedPayload.clientRequestId) {
            const existingByRequestId =
              await repository.findSnapshotByClientRequestId(client, {
                organizationId,
                clientRequestId: normalizedPayload.clientRequestId,
              });

            if (existingByRequestId) {
              if (
                existingByRequestId.user_id === userId &&
                existingByRequestId.property_id === propertyId
              ) {
                return existingByRequestId;
              }

              throw new AppError(
                409,
                'CONFLICT',
                'clientRequestId is already in use for a different interaction request.',
              );
            }
          }

          const existingGroup =
            await repository.findExistingGroupForUserProperty(client, {
              organizationId,
              userId,
              propertyId,
            });

          if (existingGroup) {
            throw new AppError(
              409,
              'CONFLICT',
              'An interaction already exists for this representative and property. Use POST /api/interactions/:id to revise it.',
            );
          }

          const interactionGroupId = randomUUID();
          const created = await repository.createSnapshot(client, {
            interactionGroupId,
            propertyId,
            organizationId,
            ownerUserId: userId,
            statusId: status.id,
            statusName: status.name,
            initialInteractionAt: new Date().toISOString(),
            changedBy: userId,
            contactName: normalizedPayload.contactName,
            contactPhone: normalizedPayload.contactPhone,
            contactEmail: normalizedPayload.contactEmail,
            notes: normalizedPayload.notes,
            clientRequestId: normalizedPayload.clientRequestId,
          });

          return repository.findSnapshotById(client, {
            organizationId,
            interactionId: created.id,
          });
        });

        return toInteractionSnapshotResponse(snapshot);
      } catch (error) {
        if (!isUniqueViolation(error) || !normalizedPayload.clientRequestId) {
          throw error;
        }

        const existing = await runInTransaction(async (client) => {
          return repository.findSnapshotByClientRequestId(client, {
            organizationId,
            clientRequestId: normalizedPayload.clientRequestId,
          });
        });

        if (
          !existing ||
          existing.user_id !== userId ||
          existing.property_id !== propertyId
        ) {
          throw new AppError(
            409,
            'CONFLICT',
            'clientRequestId is already in use for a different interaction request.',
          );
        }

        return toInteractionSnapshotResponse(existing);
      }
    },

    async getInteractionSnapshotById({
      organizationId,
      userId,
      role,
      interactionId,
    }) {
      const snapshot = await runInTransaction(async (client) => {
        const repVisibility = await repository.getRepVisibility(client, {
          organizationId,
        });

        if (!repVisibility) {
          throw new AppError(
            404,
            'RESOURCE_NOT_FOUND',
            'Organization settings not found.',
          );
        }

        const requestedSnapshot = await repository.findVisibleSnapshotById(client, {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          repVisibility,
          interactionId,
        });

        if (!requestedSnapshot) {
          return null;
        }

        if (requestedSnapshot.is_current) {
          return requestedSnapshot;
        }

        return repository.findVisibleCurrentSnapshotByGroup(client, {
          organizationId,
          actorUserId: userId,
          actorRole: role,
          repVisibility,
          interactionGroupId: requestedSnapshot.interaction_group_id,
        });
      });

      if (!snapshot) {
        throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Interaction not found.');
      }

      return toInteractionSnapshotResponse(snapshot);
    },

    async reviseInteraction({
      organizationId,
      userId,
      role,
      interactionId,
      statusId,
      contactName,
      contactPhone,
      contactEmail,
      notes,
    }) {
      const normalizedPatch = {
        statusId,
        contactName: normalizeNullableText(contactName),
        contactPhone: normalizeNullableText(contactPhone),
        contactEmail: normalizeNullableText(contactEmail),
        notes: normalizeNullableText(notes),
      };

      const revised = await runInTransaction(async (client) => {
        const baseSnapshot = await repository.findSnapshotById(client, {
          organizationId,
          interactionId,
        });

        if (!baseSnapshot) {
          throw new AppError(
            404,
            'RESOURCE_NOT_FOUND',
            'Interaction not found.',
          );
        }

        const sharesTeam = await repository.hasSharedTeamMembership(client, {
          organizationId,
          actorUserId: userId,
          ownerUserId: baseSnapshot.user_id,
        });

        if (
          !isEditAllowed({
            actorRole: role,
            actorUserId: userId,
            ownerUserId: baseSnapshot.user_id,
            sharesTeam,
          })
        ) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'You do not have permission to perform this action.',
          );
        }

        const currentSnapshot = await repository.findCurrentSnapshotByGroup(
          client,
          {
            organizationId,
            interactionGroupId: baseSnapshot.interaction_group_id,
          },
        );

        if (!currentSnapshot) {
          throw new AppError(
            409,
            'CONFLICT',
            'Current interaction snapshot could not be resolved.',
          );
        }

        let nextStatusId = currentSnapshot.status_id;
        let nextStatusName = currentSnapshot.status_name;

        if (normalizedPatch.statusId !== undefined) {
          const activeStatus = await repository.findActiveStatusById(client, {
            organizationId,
            statusId: normalizedPatch.statusId,
          });

          if (!activeStatus) {
            throw new AppError(
              400,
              'VALIDATION_ERROR',
              'statusId must reference an active status in this organization.',
            );
          }

          nextStatusId = activeStatus.id;
          nextStatusName = activeStatus.name;
        }

        await repository.clearCurrentForGroup(client, {
          organizationId,
          interactionGroupId: currentSnapshot.interaction_group_id,
        });

        const finalCurrent = await repository.createSnapshot(client, {
          interactionGroupId: currentSnapshot.interaction_group_id,
          propertyId: currentSnapshot.property_id,
          organizationId,
          ownerUserId: currentSnapshot.user_id,
          statusId: nextStatusId,
          statusName: nextStatusName,
          initialInteractionAt: currentSnapshot.initial_interaction_at,
          changedBy: userId,
          contactName:
            normalizedPatch.contactName !== undefined
              ? normalizedPatch.contactName
              : currentSnapshot.contact_name,
          contactPhone:
            normalizedPatch.contactPhone !== undefined
              ? normalizedPatch.contactPhone
              : currentSnapshot.contact_phone,
          contactEmail:
            normalizedPatch.contactEmail !== undefined
              ? normalizedPatch.contactEmail
              : currentSnapshot.contact_email,
          notes:
            normalizedPatch.notes !== undefined
              ? normalizedPatch.notes
              : currentSnapshot.notes,
          clientRequestId: null,
        });

        const finalSnapshot = await repository.findSnapshotById(client, {
          organizationId,
          interactionId: finalCurrent.id,
        });

        return finalSnapshot;
      });

      return toInteractionSnapshotResponse(revised);
    },
  };
}
