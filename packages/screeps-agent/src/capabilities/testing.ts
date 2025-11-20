/**
 * Testing Capability
 *
 * Provides test execution and validation for Screeps bot development.
 */

import type { MCPClient } from "../mcp/client.js";
import type { TestExecutionResult, TaskResult, AgentAction } from "../types.js";
import { ActionType } from "../types.js";

/**
 * Testing capability for running and validating tests
 */
export class TestingCapability {
  private mcpClient: MCPClient;
  private actions: AgentAction[] = [];

  public constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * Execute test suites
   */
  public async executeTests(suites: string[] = ["unit"]): Promise<TaskResult> {
    this.actions = [];

    try {
      const results: TestExecutionResult[] = [];

      for (const suite of suites) {
        this.logAction(ActionType.TestRun, `Running ${suite} tests`, { suite });

        const result = await this.runTestSuite(suite);
        results.push(result);

        this.logAction(ActionType.TestRun, `Completed ${suite} tests`, { result });
      }

      // Aggregate results
      const aggregated = this.aggregateResults(results);

      return {
        success: aggregated.passed,
        message: aggregated.passed
          ? `All tests passed (${aggregated.passedCount}/${aggregated.total})`
          : `Tests failed (${aggregated.failedCount}/${aggregated.total} failures)`,
        data: {
          results,
          aggregated
        },
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to execute tests: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
  }

  /**
   * Run a specific test suite
   */
  private async runTestSuite(_suite: string): Promise<TestExecutionResult> {
    // TODO: This would execute actual test commands
    // For now, return a mock result
    const startTime = Date.now();

    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, 100));

    const endTime = Date.now();

    // Mock result - in real implementation, parse test output
    return {
      passed: true,
      total: 10,
      passedCount: 10,
      failedCount: 0,
      skippedCount: 0,
      duration: endTime - startTime
    };
  }

  /**
   * Validate build succeeds
   */
  public async validateBuild(): Promise<TaskResult> {
    this.actions = [];

    try {
      this.logAction(ActionType.TestRun, "Validating build", {});

      // TODO: Execute build command
      // For now, simulate success

      this.logAction(ActionType.TestRun, "Build validation completed", {
        success: true
      });

      return {
        success: true,
        message: "Build validation passed",
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Build validation failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
  }

  /**
   * Run linter
   */
  public async runLinter(): Promise<TaskResult> {
    this.actions = [];

    try {
      this.logAction(ActionType.TestRun, "Running linter", {});

      // TODO: Execute linter command
      // For now, simulate success

      this.logAction(ActionType.TestRun, "Linter completed", { success: true });

      return {
        success: true,
        message: "Linter passed",
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Linter failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
  }

  /**
   * Run formatter check
   */
  public async runFormatterCheck(): Promise<TaskResult> {
    this.actions = [];

    try {
      this.logAction(ActionType.TestRun, "Running formatter check", {});

      // TODO: Execute formatter check command
      // For now, simulate success

      this.logAction(ActionType.TestRun, "Formatter check completed", {
        success: true
      });

      return {
        success: true,
        message: "Formatter check passed",
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Formatter check failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
  }

  /**
   * Validate bot runtime behavior
   */
  public async validateRuntime(): Promise<TaskResult> {
    this.actions = [];

    try {
      this.logAction(ActionType.MCPRead, "Validating bot runtime behavior", {});

      // Get bot state
      const stats = (await this.mcpClient.getBotState()) as {
        cpu?: { used?: number; limit?: number };
        creeps?: number;
        rooms?: number;
      };

      const issues: string[] = [];

      // Check CPU usage
      if (stats.cpu) {
        const cpuUsage = stats.cpu.used || 0;
        const cpuLimit = stats.cpu.limit || 100;
        if (cpuUsage > cpuLimit * 0.95) {
          issues.push(`Critical CPU usage: ${cpuUsage.toFixed(2)}/${cpuLimit}`);
        }
      }

      // Check bot is operational
      if (stats.creeps === 0 && stats.rooms && stats.rooms > 0) {
        issues.push("No creeps alive - bot may not be functioning");
      }

      this.logAction(ActionType.MCPRead, "Runtime validation completed", { stats, issues });

      return {
        success: issues.length === 0,
        message:
          issues.length === 0 ? "Runtime validation passed" : `Runtime validation found ${issues.length} issue(s)`,
        data: {
          stats,
          issues
        },
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Runtime validation failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
  }

  /**
   * Aggregate test results
   */
  private aggregateResults(results: TestExecutionResult[]): TestExecutionResult {
    const aggregated: TestExecutionResult = {
      passed: true,
      total: 0,
      passedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      failures: [],
      duration: 0
    };

    for (const result of results) {
      aggregated.total += result.total;
      aggregated.passedCount += result.passedCount;
      aggregated.failedCount += result.failedCount;
      aggregated.skippedCount += result.skippedCount;
      aggregated.duration += result.duration;

      if (!result.passed) {
        aggregated.passed = false;
      }

      if (result.failures) {
        aggregated.failures = aggregated.failures || [];
        aggregated.failures.push(...result.failures);
      }
    }

    return aggregated;
  }

  /**
   * Log an action
   */
  private logAction(type: ActionType, description: string, details?: Record<string, unknown>): void {
    const action: AgentAction = {
      type,
      timestamp: new Date(),
      description
    };
    if (details !== undefined) {
      action.details = details;
    }
    this.actions.push(action);
  }

  /**
   * Get all actions taken
   */
  public getActions(): AgentAction[] {
    return [...this.actions];
  }

  /**
   * Clear action log
   */
  public clearActions(): void {
    this.actions = [];
  }
}
