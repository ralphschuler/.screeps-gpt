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
  type RecoveryState
} from "./RecoveryOrchestrator";
