/**
 * Browser MCP client wrapper. Connects to the market MCP server over
 * Streamable HTTP and exposes the tools/list + tools/call surface the BYOK
 * agent loop needs.
 *
 * Auth: v1 uses a Personal Access Token (PAT, `plur_pat_…`). The MCP
 * server's auth middleware (auth.py) accepts both PATs and Hydra OAuth
 * JWTs; switching to OAuth PKCE later only changes the token source, not
 * the transport.
 *
 * Note: the MCP server requires the request to set Accept headers for both
 * application/json and text/event-stream — handled by the SDK's transport.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCP_URL } from '../utils/env';

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export class ByokMcpClient {
  private client: Client | null = null;
  private connected = false;
  private readonly token: string;
  private readonly url: string;

  constructor(token: string, url: string = MCP_URL) {
    if (!token) throw new Error('MCP token is required');
    this.token = token;
    this.url = url;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const transport = new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit: {
        headers: { Authorization: `Bearer ${this.token}` },
      },
    });
    this.client = new Client(
      { name: 'plurality-byok-agent', version: '0.1.0' },
      { capabilities: {} },
    );
    await this.client.connect(transport);
    this.connected = true;
  }

  async listTools(): Promise<McpToolDef[]> {
    if (!this.client) throw new Error('MCP client not connected');
    const result = await this.client.listTools();
    return (result.tools || []).map((t) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: (t.inputSchema as Record<string, unknown>) || { type: 'object', properties: {} },
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    if (!this.client) throw new Error('MCP client not connected');
    const result = await this.client.callTool({ name, arguments: args });
    return {
      content: (result.content as McpToolResult['content']) || [],
      isError: result.isError === true,
    };
  }

  /** Flatten an MCP tool result's content blocks into a single string for the LLM. */
  static contentToText(result: McpToolResult): string {
    return result.content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
  }

  async close(): Promise<void> {
    try {
      await this.client?.close();
    } catch {
      // ignore
    }
    this.connected = false;
    this.client = null;
  }
}
