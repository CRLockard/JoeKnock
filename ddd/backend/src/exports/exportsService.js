import { AppError } from '../common/errors.js';
import { withTransaction } from '../db/transaction.js';
import { exportsRepository as defaultRepository } from './exportsRepository.js';
import { reportsRepository } from '../reports/reportsRepository.js';
import { assertCalendarDate } from '../reports/reportDateRange.js';
import { formatAddress } from '../reports/addressFormat.js';
import { serializeCsv } from './csv.js';

const CSV_HEADERS = [
  'address',
  'contactName',
  'phone',
  'currentStatus',
  'representative',
  'interactionDate',
];

function formatRepresentative(row) {
  return [row.first_name, row.last_name]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

function toCsvRows(rows) {
  return rows.map((row) => [
    formatAddress(row),
    row.contact_name ?? '',
    row.contact_phone ?? '',
    row.status_name ?? '',
    formatRepresentative(row),
    // Organization-local knock date frozen at submission.
    row.knock_date_text,
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

        assertCalendarDate(dateFrom);
        assertCalendarDate(dateTo);

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
          dateFrom,
          dateTo,
        });

        return { rows };
      });

      const csvRows = toCsvRows(result.rows);

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
