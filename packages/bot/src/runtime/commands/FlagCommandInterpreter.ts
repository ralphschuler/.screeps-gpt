import { profile } from "@ralphschuler/screeps-profiler";
import type { GameContext } from "@runtime/types/GameContext";

/**
 * Flag command types based on primary color
 */
export enum FlagCommandType {
  ATTACK = "ATTACK", // Red: Attack/raid target
  CLAIM = "CLAIM", // Blue: Claim room target
  REMOTE_MINE = "REMOTE_MINE", // Green: Remote mining site
  EXPAND = "EXPAND", // Yellow: Expansion/colonization target
  SCOUT = "SCOUT", // White: Observation/scout target
  DEFEND = "DEFEND", // Purple: Defense priority area
  BUILD = "BUILD", // Orange: Construction focus area
  RESERVE = "RESERVE" // Brown: Reserve controller target
}

/**
 * Priority level based on secondary color
 */
export enum FlagPriority {
  LOW = "LOW", // White secondary
  MEDIUM = "MEDIUM", // Orange secondary
  HIGH = "HIGH" // Red secondary
}

/**
 * Parsed flag command with type and priority
 */
export interface FlagCommand {
  /** Flag name */
  name: string;
  /** Command type */
  type: FlagCommandType;
  /** Priority level */
  priority: FlagPriority;
  /** Room name where flag is placed */
  roomName: string;
  /** Position of the flag */
  pos: { x: number; y: number };
  /** Raw flag object */
  flag: Flag;
}

/**
 * Command validation result
 */
export interface CommandValidation {
  /** Whether the command is valid */
  valid: boolean;
  /** Reason if invalid */
  reason?: string;
  /** Prerequisites not met */
  missingPrerequisites?: string[];
}

/**
 * Interprets flag colors into actionable commands for the bot.
 * Provides a user interface for directing bot behavior without code changes.
 *
 * Color Conventions (Primary):
 * - Red: Attack/raid target
 * - Blue: Claim room target
 * - Green: Remote mining site
 * - Yellow: Expansion/colonization target
 * - White: Observation/scout target
 * - Purple: Defense priority area
 * - Orange: Construction focus area
 * - Brown: Reserve controller target
 *
 * Priority (Secondary Color):
 * - White: Low priority
 * - Orange: Medium priority
 * - Red: High priority
 */
@profile
export class FlagCommandInterpreter {
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(logger: Pick<Console, "log" | "warn"> = console) {
    this.logger = logger;
  }

  /**
   * Parse all game flags into commands
   */
  public parseFlags(game: GameContext): FlagCommand[] {
    const commands: FlagCommand[] = [];

    const flags = game.flags as Record<string, Flag | undefined>;
    for (const flagName in flags) {
      const flag = flags[flagName];
      if (!flag) continue;

      const command = this.parseSingleFlag(flag);
      if (command) {
        commands.push(command);
      }
    }

    return commands;
  }

  /**
   * Parse a single flag into a command
   */
  private parseSingleFlag(flag: Flag): FlagCommand | null {
    const type = this.getCommandType(flag.color);
    if (!type) {
      return null;
    }

    const priority = this.getPriority(flag.secondaryColor);

    return {
      name: flag.name,
      type,
      priority,
      roomName: flag.pos.roomName,
      pos: { x: flag.pos.x, y: flag.pos.y },
      flag
    };
  }

  /**
   * Map primary flag color to command type
   */
  private getCommandType(color: ColorConstant): FlagCommandType | null {
    switch (color) {
      case COLOR_RED:
        return FlagCommandType.ATTACK;
      case COLOR_BLUE:
        return FlagCommandType.CLAIM;
      case COLOR_GREEN:
        return FlagCommandType.REMOTE_MINE;
      case COLOR_YELLOW:
        return FlagCommandType.EXPAND;
      case COLOR_WHITE:
        return FlagCommandType.SCOUT;
      case COLOR_PURPLE:
        return FlagCommandType.DEFEND;
      case COLOR_ORANGE:
        return FlagCommandType.BUILD;
      case COLOR_BROWN:
        return FlagCommandType.RESERVE;
      default:
        return null;
    }
  }

  /**
   * Map secondary flag color to priority
   */
  private getPriority(color: ColorConstant): FlagPriority {
    switch (color) {
      case COLOR_RED:
        return FlagPriority.HIGH;
      case COLOR_ORANGE:
        return FlagPriority.MEDIUM;
      case COLOR_WHITE:
      default:
        return FlagPriority.LOW;
    }
  }

  /**
   * Validate command feasibility based on game state
   */
  public validateCommand(command: FlagCommand, game: GameContext, _memory: Memory): CommandValidation {
    const missingPrerequisites: string[] = [];

    // Validate based on command type
    switch (command.type) {
      case FlagCommandType.CLAIM:
        if (!this.hasClaimerCapability(game)) {
          missingPrerequisites.push("No claimer creep or spawn capacity available");
        }
        if (!this.hasGCL(game)) {
          missingPrerequisites.push("Insufficient GCL for new room");
        }
        break;

      case FlagCommandType.REMOTE_MINE:
        if (!this.hasRemoteHaulers(game)) {
          missingPrerequisites.push("No remote hauler creeps available");
        }
        break;

      case FlagCommandType.ATTACK:
        if (!this.hasAttackCreeps(game)) {
          missingPrerequisites.push("No attack creeps available");
        }
        break;

      case FlagCommandType.RESERVE:
        if (!this.hasReserverCreep(game)) {
          missingPrerequisites.push("No reserver creep available");
        }
        break;
    }

    // Check general prerequisites
    if (!this.hasStableEnergy(game)) {
      missingPrerequisites.push("Insufficient energy reserves");
    }

    if (missingPrerequisites.length > 0) {
      return {
        valid: false,
        reason: `Prerequisites not met: ${missingPrerequisites.join(", ")}`,
        missingPrerequisites
      };
    }

    return { valid: true };
  }

  /**
   * Minimum energy cost for claimer body (CLAIM + MOVE)
   */
  private static readonly CLAIMER_BODY_COST = 650;

  /**
   * Check if bot has claimer capability (existing claimer OR spawn with capacity)
   * This allows claim flags to be valid even before a claimer is spawned.
   */
  private hasClaimerCapability(game: GameContext): boolean {
    // Check for existing claimer creep
    for (const name in game.creeps) {
      const creep = game.creeps[name];
      if (creep?.memory?.role === "claimer") {
        return true;
      }
    }

    // Check if any spawn can build a claimer body (650 energy for CLAIM + MOVE)
    for (const spawnName in game.spawns) {
      const spawn = game.spawns[spawnName];
      // Check room energy capacity (what the room CAN hold when fully charged)
      const room = spawn?.room;
      const energyCapacity = room?.energyCapacityAvailable ?? 300;
      if (energyCapacity >= FlagCommandInterpreter.CLAIMER_BODY_COST) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if bot has sufficient GCL using live game data
   * GCL level determines the maximum number of rooms that can be controlled
   */
  private hasGCL(game: GameContext): boolean {
    const controlledRooms = Object.values(game.rooms).filter(room => room.controller?.my).length;
    // Use live game.gcl data instead of stale memory
    const gcl = game.gcl as { level: number } | undefined;
    const gclLevel = gcl?.level ?? 1;
    return controlledRooms < gclLevel;
  }

  /**
   * Check if bot has remote hauler creeps
   */
  private hasRemoteHaulers(game: GameContext): boolean {
    for (const name in game.creeps) {
      const creep = game.creeps[name];
      if (creep?.memory?.role === "hauler" || creep?.memory?.role === "remoteHauler") {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if bot has attack creeps
   */
  private hasAttackCreeps(game: GameContext): boolean {
    for (const name in game.creeps) {
      const creep = game.creeps[name];
      if (creep?.memory?.role === "attacker" || creep?.memory?.role === "warrior" || creep?.memory?.role === "ranger") {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if bot has reserver creeps
   */
  private hasReserverCreep(game: GameContext): boolean {
    for (const name in game.creeps) {
      const creep = game.creeps[name];
      if (creep?.memory?.role === "reserver") {
        return true;
      }
    }
    return false;
  }

  /**
   * Minimum energy thresholds for command validation
   */
  private static readonly MIN_STORAGE_ENERGY = 10000;
  private static readonly MIN_ROOM_ENERGY = 300;

  /**
   * Check if bot has stable energy reserves
   */
  private hasStableEnergy(game: GameContext): boolean {
    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];
      if (room?.controller?.my) {
        const storage = room.storage;
        if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > FlagCommandInterpreter.MIN_STORAGE_ENERGY) {
          return true;
        }
        // Fallback to room energy if no storage
        const roomWithEnergy = room as Room & { energyAvailable?: number };
        if ((roomWithEnergy.energyAvailable ?? 0) > FlagCommandInterpreter.MIN_ROOM_ENERGY) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Store command in memory for processing by other systems
   */
  public storeCommand(command: FlagCommand, memory: Memory, game: GameContext): void {
    memory.flagCommands ??= {};

    const validation = this.validateCommand(command, game, memory);

    const flagCommands = memory.flagCommands as Record<
      string,
      {
        type: string;
        priority: string;
        roomName: string;
        pos: { x: number; y: number };
        acknowledged: boolean;
        valid: boolean;
        validationReason?: string;
        acknowledgedAt: number;
      }
    >;

    flagCommands[command.name] = {
      type: command.type,
      priority: command.priority,
      roomName: command.roomName,
      pos: command.pos,
      acknowledged: true,
      valid: validation.valid,
      validationReason: validation.reason,
      acknowledgedAt: game.time
    };

    // When a CLAIM command is valid, enqueue expansion request so RoleControllerManager spawns a claimer
    if (command.type === FlagCommandType.CLAIM && validation.valid) {
      this.enqueueExpansionRequest(command, memory, game);
    }

    this.logger.log?.(
      `[FlagCommand] ${command.type} command '${command.name}' in ${command.roomName} (${command.priority} priority) - ` +
        `${validation.valid ? "VALID" : `INVALID: ${validation.reason}`}`
    );
  }

  /**
   * Enqueue an expansion request for a valid CLAIM command.
   * This ensures RoleControllerManager spawns a claimer for the target room.
   */
  private enqueueExpansionRequest(command: FlagCommand, memory: Memory, game: GameContext): void {
    // Initialize colony memory if not present
    memory.colony ??= {
      expansionQueue: [],
      claimedRooms: [],
      shardMessages: [],
      lastExpansionCheck: 0
    };

    // Type the expansion queue
    const expansionQueue = memory.colony.expansionQueue as Array<{
      targetRoom: string;
      priority: number;
      reason: string;
      requestedAt: number;
      status: string;
    }>;

    // Check if already queued
    const existingRequest = expansionQueue.find(req => req.targetRoom === command.roomName);
    if (existingRequest) {
      // Update priority if flag has higher priority
      const flagPriority = this.getPriorityValue(command.priority);
      if (flagPriority > existingRequest.priority) {
        existingRequest.priority = flagPriority;
        existingRequest.reason = `Flag command: ${command.name}`;
        this.logger.log?.(`[FlagCommand] Updated expansion priority for ${command.roomName} to ${flagPriority}`);
      }
      return;
    }

    // Check if room is already claimed
    const claimedRooms = memory.colony.claimedRooms as string[] | undefined;
    if (claimedRooms?.includes(command.roomName)) {
      return; // Already claimed, no need to queue
    }

    // Add new expansion request
    expansionQueue.push({
      targetRoom: command.roomName,
      priority: this.getPriorityValue(command.priority),
      reason: `Flag command: ${command.name}`,
      requestedAt: game.time,
      status: "pending"
    });

    this.logger.log?.(
      `[FlagCommand] Queued expansion to ${command.roomName} (priority: ${this.getPriorityValue(command.priority)})`
    );
  }

  /**
   * Convert FlagPriority to numeric value for expansion queue
   */
  private getPriorityValue(priority: FlagPriority): number {
    switch (priority) {
      case FlagPriority.HIGH:
        return 90;
      case FlagPriority.MEDIUM:
        return 75;
      case FlagPriority.LOW:
      default:
        return 50;
    }
  }

  /**
   * Remove processed or cancelled commands
   */
  public removeCommand(flagName: string, memory: Memory): void {
    const flagCommands = memory.flagCommands as Record<string, unknown> | undefined;
    if (flagCommands?.[flagName]) {
      delete flagCommands[flagName];
      this.logger.log?.(`[FlagCommand] Removed command '${flagName}'`);
    }
  }

  /**
   * Get visual feedback text for a flag command
   */
  public getCommandStatusText(command: FlagCommand, game: GameContext, memory: Memory): string {
    const validation = this.validateCommand(command, game, memory);

    if (!validation.valid) {
      return `⚠️ ${command.type}\n${validation.reason}`;
    }

    return `✓ ${command.type}\n${command.priority} Priority`;
  }
}
