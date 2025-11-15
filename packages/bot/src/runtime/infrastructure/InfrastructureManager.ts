import { RoadPlanner } from "./RoadPlanner";
import { TrafficManager } from "./TrafficManager";
import { ContainerPlacement } from "./ContainerPlacement";
import type { GameContext } from "@runtime/types/GameContext";
import { profile } from "@profiler";

/**
 * Infrastructure manager memory structure
 */
export interface InfrastructureMemory {
  traffic?: {
    movementRequests: Record<string, unknown>;
    trafficData?: Record<string, { count: number; lastUpdated: number }>;
  };
  roadPlanning?: {
    lastPlanned: Record<string, number>; // roomName -> tick
  };
  containerPlanning?: {
    lastPlanned: Record<string, number>; // roomName -> tick
  };
}

/**
 * Configuration for infrastructure manager
 */
export interface InfrastructureManagerConfig {
  logger?: Pick<Console, "log" | "warn">;
  memory?: InfrastructureMemory;
  roadPlanningInterval?: number; // Ticks between road planning (default: 100)
  containerPlanningInterval?: number; // Ticks between container planning (default: 500)
  trafficDecayInterval?: number; // Ticks between traffic decay (default: 50)
  maxRoadsPerTick?: number; // Max road construction sites per tick (default: 1)
  enableTrafficAnalysis?: boolean; // Enable traffic recording (default: true)
}

/**
 * Manages automated road planning, traffic analysis, and infrastructure maintenance.
 * Coordinates RoadPlanner and TrafficManager to optimize creep movement paths.
 */
@profile
export class InfrastructureManager {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly roadPlanner: RoadPlanner;
  private readonly trafficManager: TrafficManager;
  private readonly containerPlacement: ContainerPlacement;
  private readonly memoryRef?: InfrastructureMemory;
  private readonly roadPlanningInterval: number;
  private readonly containerPlanningInterval: number;
  private readonly trafficDecayInterval: number;
  private lastTrafficDecay: number = 0;

  public constructor(config: InfrastructureManagerConfig = {}) {
    this.logger = config.logger ?? console;
    this.memoryRef = config.memory;
    this.roadPlanningInterval = config.roadPlanningInterval ?? 100;
    this.containerPlanningInterval = config.containerPlanningInterval ?? 500;
    this.trafficDecayInterval = config.trafficDecayInterval ?? 50;

    // Initialize infrastructure memory structures if memory reference provided
    if (this.memoryRef) {
      // Initialize traffic memory structure if needed
      this.memoryRef.traffic ??= {
        movementRequests: {},
        trafficData: {}
      };

      // Initialize road planning memory
      this.memoryRef.roadPlanning ??= { lastPlanned: {} };

      // Initialize container planning memory
      this.memoryRef.containerPlanning ??= { lastPlanned: {} };
    }

    // Initialize traffic manager with memory reference
    // Note: passing the actual memory object, not a copy
    this.trafficManager = new TrafficManager({
      logger: this.logger,
      memory: this.memoryRef?.traffic,
      enableTrafficAnalysis: config.enableTrafficAnalysis ?? true
    });

    // Initialize road planner and connect to traffic manager
    this.roadPlanner = new RoadPlanner(this.logger, config.maxRoadsPerTick ?? 1);
    this.roadPlanner.setTrafficManager(this.trafficManager);

    // Initialize container placement
    this.containerPlacement = new ContainerPlacement(this.logger);
  }

  /**
   * Main execution loop - called each tick from kernel
   * Handles traffic tracking, decay, periodic road planning, and container placement
   */
  public run(game: GameContext): {
    roadsPlanned: number;
    containersPlanned: number;
    trafficPositions: number;
  } {
    // Apply traffic decay periodically
    if (game.time - this.lastTrafficDecay >= this.trafficDecayInterval) {
      this.trafficManager.applyTrafficDecay();
      this.lastTrafficDecay = game.time;
    }

    let totalRoadsPlanned = 0;
    let totalContainersPlanned = 0;

    // Process each owned room
    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];

      if (!room.controller?.my) {
        continue;
      }

      // Plan containers for sources (less frequent than roads)
      const lastContainerPlanned = this.memoryRef?.containerPlanning?.lastPlanned[roomName] ?? 0;
      if (game.time - lastContainerPlanned >= this.containerPlanningInterval) {
        const containersPlanned = this.containerPlacement.planSourceContainers(room);
        totalContainersPlanned += containersPlanned;

        // Update last planned time
        if (this.memoryRef?.containerPlanning) {
          this.memoryRef.containerPlanning.lastPlanned[roomName] = game.time;
        }
      }

      // Plan roads (existing logic)
      const lastRoadPlanned = this.memoryRef?.roadPlanning?.lastPlanned[roomName] ?? 0;
      if (game.time - lastRoadPlanned >= this.roadPlanningInterval) {
        const result = this.roadPlanner.autoPlaceRoads(room, game);
        totalRoadsPlanned += result.created;

        // Update last planned time
        if (this.memoryRef?.roadPlanning) {
          this.memoryRef.roadPlanning.lastPlanned[roomName] = game.time;
        }

        if (result.created > 0) {
          this.logger.log?.(
            `[InfrastructureManager] Planned ${result.created} roads in ${roomName} at tick ${game.time}`
          );
        }
      }
    }

    // Save traffic data to memory
    this.trafficManager.saveToMemory();

    return {
      roadsPlanned: totalRoadsPlanned,
      containersPlanned: totalContainersPlanned,
      trafficPositions: this.trafficManager.getTrackedPositionCount()
    };
  }

  /**
   * Record creep movement for traffic analysis
   * Should be called whenever a creep moves
   */
  public recordCreepMovement(creep: Creep): void {
    this.trafficManager.recordMovement(creep.pos);
  }

  /**
   * Get the traffic manager instance
   */
  public getTrafficManager(): TrafficManager {
    return this.trafficManager;
  }

  /**
   * Get the road planner instance
   */
  public getRoadPlanner(): RoadPlanner {
    return this.roadPlanner;
  }

  /**
   * Get high-traffic positions for monitoring/debugging
   */
  public getHighTrafficPositions(threshold: number = 10): Array<{ pos: RoomPosition; count: number }> {
    return this.trafficManager.getHighTrafficPositions(threshold);
  }
}
