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
  UpdateDocs = "update_docs",
  /** Research a topic and deliver insights */
  Research = "research",
  /** Create strategic plans for Screeps development */
  Strategize = "strategize"
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
  IssueUpdate = "issue_update",
  /** Research analysis */
  ResearchAnalysis = "research_analysis",
  /** Strategic planning */
  StrategicPlanning = "strategic_planning"
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

/**
 * Research request scope
 */
export type ResearchScope = "internal" | "external" | "comprehensive";

/**
 * Research request depth
 */
export type ResearchDepth = "overview" | "detailed" | "exhaustive";

/**
 * Research output format
 */
export type ResearchOutputFormat = "summary" | "report" | "actionable_items";

/**
 * Research request configuration
 */
export interface ResearchRequest {
  /** Topic to research */
  topic: string;
  /** Scope of research */
  scope: ResearchScope;
  /** Depth of research */
  depth: ResearchDepth;
  /** Output format */
  outputFormat: ResearchOutputFormat;
  /** Optional context for the research */
  context?: string;
  /** Optional keywords to focus on */
  keywords?: string[];
}

/**
 * Research finding from analysis
 */
export interface ResearchFinding {
  /** Finding title */
  title: string;
  /** Finding description */
  description: string;
  /** Relevance score (0-100) */
  relevance: number;
  /** Supporting evidence */
  evidence: string[];
  /** Category of finding */
  category: string;
}

/**
 * Research recommendation
 */
export interface ResearchRecommendation {
  /** Recommendation title */
  title: string;
  /** Detailed recommendation */
  description: string;
  /** Priority level */
  priority: "critical" | "high" | "medium" | "low";
  /** Estimated effort */
  effort: "trivial" | "small" | "medium" | "large" | "xlarge";
  /** Expected impact */
  impact: string;
}

/**
 * Research source reference
 */
export interface ResearchSource {
  /** Source title or name */
  title: string;
  /** Source URL or file path */
  location: string;
  /** Source type */
  type: "documentation" | "code" | "issue" | "external" | "api";
  /** Reliability score (0-100) */
  reliability: number;
}

/**
 * Complete research result
 */
export interface ResearchResult {
  /** Researched topic */
  topic: string;
  /** Research findings */
  findings: ResearchFinding[];
  /** Recommendations based on findings */
  recommendations: ResearchRecommendation[];
  /** Sources used in research */
  sources: ResearchSource[];
  /** Confidence score (0-100) */
  confidence: number;
  /** Research timestamp */
  timestamp: Date;
  /** Executive summary */
  summary: string;
}

/**
 * Strategy domain types
 */
export type StrategyDomain = "expansion" | "economy" | "defense" | "combat" | "infrastructure" | "optimization";

/**
 * Strategy time horizon
 */
export type StrategyTimeHorizon = "short" | "medium" | "long";

/**
 * Strategy constraints
 */
export interface StrategyConstraints {
  /** Maximum CPU budget */
  maxCPU?: number;
  /** Maximum memory budget */
  maxMemory?: number;
  /** Resource constraints */
  resources?: Record<string, number>;
  /** Time constraints */
  timeLimit?: number;
  /** Must work with existing systems */
  compatibility?: string[];
}

/**
 * Strategy objective
 */
export interface StrategyObjective {
  /** Objective name */
  name: string;
  /** Objective description */
  description: string;
  /** Target metric */
  metric: string;
  /** Target value */
  target: number | string;
  /** Priority */
  priority: "critical" | "high" | "medium" | "low";
}

/**
 * Strategy request configuration
 */
export interface StrategyRequest {
  /** Strategy domain */
  domain: StrategyDomain;
  /** Strategy constraints */
  constraints: StrategyConstraints;
  /** Strategy objectives */
  objectives: StrategyObjective[];
  /** Time horizon for strategy */
  timeHorizon: StrategyTimeHorizon;
  /** Current game state context */
  currentState?: Record<string, unknown>;
}

/**
 * Strategy phase definition
 */
export interface StrategyPhase {
  /** Phase name */
  name: string;
  /** Phase description */
  description: string;
  /** Phase order */
  order: number;
  /** Duration estimate */
  duration: string;
  /** Phase actions */
  actions: StrategyAction[];
  /** Prerequisites */
  prerequisites: string[];
  /** Completion criteria */
  completionCriteria: string[];
}

/**
 * Strategy action
 */
export interface StrategyAction {
  /** Action name */
  name: string;
  /** Action description */
  description: string;
  /** Action type */
  type: "implement" | "configure" | "monitor" | "validate";
  /** Target files or modules */
  targets: string[];
  /** Priority */
  priority: "critical" | "high" | "medium" | "low";
}

/**
 * Success metric for strategy
 */
export interface SuccessMetric {
  /** Metric name */
  name: string;
  /** Current value */
  currentValue: number | string;
  /** Target value */
  targetValue: number | string;
  /** Unit of measurement */
  unit: string;
  /** How to measure */
  measurementMethod: string;
}

/**
 * Risk assessment for strategy
 */
export interface RiskAssessment {
  /** Risk name */
  name: string;
  /** Risk description */
  description: string;
  /** Probability (0-100) */
  probability: number;
  /** Impact (0-100) */
  impact: number;
  /** Mitigation strategy */
  mitigation: string;
}

/**
 * Implementation plan for strategy
 */
export interface ImplementationPlan {
  /** Plan summary */
  summary: string;
  /** Files to modify */
  filesToModify: string[];
  /** Files to create */
  filesToCreate: string[];
  /** Tests to add */
  testsToAdd: string[];
  /** Documentation updates */
  documentationUpdates: string[];
  /** Estimated effort */
  estimatedEffort: string;
}

/**
 * Complete strategy result
 */
export interface StrategyResult {
  /** Strategy domain */
  domain: StrategyDomain;
  /** Strategy phases */
  phases: StrategyPhase[];
  /** Success metrics */
  metrics: SuccessMetric[];
  /** Risk assessments */
  risks: RiskAssessment[];
  /** Implementation plan */
  implementation: ImplementationPlan;
  /** Strategy timestamp */
  timestamp: Date;
  /** Executive summary */
  summary: string;
  /** Confidence score (0-100) */
  confidence: number;
}
