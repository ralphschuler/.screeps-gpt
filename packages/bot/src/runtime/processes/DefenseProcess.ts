import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import { ThreatDetector, type ThreatMemory } from "@runtime/defense/ThreatDetector";
import { DefenseCoordinator, type DefenseMemory } from "@runtime/defense/DefenseCoordinator";
import { TowerManager } from "@runtime/defense/TowerManager";
import { CombatManager, type CombatManagerMemory } from "@runtime/defense/CombatManager";

/**
 * Defense coordination process that handles threat detection and defensive responses.
 * Responsibilities:
 * - Threat detection and tracking
 * - Tower management and targeting
 * - Combat coordination and squad management
 * - Defensive posture management
 * 
 * Priority: 90 (high) - Must run early to respond to threats
 */
@registerProcess({ name: "DefenseProcess", priority: 90, singleton: true })
export class DefenseProcess {
  private readonly defenseCoordinator: DefenseCoordinator;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor() {
    this.logger = console;
    this.cpuEmergencyThreshold = 0.9;

    // Initialize defense memory structures
    if (typeof Memory !== "undefined") {
      Memory.threats ??= { rooms: {}, lastUpdate: 0 };
      Memory.defense ??= { posture: {}, lastDefenseAction: 0 };
      Memory.combat ??= { squads: {} };
    }

    const threatMemory: ThreatMemory | undefined =
      typeof Memory !== "undefined" && Memory.threats ? Memory.threats : undefined;
    const defenseMemory: DefenseMemory | undefined =
      typeof Memory !== "undefined" && Memory.defense ? Memory.defense : undefined;
    const combatMemory: CombatManagerMemory | undefined =
      typeof Memory !== "undefined" && Memory.combat ? Memory.combat : undefined;

    const threatDetector = new ThreatDetector(this.logger, threatMemory);
    const towerManager = new TowerManager(this.logger);
    const combatManager = new CombatManager({ logger: this.logger, memory: combatMemory });

    this.defenseCoordinator = new DefenseCoordinator(
      threatDetector,
      towerManager,
      combatManager,
      this.logger,
      defenseMemory
    );
  }

  public run(ctx: ProcessContext<Memory>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // Skip if emergency reset occurred
    if (memory.emergencyReset) {
      return;
    }

    // Initialize defense memory structures if needed
    memory.threats ??= { rooms: {}, lastUpdate: 0 };
    memory.defense ??= { posture: {}, lastDefenseAction: 0 };
    memory.combat ??= { squads: {} };

    // CPU guard before defense operations
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[DefenseProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `aborting defense operations`
      );
      return;
    }

    // Coordinate defense for all owned rooms
    for (const roomName in gameContext.rooms) {
      const room = gameContext.rooms[roomName];
      if (room.controller?.my) {
        this.defenseCoordinator.coordinateDefense(room, gameContext.time);
      }
    }
  }
}
