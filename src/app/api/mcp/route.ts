/**
 * MCP Streamable HTTP transport endpoint
 *
 * Handles POST (JSON-RPC messages), GET (SSE stream), and DELETE (session close).
 * Runs in stateless mode — no session tracking. This is appropriate for a
 * single-user local tool.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getMcpServer } from "@/server/mcp/server";

async function handleMcpRequest(request: Request): Promise<Response> {
  const server = getMcpServer();

  // Create a stateless transport per request
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  // Connect the server to this transport
  await server.connect(transport);

  // Delegate the request to the transport
  return transport.handleRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
