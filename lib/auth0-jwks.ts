import { createPublicKey, createVerify, type KeyObject } from 'crypto';
import {
  getAuth0Config,
  isAuth0Issuer,
  type Auth0Config,
} from '@/lib/auth0-config';
import {
  decodeJwtHeader,
  decodeJwtPayload,
  isExpectedAccessTokenLength,
  type AccessTokenPayload,
} from '@/lib/jwt';

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;

interface Auth0JwksKey {
  kid: string;
  kty: string;
  use?: string;
  n?: string;
  e?: string;
  alg?: string;
}

interface Auth0JwksResponse {
  keys: Auth0JwksKey[];
}

interface JwksCacheEntry {
  fetchedAt: number;
  keys: Auth0JwksKey[];
}

let jwksCache: JwksCacheEntry | null = null;

function audienceMatches(
  tokenAudience: string | string[] | undefined,
  expectedAudience: string,
): boolean {
  if (!tokenAudience) {
    return false;
  }

  if (typeof tokenAudience === 'string') {
    return tokenAudience === expectedAudience;
  }

  return tokenAudience.includes(expectedAudience);
}

function isAllowedAuth0Client(
  payload: AccessTokenPayload,
  allowedClientIds: string[],
): boolean {
  if (payload.azp && allowedClientIds.includes(payload.azp)) {
    return true;
  }

  if (!payload.sub) {
    return false;
  }

  return allowedClientIds.some(
    (clientId) =>
      payload.sub === clientId || payload.sub === `${clientId}@clients`,
  );
}

function jwkToPublicKey(jwk: Auth0JwksKey): KeyObject | null {
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    return null;
  }

  return createPublicKey({
    key: {
      kty: 'RSA',
      n: jwk.n,
      e: jwk.e,
    },
    format: 'jwk',
  });
}

async function fetchAuth0Jwks(domain: string): Promise<Auth0JwksKey[]> {
  const now = Date.now();

  if (jwksCache && now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys;
  }

  const response = await fetch(`https://${domain}/.well-known/jwks.json`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Auth0 JWKS fetch failed with status ${response.status}`);
  }

  const body = (await response.json()) as Auth0JwksResponse;
  const keys = Array.isArray(body.keys) ? body.keys : [];

  jwksCache = {
    fetchedAt: now,
    keys,
  };

  return keys;
}

function verifyJwtWithPublicKey(
  token: string,
  publicKey: KeyObject,
): AccessTokenPayload | null {
  const parts = token.trim().split('.');

  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const isValid = createVerify('RSA-SHA256')
    .update(signingInput)
    .verify(publicKey, Buffer.from(signature, 'base64url'));

  if (!isValid) {
    return null;
  }

  const payload = decodeJwtPayload(token);

  if (!payload) {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function isAuth0AccessTokenPayload(
  payload: AccessTokenPayload,
  config: Auth0Config,
): boolean {
  if (!isAuth0Issuer(payload.iss, config)) {
    return false;
  }

  if (!audienceMatches(payload.aud, config.audience)) {
    return false;
  }

  if (payload.gty !== 'client-credentials') {
    return false;
  }

  return isAllowedAuth0Client(payload, config.allowedClientIds);
}

export async function verifyAuth0AccessToken(
  token: string,
  config?: Auth0Config,
): Promise<AccessTokenPayload | null> {
  const resolvedConfig = config ?? getAuth0Config();

  if (!resolvedConfig) {
    return null;
  }
  const trimmedToken = token.trim();

  if (!isExpectedAccessTokenLength(trimmedToken)) {
    return null;
  }

  const header = decodeJwtHeader(trimmedToken);

  if (!header || header.alg !== 'RS256' || !header.kid) {
    return null;
  }

  const payload = decodeJwtPayload(trimmedToken);

  if (!payload || !isAuth0AccessTokenPayload(payload, resolvedConfig)) {
    return null;
  }

  const jwksKeys = await fetchAuth0Jwks(resolvedConfig.domain);
  const jwk = jwksKeys.find((key) => key.kid === header.kid);

  if (!jwk) {
    return null;
  }

  const publicKey = jwkToPublicKey(jwk);

  if (!publicKey) {
    return null;
  }

  return verifyJwtWithPublicKey(trimmedToken, publicKey);
}

export function clearAuth0JwksCacheForTests(): void {
  jwksCache = null;
}
