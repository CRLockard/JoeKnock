import request from 'supertest';
import { signAccessToken } from '../../src/auth/jwt.js';
import { createOrganizationFixture } from './orgFactory.js';
import { createUserFixture } from './userFactory.js';

export function createOrgAuthFixtures() {
  const organizationA = createOrganizationFixture('a');
  const organizationB = createOrganizationFixture('b');

  const userA = createUserFixture({
    organizationId: organizationA.id,
    role: 'rep',
    label: 'user-a',
  });

  const userB = createUserFixture({
    organizationId: organizationB.id,
    role: 'rep',
    label: 'user-b',
  });

  const tokenA = signAccessToken({
    userId: userA.id,
    organizationId: organizationA.id,
    role: userA.role,
  });

  const tokenB = signAccessToken({
    userId: userB.id,
    organizationId: organizationB.id,
    role: userB.role,
  });

  return {
    organizationA,
    organizationB,
    userA,
    userB,
    tokenA,
    tokenB,
  };
}

export function authenticatedGet(app, token, path) {
  return request(app).get(path).set('Authorization', `Bearer ${token}`);
}
