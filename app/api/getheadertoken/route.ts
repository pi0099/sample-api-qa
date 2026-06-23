import { corsHeaders, withCors } from '@/lib/cors';
import { parseAccessToken } from '@/lib/oauth';
import {
  diagnoseAccessToken,
  isQaDebugEnabled,
  logRequestEvent,
} from '@/lib/request-log';

function isValidBearerToken(value: string | null): value is string {
  return value !== null && value.startsWith('Bearer ');
}

function extractAccessToken(authorization: string): string {
  return authorization.slice('Bearer '.length).trim();
}

function buildSampleUser(accessToken: string) {
  return {
    userId: `${accessToken}LamPi`,
    name: 'Sample User',
    email: 'sample.user@example.com',
    role: 'tester',
  };
}

export async function GET(request: Request): Promise<Response> {
  const endpoint = '/api/getheadertoken';
  const authorization = request.headers.get('Authorization');
  const diagnosis = diagnoseAccessToken(authorization);
  const debugEnabled = isQaDebugEnabled(request);

  if (!isValidBearerToken(authorization)) {
    logRequestEvent({
      endpoint,
      method: 'GET',
      request,
      status: 401,
      outcome: diagnosis.reason,
      extra: {
        tokenPreview: diagnosis.tokenPreview,
        tokenLength: diagnosis.tokenLength,
        debugMessage: diagnosis.message,
      },
    });

    return withCors(
      Response.json({
        error: 'invalid_token',
        error_description:
          'Authorization header required. Expected: Bearer <access_token>',
        ...(debugEnabled
          ? {
              debug: {
                reason: diagnosis.reason,
                message: diagnosis.message,
                tokenPreview: diagnosis.tokenPreview,
                tokenLength: diagnosis.tokenLength,
              },
            }
          : {}),
      }, { status: 401 }),
    );
  }

  const accessToken = extractAccessToken(authorization);

  if (!parseAccessToken(accessToken)) {
    const diagnosisAfterBearer = diagnoseAccessToken(authorization);

    logRequestEvent({
      endpoint,
      method: 'GET',
      request,
      status: 401,
      outcome: diagnosisAfterBearer.reason,
      extra: {
        tokenPreview: diagnosisAfterBearer.tokenPreview,
        tokenLength: diagnosisAfterBearer.tokenLength,
        debugMessage: diagnosisAfterBearer.message,
        decodedSub: diagnosisAfterBearer.decodedSub,
        decodedGrantType: diagnosisAfterBearer.decodedGrantType,
        decodedExp: diagnosisAfterBearer.decodedExp,
      },
    });

    return withCors(
      Response.json({
        error: 'invalid_token',
        error_description:
          'Access token is invalid, expired, or not issued for test-m2m-client',
        ...(debugEnabled
          ? {
              debug: {
                reason: diagnosisAfterBearer.reason,
                message: diagnosisAfterBearer.message,
                tokenPreview: diagnosisAfterBearer.tokenPreview,
                tokenLength: diagnosisAfterBearer.tokenLength,
                decodedSub: diagnosisAfterBearer.decodedSub,
                decodedGrantType: diagnosisAfterBearer.decodedGrantType,
                decodedExp: diagnosisAfterBearer.decodedExp,
              },
            }
          : {}),
      }, { status: 401 }),
    );
  }

  logRequestEvent({
    endpoint,
    method: 'GET',
    request,
    status: 200,
    outcome: 'user_returned',
    extra: {
      tokenPreview: diagnosis.tokenPreview,
      tokenLength: diagnosis.tokenLength,
      decodedSub: diagnosis.decodedSub,
    },
  });

  return withCors(Response.json(buildSampleUser(accessToken)));
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
