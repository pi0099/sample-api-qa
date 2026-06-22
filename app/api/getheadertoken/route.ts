import { corsHeaders, withCors } from '@/lib/cors';
import { parseAccessToken } from '@/lib/oauth';

function isValidBearerToken(value: string | null): value is string {
  return value !== null && value.startsWith('Bearer ');
}

function extractAccessToken(authorization: string): string {
  return authorization.slice('Bearer '.length);
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
  const authorization = request.headers.get('Authorization');

  if (!isValidBearerToken(authorization)) {
    return withCors(
      Response.json(
        {
          error: 'invalid_token',
          error_description:
            'Authorization header required. Expected: Bearer <access_token>',
        },
        { status: 401 },
      ),
    );
  }

  const accessToken = extractAccessToken(authorization);

  if (!parseAccessToken(accessToken)) {
    return withCors(
      Response.json(
        {
          error: 'invalid_token',
          error_description:
            'Access token is invalid, expired, or not issued for test-m2m-client',
        },
        { status: 401 },
      ),
    );
  }

  return withCors(Response.json(buildSampleUser(accessToken)));
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
