import { AppError } from '../common/errors.js';

const formatterCache = new Map();

function getPartsFormatter(timeZone) {
  const cacheKey = String(timeZone);

  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(
      cacheKey,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }

  return formatterCache.get(cacheKey);
}

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
  const parts = getPartsFormatter(timeZone).formatToParts(new Date(instantMs));
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
  // Convert a local calendar midnight in the organization timezone into the
  // exact UTC instant used for SQL range predicates.
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

/**
 * Converts inclusive organization-local report dates into UTC boundaries.
 *
 * Stored timestamps are UTC, but report filters are calendar dates in the
 * organization's configured timezone. Queries use a half-open interval:
 * [utcStartInclusive, utcEndExclusive).
 */
export function resolveOrganizationDateRangeToUtc({
  dateFrom,
  dateTo,
  timezone,
}) {
  const fromDate = parseDateOnly(dateFrom);
  const toDate = parseDateOnly(dateTo);
  const endExclusiveDate = nextDate(toDate);

  return {
    utcStartInclusive: zonedMidnightToUtc(fromDate, timezone),
    utcEndExclusive: zonedMidnightToUtc(endExclusiveDate, timezone),
  };
}

export function formatUtcDateForTimezone(value, timezone) {
  if (!value) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(value));

  const values = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}
