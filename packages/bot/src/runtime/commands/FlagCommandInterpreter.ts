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
  public validateCommand(command: FlagCommand, game: GameContext, memory: Memory): CommandValidation {
    const missingPrerequisites: string[] = [];

    // Validate based on command type
    switch (command.type) {
      case FlagCommandType.CLAIM:
        if (!this.hasClaimCreep(game)) {
          missingPrerequisites.push("No claimer creep available");
        }
        if (!this.hasGCL(game, memory)) {
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
   * Check if bot has claimer creeps
   */
  private hasClaimCreep(game: GameContext): boolean {
    for (const name in game.creeps) {
      const creep = game.creeps[name];
      if (creep?.memory?.role === "claimer") {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if bot has sufficient GCL
   */
  private hasGCL(game: GameContext, memory: Memory): boolean {
    const controlledRooms = Object.values(game.rooms).filter(room => room.controller?.my).length;
    // GCL level determines max rooms (simplified check)
    const gclMemory = memory.gcl as { level?: number } | undefined;
    const gclLevel = gclMemory?.level ?? 1;
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
      if (
        creep?.memory?.role === "attacker" ||
        creep?.memory?.role === "warrior" ||
        creep?.memory?.role === "ranger"
      ) {
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
   * Check if bot has stable energy reserves
   */
  private hasStableEnergy(game: GameContext): boolean {
    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];
      if (room?.controller?.my) {
        const storage = room.storage;
        if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
          return true;
        }
        // Fallback to room energy if no storage
        const roomWithEnergy = room as Room & { energyAvailable?: number };
        if ((roomWithEnergy.energyAvailable ?? 0) > 300) {
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

    this.logger.log?.(
      `[FlagCommand] ${command.type} command '${command.name}' in ${command.roomName} (${command.priority} priority) - ` +
        `${validation.valid ? "VALID" : `INVALID: ${validation.reason}`}`
    );
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
