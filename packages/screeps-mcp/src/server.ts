#!/usr/bin/env node
/**
 * Screeps MCP Server
 *
 * Model Context Protocol server integration for Screeps bot development.
 * Exposes Screeps game data, memory, and operations via MCP protocol.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import { ScreepsClient } from "./screeps/client.js";
import type { MCPServerConfig } from "./types.js";
import {
  getRoomsResource,
  getCreepsResource,
  getSpawnsResource,
  getMemoryResource,
  getStatsResource,
  listResources
} from "./handlers/resources.js";
import {
  listTools,
  handleConsole,
  handleMemoryGet,
  handleMemorySet,
  handleStats,
  toolSchemas
} from "./handlers/tools.js";

/**
 * Create and configure the MCP server
 */
export function createMCPServer(config: MCPServerConfig) {
  /**
   * NOTE: Using the deprecated Server class from @modelcontextprotocol/sdk.
   * The new McpServer class doesn't yet support stdio transport which is required
   * for this implementation. This should be migrated when stdio support is added.
   * See: https://github.com/modelcontextprotocol/typescript-sdk
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const server = new Server(
    {
      name: config.name,
      version: config.version
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  );

  // Initialize Screeps client
  const client = new ScreepsClient(config.screeps);
  let clientConnected = false;

  // Lazy connection initialization
  const ensureConnected = async () => {
    if (!clientConnected) {
      await client.connect();
      clientConnected = true;
    }
  };

  // Handle list resources request
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = listResources();
    return {
      resources: resources.map(r => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: "application/json"
      }))
    };
  });

  // Handle read resource request
  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const uri = request.params.uri;

    let content: string;

    try {
      await ensureConnected();

      if (uri === "screeps://game/rooms") {
        content = await getRoomsResource(client);
      } else if (uri === "screeps://game/creeps") {
        content = await getCreepsResource(client);
      } else if (uri === "screeps://game/spawns") {
        content = await getSpawnsResource(client);
      } else if (uri === "screeps://memory") {
        content = await getMemoryResource(client);
      } else if (uri === "screeps://stats") {
        content = await getStatsResource(client);
      } else {
        throw new Error(`Unknown resource: ${uri}`);
      }

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: content
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({ error: errorMessage }, null, 2)
          }
        ]
      };
    }
  });

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: listTools()
    };
  });

  // Handle call tool request
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: toolArgs } = request.params;

    try {
      await ensureConnected();

      if (name === "screeps_console") {
        const validated = toolSchemas.console.parse(toolArgs);
        return await handleConsole(client, validated);
      } else if (name === "screeps_memory_get") {
        const validated = toolSchemas.memoryGet.parse(toolArgs);
        return await handleMemoryGet(client, validated);
      } else if (name === "screeps_memory_set") {
        const validated = toolSchemas.memorySet.parse(toolArgs);
        return await handleMemorySet(client, validated);
      } else if (name === "screeps_stats") {
        return await handleStats(client);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error executing tool '${name}': ${errorMessage}`
          }
        ]
      };
    }
  });

  return server;
}

/**
 * Main function to start the server
 */
async function main() {
  // Load configuration from environment variables
  const config: MCPServerConfig = {
    name: "screeps-mcp",
    version: "0.1.0",
    screeps: {
      token: process.env.SCREEPS_TOKEN,
      email: process.env.SCREEPS_EMAIL,
      password: process.env.SCREEPS_PASSWORD,
      host: process.env.SCREEPS_HOST ?? "screeps.com",
      port: process.env.SCREEPS_PORT ? parseInt(process.env.SCREEPS_PORT) : 443,
      protocol: (process.env.SCREEPS_PROTOCOL as "http" | "https") ?? "https",
      shard: process.env.SCREEPS_SHARD ?? "shard3"
    }
  };

  const server = createMCPServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

// Run server if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
}

export { MCPServerConfig, ScreepsClient };
