/**
 * Type definitions for Screeps Agent
 *
 * This module provides TypeScript type definitions for the autonomous Screeps agent system.
 */

/**
 * Agent configuration options
 */
export interface AgentConfig {
  /** Agent name identifier */
  name: string;
  /** Agent version */
  version: string;
  /** Screeps MCP server configuration */
  screeps: ScreepsConfig;
  /** GitHub configuration for repository operations */
  github?: GitHubConfig;
  /** Agent autonomy level */
  autonomyLevel?: AutonomyLevel;
  /** Maximum execution time in minutes */
  timeout?: number;
}

/**
 * Screeps server configuration
 */
export interface ScreepsConfig {
  /** Screeps API token (recommended) */
  token?: string;
  /** Screeps account email (alternative to token) */
  email?: string;
  /** Screeps account password (alternative to token) */
  password?: string;
  /** Screeps server host */
  host?: string;
  /** Screeps server port */
  port?: number;
  /** Protocol: http or https */
  protocol?: "http" | "https";
  /** Target shard name */
  shard?: string;
  /** MCP server URL (if using external MCP server) */
  mcpUrl?: string;
}

/**
 * GitHub configuration
 */
export interface GitHubConfig {
  /** GitHub personal access token */
  token: string;
  /** Repository in owner/repo format */
  repository: string;
  /** Base branch for PRs */
  baseBranch?: string;
}

/**
 * Agent autonomy levels
 */
export enum AutonomyLevel {
  /** Level 1: Agent suggests changes, human approves */
  Manual = "manual",
  /** Level 2: Agent implements changes, human reviews PR */
  SemiAuto = "semi-auto",
  /** Level 3: Agent implements, tests, and merges (future) */
  FullAuto = "full-auto"
}

/**
 * Agent task types
 */
export enum AgentTask {
  /** Review pull request changes */
  ReviewPR = "review_pr",
  /** Implement feature from issue */
  ImplementFeature = "implement_feature",
  /** Run test suites */
  RunTests = "run_tests",
  /** Optimize performance */
  OptimizePerformance = "optimize_performance",
  /** Analyze code quality */
  AnalyzeCode = "analyze_code",
  /** Update documentation */
  UpdateDocs = "update_docs"
}

/**
 * Task execution context
 */
export interface TaskContext {
  /** Task type to execute */
  task: AgentTask;
  /** Task-specific parameters */
  parameters: Record<string, unknown>;
  /** Issue number (if applicable) */
  issueNumber?: number;
  /** Pull request number (if applicable) */
  pullRequestNumber?: number;
  /** Branch name (if applicable) */
  branch?: string;
}

/**
 * Task execution result
 */
export interface TaskResult {
  /** Whether task succeeded */
  success: boolean;
  /** Result message */
  message: string;
  /** Task output data */
  data?: Record<string, unknown>;
  /** Error details if failed */
  error?: Error;
  /** Actions taken by the agent */
  actions?: AgentAction[];
}

/**
 * Agent action record
 */
export interface AgentAction {
  /** Action type */
  type: ActionType;
  /** Timestamp when action was taken */
  timestamp: Date;
  /** Action description */
  description: string;
  /** Action details */
  details?: Record<string, unknown>;
}

/**
 * Action types the agent can perform
 */
export enum ActionType {
  /** Reading data from MCP */
  MCPRead = "mcp_read",
  /** Writing data via MCP */
  MCPWrite = "mcp_write",
  /** Executing console command */
  ConsoleExecute = "console_execute",
  /** Creating or modifying files */
  FileModify = "file_modify",
  /** Running tests */
  TestRun = "test_run",
  /** Creating pull request */
  PRCreate = "pr_create",
  /** Adding PR comment */
  PRComment = "pr_comment",
  /** Creating issue */
  IssueCreate = "issue_create",
  /** Updating issue */
  IssueUpdate = "issue_update"
}

/**
 * MCP resource types
 */
export enum MCPResourceType {
  /** Room state and structures */
  Rooms = "screeps://game/rooms",
  /** Creep status and roles */
  Creeps = "screeps://game/creeps",
  /** Spawn queue and status */
  Spawns = "screeps://game/spawns",
  /** Bot memory structure */
  Memory = "screeps://memory",
  /** Performance and telemetry */
  Stats = "screeps://stats"
}

/**
 * Code review result
 */
export interface CodeReviewResult {
  /** Overall review status */
  status: "approved" | "changes_requested" | "commented";
  /** Review comments */
  comments: CodeReviewComment[];
  /** Suggested changes */
  suggestions?: string[];
  /** Summary of review */
  summary: string;
}

/**
 * Code review comment
 */
export interface CodeReviewComment {
  /** File path */
  path: string;
  /** Line number (optional) */
  line?: number;
  /** Comment text */
  body: string;
  /** Severity level */
  severity: "error" | "warning" | "info";
}

/**
 * Test execution result
 */
export interface TestExecutionResult {
  /** Whether all tests passed */
  passed: boolean;
  /** Total number of tests */
  total: number;
  /** Number of passed tests */
  passedCount: number;
  /** Number of failed tests */
  failedCount: number;
  /** Number of skipped tests */
  skippedCount: number;
  /** Test failures */
  failures?: TestFailure[];
  /** Test duration in milliseconds */
  duration: number;
}

/**
 * Test failure details
 */
export interface TestFailure {
  /** Test name */
  name: string;
  /** Test file */
  file: string;
  /** Error message */
  error: string;
  /** Stack trace */
  stack?: string;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  /** Whether deployment succeeded */
  success: boolean;
  /** Deployment message */
  message: string;
  /** Deployed version */
  version?: string;
  /** Deployment timestamp */
  timestamp: Date;
  /** Post-deployment validation result */
  validation?: ValidationResult;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  passed: boolean;
  /** Validation checks */
  checks: ValidationCheck[];
}

/**
 * Validation check
 */
export interface ValidationCheck {
  /** Check name */
  name: string;
  /** Whether check passed */
  passed: boolean;
  /** Check message */
  message: string;
}
