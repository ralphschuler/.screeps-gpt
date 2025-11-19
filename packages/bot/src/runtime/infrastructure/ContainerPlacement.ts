import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Manages automatic placement of containers at energy sources for RCL 2+
 * Enables stationary harvester economy for improved energy efficiency
 */
@profile
export class ContainerPlacement {
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(logger?: Pick<Console, "log" | "warn">) {
    this.logger = logger ?? console;
  }

  /**
   * Plan and create container construction sites for sources in the room
   * Only places containers if:
   * - Room is RCL 2+
   * - Source doesn't already have a container nearby
   * - Valid walkable position exists 1 space away from source (range 2)
   */
  public planSourceContainers(room: Room): number {
    // Only place containers at RCL 2+
    if (!room.controller?.my || room.controller.level < 2) {
      return 0;
    }

    const sources = room.find(FIND_SOURCES);
    let containersPlanned = 0;

    for (const source of sources) {
      // Check if container already exists or is planned (range 2 = 1 space away)
      const existingContainers = source.pos.findInRange(FIND_STRUCTURES, 2, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      });

      const containerSites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      });

      if (existingContainers.length > 0 || containerSites.length > 0) {
        continue; // Container already exists or planned
      }

      // Find optimal position for container
      const containerPos = this.findOptimalContainerPosition(source, room);
      if (containerPos) {
        const result = room.createConstructionSite(containerPos.x, containerPos.y, STRUCTURE_CONTAINER);
        if (result === OK) {
          containersPlanned++;
          this.logger.log?.(
            `[ContainerPlacement] Planned container at (${containerPos.x},${containerPos.y}) for source ${source.id} in ${room.name}`
          );
        }
      }
    }

    return containersPlanned;
  }

  /**
   * Find the optimal position for a container near a source
   * Prioritizes positions closest to spawn while being 1 space away from source (range 2)
   */
  private findOptimalContainerPosition(source: Source, room: Room): RoomPosition | null {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return null; // No spawn to optimize for
    }

    // Get all positions at range 2 (1 space away) from source
    const candidatePositions: RoomPosition[] = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        // Skip the source itself and adjacent positions
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
        // Only include positions at exactly range 2 (Chebyshev distance)
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;

        const pos = new RoomPosition(source.pos.x + dx, source.pos.y + dy, room.name);
        candidatePositions.push(pos);
      }
    }

    // Filter to walkable positions and sort by distance to spawn
    const walkablePositions = candidatePositions.filter(pos => this.isWalkable(pos, room));

    if (walkablePositions.length === 0) {
      return null;
    }

    // Sort by distance to spawn (closest first)
    walkablePositions.sort((a, b) => {
      const distA = spawn.pos.getRangeTo(a);
      const distB = spawn.pos.getRangeTo(b);
      return distA - distB;
    });

    return walkablePositions[0];
  }

  /**
   * Check if a position is walkable (no walls, no structures blocking)
   */
  private isWalkable(pos: RoomPosition, room: Room): boolean {
    // Check terrain
    const terrain = room.getTerrain();
    if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) {
      return false;
    }

    // Check for blocking structures (allow roads and containers)
    const structures = pos.lookFor(LOOK_STRUCTURES);
    const blockingStructures = structures.filter(
      s => s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER
    );

    return blockingStructures.length === 0;
  }
}
