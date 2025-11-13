/**
 * Code Review Capability
 *
 * Provides automated code review and analysis for Screeps bot development.
 */

import type { MCPClient } from "../mcp/client.js";
import type { CodeReviewResult, CodeReviewComment } from "../types.js";

/**
 * Code review capability for analyzing changes
 */
export class CodeReviewCapability {
  private mcpClient: MCPClient;

  public constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * Review code changes against Screeps best practices
   */
  public async reviewChanges(files: Array<{ path: string; content: string }>): Promise<CodeReviewResult> {
    const comments: CodeReviewComment[] = [];

    for (const file of files) {
      // Check TypeScript strict mode compliance
      if (file.path.endsWith(".ts")) {
        this.checkTypeScriptStrictMode(file, comments);
      }

      // Check for performance patterns
      this.checkPerformancePatterns(file, comments);

      // Check for CPU efficiency
      this.checkCPUEfficiency(file, comments);

      // Check for memory leaks
      this.checkMemoryLeaks(file, comments);
    }

    // Determine overall status
    const hasErrors = comments.some(c => c.severity === "error");
    const hasWarnings = comments.some(c => c.severity === "warning");

    let status: CodeReviewResult["status"] = "approved";
    if (hasErrors) {
      status = "changes_requested";
    } else if (hasWarnings) {
      status = "commented";
    }

    return {
      status,
      comments,
      suggestions: this.generateSuggestions(comments),
      summary: this.generateSummary(comments)
    };
  }

  /**
   * Check TypeScript strict mode compliance
   */
  private checkTypeScriptStrictMode(file: { path: string; content: string }, comments: CodeReviewComment[]): void {
    // Check for 'any' types
    const anyTypeRegex = /:\s*any\b/g;
    const lines = file.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = anyTypeRegex.exec(line);
      if (match) {
        comments.push({
          path: file.path,
          line: i + 1,
          body: "Avoid using 'any' type. Use specific types or 'unknown' instead.",
          severity: "warning"
        });
      }
    }

    // Check for non-null assertions
    const nonNullRegex = /!\s*[;,)\]]/g;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (nonNullRegex.test(line)) {
        comments.push({
          path: file.path,
          line: i + 1,
          body: "Non-null assertion operator (!) should be used sparingly. Consider proper null checking.",
          severity: "info"
        });
      }
    }
  }

  /**
   * Check for performance patterns
   */
  private checkPerformancePatterns(file: { path: string; content: string }, comments: CodeReviewComment[]): void {
    const lines = file.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for pathfinding in loops
      if (
        line.includes("PathFinder") ||
        (line.includes("findPath") && (lines[i - 1]?.includes("for") || lines[i - 1]?.includes("while")))
      ) {
        comments.push({
          path: file.path,
          line: i + 1,
          body: "Pathfinding inside loops can be CPU-expensive. Consider caching paths or moving pathfinding outside the loop.",
          severity: "warning"
        });
      }

      // Check for repeated Game.getObjectById calls
      if (line.match(/Game\.getObjectById.*Game\.getObjectById/)) {
        comments.push({
          path: file.path,
          line: i + 1,
          body: "Multiple Game.getObjectById calls on the same line. Cache the result in a variable.",
          severity: "warning"
        });
      }

      // Check for find operations in loops
      if (
        (line.includes(".find(") || line.includes(".filter(")) &&
        (lines[i - 1]?.includes("for") || lines[i - 1]?.includes("while"))
      ) {
        comments.push({
          path: file.path,
          line: i + 1,
          body: "Find/filter operations inside loops can be expensive. Consider caching results.",
          severity: "info"
        });
      }
    }
  }

  /**
   * Check for CPU efficiency
   */
  private checkCPUEfficiency(file: { path: string; content: string }, comments: CodeReviewComment[]): void {
    const lines = file.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for unnecessary lookups
      if (line.includes("Game.rooms") && line.match(/Game\.rooms\[.*?\]/g)?.length > 1) {
        comments.push({
          path: file.path,
          line: i + 1,
          body: "Multiple Game.rooms lookups. Cache the room reference in a variable.",
          severity: "info"
        });
      }

      // Check for missing CPU checks in expensive operations
      if ((line.includes("PathFinder") || line.includes("findPath")) && !file.content.includes("Game.cpu.getUsed()")) {
        comments.push({
          path: file.path,
          line: i + 1,
          body: "Consider adding CPU usage tracking around expensive pathfinding operations.",
          severity: "info"
        });
      }
    }
  }

  /**
   * Check for memory leaks
   */
  private checkMemoryLeaks(file: { path: string; content: string }, comments: CodeReviewComment[]): void {
    const lines = file.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for unbounded memory growth
      if (line.includes("Memory.") && line.includes("push(")) {
        comments.push({
          path: file.path,
          line: i + 1,
          body: "Array.push() on Memory can lead to unbounded growth. Consider implementing size limits or cleanup.",
          severity: "warning"
        });
      }

      // Check for missing memory cleanup
      if (file.content.includes("Memory.creeps[") && !file.content.includes("delete Memory.creeps[")) {
        comments.push({
          path: file.path,
          body: "Creep memory should be cleaned up when creeps die. Add cleanup logic.",
          severity: "warning"
        });
      }
    }
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(comments: CodeReviewComment[]): string[] {
    const suggestions: string[] = [];

    const errorCount = comments.filter(c => c.severity === "error").length;
    const warningCount = comments.filter(c => c.severity === "warning").length;

    if (errorCount > 0) {
      suggestions.push(`Address ${errorCount} error(s) before merging to prevent runtime issues.`);
    }

    if (warningCount > 0) {
      suggestions.push(`Review ${warningCount} warning(s) to improve code quality and performance.`);
    }

    // Check for common patterns
    const performanceIssues = comments.filter(c => c.body.toLowerCase().includes("performance"));
    if (performanceIssues.length > 0) {
      suggestions.push("Consider performance optimizations to reduce CPU usage and improve tick efficiency.");
    }

    const memoryIssues = comments.filter(c => c.body.toLowerCase().includes("memory"));
    if (memoryIssues.length > 0) {
      suggestions.push("Review memory management patterns to prevent leaks and optimize storage.");
    }

    return suggestions;
  }

  /**
   * Generate review summary
   */
  private generateSummary(comments: CodeReviewComment[]): string {
    const errorCount = comments.filter(c => c.severity === "error").length;
    const warningCount = comments.filter(c => c.severity === "warning").length;
    const infoCount = comments.filter(c => c.severity === "info").length;

    if (comments.length === 0) {
      return "Code review completed successfully. No issues found.";
    }

    const parts: string[] = [];

    if (errorCount > 0) {
      parts.push(`${errorCount} error(s)`);
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} warning(s)`);
    }
    if (infoCount > 0) {
      parts.push(`${infoCount} info message(s)`);
    }

    return `Code review completed with ${parts.join(", ")}. Please review the comments and address critical issues.`;
  }

  /**
   * Analyze bot runtime behavior
   */
  public async analyzeBotBehavior(): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    issues: string[];
  }> {
    // Get bot state from MCP
    const stats = (await this.mcpClient.getBotState()) as {
      cpu?: { used?: number; limit?: number };
      memory?: { used?: number; limit?: number };
    };

    const cpuUsage = stats.cpu?.used || 0;
    const cpuLimit = stats.cpu?.limit || 100;
    const issues: string[] = [];

    // Check CPU usage
    if (cpuUsage > cpuLimit * 0.9) {
      issues.push(
        `High CPU usage detected: ${cpuUsage.toFixed(2)}/${cpuLimit} (${((cpuUsage / cpuLimit) * 100).toFixed(1)}%)`
      );
    }

    // Check memory patterns
    const memory = (await this.mcpClient.getMemory()) as { success?: boolean };
    if (memory && memory.success !== undefined) {
      // Successfully retrieved memory
      // Could add more sophisticated memory analysis here
    }

    return {
      cpuUsage,
      memoryUsage: 0, // Would need additional memory analysis
      issues
    };
  }
}
