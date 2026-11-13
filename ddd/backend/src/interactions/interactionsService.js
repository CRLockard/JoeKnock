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
    ...(typeof row.can_edit === 'boolean' ? { canEdit: row.can_edit } : {}),
    interactionId: row.id,
    interactionGroupId: row.interaction_group_id,
    propertyId: row.property_id,
    userId: row.user_id,
    statusId: row.status_id,
    statusName: row.status_name,
    initialInteractionAt: toIsoTimestamp(
      row.initial_interaction_at_utc ?? row.initial_interaction_at,
    ),
    changedAt: toIsoTimestamp(row.changed_at_utc ?? row.changed_at),
    changedBy: row.changed_by,
    lastEditedBy:
      row.editor_first_name || row.editor_last_name
        ? {
            firstName: row.editor_first_name,
            lastName: row.editor_last_name,
          }
        : null,
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

function sameNullableText(left, right) {
  return (left ?? null) === (right ?? null);
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
  now = () => new Date(),
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
      sameDayReturn = false,
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

          await repository.lockRelationship(client, {
            organizationId,
            userId,
            propertyId,
          });

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

          const organizationTimezone =
            await repository.findValidOrganizationTimezone(client, {
              organizationId,
            });

          if (!organizationTimezone) {
            throw new AppError(
              422,
              'ORGANIZATION_TIMEZONE_INVALID',
              'This organization has no valid timezone configured. Ask an administrator to set one in Settings before recording visits.',
            );
          }

          const interactionGroupId = randomUUID();
          const submittedAt = now().toISOString();

          // A counted visit already exists for this organization-local day.
          const todaysVisitId = await repository.findVisitForLocalDay(client, {
            organizationId,
            userId,
            propertyId,
            instant: submittedAt,
            timezone: organizationTimezone,
          });

          if (todaysVisitId && !sameDayReturn) {
            throw new AppError(
              409,
              'SAME_DAY_VISIT_EXISTS',
              'You already logged a visit to this property today. Edit that visit, or save a same-day return to add details without another knock.',
            );
          }

          if (todaysVisitId) {
            // Same-day return: an additional snapshot on today's history that
            // copies its frozen timing and earns no knock.
            const todaysCurrent = await repository.findSnapshotById(client, {
              organizationId,
              interactionId: todaysVisitId.id,
            });

            await repository.clearCurrentForGroup(client, {
              organizationId,
              interactionGroupId: todaysCurrent.interaction_group_id,
            });

            const added = await repository.createSnapshot(client, {
              interactionGroupId: todaysCurrent.interaction_group_id,
              propertyId,
              organizationId,
              ownerUserId: userId,
              statusId: status.id,
              statusName: status.name,
              initialInteractionAt: todaysCurrent.initial_interaction_at,
              timingSourceSnapshotId: todaysCurrent.id,
              changedBy: userId,
              contactName: normalizedPayload.contactName,
              contactPhone: normalizedPayload.contactPhone,
              contactEmail: normalizedPayload.contactEmail,
              notes: normalizedPayload.notes,
              clientRequestId: normalizedPayload.clientRequestId,
            });

            return repository.findSnapshotById(client, {
              organizationId,
              interactionId: added.id,
            });
          }

          // First visit of the local day starts a new history and earns the knock.
          const created = await repository.createSnapshot(client, {
            interactionGroupId,
            propertyId,
            organizationId,
            ownerUserId: userId,
            statusId: status.id,
            statusName: status.name,
            initialInteractionAt: submittedAt,
            submittedAt,
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
        if (
          isUniqueViolation(error) &&
          error.constraint === 'interactions_daily_knock_unique'
        ) {
          throw new AppError(
            409,
            'SAME_DAY_VISIT_EXISTS',
            'You already logged a visit to this property today. Edit that visit, or save a same-day return to add details without another knock.',
          );
        }

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

        const requestedSnapshot = await repository.findVisibleSnapshotById(
          client,
          {
            organizationId,
            actorUserId: userId,
            actorRole: role,
            repVisibility,
            interactionId,
          },
        );

        if (!requestedSnapshot) {
          return null;
        }

        const current = requestedSnapshot.is_current
          ? requestedSnapshot
          : await repository.findVisibleCurrentSnapshotByGroup(client, {
              organizationId,
              actorUserId: userId,
              actorRole: role,
              repVisibility,
              interactionGroupId: requestedSnapshot.interaction_group_id,
            });
        if (!current) return null;
        const sharesTeam =
          role === 'manager' &&
          (await repository.hasSharedTeamMembership(client, {
            organizationId,
            actorUserId: userId,
            ownerUserId: current.user_id,
          }));
        return {
          ...current,
          can_edit: isEditAllowed({
            actorRole: role,
            actorUserId: userId,
            ownerUserId: current.user_id,
            sharesTeam,
          }),
        };
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

        // Lock the stable group identity, not the replaceable current row.
        // After waiting, READ COMMITTED sees the latest committed snapshot.
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
          [organizationId, baseSnapshot.interaction_group_id],
        );
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

        // The URL's snapshot ID is the version the editor actually loaded.
        // An old ID still resolves on GET, but may not overwrite a newer save.
        if (currentSnapshot.id !== interactionId) {
          throw new AppError(
            409,
            'CONFLICT',
            'This interaction was updated by someone else. Your draft is retained; reopen the property to review the latest version before saving.',
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

        const nextContactName =
          normalizedPatch.contactName !== undefined
            ? normalizedPatch.contactName
            : currentSnapshot.contact_name;
        const nextContactPhone =
          normalizedPatch.contactPhone !== undefined
            ? normalizedPatch.contactPhone
            : currentSnapshot.contact_phone;
        const nextContactEmail =
          normalizedPatch.contactEmail !== undefined
            ? normalizedPatch.contactEmail
            : currentSnapshot.contact_email;
        const nextNotes =
          normalizedPatch.notes !== undefined
            ? normalizedPatch.notes
            : currentSnapshot.notes;

        const isNoOpRevision =
          nextStatusId === currentSnapshot.status_id &&
          sameNullableText(nextContactName, currentSnapshot.contact_name) &&
          sameNullableText(nextContactPhone, currentSnapshot.contact_phone) &&
          sameNullableText(nextContactEmail, currentSnapshot.contact_email) &&
          sameNullableText(nextNotes, currentSnapshot.notes);

        if (isNoOpRevision) {
          return currentSnapshot;
        }

        await repository.clearCurrentForGroup(client, {
          organizationId,
          interactionGroupId: currentSnapshot.interaction_group_id,
        });

        // Revisions never mutate historical rows. A new snapshot is inserted
        // and marked current while prior current becomes non-current.
        const finalCurrent = await repository.createSnapshot(client, {
          interactionGroupId: currentSnapshot.interaction_group_id,
          propertyId: currentSnapshot.property_id,
          organizationId,
          ownerUserId: currentSnapshot.user_id,
          statusId: nextStatusId,
          statusName: nextStatusName,
          initialInteractionAt: currentSnapshot.initial_interaction_at,
          timingSourceSnapshotId: currentSnapshot.id,
          changedBy: userId,
          contactName: nextContactName,
          contactPhone: nextContactPhone,
          contactEmail: nextContactEmail,
          notes: nextNotes,
          clientRequestId: null,
        });

        const finalSnapshot = await repository.findSnapshotById(client, {
          organizationId,
          interactionId: finalCurrent.id,
        });

        return finalSnapshot;
      }).catch((error) => {
        if (
          isUniqueViolation(error) &&
          error.constraint === 'interactions_current_group_unique'
        ) {
          throw new AppError(
            409,
            'CONFLICT',
            'This interaction changed while saving. Review the latest version and try again.',
          );
        }
        throw error;
      });

      return toInteractionSnapshotResponse({ ...revised, can_edit: true });
    },
  };
}
