/**
 * Runtime protocols for inter-process communication.
 * These protocols replace Memory-based communication patterns with type-safe,
 * zero-overhead protocol-based communication using the screeps-kernel system.
 */

// Import all protocols to trigger @protocol decorator registration
import "./StateCoordinationProtocol";
import "./RoleManagementProtocol";
import "./BehaviorCoordinationProtocol";
import "./BootstrapCoordinationProtocol";
import "./MetricsCoordinationProtocol";
import "./HealthMonitoringProtocol";

// Export protocol classes for testing
export { StateCoordinationProtocol } from "./StateCoordinationProtocol";
export { RoleManagementProtocol } from "./RoleManagementProtocol";
export { BehaviorCoordinationProtocol } from "./BehaviorCoordinationProtocol";
export { BootstrapCoordinationProtocol } from "./BootstrapCoordinationProtocol";
export { MetricsCoordinationProtocol } from "./MetricsCoordinationProtocol";
export { HealthMonitoringProtocol } from "./HealthMonitoringProtocol";

// Export protocol interfaces for type safety
export type { IStateCoordinationProtocol } from "./StateCoordinationProtocol";
export type { IRoleManagementProtocol, RoleCounts } from "./RoleManagementProtocol";
export type { IBehaviorCoordinationProtocol } from "./BehaviorCoordinationProtocol";
export type { IBootstrapCoordinationProtocol, BootstrapStatus } from "./BootstrapCoordinationProtocol";
export type { IMetricsCoordinationProtocol, MemoryUtilization } from "./MetricsCoordinationProtocol";
export type {
  IHealthMonitoringProtocol,
  HealthMetrics,
  HealthWarning,
  RecoveryState
} from "./HealthMonitoringProtocol";

/**
 * Combined protocol interface for type-safe process contexts.
 * Use this interface in ProcessContext generic parameter to get type checking
 * for all protocol methods.
 *
 * @example
 * import type { RuntimeProtocols } from "@runtime/protocols";
 *
 * @process({ name: "MyProcess", priority: 50 })
 * export class MyProcess {
 *   run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
 *     // TypeScript knows about all protocol methods
 *     if (ctx.protocol.isEmergencyReset()) { ... }
 *     const roleCounts = ctx.protocol.getRoleCounts();
 *   }
 * }
 */
export interface RuntimeProtocols
  extends IStateCoordinationProtocol,
    IRoleManagementProtocol,
    IBehaviorCoordinationProtocol,
    IBootstrapCoordinationProtocol,
    IMetricsCoordinationProtocol,
    IHealthMonitoringProtocol {}
