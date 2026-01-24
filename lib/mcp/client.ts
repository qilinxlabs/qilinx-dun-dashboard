/**
 * MCP Client using official SDK with StreamableHTTP Transport
 * 
 * This module provides MCP client functionality using the official
 * @modelcontextprotocol/sdk package.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface MCPClientOptions {
  host: string;
  authToken: string;
}

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type?: string;
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}

export interface MCPClientInstance {
  listTools: () => Promise<MCPToolDefinition[]>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  close: () => Promise<void>;
}

/**
 * Create an MCP client with StreamableHTTP transport
 */
export async function createMCPClient(
  options: MCPClientOptions
): Promise<MCPClientInstance> {
  const transport = new StreamableHTTPClientTransport(
    new URL(options.host),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${options.authToken}`,
        },
      },
    }
  );

  const client = new Client({
    name: "dun-chat",
    version: "1.0.0",
  });

  await client.connect(transport);

  return {
    listTools: async () => {
      const result = await client.listTools();
      return result.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as MCPToolDefinition["inputSchema"],
      }));
    },
    callTool: async (name: string, args: Record<string, unknown>) => {
      const response = await client.callTool({
        name,
        arguments: args,
      });

      // Extract text content from response
      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("\n");
        
        if (textContent) {
          try {
            return JSON.parse(textContent);
          } catch {
            return textContent;
          }
        }
      }

      return response.content || response;
    },
    close: async () => {
      await client.close();
    },
  };
}
