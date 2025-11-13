/**
 * MCP Tool handlers for Screeps operations
 */

import { z } from "zod";
import type { ScreepsClient } from "../screeps/client.js";

/**
 * Tool schemas
 */
export const toolSchemas = {
  console: z.object({
    command: z.string().describe("Console command to execute")
  }),

  memoryGet: z.object({
    path: z.string().describe("Memory path to read (e.g., 'rooms.W1N1')")
  }),

  memorySet: z.object({
    path: z.string().describe("Memory path to write (e.g., 'myData.config')"),
    value: z.unknown().describe("Value to set at the path")
  }),

  stats: z.object({})
};

/**
 * Tool definitions
 */
export function listTools() {
  return [
    {
      name: "screeps.console",
      description: "Execute console commands in Screeps",
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Console command to execute"
          }
        },
        required: ["command"]
      }
    },
    {
      name: "screeps.memory.get",
      description: "Read Memory objects from Screeps",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Memory path to read (e.g., 'rooms.W1N1')"
          }
        },
        required: ["path"]
      }
    },
    {
      name: "screeps.memory.set",
      description: "Update Memory in Screeps (with safety checks)",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Memory path to write (e.g., 'myData.config')"
          },
          value: {
            description: "Value to set at the path (any JSON-serializable value)"
          }
        },
        required: ["path", "value"]
      }
    },
    {
      name: "screeps.stats",
      description: "Query performance metrics from Screeps",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    }
  ];
}

/**
 * Tool handler: Execute console command
 */
export async function handleConsole(client: ScreepsClient, args: z.infer<typeof toolSchemas.console>) {
  const result = await client.executeConsole(args.command);
  return {
    content: [
      {
        type: "text",
        text: result.success ? result.output : `Error: ${result.error}`
      }
    ]
  };
}

/**
 * Tool handler: Get memory
 */
export async function handleMemoryGet(client: ScreepsClient, args: z.infer<typeof toolSchemas.memoryGet>) {
  const result = await client.getMemory(args.path);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}

/**
 * Tool handler: Set memory
 */
export async function handleMemorySet(client: ScreepsClient, args: z.infer<typeof toolSchemas.memorySet>) {
  const result = await client.setMemory(args.path, args.value);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}

/**
 * Tool handler: Get stats
 */
export async function handleStats(client: ScreepsClient) {
  const stats = await client.getStats();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(stats, null, 2)
      }
    ]
  };
}
