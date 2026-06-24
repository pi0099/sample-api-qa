import {
  createJwtSid,
  decodeJwtPayload,
  getSigningKeys,
  isExpectedAccessTokenLength,
  signJwt,
  verifyJwt,
  type AccessTokenPayload,
  type SampleJwtPayload,
} from '@/lib/jwt';
import { getAuth0Config } from '@/lib/auth0-config';
import {
  isAuth0AccessTokenPayload,
  verifyAuth0AccessToken,
} from '@/lib/auth0-jwks';

export const SAMPLE_CLIENT_ID = 'test-m2m-client';
export const SAMPLE_CLIENT_SECRET = 'test-m2m-secret';
export const SAMPLE_TOKEN_EXPIRES_IN = 86400;
export const SAMPLE_TOKEN_ISSUER = 'https://sample-api-qa.vercel.app/';
export const SAMPLE_TOKEN_AUDIENCE = 'https://sample-api-qa.vercel.app/api/v2/';

export interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface OAuthErrorResponse {
  error: string;
  error_description: string;
}

export function validateClientCredentials(
  clientId: string,
  clientSecret: string,
): boolean {
  return (
    clientId === SAMPLE_CLIENT_ID && clientSecret === SAMPLE_CLIENT_SECRET
  );
}

export function isAllowedClientSubject(sub: string | undefined): boolean {
  return (
    sub === SAMPLE_CLIENT_ID || sub === `${SAMPLE_CLIENT_ID}@clients`
  );
}

export function createAccessToken(
  expiresIn: number = SAMPLE_TOKEN_EXPIRES_IN,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SampleJwtPayload = {
    iss: SAMPLE_TOKEN_ISSUER,
    sub: `${SAMPLE_CLIENT_ID}@clients`,
    aud: SAMPLE_TOKEN_AUDIENCE,
    iat: now,
    exp: now + expiresIn,
    gty: 'client-credentials',
    azp: SAMPLE_CLIENT_ID,
    scope: 'read:users',
    sid: createJwtSid(),
  };

  const { privateKey } = getSigningKeys();
  return signJwt(payload, privateKey);
}

export function parseSampleAccessToken(token: string): SampleJwtPayload | null {
  const trimmedToken = token.trim();

  if (!isExpectedAccessTokenLength(trimmedToken)) {
    return null;
  }

  const { publicKey } = getSigningKeys();
  const payload = verifyJwt(trimmedToken, publicKey);

  if (!payload) {
    return null;
  }

  if (!isAllowedClientSubject(payload.sub) && payload.azp !== SAMPLE_CLIENT_ID) {
    return null;
  }

  return payload;
}

export async function parseAccessToken(
  token: string,
): Promise<AccessTokenPayload | null> {
  const sampleToken = parseSampleAccessToken(token);

  if (sampleToken) {
    return sampleToken;
  }

  const auth0Config = getAuth0Config();

  if (!auth0Config) {
    return null;
  }

  return verifyAuth0AccessToken(token, auth0Config);
}

export function inspectSampleAccessToken(token: string): {
  payload: AccessTokenPayload | null;
  signatureValid: boolean;
  expired: boolean;
  allowedClient: boolean;
  expectedLength: boolean;
} {
  const trimmedToken = token.trim();
  const payload = decodeJwtPayload(trimmedToken);
  const { publicKey } = getSigningKeys();
  const verified = verifyJwt(trimmedToken, publicKey);

  return {
    payload,
    signatureValid: verified !== null,
    expired:
      payload !== null &&
      typeof payload.exp === 'number' &&
      payload.exp < Math.floor(Date.now() / 1000),
    allowedClient:
      payload !== null &&
      (isAllowedClientSubject(payload.sub) || payload.azp === SAMPLE_CLIENT_ID),
    expectedLength: isExpectedAccessTokenLength(trimmedToken),
  };
}

export async function inspectAccessToken(token: string): Promise<{
  payload: AccessTokenPayload | null;
  signatureValid: boolean;
  expired: boolean;
  allowedClient: boolean;
  expectedLength: boolean;
  tokenSource: 'sample' | 'auth0' | 'unknown';
}> {
  const trimmedToken = token.trim();
  const sampleInspection = inspectSampleAccessToken(trimmedToken);

  if (parseSampleAccessToken(trimmedToken)) {
    return {
      ...sampleInspection,
      tokenSource: 'sample',
    };
  }

  const auth0Config = getAuth0Config();
  const payload = decodeJwtPayload(trimmedToken);

  if (!auth0Config || !payload) {
    return {
      ...sampleInspection,
      tokenSource: 'unknown',
    };
  }

  const auth0ClaimsValid = isAuth0AccessTokenPayload(payload, auth0Config);
  const verified = auth0ClaimsValid
    ? await verifyAuth0AccessToken(trimmedToken, auth0Config)
    : null;

  return {
    payload,
    signatureValid: verified !== null,
    expired:
      payload.exp < Math.floor(Date.now() / 1000),
    allowedClient: auth0ClaimsValid,
    expectedLength: isExpectedAccessTokenLength(trimmedToken),
    tokenSource: verified ? 'auth0' : 'unknown',
  };
}

export function oauthError(
  error: string,
  errorDescription: string,
  status: number,
): Response {
  const body: OAuthErrorResponse = {
    error,
    error_description: errorDescription,
  };

  return Response.json(body, { status });
}
