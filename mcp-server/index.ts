import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { getOrderInfo } from '../lib/order-info.js';

const TOOL_NAME = 'get_order_info';

function asTextContent(payload: unknown): TextContent {
  return {
    type: 'text',
    text: JSON.stringify(payload, null, 2),
  };
}

function toolError(message: string): CallToolResult {
  return {
    isError: true,
    content: [asTextContent({ error: message })],
  };
}

const server = new Server(
  {
    name: 'sample-api-orderinfo',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: TOOL_NAME,
      description:
        'Return seeded random order info. Pass userId or email (same result for same user). Both use the same query/body field style.',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User id, e.g. alice (same orders as email alice@example.com)',
          },
          email: {
            type: 'string',
            description: 'User email, e.g. alice@example.com (same orders as userId alice)',
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== TOOL_NAME) {
    return toolError(`Unknown tool: ${request.params.name}`);
  }

  const args = request.params.arguments ?? {};
  const userId =
    typeof args.userId === 'string' ? args.userId.trim() : undefined;
  const email =
    typeof args.email === 'string' ? args.email.trim() : undefined;

  try {
    const result = getOrderInfo({ userId, email });

    return {
      content: [asTextContent(result)],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to build order info';

    return toolError(message);
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
