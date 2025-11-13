/**
 * MCP Client for Screeps
 *
 * Provides a client interface for interacting with the Screeps MCP server.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ScreepsConfig, MCPResourceType } from "../types.js";

/**
 * MCP client for Screeps operations
 */
export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private config: ScreepsConfig;

  public constructor(config: ScreepsConfig) {
    this.config = config;
  }

  /**
   * Initialize connection to Screeps MCP server
   */
  public async connect(): Promise<void> {
    try {
      // Create client instance
      this.client = new Client(
        {
          name: "screeps-agent-client",
          version: "0.1.0"
        },
        {
          capabilities: {
            roots: {
              listChanged: false
            },
            sampling: {}
          }
        }
      );

      // Set up stdio transport to communicate with MCP server
      this.transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@ralphschuler/screeps-mcp"],
        env: {
          ...process.env,
          SCREEPS_TOKEN: this.config.token || "",
          SCREEPS_EMAIL: this.config.email || "",
          SCREEPS_PASSWORD: this.config.password || "",
          SCREEPS_HOST: this.config.host || "screeps.com",
          SCREEPS_PORT: String(this.config.port || 443),
          SCREEPS_PROTOCOL: this.config.protocol || "https",
          SCREEPS_SHARD: this.config.shard || "shard3"
        }
      });

      // Connect client to transport
      await this.client.connect(this.transport);
    } catch (error) {
      throw new Error(
        `Failed to connect to Screeps MCP server: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Disconnect from Screeps MCP server
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
    } catch (error) {
      console.error("Error disconnecting from MCP server:", error);
    }
  }

  /**
   * Get a resource from the MCP server
   */
  public async getResource(uri: MCPResourceType | string): Promise<unknown> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      const response = await this.client.request(
        {
          method: "resources/read",
          params: { uri }
        },
        { timeout: 30000 }
      );

      return response;
    } catch (error) {
      throw new Error(`Failed to get resource ${uri}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Invoke a tool on the MCP server
   */
  public async invokeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      const response = await this.client.request(
        {
          method: "tools/call",
          params: {
            name,
            arguments: args
          }
        },
        { timeout: 60000 }
      );

      return response;
    } catch (error) {
      throw new Error(`Failed to invoke tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List available resources from the MCP server
   */
  public async listResources(): Promise<unknown[]> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      const response = await this.client.request(
        {
          method: "resources/list",
          params: {}
        },
        { timeout: 30000 }
      );

      return (response as { resources?: unknown[] }).resources || [];
    } catch (error) {
      throw new Error(`Failed to list resources: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List available tools from the MCP server
   */
  public async listTools(): Promise<unknown[]> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      const response = await this.client.request(
        {
          method: "tools/list",
          params: {}
        },
        { timeout: 30000 }
      );

      return (response as { tools?: unknown[] }).tools || [];
    } catch (error) {
      throw new Error(`Failed to list tools: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get bot state from Screeps
   */
  public async getBotState(): Promise<unknown> {
    return this.getResource(MCPResourceType.Stats);
  }

  /**
   * Execute console command in Screeps
   */
  public async executeConsole(command: string): Promise<unknown> {
    return this.invokeTool("screeps.console", { command });
  }

  /**
   * Get memory from Screeps
   */
  public async getMemory(path?: string): Promise<unknown> {
    const uri = path ? `${MCPResourceType.Memory}?path=${encodeURIComponent(path)}` : MCPResourceType.Memory;
    return this.getResource(uri);
  }

  /**
   * Set memory in Screeps
   */
  public async setMemory(path: string, value: unknown): Promise<unknown> {
    return this.invokeTool("screeps.memory.set", { path, value });
  }

  /**
   * Get room data from Screeps
   */
  public async getRooms(): Promise<unknown> {
    return this.getResource(MCPResourceType.Rooms);
  }

  /**
   * Get creep data from Screeps
   */
  public async getCreeps(): Promise<unknown> {
    return this.getResource(MCPResourceType.Creeps);
  }

  /**
   * Get spawn data from Screeps
   */
  public async getSpawns(): Promise<unknown> {
    return this.getResource(MCPResourceType.Spawns);
  }

  /**
   * Check if client is connected
   */
  public isConnected(): boolean {
    return this.client !== null && this.transport !== null;
  }
}
