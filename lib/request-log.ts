export type TokenRejectReason =
  | 'missing_authorization'
  | 'invalid_bearer_format'
  | 'empty_token_after_bearer'
  | 'double_bearer_prefix'
  | 'looks_like_jwt'
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

  if (trimmedToken.split('.').length === 3) {
    return {
      reason: 'looks_like_jwt',
      message: 'Token looks like JWT (3 dot-separated parts), not sample M2M token',
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
    };
  }

  let payload: {
    sub?: string;
    grant_type?: string;
    exp?: number;
  };

  try {
    payload = JSON.parse(
      Buffer.from(trimmedToken, 'base64url').toString('utf8'),
    ) as {
      sub?: string;
      grant_type?: string;
      exp?: number;
    };
  } catch {
    return {
      reason: 'decode_failed',
      message: 'Token is not valid base64url JSON payload',
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
    };
  }

  if (payload.grant_type !== 'client_credentials') {
    return {
      reason: 'wrong_grant_type',
      message: `Expected grant_type=client_credentials, got ${payload.grant_type ?? 'undefined'}`,
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: payload.sub,
      decodedGrantType: payload.grant_type,
      decodedExp: payload.exp,
    };
  }

  if (payload.sub !== 'test-m2m-client') {
    return {
      reason: 'wrong_sub',
      message: `Expected sub=test-m2m-client, got ${payload.sub ?? 'undefined'}`,
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: payload.sub,
      decodedGrantType: payload.grant_type,
      decodedExp: payload.exp,
    };
  }

  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    return {
      reason: 'expired',
      message: 'Token is expired',
      tokenLength: trimmedToken.length,
      tokenPreview: maskToken(trimmedToken),
      decodedSub: payload.sub,
      decodedGrantType: payload.grant_type,
      decodedExp: payload.exp,
    };
  }

  return {
    reason: 'valid',
    message: 'Token is valid',
    tokenLength: trimmedToken.length,
    tokenPreview: maskToken(trimmedToken),
    decodedSub: payload.sub,
    decodedGrantType: payload.grant_type,
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
