#!/usr/bin/env node
/**
 * Screeps Agent - Main Orchestration
 *
 * Autonomous agent for Screeps bot development with Docker-based MCP server interaction.
 */

import { MCPClient } from "./mcp/client.js";
import { CodeReviewCapability } from "./capabilities/codeReview.js";
import { ImplementationCapability } from "./capabilities/implementation.js";
import { TestingCapability } from "./capabilities/testing.js";
import { DeploymentCapability } from "./capabilities/deployment.js";
import type { AgentConfig, AgentTask, TaskContext, TaskResult, AutonomyLevel } from "./types.js";

/**
 * Main agent class for orchestrating development tasks
 */
export class ScreensAgent {
  private config: AgentConfig;
  private mcpClient: MCPClient;
  private codeReview: CodeReviewCapability;
  private implementation: ImplementationCapability;
  private testing: TestingCapability;
  private deployment: DeploymentCapability;

  public constructor(config: AgentConfig) {
    this.config = config;
    this.mcpClient = new MCPClient(config.screeps);
    this.codeReview = new CodeReviewCapability(this.mcpClient);
    this.implementation = new ImplementationCapability(this.mcpClient);
    this.testing = new TestingCapability(this.mcpClient);
    this.deployment = new DeploymentCapability(this.mcpClient);
  }

  /**
   * Initialize the agent
   */
  public async initialize(): Promise<void> {
    console.log(`🤖 Initializing Screeps Agent: ${this.config.name}`);
    console.log(`   Version: ${this.config.version}, Autonomy: ${this.config.autonomyLevel || AutonomyLevel.Manual}`);

    // Connect to MCP server
    await this.mcpClient.connect();
    console.log("✅ Connected to Screeps MCP server");

    // Verify connection
    if (!this.mcpClient.isConnected()) {
      throw new Error("Failed to establish MCP connection");
    }

    console.log("🚀 Agent initialized and ready");
  }

  /**
   * Execute a task
   */
  public async executeTask(context: TaskContext): Promise<TaskResult> {
    console.log(`\n📋 Executing task: ${context.task}`);

    try {
      let result: TaskResult;

      switch (context.task) {
        case AgentTask.ReviewPR:
          result = await this.reviewPullRequest(context);
          break;

        case AgentTask.ImplementFeature:
          result = await this.implementFeature(context);
          break;

        case AgentTask.RunTests:
          result = await this.runTests(context);
          break;

        case AgentTask.OptimizePerformance:
          result = await this.optimizePerformance(context);
          break;

        case AgentTask.AnalyzeCode:
          result = await this.analyzeCode(context);
          break;

        case AgentTask.UpdateDocs:
          result = await this.updateDocumentation(context);
          break;

        default:
          result = {
            success: false,
            message: `Unknown task type: ${context.task}`,
            error: new Error(`Unknown task type: ${context.task}`)
          };
      }

      this.logTaskResult(result);
      return result;
    } catch (error) {
      const errorResult: TaskResult = {
        success: false,
        message: `Task execution failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error))
      };

      this.logTaskResult(errorResult);
      return errorResult;
    }
  }

  /**
   * Review pull request
   */
  private async reviewPullRequest(_context: TaskContext): Promise<TaskResult> {
    console.log("🔍 Reviewing pull request...");

    // TODO: Fetch PR files from GitHub
    const files: Array<{ path: string; content: string }> = [];

    const reviewResult = await this.codeReview.reviewChanges(files);

    return {
      success: reviewResult.status !== "changes_requested",
      message: reviewResult.summary,
      data: reviewResult
    };
  }

  /**
   * Implement feature
   */
  private async implementFeature(context: TaskContext): Promise<TaskResult> {
    console.log("🛠️  Implementing feature...");

    const spec = {
      title: (context.parameters.title as string) || "Feature",
      description: (context.parameters.description as string) || "",
      requirements: (context.parameters.requirements as string[]) || []
    };

    return await this.implementation.implementFeature(spec);
  }

  /**
   * Run tests
   */
  private async runTests(context: TaskContext): Promise<TaskResult> {
    console.log("🧪 Running tests...");

    const suites = (context.parameters.suites as string[]) || ["unit"];
    return await this.testing.executeTests(suites);
  }

  /**
   * Optimize performance
   */
  private async optimizePerformance(_context: TaskContext): Promise<TaskResult> {
    console.log("⚡ Analyzing performance...");

    const behavior = await this.codeReview.analyzeBotBehavior();

    return {
      success: behavior.issues.length === 0,
      message:
        behavior.issues.length === 0
          ? "No performance issues detected"
          : `Found ${behavior.issues.length} performance issue(s)`,
      data: behavior
    };
  }

  /**
   * Analyze code
   */
  private async analyzeCode(_context: TaskContext): Promise<TaskResult> {
    console.log("📊 Analyzing code quality...");

    // TODO: Implement code analysis
    return {
      success: true,
      message: "Code analysis completed"
    };
  }

  /**
   * Update documentation
   */
  private async updateDocumentation(_context: TaskContext): Promise<TaskResult> {
    console.log("📚 Updating documentation...");

    // TODO: Implement documentation updates
    return {
      success: true,
      message: "Documentation updated"
    };
  }

  /**
   * Shutdown the agent
   */
  public async shutdown(): Promise<void> {
    console.log("\n🛑 Shutting down agent...");
    await this.mcpClient.disconnect();
    console.log("✅ Agent shutdown complete");
  }

  /**
   * Log task result
   */
  private logTaskResult(result: TaskResult): void {
    const icon = result.success ? "✅" : "❌";
    console.log(`\n${icon} Task result: ${result.message}`);

    if (result.actions && result.actions.length > 0) {
      console.log(`📝 Actions taken: ${result.actions.length}`);
      for (const action of result.actions) {
        console.log(`   - [${action.timestamp.toISOString()}] ${action.type}: ${action.description}`);
      }
    }

    if (result.error) {
      console.error(`❗ Error: ${result.error.message}`);
    }
  }
}

/**
 * CLI entry point
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const taskArg = args.find(arg => arg.startsWith("--task="));
  const task = taskArg ? taskArg.split("=")[1] : null;

  if (!task) {
    console.error("❌ Error: --task argument is required");
    console.error("Usage: screeps-agent --task=<task_type>");
    console.error(
      "Available tasks: review_pr, implement_feature, run_tests, optimize_performance, analyze_code, update_docs"
    );
    process.exit(1);
  }

  // Load configuration from environment
  const config: AgentConfig = {
    name: process.env.AGENT_NAME || "screeps-agent",
    version: process.env.AGENT_VERSION || "0.1.0",
    screeps: {
      token: process.env.SCREEPS_TOKEN,
      email: process.env.SCREEPS_EMAIL,
      password: process.env.SCREEPS_PASSWORD,
      host: process.env.SCREEPS_HOST || "screeps.com",
      port: process.env.SCREEPS_PORT ? parseInt(process.env.SCREEPS_PORT, 10) : 443,
      protocol: (process.env.SCREEPS_PROTOCOL as "http" | "https") || "https",
      shard: process.env.SCREEPS_SHARD || "shard3"
    },
    github: process.env.GITHUB_TOKEN
      ? {
          token: process.env.GITHUB_TOKEN,
          repository: process.env.GITHUB_REPOSITORY || "",
          baseBranch: process.env.GITHUB_BASE_BRANCH || "main"
        }
      : undefined,
    autonomyLevel: (process.env.AUTONOMY_LEVEL as AutonomyLevel) || AutonomyLevel.Manual,
    timeout: process.env.TIMEOUT ? parseInt(process.env.TIMEOUT, 10) : 45
  };

  // Validate configuration
  if (!config.screeps.token && (!config.screeps.email || !config.screeps.password)) {
    console.error("❌ Error: Screeps authentication required");
    console.error("Set SCREEPS_TOKEN or SCREEPS_EMAIL + SCREEPS_PASSWORD environment variables");
    process.exit(1);
  }

  // Create and initialize agent
  const agent = new ScreensAgent(config);

  try {
    await agent.initialize();

    // Execute task
    const context: TaskContext = {
      task: task as AgentTask,
      parameters: {}
    };

    const result = await agent.executeTask(context);

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await agent.shutdown();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}

export default ScreensAgent;
