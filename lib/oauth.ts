import { decodeJwtPayload, signJwt, verifyJwt, type JwtPayload } from '@/lib/jwt';

export const SAMPLE_CLIENT_ID = 'test-m2m-client';
export const SAMPLE_CLIENT_SECRET = 'test-m2m-secret';
export const SAMPLE_TOKEN_EXPIRES_IN = 86400;
export const SAMPLE_TOKEN_ISSUER = 'https://sample-api-qa.vercel.app';
export const SAMPLE_JWT_SECRET =
  process.env.OAUTH_JWT_SECRET ?? 'sample-api-qa-test-jwt-secret';

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
  const payload: JwtPayload = {
    iss: SAMPLE_TOKEN_ISSUER,
    sub: `${SAMPLE_CLIENT_ID}@clients`,
    iat: now,
    exp: now + expiresIn,
    gty: 'client-credentials',
    azp: SAMPLE_CLIENT_ID,
  };

  return signJwt(payload, SAMPLE_JWT_SECRET);
}

export function parseAccessToken(token: string): JwtPayload | null {
  const payload = verifyJwt(token, SAMPLE_JWT_SECRET);

  if (!payload) {
    return null;
  }

  if (payload.gty !== 'client-credentials') {
    return null;
  }

  if (!isAllowedClientSubject(payload.sub) && payload.azp !== SAMPLE_CLIENT_ID) {
    return null;
  }

  return payload;
}

export function inspectAccessToken(token: string): {
  payload: JwtPayload | null;
  signatureValid: boolean;
  expired: boolean;
  allowedClient: boolean;
} {
  const trimmedToken = token.trim();
  const payload = decodeJwtPayload(trimmedToken);
  const verified = verifyJwt(trimmedToken, SAMPLE_JWT_SECRET);

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
