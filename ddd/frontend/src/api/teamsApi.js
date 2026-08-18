import { apiFetch } from './client.js';

export function getTeams() {
  return apiFetch('/teams', {
    method: 'GET',
  });
}

export function getTeam(teamId) {
  return apiFetch(`/teams/${teamId}`, {
    method: 'GET',
  });
}

export function createTeam(payload) {
  return apiFetch('/teams', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addUserToTeam(teamId, payload) {
  return apiFetch(`/teams/${teamId}/users`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
