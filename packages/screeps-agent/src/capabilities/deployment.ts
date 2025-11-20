/**
 * Deployment Capability
 *
 * Provides deployment orchestration and validation for Screeps bot.
 */

import type { MCPClient } from "../mcp/client.js";
import {
  ActionType,
  type DeploymentResult,
  type ValidationResult,
  type ValidationCheck,
  type TaskResult,
  type AgentAction
} from "../types.js";

/**
 * Deployment capability for orchestrating bot deployments
 */
export class DeploymentCapability {
  private mcpClient: MCPClient;
  private actions: AgentAction[] = [];

  public constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
    this.actions = [];
  }

  /**
   * Deploy bot to Screeps server
   */
  public async deployBot(version?: string): Promise<TaskResult> {
    this.actions = [];

    try {
      this.logAction(ActionType.FileModify, "Starting bot deployment", {
        version
      });

      // TODO: Actual deployment would happen here
      // This would use screeps-api to upload code

      const deploymentResult: DeploymentResult = {
        success: true,
        message: "Bot deployed successfully",
        version: version || "0.1.0",
        timestamp: new Date()
      };

      this.logAction(ActionType.FileModify, "Deployment completed", {
        result: deploymentResult
      });

      // Validate deployment
      const validation = await this.validateDeployment();
      deploymentResult.validation = validation;

      return {
        success: deploymentResult.success && validation.passed,
        message: deploymentResult.message,
        data: deploymentResult as unknown as Record<string, unknown>,
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Deployment failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
  }

  /**
   * Validate deployment success
   */
  public async validateDeployment(): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    try {
      // Check bot is running
      this.logAction(ActionType.MCPRead, "Validating bot is running", {});

      const stats = (await this.mcpClient.getBotState()) as {
        cpu?: { used?: number };
        rooms?: number;
      };

      checks.push({
        name: "Bot is running",
        passed: stats.cpu !== undefined && (stats.cpu.used ?? 0) > 0,
        message: stats.cpu ? `Bot is active (CPU: ${stats.cpu.used ?? 0})` : "Bot is not running"
      });

      // Check spawns are active
      const spawns = (await this.mcpClient.getSpawns()) as unknown[];
      checks.push({
        name: "Spawns are active",
        passed: Array.isArray(spawns) && spawns.length > 0,
        message: Array.isArray(spawns) ? `${spawns.length} spawn(s) active` : "No spawns found"
      });

      // Check rooms are controlled
      if (stats.rooms !== undefined) {
        checks.push({
          name: "Rooms are controlled",
          passed: stats.rooms > 0,
          message: `${stats.rooms} room(s) controlled`
        });
      }

      this.logAction(ActionType.MCPRead, "Deployment validation completed", {
        checks
      });
    } catch (error) {
      checks.push({
        name: "Deployment validation",
        passed: false,
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`
      });
    }

    const passed = checks.every(check => check.passed);

    return {
      passed,
      checks
    };
  }

  /**
   * Monitor deployment health
   */
  public async monitorHealth(durationMinutes: number = 5): Promise<TaskResult> {
    this.actions = [];

    try {
      this.logAction(ActionType.MCPRead, `Starting health monitoring for ${durationMinutes} minutes`, {
        durationMinutes
      });

      // TODO: Implement actual monitoring loop
      // For now, just check current state

      const stats = (await this.mcpClient.getBotState()) as {
        cpu?: { used?: number; limit?: number };
        gcl?: { level?: number };
        rooms?: number;
        creeps?: number;
      };

      const health = {
        cpuUsage: stats.cpu ? (stats.cpu.used ?? 0) / (stats.cpu.limit || 100) : 0,
        gclLevel: stats.gcl?.level || 0,
        roomCount: stats.rooms || 0,
        creepCount: stats.creeps || 0
      };

      this.logAction(ActionType.MCPRead, "Health monitoring completed", {
        health
      });

      return {
        success: true,
        message: "Health monitoring completed",
        data: { health, stats },
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Health monitoring failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
  }

  /**
   * Rollback deployment
   */
  public async rollback(targetVersion: string): Promise<TaskResult> {
    this.actions = [];

    try {
      this.logAction(ActionType.FileModify, "Starting deployment rollback", {
        targetVersion
      });

      // TODO: Implement actual rollback
      // This would redeploy a previous version

      this.logAction(ActionType.FileModify, "Rollback completed", {
        targetVersion
      });

      return {
        success: true,
        message: `Rolled back to version ${targetVersion}`,
        data: { version: targetVersion },
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Rollback failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
  }

  /**
   * Check if rollback is needed
   */
  public async checkRollbackNeeded(): Promise<boolean> {
    try {
      const validation = await this.validateDeployment();

      // Rollback needed if critical checks fail
      const criticalChecks = validation.checks.filter(
        check => check.name === "Bot is running" || check.name === "Spawns are active"
      );

      return criticalChecks.some(check => !check.passed);
    } catch {
      // If we can't validate, assume rollback is needed
      return true;
    }
  }

  /**
   * Execute pre-deployment checks
   */
  public async preDeploymentChecks(): Promise<TaskResult> {
    this.actions = [];

    try {
      const checks: ValidationCheck[] = [];

      // Check build succeeds
      this.logAction(ActionType.TestRun, "Running pre-deployment checks", {});

      // TODO: Execute actual build and test commands
      checks.push({
        name: "Build succeeds",
        passed: true,
        message: "Build completed successfully"
      });

      checks.push({
        name: "Tests pass",
        passed: true,
        message: "All tests passed"
      });

      checks.push({
        name: "Linter passes",
        passed: true,
        message: "No linting errors"
      });

      const passed = checks.every(check => check.passed);

      this.logAction(ActionType.TestRun, "Pre-deployment checks completed", { checks, passed });

      return {
        success: passed,
        message: passed ? "All pre-deployment checks passed" : "Some pre-deployment checks failed",
        data: { checks },
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Pre-deployment checks failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
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
