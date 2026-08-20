import { apiFetch } from './client.js';

export function getActivityReport(filters) {
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

  return apiFetch(`/reports/activity?${params.toString()}`, {
    method: 'GET',
  });
}
