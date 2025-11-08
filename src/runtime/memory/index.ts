export { MemoryManager } from "./MemoryManager";
export { MemoryGarbageCollector } from "./MemoryGarbageCollector";
export { MemoryMigrationManager } from "./MemoryMigrationManager";
export { MemoryUtilizationMonitor } from "./MemoryUtilizationMonitor";
export { MemorySelfHealer } from "./MemorySelfHealer";
export { MemoryValidator } from "./MemoryValidator";

export type { GarbageCollectorConfig, CleanupResult } from "./MemoryGarbageCollector";
export type { Migration, MigrationHandler, MigrationResult } from "./MemoryMigrationManager";
export type { UtilizationMonitorConfig, MemoryUtilization } from "./MemoryUtilizationMonitor";
export type { SelfHealerConfig, HealthCheckResult } from "./MemorySelfHealer";
