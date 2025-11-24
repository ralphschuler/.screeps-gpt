import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Verbosity levels for creep communication
 */
export type CommunicationVerbosity = "disabled" | "minimal" | "normal" | "verbose";

/**
 * Communication severity levels for message classification
 */
export enum CommunicationLevel {
  SILENT = 0, // No messages
  ERROR = 1, // Critical failures only
  WARNING = 2, // Errors + warnings
  INFO = 3, // Errors + warnings + important status
  VERBOSE = 4 // All messages (current behavior)
}

/**
 * Configuration for creep communication system
 */
export interface CreepCommunicationConfig {
  /**
   * Enable/disable creep communication
   * Default: "normal"
   */
  verbosity?: CommunicationVerbosity;

  /**
   * Communication severity level (overrides verbosity if set)
   * Default: undefined (uses verbosity mapping)
   */
  level?: CommunicationLevel;

  /**
   * Enable room visuals for task goals
   * Default: false
   */
  enableRoomVisuals?: boolean;

  /**
   * Maximum CPU budget per tick for communication
   * Default: 0.1 CPU per tick
   */
  cpuBudget?: number;
}

/**
 * Action types for visual communication
 */
export type CreepAction =
  | "harvest"
  | "deliver"
  | "upgrade"
  | "build"
  | "repair"
  | "gather"
  | "travel"
  | "pickup"
  | "full"
  | "empty"
  | "stuck"
  | "error";

/**
 * Emoji mapping for visual communication
 */
const ACTION_EMOJIS: Record<CreepAction, string> = {
  harvest: "⛏️",
  deliver: "📦",
  upgrade: "⚡",
  build: "🔨",
  repair: "🔧",
  gather: "🔍",
  travel: "🚶",
  pickup: "📥",
  full: "✅",
  empty: "🔋",
  stuck: "❌",
  error: "⚠️"
};

/**
 * Default severity mapping for CreepActions
 * Maps each action to its default communication level
 */
const ACTION_SEVERITY: Record<CreepAction, CommunicationLevel> = {
  // ERROR level - critical failures
  stuck: CommunicationLevel.ERROR,
  error: CommunicationLevel.ERROR,

  // WARNING level - caution conditions
  empty: CommunicationLevel.WARNING,
  full: CommunicationLevel.WARNING,

  // INFO level - important status
  gather: CommunicationLevel.INFO,

  // VERBOSE level - routine operations
  harvest: CommunicationLevel.VERBOSE,
  deliver: CommunicationLevel.VERBOSE,
  upgrade: CommunicationLevel.VERBOSE,
  build: CommunicationLevel.VERBOSE,
  repair: CommunicationLevel.VERBOSE,
  travel: CommunicationLevel.VERBOSE,
  pickup: CommunicationLevel.VERBOSE
};

interface CreepLike {
  say(message: string, toPublic?: boolean): number;
  name: string;
  pos: RoomPosition;
  room: {
    visual: RoomVisual;
    name: string;
  };
  memory: {
    stuck?: boolean;
  };
}

/**
 * Manages visual communication for creeps using creep.say() and room visuals.
 * Provides configurable verbosity levels and CPU budget management.
 */
@profile
export class CreepCommunicationManager {
  private readonly config: Required<CreepCommunicationConfig>;
  private cpuUsedThisTick: number = 0;
  private lastTickReset: number = -1;

  public constructor(config: CreepCommunicationConfig = {}) {
    // Map verbosity to severity level if level not explicitly set
    let level = config.level;
    if (level === undefined) {
      const verbosity = config.verbosity ?? "normal";
      level = this.verbosityToLevel(verbosity);
    }

    this.config = {
      verbosity: config.verbosity ?? "normal",
      level,
      enableRoomVisuals: config.enableRoomVisuals ?? false,
      cpuBudget: config.cpuBudget ?? 0.1
    };
  }

  /**
   * Map verbosity string to CommunicationLevel enum
   */
  private verbosityToLevel(verbosity: CommunicationVerbosity): CommunicationLevel {
    switch (verbosity) {
      case "disabled":
        return CommunicationLevel.SILENT;
      case "minimal":
        return CommunicationLevel.WARNING; // Show warnings and errors
      case "normal":
        return CommunicationLevel.WARNING; // Default to WARNING per requirements
      case "verbose":
        return CommunicationLevel.VERBOSE;
      default:
        return CommunicationLevel.WARNING;
    }
  }

  /**
   * Reset CPU tracking at the start of each tick
   */
  public resetTick(currentTick: number): void {
    if (this.lastTickReset !== currentTick) {
      this.cpuUsedThisTick = 0;
      this.lastTickReset = currentTick;
    }
  }

  /**
   * Check if communication is enabled based on severity level
   */
  private isEnabled(): boolean {
    return this.config.level !== CommunicationLevel.SILENT;
  }

  /**
   * Check if a message with given severity should be displayed
   */
  private shouldDisplay(severity: CommunicationLevel): boolean {
    return this.isEnabled() && severity <= this.config.level;
  }

  /**
   * Check if CPU budget allows for more communication
   */
  private canCommunicate(cpuBefore: number, cpuAfter: number): boolean {
    const cpuCost = cpuAfter - cpuBefore;
    this.cpuUsedThisTick += cpuCost;
    return this.cpuUsedThisTick <= this.config.cpuBudget;
  }

  /**
   * Make a creep say a message with emoji visual indicator
   * Uses action's default severity level for filtering
   */
  public say(creep: CreepLike, action: CreepAction, additionalText?: string, cpuGetter?: () => number): void {
    const severity = ACTION_SEVERITY[action] ?? CommunicationLevel.INFO;
    this.sayWithSeverity(creep, action, severity, additionalText, cpuGetter);
  }

  /**
   * Make a creep say a message with explicit severity level
   */
  public sayWithSeverity(
    creep: CreepLike,
    action: CreepAction,
    severity: CommunicationLevel,
    additionalText?: string,
    cpuGetter?: () => number
  ): void {
    if (!this.shouldDisplay(severity)) {
      return;
    }

    const cpuBefore = cpuGetter?.() ?? 0;

    const emoji = ACTION_EMOJIS[action] ?? "💬";
    let message = emoji;

    // Add additional text based on verbosity
    if (this.config.verbosity === "verbose" && additionalText) {
      message += ` ${additionalText}`;
    } else if (this.config.verbosity === "normal" && additionalText && additionalText.length <= 3) {
      // Only short additions in normal mode (like "OK", "100")
      message += ` ${additionalText}`;
    }

    // Truncate to fit within Screeps say() character limit (10 chars)
    message = message.substring(0, 10);

    // Only call say if the method exists (for test compatibility)
    if (typeof creep.say === "function") {
      creep.say(message, false);
    }

    const cpuAfter = cpuGetter?.() ?? 0;
    if (cpuGetter && !this.canCommunicate(cpuBefore, cpuAfter)) {
      // Budget exceeded, disable for rest of tick
      // This is a soft limit - we already said this message
      return;
    }
  }

  /**
   * Display error message (always visible at ERROR level)
   */
  public error(creep: CreepLike, action: CreepAction, message?: string, cpuGetter?: () => number): void {
    this.sayWithSeverity(creep, action, CommunicationLevel.ERROR, message, cpuGetter);
  }

  /**
   * Display warning message (visible at WARNING level and above)
   */
  public warn(creep: CreepLike, action: CreepAction, message?: string, cpuGetter?: () => number): void {
    this.sayWithSeverity(creep, action, CommunicationLevel.WARNING, message, cpuGetter);
  }

  /**
   * Display info message (visible at INFO level and above)
   */
  public info(creep: CreepLike, action: CreepAction, message?: string, cpuGetter?: () => number): void {
    this.sayWithSeverity(creep, action, CommunicationLevel.INFO, message, cpuGetter);
  }

  /**
   * Display verbose message (only visible at VERBOSE level)
   */
  public verbose(creep: CreepLike, action: CreepAction, message?: string, cpuGetter?: () => number): void {
    this.sayWithSeverity(creep, action, CommunicationLevel.VERBOSE, message, cpuGetter);
  }

  /**
   * Display error or stuck state (backward compatibility)
   */
  public sayError(creep: CreepLike, message?: string, cpuGetter?: () => number): void {
    if (creep.memory.stuck) {
      this.error(creep, "stuck", message, cpuGetter);
    } else {
      this.error(creep, "error", message, cpuGetter);
    }
  }

  /**
   * Display resource status (full/empty) (backward compatibility)
   */
  public sayResourceStatus(creep: CreepLike, isFull: boolean, percentage?: number, cpuGetter?: () => number): void {
    const action: CreepAction = isFull ? "full" : "empty";
    const text = percentage !== undefined ? `${Math.floor(percentage)}%` : undefined;
    // Use default severity from ACTION_SEVERITY (WARNING level)
    this.say(creep, action, text, cpuGetter);
  }

  /**
   * Draw room visual indicators for task goals
   */
  public drawTaskGoal(
    creep: CreepLike,
    target: RoomPosition,
    color: string = "#00ff00",
    cpuGetter?: () => number
  ): void {
    if (!this.config.enableRoomVisuals) {
      return;
    }

    const cpuBefore = cpuGetter?.() ?? 0;

    // Draw line from creep to target
    creep.room.visual.line(creep.pos, target, {
      color,
      width: 0.1,
      opacity: 0.5,
      lineStyle: "dashed"
    });

    // Draw circle at target
    creep.room.visual.circle(target, {
      radius: 0.4,
      fill: "transparent",
      stroke: color,
      strokeWidth: 0.1,
      opacity: 0.6
    });

    const cpuAfter = cpuGetter?.() ?? 0;
    if (cpuGetter) {
      this.canCommunicate(cpuBefore, cpuAfter);
    }
  }

  /**
   * Update configuration at runtime
   */
  public updateConfig(config: Partial<CreepCommunicationConfig>): void {
    if (config.verbosity !== undefined) {
      this.config.verbosity = config.verbosity;
      // Update level based on verbosity if level not explicitly set
      if (config.level === undefined) {
        this.config.level = this.verbosityToLevel(config.verbosity);
      }
    }
    if (config.level !== undefined) {
      this.config.level = config.level;
    }
    if (config.enableRoomVisuals !== undefined) {
      this.config.enableRoomVisuals = config.enableRoomVisuals;
    }
    if (config.cpuBudget !== undefined) {
      this.config.cpuBudget = config.cpuBudget;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<CreepCommunicationConfig> {
    return { ...this.config };
  }

  /**
   * Get CPU usage statistics for this tick
   */
  public getCpuUsage(): { used: number; budget: number; percentage: number } {
    return {
      used: this.cpuUsedThisTick,
      budget: this.config.cpuBudget,
      percentage: (this.cpuUsedThisTick / this.config.cpuBudget) * 100
    };
  }
}
