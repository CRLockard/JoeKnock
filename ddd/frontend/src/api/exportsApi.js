import { apiRequest } from './client.js';

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
  const { response } = await apiRequest(
    `/exports/properties?${buildQuery(filters)}`,
    { method: 'GET' },
  );

  return {
    blob: await response.blob(),
    filename: getFilenameFromDisposition(
      response.headers.get('content-disposition'),
    ),
  };
}
