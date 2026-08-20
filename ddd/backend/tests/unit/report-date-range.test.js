import { describe, expect, it } from 'vitest';
import { resolveOrganizationDateRangeToUtc } from '../../src/reports/reportDateRange.js';

describe('report date range timezone conversion', () => {
  it('produces different UTC boundaries for the same local date across timezones', () => {
    const utcBoundaries = resolveOrganizationDateRangeToUtc({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-01',
      timezone: 'UTC',
    });

    const newYorkBoundaries = resolveOrganizationDateRangeToUtc({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-01',
      timezone: 'America/New_York',
    });

    expect(utcBoundaries.utcStartInclusive).toBe('2026-08-01T00:00:00.000Z');
    expect(utcBoundaries.utcEndExclusive).toBe('2026-08-02T00:00:00.000Z');
    expect(newYorkBoundaries.utcStartInclusive).toBe(
      '2026-08-01T04:00:00.000Z',
    );
    expect(newYorkBoundaries.utcEndExclusive).toBe('2026-08-02T04:00:00.000Z');
    expect(utcBoundaries.utcStartInclusive).not.toBe(
      newYorkBoundaries.utcStartInclusive,
    );
  });

  it('keeps DST spring-forward boundary correctness', () => {
    const boundaries = resolveOrganizationDateRangeToUtc({
      dateFrom: '2026-03-08',
      dateTo: '2026-03-08',
      timezone: 'America/New_York',
    });

    expect(boundaries.utcStartInclusive).toBe('2026-03-08T05:00:00.000Z');
    expect(boundaries.utcEndExclusive).toBe('2026-03-09T04:00:00.000Z');

    const spanHours =
      (Date.parse(boundaries.utcEndExclusive) -
        Date.parse(boundaries.utcStartInclusive)) /
      (60 * 60 * 1000);

    expect(spanHours).toBe(23);
  });

  it('keeps DST fall-back boundary correctness', () => {
    const boundaries = resolveOrganizationDateRangeToUtc({
      dateFrom: '2026-11-01',
      dateTo: '2026-11-01',
      timezone: 'America/New_York',
    });

    expect(boundaries.utcStartInclusive).toBe('2026-11-01T04:00:00.000Z');
    expect(boundaries.utcEndExclusive).toBe('2026-11-02T05:00:00.000Z');

    const spanHours =
      (Date.parse(boundaries.utcEndExclusive) -
        Date.parse(boundaries.utcStartInclusive)) /
      (60 * 60 * 1000);

    expect(spanHours).toBe(25);
  });
});
