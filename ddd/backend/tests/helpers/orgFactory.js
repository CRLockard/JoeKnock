import { randomUUID } from 'node:crypto';

export function createOrganizationFixture(label) {
  return {
    id: randomUUID(),
    name: `org-${label}`,
  };
}
