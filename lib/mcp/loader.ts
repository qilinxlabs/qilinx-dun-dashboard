/**
 * MCP Tools Loader
 * 
 * Loads and manages MCP tools for a user's chat session.
 * Uses the official MCP SDK with AI SDK integration.
 */

import { tool, type Tool } from "ai";
import { z } from "zod";
import { getMCPToolsWithUserState, getUserById } from "@/lib/db/queries";
import { createMCPClient, type MCPClientInstance, type MCPToolDefinition } from "./client";

// Use a more permissive type for the tools record
// biome-ignore lint/suspicious/noExplicitAny: MCP tools have dynamic schemas
export type MCPToolRecord = Record<string, Tool<any, any>>;

export interface MCPToolsContext {
  tools: MCPToolRecord;
  clients: MCPClientInstance[];
}

/**
 * Convert JSON Schema to Zod schema for MCP tools
 */
function jsonSchemaToZod(schema: MCPToolDefinition["inputSchema"]): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  const required = schema.required || [];

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      let zodType: z.ZodTypeAny;

      switch (prop.type) {
        case "string":
          zodType = z.string();
          break;
        case "number":
        case "integer":
          zodType = z.number();
          break;
        case "boolean":
          zodType = z.boolean();
          break;
        case "array":
          zodType = z.array(z.unknown());
          break;
        case "object":
          zodType = z.record(z.unknown());
          break;
        default:
          zodType = z.unknown();
      }

      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }

      if (!required.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }
  }

  return z.object(shape);
}

/**
 * Create AI SDK tool from MCP tool definition
 */
function createAITool(
  mcpTool: MCPToolDefinition,
  client: MCPClientInstance
// biome-ignore lint/suspicious/noExplicitAny: MCP tools have dynamic schemas
): Tool<any, any> {
  const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);
  type SchemaType = z.infer<typeof zodSchema>;
  
  return tool({
    description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
    inputSchema: zodSchema,
    execute: async (args: SchemaType) => {
      try {
        return await client.callTool(mcpTool.name, args as Record<string, unknown>);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Tool call failed",
        };
      }
    },
  });
}

/**
 * Load all enabled MCP tools for a user
 */
export async function loadMCPToolsForUser(userId: string): Promise<MCPToolsContext> {
  const allTools: MCPToolRecord = {};
  const clients: MCPClientInstance[] = [];

  try {
    // Get user's API token for MCP authentication
    const user = await getUserById(userId);
    if (!user?.apiToken) {
      console.warn("User has no API token, skipping MCP tools");
      return { tools: allTools, clients };
    }

    // Get enabled MCP tools for the user
    const mcpTools = await getMCPToolsWithUserState({ userId });
    const enabledTools = mcpTools.filter((t) => t.isEnabled);

    if (enabledTools.length === 0) {
      return { tools: allTools, clients };
    }

    // Connect to each MCP server and load tools
    for (const mcpTool of enabledTools) {
      try {
        const client = await createMCPClient({
          host: mcpTool.host,
          authToken: user.apiToken,
        });

        clients.push(client);

        // Get tools from this MCP server
        const serverTools = await client.listTools();

        // Create AI SDK tools
        for (const serverTool of serverTools) {
          allTools[serverTool.name] = createAITool(serverTool, client);
        }
      } catch (error) {
        // Log error but continue with other servers
        console.error(`Failed to connect to MCP server ${mcpTool.name}:`, error);
      }
    }

    return { tools: allTools, clients };
  } catch (error) {
    console.error("Failed to load MCP tools:", error);
    return { tools: allTools, clients };
  }
}

/**
 * Disconnect all MCP clients
 */
export async function disconnectMCPClients(context: MCPToolsContext): Promise<void> {
  for (const client of context.clients) {
    try {
      await client.close();
    } catch (error) {
      console.error("Failed to disconnect MCP client:", error);
    }
  }
  context.clients.length = 0;
}
