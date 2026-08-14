import { randomUUID } from 'node:crypto';

export function createUserFixture({ organizationId, role, label }) {
  return {
    id: randomUUID(),
    organizationId,
    role,
    email: `${label}-${Date.now()}@example.test`,
  };
}
