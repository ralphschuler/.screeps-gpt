/**
 * Service Locator for accessing shared services in role controllers.
 * This avoids the need to pass dependencies through every role controller.
 */

import type { CreepCommunicationManager } from "../CreepCommunicationManager";
import type { EnergyPriorityManager } from "@runtime/energy";
import type { WallUpgradeManager } from "@runtime/defense/WallUpgradeManager";
import type { PathfindingManager } from "@runtime/pathfinding";

/**
 * Global service references that can be accessed by role controllers
 */
class ServiceRegistry {
  private communicationManager: CreepCommunicationManager | null = null;
  private energyPriorityManager: EnergyPriorityManager | null = null;
  private wallUpgradeManager: WallUpgradeManager | null = null;
  private pathfindingManager: PathfindingManager | null = null;

  public setCommunicationManager(manager: CreepCommunicationManager): void {
    this.communicationManager = manager;
  }

  public getCommunicationManager(): CreepCommunicationManager | null {
    return this.communicationManager;
  }

  public setEnergyPriorityManager(manager: EnergyPriorityManager): void {
    this.energyPriorityManager = manager;
  }

  public getEnergyPriorityManager(): EnergyPriorityManager | null {
    return this.energyPriorityManager;
  }

  public setWallUpgradeManager(manager: WallUpgradeManager): void {
    this.wallUpgradeManager = manager;
  }

  public getWallUpgradeManager(): WallUpgradeManager | null {
    return this.wallUpgradeManager;
  }

  public setPathfindingManager(manager: PathfindingManager): void {
    this.pathfindingManager = manager;
  }

  public getPathfindingManager(): PathfindingManager | null {
    return this.pathfindingManager;
  }
}

// Global singleton instance
export const serviceRegistry = new ServiceRegistry();
