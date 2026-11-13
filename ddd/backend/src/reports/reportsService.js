import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { reportsRepository as defaultRepository } from './reportsRepository.js';
import { assertCalendarDate } from './reportDateRange.js';
import { formatAddress } from './addressFormat.js';

function toReportResponse(
  row,
  { dateFrom, dateTo, timezone, userId, teamId, statusId },
) {
  return {
    dateRange: {
      dateFrom,
      dateTo,
      timezone,
    },
    appliedFilters: {
      userId: userId ?? null,
      teamId: teamId ?? null,
      statusId: statusId ?? null,
    },
    summary: {
      totalKnocks: row.total_knocks,
      // Kept for API compatibility; status counts now cover the same knocks.
      totalStatusActivityGroups: row.total_knocks,
    },
    byStatus: Array.isArray(row.by_status)
      ? row.by_status.map((item) => ({
          statusId: item.status_id,
          statusName: item.status_name,
          knocks: item.knocks,
        }))
      : [],
    byRepresentative: Array.isArray(row.by_representative)
      ? row.by_representative.map((item) => ({
          userId: item.user_id,
          firstName: item.first_name,
          lastName: item.last_name,
          email: item.email,
          knocks: item.knocks,
          properties: (item.properties ?? []).map((property) => ({
            propertyId: property.property_id,
            address: formatAddress(property),
            knocks: property.knocks,
          })),
        }))
      : [],
  };
}

export function createReportsService({
  repository = defaultRepository,
  runInTransaction = withTransaction,
} = {}) {
  return {
    async getActivityReport({
      organizationId,
      actorUserId,
      actorRole,
      dateFrom,
      dateTo,
      userId,
      teamId,
      statusId,
    }) {
      const result = await runInTransaction(async (client) => {
        const settings = await repository.getOrganizationSettings(client, {
          organizationId,
        });

        if (!settings?.timezone || !settings?.rep_visibility) {
          throw new AppError(
            404,
            'RESOURCE_NOT_FOUND',
            'Organization settings not found.',
          );
        }

        // dateFrom/dateTo are organization-local calendar dates compared with
        // the knock_date frozen at submission, so later timezone changes and
        // DST never move an existing knock.
        assertCalendarDate(dateFrom);
        assertCalendarDate(dateTo);

        // Repository enforces visibility + organization scoping using actor
        // role and rep_visibility in SQL predicates.
        const reportRow = await repository.getActivityReportRows(client, {
          organizationId,
          actorUserId,
          actorRole,
          repVisibility: settings.rep_visibility,
          userId,
          teamId,
          statusId,
          dateFrom,
          dateTo,
        });

        return {
          reportRow,
          timezone: settings.timezone,
        };
      });

      return toReportResponse(
        result.reportRow ?? {
          total_knocks: 0,
          by_status: [],
          by_representative: [],
        },
        {
          dateFrom,
          dateTo,
          timezone: result.timezone,
          userId,
          teamId,
          statusId,
        },
      );
    },
  };
}
