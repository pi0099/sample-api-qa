import { getAuth0Config, isAuth0Issuer } from '@/lib/auth0-config';
import { getAuth0ClaimFailure } from '@/lib/auth0-jwks';
import {
  inspectAccessToken,
  parseAccessToken,
  parseSampleAccessToken,
} from '@/lib/oauth';
import { decodeJwtPayload } from '@/lib/jwt';

export type TokenRejectReason =
  | 'missing_authorization'
  | 'invalid_bearer_format'
  | 'empty_token_after_bearer'
  | 'double_bearer_prefix'
  | 'invalid_jwt_format'
  | 'unexpected_token_length'
  | 'invalid_signature'
  | 'decode_failed'
  | 'wrong_grant_type'
  | 'wrong_sub'
  | 'wrong_issuer'
  | 'wrong_audience'
  | 'wrong_client'
  | 'auth0_not_configured'
  | 'expired'
  | 'valid';

export interface TokenDiagnosis {
  reason: TokenRejectReason;
  message: string;
  tokenLength: number;
  tokenPreview: string;
  decodedSub?: string;
  decodedGrantType?: string;
  decodedExp?: number;
  decodedIss?: string;
  tokenSource?: 'sample' | 'auth0' | 'unknown';
}

export function maskToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 16) {
    return `[len=${trimmed.length}]`;
  }

  return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)} [len=${trimmed.length}]`;
}

export function isQaDebugEnabled(request: Request): boolean {
  return request.headers.get('x-qa-debug') === '1';
}

function looksLikeAuth0Token(issuer: string | undefined): boolean {
  if (!issuer) {
    return false;
  }

  return issuer.includes('auth0.com');
}

export async function diagnoseAccessToken(
  authorization: string | null,
): Promise<TokenDiagnosis> {
  if (!authorization) {
    return {
      reason: 'missing_authorization',
      message: 'Authorization header is missing',
      tokenLength: 0,
      tokenPreview: '',
    };
  }

  if (!authorization.startsWith('Bearer ')) {
    return {
      reason: 'invalid_bearer_format',
      message: 'Authorization must start with "Bearer "',
      tokenLength: authorization.length,
      tokenPreview: maskToken(authorization),
    };
  }

  const accessToken = authorization.slice('Bearer '.length);
  const trimmedToken = accessToken.trim();

  if (!trimmedToken) {
    return {
      reason: 'empty_token_after_bearer',
      message: 'Token is empty after "Bearer "',
      tokenLength: 0,
      tokenPreview: '',
    };
  }

  if (trimmedToken.startsWith('Bearer ')) {
    return {
      reason: 'double_bearer_prefix',
      message: 'Token starts with "Bearer " again — likely double prefix',
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
    };
  }

  if (trimmedToken.split('.').length !== 3) {
    return {
      reason: 'invalid_jwt_format',
      message: 'Token must be a JWT with 3 dot-separated parts',
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
    };
  }

  const inspection = await inspectAccessToken(trimmedToken);
  const payload = inspection.payload ?? decodeJwtPayload(trimmedToken);

  if (!inspection.expectedLength) {
    return {
      reason: 'unexpected_token_length',
      message: `Expected access token length about 796 chars (allowed 750-850), got ${trimmedToken.length}`,
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: payload?.sub,
      decodedGrantType: payload?.gty,
      decodedExp: payload?.exp,
      decodedIss: payload?.iss,
      tokenSource: inspection.tokenSource,
    };
  }

  if (!payload) {
    return {
      reason: 'decode_failed',
      message: 'JWT payload could not be decoded',
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
    };
  }

  const parsed = await parseAccessToken(trimmedToken);

  if (parsed) {
    return {
      reason: 'valid',
      message: 'Token is valid',
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: payload.sub,
      decodedGrantType: payload.gty,
      decodedExp: payload.exp,
      decodedIss: payload.iss,
      tokenSource: inspection.tokenSource,
    };
  }

  if (inspection.expired) {
    return {
      reason: 'expired',
      message: 'Token is expired',
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: payload.sub,
      decodedGrantType: payload.gty,
      decodedExp: payload.exp,
      decodedIss: payload.iss,
      tokenSource: inspection.tokenSource,
    };
  }

  if (looksLikeAuth0Token(payload.iss)) {
    const auth0Config = getAuth0Config();

    if (!auth0Config) {
      return {
        reason: 'auth0_not_configured',
        message:
          'Token is from Auth0 but AUTH0_DOMAIN/AUTH0_AUDIENCE/AUTH0_ALLOWED_CLIENT_IDS are not configured',
        tokenLength: trimmedToken.length,
        tokenPreview: maskToken(trimmedToken),
        decodedSub: payload.sub,
        decodedGrantType: payload.gty,
        decodedExp: payload.exp,
        decodedIss: payload.iss,
        tokenSource: 'auth0',
      };
    }

    if (!isAuth0Issuer(payload.iss, auth0Config)) {
      return {
        reason: 'wrong_issuer',
        message: `Expected Auth0 issuer ${auth0Config.issuer}, got ${payload.iss}`,
        tokenLength: trimmedToken.length,
        tokenPreview: maskToken(trimmedToken),
        decodedSub: payload.sub,
        decodedGrantType: payload.gty,
        decodedExp: payload.exp,
        decodedIss: payload.iss,
        tokenSource: 'auth0',
      };
    }

    const claimFailure = getAuth0ClaimFailure(payload, auth0Config);

    if (claimFailure) {
      const failureMessages: Record<typeof claimFailure, string> = {
        wrong_issuer: `Expected Auth0 issuer ${auth0Config.issuer}, got ${payload.iss}`,
        wrong_audience: `Expected aud=${auth0Config.audience}, got ${JSON.stringify(payload.aud)}`,
        wrong_grant_type: `Expected gty=client-credentials, got ${payload.gty ?? 'undefined'}`,
        wrong_client: `Client not allowed. Set AUTH0_ALLOWED_CLIENT_IDS to token azp=${payload.azp ?? 'undefined'} (configured: ${auth0Config.allowedClientIds.join(', ')})`,
      };

      return {
        reason: claimFailure,
        message: failureMessages[claimFailure],
        tokenLength: trimmedToken.length,
        tokenPreview: maskToken(trimmedToken),
        decodedSub: payload.sub,
        decodedGrantType: payload.gty,
        decodedExp: payload.exp,
        decodedIss: payload.iss,
        tokenSource: 'auth0',
      };
    }
  }

  if (payload.gty !== 'client-credentials') {
    return {
      reason: 'wrong_grant_type',
      message: `Expected gty=client-credentials, got ${payload.gty ?? 'undefined'}`,
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: payload.sub,
      decodedGrantType: payload.gty,
      decodedExp: payload.exp,
      decodedIss: payload.iss,
      tokenSource: inspection.tokenSource,
    };
  }

  if (!parseSampleAccessToken(trimmedToken) && !inspection.allowedClient) {
    return {
      reason: 'wrong_sub',
      message: `Expected client test-m2m-client or configured Auth0 client, got sub=${payload.sub ?? 'undefined'}`,
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: payload.sub,
      decodedGrantType: payload.gty,
      decodedExp: payload.exp,
      decodedIss: payload.iss,
      tokenSource: inspection.tokenSource,
    };
  }

  return {
    reason: 'invalid_signature',
    message:
      'JWT signature is invalid or token was not issued by sample-api or configured Auth0 tenant',
    tokenLength: trimmedToken.length,
    tokenPreview: maskToken(trimmedToken),
    decodedSub: payload.sub,
    decodedGrantType: payload.gty,
    decodedExp: payload.exp,
    decodedIss: payload.iss,
    tokenSource: inspection.tokenSource,
  };
}

interface RequestLogInput {
  endpoint: string;
  method: string;
  request: Request;
  status: number;
  outcome: string;
  extra?: Record<string, string | number | boolean | undefined>;
}

export function logRequestEvent(input: RequestLogInput): void {
  const requestId =
    input.request.headers.get('x-vercel-id') ??
    input.request.headers.get('x-request-id') ??
    'local';

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'sample-api-qa',
      timestamp: new Date().toISOString(),
      requestId,
      endpoint: input.endpoint,
      method: input.method,
      status: input.status,
      outcome: input.outcome,
      userAgent: input.request.headers.get('user-agent') ?? undefined,
      contentType: input.request.headers.get('content-type') ?? undefined,
      ...input.extra,
    }),
  );
}
