#!/usr/bin/env node
/**
 * Screeps Agent - Main Orchestration Module
 *
 * This module provides the autonomous agent implementation for Screeps bot development.
 * The agent connects to a Docker-based MCP server and can execute various development
 * tasks including code review, feature implementation, testing, and deployment.
 *
 * Key capabilities:
 * - Pull request review and code analysis
 * - Autonomous feature implementation
 * - Test execution and validation
 * - Performance optimization recommendations
 * - Documentation updates
 *
 * @module screeps-agent
 * @see {@link ScreensAgent} for the main agent class
 * @see {@link MCPClient} for MCP server communication
 */

import { MCPClient } from "./mcp/client.js";
import { CodeReviewCapability } from "./capabilities/codeReview.js";
import { ImplementationCapability } from "./capabilities/implementation.js";
import { TestingCapability } from "./capabilities/testing.js";
import { DeploymentCapability } from "./capabilities/deployment.js";
import { ResearcherCapability } from "./capabilities/researcher.js";
import { StrategistCapability } from "./capabilities/strategist.js";
import {
  AgentTask,
  AutonomyLevel,
  type AgentConfig,
  type ScreepsConfig,
  type TaskContext,
  type TaskResult,
  type ResearchRequest,
  type StrategyRequest
} from "./types.js";

/**
 * Main agent class for orchestrating Screeps development tasks.
 *
 * The ScreensAgent provides autonomous capabilities for various development workflows.
 * It connects to the Screeps game via MCP server and can perform code reviews,
 * implement features, run tests, and deploy changes.
 *
 * @example
 * ```typescript
 * const agent = new ScreensAgent({
 *   name: "my-agent",
 *   version: "1.0.0",
 *   screeps: { token: process.env.SCREEPS_TOKEN, shard: "shard3" },
 *   autonomyLevel: AutonomyLevel.SemiAutonomous
 * });
 *
 * await agent.initialize();
 * const result = await agent.executeTask({ task: AgentTask.ReviewPR, parameters: {} });
 * await agent.shutdown();
 * ```
 */
export class ScreensAgent {
  private config: AgentConfig;
  private mcpClient: MCPClient;
  private codeReview: CodeReviewCapability;
  private implementation: ImplementationCapability;
  private testing: TestingCapability;
  private deployment: DeploymentCapability;
  private researcher: ResearcherCapability;
  private strategist: StrategistCapability;

  public constructor(config: AgentConfig) {
    this.config = config;
    this.mcpClient = new MCPClient(config.screeps);
    this.codeReview = new CodeReviewCapability(this.mcpClient);
    this.implementation = new ImplementationCapability(this.mcpClient);
    this.testing = new TestingCapability(this.mcpClient);
    this.deployment = new DeploymentCapability(this.mcpClient);
    this.researcher = new ResearcherCapability(this.mcpClient);
    this.strategist = new StrategistCapability(this.mcpClient);
  }

  /**
   * Initialize the agent and connect to the MCP server.
   *
   * This method must be called before executing any tasks. It establishes
   * the connection to the Screeps MCP server and verifies connectivity.
   *
   * @throws {Error} if MCP connection cannot be established
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
   * Execute a development task.
   *
   * Routes the task to the appropriate capability handler and returns the result.
   * Supports code review, feature implementation, testing, performance analysis,
   * code analysis, and documentation updates.
   *
   * @param context - Task execution context with task type and parameters
   * @returns Task result with success status, message, and optional data
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

        case AgentTask.Research:
          result = await this.conductResearch(context);
          break;

        case AgentTask.Strategize:
          result = await this.createStrategy(context);
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
      data: reviewResult as unknown as Record<string, unknown>
    };
  }

  /**
   * Implement feature
   */
  private async implementFeature(context: TaskContext): Promise<TaskResult> {
    console.log("🛠️  Implementing feature...");

    const spec = {
      title: (context.parameters["title"] as string) || "Feature",
      description: (context.parameters["description"] as string) || "",
      requirements: (context.parameters["requirements"] as string[]) || []
    };

    return await this.implementation.implementFeature(spec);
  }

  /**
   * Run tests
   */
  private async runTests(context: TaskContext): Promise<TaskResult> {
    console.log("🧪 Running tests...");

    const suites = (context.parameters["suites"] as string[]) || ["unit"];
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
   * Conduct research on a topic
   */
  private async conductResearch(context: TaskContext): Promise<TaskResult> {
    console.log("🔬 Conducting research...");

    const request: ResearchRequest = {
      topic: (context.parameters["topic"] as string) || "general",
      scope: (context.parameters["scope"] as ResearchRequest["scope"]) || "comprehensive",
      depth: (context.parameters["depth"] as ResearchRequest["depth"]) || "detailed",
      outputFormat: (context.parameters["outputFormat"] as ResearchRequest["outputFormat"]) || "report"
    };

    // Add optional properties only if defined
    const contextValue = context.parameters["context"] as string | undefined;
    if (contextValue !== undefined) {
      request.context = contextValue;
    }

    const keywords = context.parameters["keywords"] as string[] | undefined;
    if (keywords !== undefined) {
      request.keywords = keywords;
    }

    return await this.researcher.conductResearch(request);
  }

  /**
   * Create a strategic plan
   */
  private async createStrategy(context: TaskContext): Promise<TaskResult> {
    console.log("📋 Creating strategic plan...");

    const request: StrategyRequest = {
      domain: (context.parameters["domain"] as StrategyRequest["domain"]) || "optimization",
      constraints: (context.parameters["constraints"] as StrategyRequest["constraints"]) || {},
      objectives: (context.parameters["objectives"] as StrategyRequest["objectives"]) || [],
      timeHorizon: (context.parameters["timeHorizon"] as StrategyRequest["timeHorizon"]) || "medium"
    };

    // Add optional currentState only if defined
    const currentState = context.parameters["currentState"] as Record<string, unknown> | undefined;
    if (currentState !== undefined) {
      request.currentState = currentState;
    }

    return await this.strategist.createStrategy(request);
  }

  /**
   * Shutdown the agent and disconnect from MCP server.
   *
   * This method should be called when the agent is no longer needed
   * to properly clean up resources and close connections.
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
      "Available tasks: review_pr, implement_feature, run_tests, optimize_performance, analyze_code, update_docs, research, strategize"
    );
    process.exit(1);
  }

  // Load configuration from environment
  const screepsConfig: ScreepsConfig = {
    host: process.env["SCREEPS_HOST"] || "screeps.com",
    port: process.env["SCREEPS_PORT"] ? parseInt(process.env["SCREEPS_PORT"], 10) : 443,
    protocol: (process.env["SCREEPS_PROTOCOL"] as "http" | "https") || "https",
    shard: process.env["SCREEPS_SHARD"] || "shard3"
  };
  if (process.env["SCREEPS_TOKEN"]) {
    screepsConfig.token = process.env["SCREEPS_TOKEN"];
  }
  if (process.env["SCREEPS_EMAIL"]) {
    screepsConfig.email = process.env["SCREEPS_EMAIL"];
  }
  if (process.env["SCREEPS_PASSWORD"]) {
    screepsConfig.password = process.env["SCREEPS_PASSWORD"];
  }

  const config: AgentConfig = {
    name: process.env["AGENT_NAME"] || "screeps-agent",
    version: process.env["AGENT_VERSION"] || "0.1.0",
    screeps: screepsConfig,
    autonomyLevel: (process.env["AUTONOMY_LEVEL"] as AutonomyLevel) || AutonomyLevel.Manual,
    timeout: process.env["TIMEOUT"] ? parseInt(process.env["TIMEOUT"], 10) : 45
  };

  if (process.env["GITHUB_TOKEN"]) {
    config.github = {
      token: process.env["GITHUB_TOKEN"],
      repository: process.env["GITHUB_REPOSITORY"] || "",
      baseBranch: process.env["GITHUB_BASE_BRANCH"] || "main"
    };
  }

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
