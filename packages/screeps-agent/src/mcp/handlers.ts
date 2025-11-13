/**
 * MCP Request/Response Handlers
 *
 * Provides utilities for processing MCP server responses and formatting requests.
 */

import type { MCPResourceType } from "../types.js";

/**
 * Parse MCP resource response
 */
export function parseResourceResponse(response: unknown): unknown {
  if (typeof response !== "object" || response === null) {
    return response;
  }

  const resp = response as { contents?: Array<{ text?: string }> };

  // Extract text content from MCP response format
  if (resp.contents && Array.isArray(resp.contents)) {
    const textContent = resp.contents
      .filter(item => item.text)
      .map(item => item.text)
      .join("");

    try {
      return JSON.parse(textContent);
    } catch {
      return textContent;
    }
  }

  return response;
}

/**
 * Parse MCP tool response
 */
export function parseToolResponse(response: unknown): unknown {
  if (typeof response !== "object" || response === null) {
    return response;
  }

  const resp = response as { content?: Array<{ type?: string; text?: string }> };

  // Extract content from MCP tool response format
  if (resp.content && Array.isArray(resp.content)) {
    const textContent = resp.content
      .filter(item => item.type === "text" && item.text)
      .map(item => item.text)
      .join("");

    try {
      return JSON.parse(textContent);
    } catch {
      return textContent;
    }
  }

  return response;
}

/**
 * Format resource URI with query parameters
 */
export function formatResourceURI(resourceType: MCPResourceType, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) {
    return resourceType;
  }

  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  return `${resourceType}?${queryString}`;
}

/**
 * Validate tool arguments
 */
export function validateToolArguments(toolName: string, args: Record<string, unknown>): void {
  switch (toolName) {
    case "screeps.console":
      if (typeof args.command !== "string") {
        throw new Error("Console command must be a string");
      }
      break;

    case "screeps.memory.get":
      if (args.path && typeof args.path !== "string") {
        throw new Error("Memory path must be a string");
      }
      break;

    case "screeps.memory.set":
      if (typeof args.path !== "string") {
        throw new Error("Memory path must be a string");
      }
      if (args.value === undefined) {
        throw new Error("Memory value is required");
      }
      // Validate against prototype pollution
      if (args.path.includes("__proto__") || args.path.includes("constructor") || args.path.includes("prototype")) {
        throw new Error("Memory path contains forbidden keywords (prototype pollution protection)");
      }
      break;

    case "screeps.stats":
      // No arguments required for stats
      break;

    default:
      // Unknown tool, skip validation
      break;
  }
}

/**
 * Extract error message from MCP error response
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const err = error as { message?: string; error?: string };
    return err.message || err.error || "Unknown error";
  }

  return String(error);
}

/**
 * Check if response indicates success
 */
export function isSuccessResponse(response: unknown): boolean {
  if (typeof response !== "object" || response === null) {
    return false;
  }

  const resp = response as { success?: boolean; ok?: boolean; error?: unknown };

  // Check for explicit success/ok indicators
  if (resp.success !== undefined) {
    return resp.success === true;
  }

  if (resp.ok !== undefined) {
    return resp.ok === true;
  }

  // If no error field, consider it successful
  return resp.error === undefined;
}

/**
 * Format console command for execution
 */
export function formatConsoleCommand(command: string): string {
  // Remove any trailing semicolons
  let formatted = command.trim();
  if (formatted.endsWith(";")) {
    formatted = formatted.slice(0, -1);
  }

  return formatted;
}

/**
 * Parse memory path into segments
 */
export function parseMemoryPath(path: string): string[] {
  return path
    .split(".")
    .filter(segment => segment.length > 0)
    .map(segment => segment.trim());
}

/**
 * Format memory value for setting
 */
export function formatMemoryValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
