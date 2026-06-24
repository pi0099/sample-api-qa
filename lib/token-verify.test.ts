import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAuth0Config, isAuth0Issuer } from './auth0-config';
import {
  createAccessToken,
  parseAccessToken,
  parseSampleAccessToken,
} from './oauth';

const originalAuth0Domain = process.env.AUTH0_DOMAIN;
const originalAuth0Audience = process.env.AUTH0_AUDIENCE;
const originalAuth0AllowedClientIds = process.env.AUTH0_ALLOWED_CLIENT_IDS;

test.after(() => {
  if (originalAuth0Domain === undefined) {
    delete process.env.AUTH0_DOMAIN;
  } else {
    process.env.AUTH0_DOMAIN = originalAuth0Domain;
  }

  if (originalAuth0Audience === undefined) {
    delete process.env.AUTH0_AUDIENCE;
  } else {
    process.env.AUTH0_AUDIENCE = originalAuth0Audience;
  }

  if (originalAuth0AllowedClientIds === undefined) {
    delete process.env.AUTH0_ALLOWED_CLIENT_IDS;
  } else {
    process.env.AUTH0_ALLOWED_CLIENT_IDS = originalAuth0AllowedClientIds;
  }
});

test('parseSampleAccessToken accepts sample-api issued token', () => {
  const token = createAccessToken();
  const payload = parseSampleAccessToken(token);

  assert.ok(payload);
  assert.equal(payload.sub, 'test-m2m-client@clients');
});

test('parseAccessToken accepts sample-api issued token without Auth0 env', async () => {
  delete process.env.AUTH0_DOMAIN;
  delete process.env.AUTH0_AUDIENCE;
  delete process.env.AUTH0_ALLOWED_CLIENT_IDS;

  const token = createAccessToken();
  const payload = await parseAccessToken(token);

  assert.ok(payload);
  assert.equal(payload.azp, 'test-m2m-client');
});

test('getAuth0Config returns null when env is incomplete', () => {
  delete process.env.AUTH0_DOMAIN;
  delete process.env.AUTH0_AUDIENCE;
  delete process.env.AUTH0_ALLOWED_CLIENT_IDS;

  assert.equal(getAuth0Config(), null);
});

test('getAuth0Config parses allowed client ids', () => {
  process.env.AUTH0_DOMAIN = 'dev-tenant.us.auth0.com';
  process.env.AUTH0_AUDIENCE = 'https://dev-tenant.us.auth0.com/api/v2/';
  process.env.AUTH0_ALLOWED_CLIENT_IDS = 'client-a, client-b';

  const config = getAuth0Config();

  assert.ok(config);
  assert.equal(config.domain, 'dev-tenant.us.auth0.com');
  assert.equal(config.issuer, 'https://dev-tenant.us.auth0.com/');
  assert.deepEqual(config.allowedClientIds, ['client-a', 'client-b']);
});

test('isAuth0Issuer tolerates trailing slash differences', () => {
  const config = {
    domain: 'dev-tenant.us.auth0.com',
    issuer: 'https://dev-tenant.us.auth0.com/',
    audience: 'https://dev-tenant.us.auth0.com/api/v2/',
    allowedClientIds: ['client-a'],
  };

  assert.equal(isAuth0Issuer('https://dev-tenant.us.auth0.com', config), true);
  assert.equal(isAuth0Issuer('https://dev-tenant.us.auth0.com/', config), true);
});
