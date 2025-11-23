/**
 * Role Controllers
 *
 * Each role controller is responsible for executing behavior logic for creeps of that role.
 * Controllers are modular and independent, making them easier to maintain and test.
 */

export * from "./RoleController";
export * from "./ServiceLocator";
export * from "./helpers";

// Core economy roles
export { HarvesterController } from "./HarvesterController";
export { UpgraderController } from "./UpgraderController";
export { BuilderController } from "./BuilderController";
export { HaulerController } from "./HaulerController";
export { RepairerController } from "./RepairerController";

// Specialized roles
export { StationaryHarvesterController } from "./StationaryHarvesterController";
export { RemoteMinerController } from "./RemoteMinerController";
export { RemoteHaulerController } from "./RemoteHaulerController";

// Combat roles
export { AttackerController } from "./AttackerController";
export { HealerController } from "./HealerController";
export { DismantlerController } from "./DismantlerController";

// Support roles
export { ClaimerController } from "./ClaimerController";
export { ScoutController } from "./ScoutController";
