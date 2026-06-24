import { corsHeaders, withCors } from '@/lib/cors';
import { getOrderInfo } from '@/lib/order-info';

function readLookupFromRequest(request: Request): {
  userId?: string;
  email?: string;
} {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId')?.trim();
  const email = url.searchParams.get('email')?.trim();

  return {
    userId: userId || undefined,
    email: email || undefined,
  };
}

export async function GET(request: Request): Promise<Response> {
  const lookup = readLookupFromRequest(request);

  try {
    const result = getOrderInfo(lookup);
    return withCors(Response.json(result));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid order info request';

    return withCors(
      Response.json({ error: 'invalid_request', error_description: message }, {
        status: 400,
      }),
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: { userId?: string; email?: string };

  try {
    body = (await request.json()) as { userId?: string; email?: string };
  } catch {
    return withCors(
      Response.json(
        {
          error: 'invalid_request',
          error_description: 'Request body must be JSON',
        },
        { status: 400 },
      ),
    );
  }

  try {
    const result = getOrderInfo({
      userId: body.userId?.trim(),
      email: body.email?.trim(),
    });

    return withCors(Response.json(result));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid order info request';

    return withCors(
      Response.json({ error: 'invalid_request', error_description: message }, {
        status: 400,
      }),
    );
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
