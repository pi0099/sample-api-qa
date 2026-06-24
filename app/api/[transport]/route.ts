import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { getOrderInfo } from '@/lib/order-info';

export const runtime = 'nodejs';

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'get_order_info',
      {
        title: 'Get Order Info',
        description:
          'Return seeded random order info for QA. Pass userId or email (same orders for the same user).',
        inputSchema: {
          userId: z
            .string()
            .optional()
            .describe('User id, e.g. alice (same orders as email alice@example.com)'),
          email: z
            .string()
            .optional()
            .describe('User email, e.g. alice@example.com (same orders as userId alice)'),
        },
      },
      async ({ userId, email }) => {
        try {
          const result = getOrderInfo({ userId, email });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to build order info';

          return {
            isError: true,
            content: [{ type: 'text', text: message }],
          };
        }
      },
    );
  },
  {},
  {
    basePath: '/api',
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
