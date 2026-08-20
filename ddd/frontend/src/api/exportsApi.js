import { loadSession } from '../auth/authStorage.js';
import { config } from '../config/env.js';

function buildQuery(filters) {
  const params = new URLSearchParams();

  params.set('dateFrom', filters.dateFrom);
  params.set('dateTo', filters.dateTo);

  if (filters.userId) {
    params.set('userId', filters.userId);
  }

  if (filters.teamId) {
    params.set('teamId', filters.teamId);
  }

  if (filters.statusId) {
    params.set('statusId', filters.statusId);
  }

  return params.toString();
}

function getFilenameFromDisposition(value) {
  if (!value) {
    return 'activity-properties.csv';
  }

  const match = String(value).match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? 'activity-properties.csv';
}

export async function exportPropertiesCsv(filters) {
  const session = loadSession();
  const headers = new Headers();

  if (session?.token) {
    headers.set('Authorization', `Bearer ${session.token}`);
  }

  const response = await fetch(
    `${config.apiBaseUrl}/exports/properties?${buildQuery(filters)}`,
    {
      method: 'GET',
      headers,
    },
  );

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    let message = 'Export failed.';
    let details;

    if (contentType.includes('application/json')) {
      const body = await response.json();
      message = body?.error?.message ?? message;
      details = body?.error?.details;
    }

    const error = new Error(message);
    error.status = response.status;
    error.details = details;
    throw error;
  }

  return {
    blob: await response.blob(),
    filename: getFilenameFromDisposition(
      response.headers.get('content-disposition'),
    ),
  };
}
