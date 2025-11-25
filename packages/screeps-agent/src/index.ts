/**
 * Screeps Agent Package
 *
 * Autonomous agent system for Screeps bot development.
 */

export { ScreensAgent } from "./agent.js";
export { MCPClient } from "./mcp/client.js";
export {
  parseResourceResponse,
  parseToolResponse,
  formatResourceURI,
  validateToolArguments,
  extractErrorMessage,
  isSuccessResponse,
  formatConsoleCommand,
  parseMemoryPath,
  formatMemoryValue
} from "./mcp/handlers.js";
export { CodeReviewCapability } from "./capabilities/codeReview.js";
export { ImplementationCapability } from "./capabilities/implementation.js";
export { TestingCapability } from "./capabilities/testing.js";
export { DeploymentCapability } from "./capabilities/deployment.js";
export { ResearcherCapability } from "./capabilities/researcher.js";
export { StrategistCapability } from "./capabilities/strategist.js";
export type {
  AgentConfig,
  ScreepsConfig,
  GitHubConfig,
  TaskContext,
  TaskResult,
  AgentAction,
  CodeReviewResult,
  CodeReviewComment,
  TestExecutionResult,
  TestFailure,
  DeploymentResult,
  ValidationResult,
  ValidationCheck,
  ResearchRequest,
  ResearchResult,
  ResearchFinding,
  ResearchRecommendation,
  ResearchSource,
  StrategyRequest,
  StrategyResult,
  StrategyPhase,
  StrategyAction,
  StrategyObjective,
  StrategyConstraints,
  SuccessMetric,
  RiskAssessment,
  ImplementationPlan
} from "./types.js";
export { AutonomyLevel, AgentTask, ActionType, MCPResourceType } from "./types.js";
