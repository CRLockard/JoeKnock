import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { reportsRepository as defaultRepository } from './reportsRepository.js';
import { resolveOrganizationDateRangeToUtc } from './reportDateRange.js';

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
      totalStatusActivityGroups: row.total_status_groups,
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

        const { utcStartInclusive, utcEndExclusive } =
          resolveOrganizationDateRangeToUtc({
            dateFrom,
            dateTo,
            timezone: settings.timezone,
          });

        const reportRow = await repository.getActivityReportRows(client, {
          organizationId,
          actorUserId,
          actorRole,
          repVisibility: settings.rep_visibility,
          userId,
          teamId,
          statusId,
          utcStartInclusive,
          utcEndExclusive,
        });

        return {
          reportRow,
          timezone: settings.timezone,
        };
      });

      return toReportResponse(
        result.reportRow ?? {
          total_knocks: 0,
          total_status_groups: 0,
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
