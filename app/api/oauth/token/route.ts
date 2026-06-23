import { corsHeaders, withCors } from '@/lib/cors';
import {
  createAccessToken,
  oauthError,
  SAMPLE_TOKEN_EXPIRES_IN,
  validateClientCredentials,
} from '@/lib/oauth';
import { isQaDebugEnabled, logRequestEvent, maskToken } from '@/lib/request-log';

interface TokenRequestBody {
  grant_type?: string;
  client_id?: string;
  client_secret?: string;
}

async function parseTokenRequest(request: Request): Promise<TokenRequestBody> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await request.json()) as TokenRequestBody;
  }

  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  return {
    grant_type: params.get('grant_type') ?? undefined,
    client_id: params.get('client_id') ?? undefined,
    client_secret: params.get('client_secret') ?? undefined,
  };
}

export async function POST(request: Request): Promise<Response> {
  const endpoint = '/api/oauth/token';
  let body: TokenRequestBody;

  try {
    body = await parseTokenRequest(request);
  } catch {
    logRequestEvent({
      endpoint,
      method: 'POST',
      request,
      status: 400,
      outcome: 'parse_body_failed',
    });

    return withCors(
      oauthError('invalid_request', 'Unable to parse token request body', 400),
    );
  }

  const clientId = body.client_id?.trim();
  const clientSecret = body.client_secret?.trim();

  if (body.grant_type !== 'client_credentials') {
    logRequestEvent({
      endpoint,
      method: 'POST',
      request,
      status: 400,
      outcome: 'unsupported_grant_type',
      extra: {
        grantType: body.grant_type,
        clientId,
      },
    });

    return withCors(
      oauthError(
        'unsupported_grant_type',
        'Only grant_type=client_credentials is supported',
        400,
      ),
    );
  }

  if (!clientId || !clientSecret) {
    logRequestEvent({
      endpoint,
      method: 'POST',
      request,
      status: 400,
      outcome: 'missing_client_credentials',
      extra: {
        clientId,
        hasClientSecret: Boolean(clientSecret),
      },
    });

    return withCors(
      oauthError(
        'invalid_request',
        'client_id and client_secret are required',
        400,
      ),
    );
  }

  if (!validateClientCredentials(clientId, clientSecret)) {
    logRequestEvent({
      endpoint,
      method: 'POST',
      request,
      status: 401,
      outcome: 'invalid_client',
      extra: {
        clientId,
        clientSecretPreview: maskToken(clientSecret),
      },
    });

    return withCors(
      oauthError('invalid_client', 'Client authentication failed', 401),
    );
  }

  const accessToken = createAccessToken(SAMPLE_TOKEN_EXPIRES_IN);

  logRequestEvent({
    endpoint,
    method: 'POST',
    request,
    status: 200,
    outcome: 'token_issued',
    extra: {
      clientId,
      accessTokenPreview: maskToken(accessToken),
      expiresIn: SAMPLE_TOKEN_EXPIRES_IN,
    },
  });

  return withCors(
    Response.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: SAMPLE_TOKEN_EXPIRES_IN,
    }),
  );
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
