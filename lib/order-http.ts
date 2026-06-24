import { corsHeaders, withCors } from '@/lib/cors';
import { getOrderById } from '@/lib/order-info';

export function readOrderIdFromRequest(request: Request): string | undefined {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId')?.trim();

  return orderId || undefined;
}

export async function handleOrderGet(request: Request): Promise<Response> {
  const orderId = readOrderIdFromRequest(request);

  if (!orderId) {
    return withCors(
      Response.json(
        {
          error: 'invalid_request',
          error_description: 'orderId query parameter is required',
        },
        { status: 400 },
      ),
    );
  }

  try {
    const result = getOrderById(orderId);
    return withCors(Response.json(result));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid order request';

    return withCors(
      Response.json({ error: 'invalid_request', error_description: message }, {
        status: 400,
      }),
    );
  }
}

export function handleOrderOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
