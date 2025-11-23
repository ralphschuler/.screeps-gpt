 
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { RuntimeProtocols } from "@runtime/protocols";
import type { GameContext } from "@runtime/types/GameContext";
import { ScoutManager } from "@runtime/scouting/ScoutManager";

/**
 * Scouting process that discovers and evaluates adjacent rooms for remote mining.
 * Responsibilities:
 * - Scout adjacent rooms periodically
 * - Update room data in Memory.scout
 * - Calculate path distances from home rooms
 * - Clean up old scout data
 *
 * Priority: 60 (medium) - Runs between infrastructure and behavior
 */
@registerProcess({ name: "ScoutingProcess", priority: 60, singleton: true })
export class ScoutingProcess {
  private readonly scoutManager: ScoutManager;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;
  private readonly scoutingInterval: number;

  public constructor() {
    this.logger = console;
    this.scoutManager = new ScoutManager(this.logger);
    this.cpuEmergencyThreshold = 0.9;
    this.scoutingInterval = 100; // Scout every 100 ticks
  }

  public run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

     
    // Skip if emergency reset or respawn occurred
    if (ctx.protocol.isEmergencyReset() || ctx.protocol.needsRespawn()) {
      return;
    }

    // CPU guard before scouting operations
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[ScoutingProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `aborting scouting operations`
      );
      return;
    }

    // Initialize scout memory
    this.scoutManager.initializeMemory(memory);

    // Only scout periodically to reduce CPU usage
    const scoutMemory = memory.scout as { lastUpdate: number };
    if (scoutMemory && gameContext.time - scoutMemory.lastUpdate < this.scoutingInterval) {
      return;
    }

    // Get owned rooms
    const ownedRooms = Object.values(gameContext.rooms).filter(room => room.controller?.my);

    if (ownedRooms.length === 0) {
      return;
    }

    // Scout adjacent rooms for each owned room
    for (const ownedRoom of ownedRooms) {
      this.scoutAdjacentRooms(ownedRoom, gameContext, memory);
    }

    // Clean up old scout data (data older than 10k ticks)
    this.scoutManager.cleanupOldData(memory, gameContext);

    this.logger.log?.(`[ScoutingProcess] Scouting complete at tick ${gameContext.time}`);
  }

  /**
   * Scout all adjacent rooms around an owned room
   */
  private scoutAdjacentRooms(homeRoom: { name: string }, gameContext: GameContext, memory: Memory): void {
    // Parse room name to get coordinates
    const match = homeRoom.name.match(/^([WE])(\d+)([NS])(\d+)$/);
    if (!match) {
      return;
    }

    const [, ewDir, ewNum, nsDir, nsNum] = match;
    const x = (ewDir === "W" ? -1 : 1) * parseInt(ewNum);
    const y = (nsDir === "S" ? -1 : 1) * parseInt(nsNum);

    // Generate adjacent room names (8 directions)
    const adjacentRooms: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip home room

        const adjX = x + dx;
        const adjY = y + dy;

        const adjEwDir = adjX < 0 ? "W" : "E";
        const adjNsDir = adjY < 0 ? "S" : "N";
        const adjRoomName = `${adjEwDir}${Math.abs(adjX)}${adjNsDir}${Math.abs(adjY)}`;

        adjacentRooms.push(adjRoomName);
      }
    }

    // Scout rooms that have visibility
    for (const roomName of adjacentRooms) {
      const room = gameContext.rooms[roomName];
      if (room) {
        // Room has visibility - scout it
        this.scoutManager.scoutRoom(room, memory, gameContext);

        // Update path distance from home room
        this.scoutManager.updatePathDistance(homeRoom.name, roomName, memory);
      }
    }
  }
}
