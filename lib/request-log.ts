import {
  inspectAccessToken,
  parseAccessToken,
} from '@/lib/oauth';

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

export function diagnoseAccessToken(
  authorization: string | null,
): TokenDiagnosis {
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

  const inspection = inspectAccessToken(trimmedToken);

  if (!inspection.expectedLength) {
    return {
      reason: 'unexpected_token_length',
      message: `Expected access token length about 796 chars (allowed 750-850), got ${trimmedToken.length}`,
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: inspection.payload?.sub,
      decodedGrantType: inspection.payload?.gty,
      decodedExp: inspection.payload?.exp,
    };
  }

  const payload = inspection.payload;

  if (!payload) {
    return {
      reason: 'decode_failed',
      message: 'JWT payload could not be decoded',
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
    };
  }

  if (parseAccessToken(trimmedToken)) {
    return {
      reason: 'valid',
      message: 'Token is valid',
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: payload.sub,
      decodedGrantType: payload.gty,
      decodedExp: payload.exp,
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
    };
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
    };
  }

  if (!inspection.allowedClient) {
    return {
      reason: 'wrong_sub',
      message: `Expected client test-m2m-client, got sub=${payload.sub ?? 'undefined'}`,
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: payload.sub,
      decodedGrantType: payload.gty,
      decodedExp: payload.exp,
    };
  }

  return {
    reason: 'invalid_signature',
    message: 'JWT signature is invalid or token was not issued by sample-api',
    tokenLength: trimmedToken.length,
    tokenPreview: maskToken(trimmedToken),
    decodedSub: payload.sub,
    decodedGrantType: payload.gty,
    decodedExp: payload.exp,
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
