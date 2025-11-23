// Core behavior system
export { BehaviorController } from "./BehaviorController";
export { RoleControllerManager } from "./RoleControllerManager";
export { CreepCommunicationManager } from "./CreepCommunicationManager";
export type { CreepCommunicationConfig, CommunicationVerbosity, CreepAction } from "./CreepCommunicationManager";
export { BodyComposer } from "./BodyComposer";
export type { BodyPattern } from "./BodyComposer";
export { EnergyBalanceCalculator } from "./EnergyBalanceCalculator";
export type { EnergyBalance } from "./EnergyBalanceCalculator";
export { RoleTaskQueueManager, TaskPriority } from "./RoleTaskQueue";
export type { TaskQueueEntry, RoleTaskQueueMemory } from "./RoleTaskQueue";

// Modular role controllers
export * from "./controllers";

// State machine-based behavior system
export { StateMachineManager } from "./StateMachineManager";
export * from "./stateMachines";
export * from "./roleExecutors";
