import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { exportsRepository as defaultRepository } from './exportsRepository.js';
import { reportsRepository } from '../reports/reportsRepository.js';
import {
  formatUtcDateForTimezone,
  resolveOrganizationDateRangeToUtc,
} from '../reports/reportDateRange.js';
import { serializeCsv } from './csv.js';

const CSV_HEADERS = [
  'address',
  'contactName',
  'phone',
  'currentStatus',
  'representative',
  'interactionDate',
];

function formatAddress(row) {
  const line1 = String(row.address_line_1 ?? '').trim();
  const line2 = String(row.address_line_2 ?? '').trim();
  const city = String(row.city ?? '').trim();
  const state = String(row.state ?? '').trim();
  const postalCode = String(row.postal_code ?? '').trim();

  const street = [line1, line2].filter(Boolean).join(' ');
  const cityStatePostal = [city, state, postalCode].filter(Boolean).join(' ');

  return [street, cityStatePostal].filter(Boolean).join(', ');
}

function formatRepresentative(row) {
  return [row.first_name, row.last_name]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

function toCsvRows(rows, timezone) {
  return rows.map((row) => [
    formatAddress(row),
    row.contact_name ?? '',
    row.contact_phone ?? '',
    row.status_name ?? '',
    formatRepresentative(row),
    formatUtcDateForTimezone(row.changed_at, timezone),
  ]);
}

function buildFilename() {
  const today = new Date().toISOString().slice(0, 10);
  return `activity-properties-${today}.csv`;
}

export function createExportsService({
  repository = defaultRepository,
  reportRepository = reportsRepository,
  runInTransaction = withTransaction,
} = {}) {
  return {
    async exportPropertiesCsv({
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
        const settings = await reportRepository.getOrganizationSettings(
          client,
          {
            organizationId,
          },
        );

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

        // Reuse reporting visibility semantics so exports cannot reveal rows
        // the actor could not see in the corresponding report view.
        const rows = await repository.getPropertyExportRows(client, {
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
          rows,
          timezone: settings.timezone,
        };
      });

      const csvRows = toCsvRows(result.rows, result.timezone);

      return {
        filename: buildFilename(),
        csv: serializeCsv({
          headers: CSV_HEADERS,
          rows: csvRows,
        }),
      };
    },
  };
}
