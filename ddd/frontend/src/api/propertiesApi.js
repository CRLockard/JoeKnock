import { apiFetch } from './client.js';

export function resolvePropertyLocation({ latitude, longitude }) {
  return apiFetch('/properties/resolve', {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude }),
  });
}
