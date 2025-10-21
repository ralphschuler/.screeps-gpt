export interface BehaviorSummary {
  processedCreeps: number;
  spawnedCreeps: string[];
  tasksExecuted: Record<string, number>;
}

export interface PerformanceSnapshot {
  tick: number;
  cpuUsed: number;
  cpuLimit: number;
  cpuBucket: number;
  creepCount: number;
  roomCount: number;
  spawnOrders: number;
  warnings: string[];
  execution: BehaviorSummary;
}

export interface CoverageSummary {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface RepositorySignal {
  coverage?: CoverageSummary;
  lintErrors?: number;
  testFailures?: number;
  timestamp: string;
}

export type EvaluationSeverity = "info" | "warning" | "critical";

export interface EvaluationFinding {
  severity: EvaluationSeverity;
  title: string;
  detail: string;
  recommendation: string;
}

export interface SystemReport {
  tick: number;
  summary: string;
  findings: EvaluationFinding[];
  repository?: RepositorySignal;
}

export interface EvaluationResult {
  report: SystemReport;
  persisted: boolean;
}
