import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { reportsRepository as defaultRepository } from './reportsRepository.js';

const PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function parseDateOnly(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid date range.');
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function nextDate({ year, month, day }) {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function partsForInstant(instantMs, timeZone) {
  const parts = PARTS_FORMATTER.formatToParts(new Date(instantMs));
  const values = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  const formatted = `${values.year}-${values.month}-${values.day}`;
  const h = Number(values.hour);
  const m = Number(values.minute);
  const s = Number(values.second);

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    h,
    m,
    s,
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: h,
    minute: m,
    second: s,
    asUtc,
    formatted,
    timeZone,
  };
}

function zoneOffsetMs(instantMs, timeZone) {
  const zonedParts = partsForInstant(instantMs, timeZone);
  return zonedParts.asUtc - instantMs;
}

function zonedMidnightToUtc({ year, month, day }, timeZone) {
  const localUtcEquivalent = Date.UTC(year, month - 1, day, 0, 0, 0);
  const firstOffset = zoneOffsetMs(localUtcEquivalent, timeZone);
  let candidate = localUtcEquivalent - firstOffset;

  const secondOffset = zoneOffsetMs(candidate, timeZone);
  if (secondOffset !== firstOffset) {
    candidate = localUtcEquivalent - secondOffset;
  }

  const candidateDate = partsForInstant(candidate, timeZone).formatted;
  const wantedDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (candidateDate !== wantedDate) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Unable to resolve report date range for organization timezone.',
    );
  }

  return new Date(candidate).toISOString();
}

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

        const fromDate = parseDateOnly(dateFrom);
        const toDate = parseDateOnly(dateTo);
        const endExclusiveDate = nextDate(toDate);

        const utcStartInclusive = zonedMidnightToUtc(
          fromDate,
          settings.timezone,
        );
        const utcEndExclusive = zonedMidnightToUtc(
          endExclusiveDate,
          settings.timezone,
        );

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
