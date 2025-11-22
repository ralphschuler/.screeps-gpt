/**
 * Health monitoring and autonomous recovery system.
 *
 * This module provides comprehensive bot health self-diagnostic capabilities
 * with autonomous recovery orchestration to prevent death spirals.
 */

export { HealthMonitor, HealthState, type HealthStatus, type HealthMetrics, type HealthConfig } from "./HealthMonitor";
export { WarningDetector, WarningType, type HealthWarning, type WarningConfig } from "./WarningDetector";
export {
  RecoveryOrchestrator,
  RecoveryMode,
  type RecoveryAction,
  type RecoveryState,
  type RecoveryConfig
} from "./RecoveryOrchestrator";

/**
 * Memory structure for stored health data (used by StatsCollector and other processes)
 */
export interface HealthDataMemory {
  score: number;
  state: string;
  metrics: {
    workforce: number;
    energy: number;
    spawn: number;
    infrastructure: number;
  };
  timestamp: number;
  warnings?: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
  recovery?: {
    mode: string;
    actionsCount: number;
  };
}

/**
 * Memory structure for recovery state
 */
export interface RecoveryStateMemory {
  mode: string;
  actions: RecoveryAction[];
  lastActionAt?: number;
}
