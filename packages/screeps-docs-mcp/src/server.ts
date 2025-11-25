#!/usr/bin/env node
/**
 * Screeps Documentation MCP Server
 *
 * Model Context Protocol server for browsing and querying Screeps documentation.
 * Provides access to API reference and game mechanics documentation.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import type { MCPServerConfig } from "./types.js";
import { listResources, handleResourceRead } from "./handlers/resources.js";
import {
  listTools,
  handleSearch,
  handleGetAPI,
  handleGetMechanics,
  handleListAPIs,
  handleListMechanics,
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

    try {
      const content = await handleResourceRead(uri);

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
      if (name === "search") {
        const validated = toolSchemas.search.parse(toolArgs);
        return await handleSearch(validated);
      } else if (name === "get_api") {
        const validated = toolSchemas.getAPI.parse(toolArgs);
        return await handleGetAPI(validated);
      } else if (name === "get_mechanics") {
        const validated = toolSchemas.getMechanics.parse(toolArgs);
        return await handleGetMechanics(validated);
      } else if (name === "list_apis") {
        return await handleListAPIs();
      } else if (name === "list_mechanics") {
        return await handleListMechanics();
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
    name: "screeps-docs-mcp",
    version: "0.1.0",
    cacheConfig: {
      ttl: process.env.DOCS_CACHE_TTL ? parseInt(process.env.DOCS_CACHE_TTL) : 3600
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

export { MCPServerConfig };
