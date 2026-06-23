export const SAMPLE_CLIENT_ID = 'test-m2m-client';
export const SAMPLE_CLIENT_SECRET = 'test-m2m-secret';
export const SAMPLE_TOKEN_EXPIRES_IN = 3600;

export interface AccessTokenPayload {
  sub: string;
  grant_type: 'client_credentials';
  iat: number;
  exp: number;
}

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

export function createAccessToken(expiresIn: number = SAMPLE_TOKEN_EXPIRES_IN): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: SAMPLE_CLIENT_ID,
    grant_type: 'client_credentials',
    iat: now,
    exp: now + expiresIn,
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function parseAccessToken(token: string): AccessTokenPayload | null {
  const trimmedToken = token.trim();

  try {
    const payload = JSON.parse(
      Buffer.from(trimmedToken, 'base64url').toString('utf8'),
    ) as AccessTokenPayload;

    if (
      payload.grant_type !== 'client_credentials' ||
      payload.sub !== SAMPLE_CLIENT_ID ||
      typeof payload.sub !== 'string'
    ) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
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
