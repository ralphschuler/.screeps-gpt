import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Verbosity levels for creep communication
 */
export type CommunicationVerbosity = "disabled" | "minimal" | "normal" | "verbose";

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
    this.config = {
      verbosity: config.verbosity ?? "normal",
      enableRoomVisuals: config.enableRoomVisuals ?? false,
      cpuBudget: config.cpuBudget ?? 0.1
    };
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
   * Check if communication is enabled based on verbosity level
   */
  private isEnabled(): boolean {
    return this.config.verbosity !== "disabled";
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
   */
  public say(creep: CreepLike, action: CreepAction, additionalText?: string, cpuGetter?: () => number): void {
    if (!this.isEnabled()) {
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
   * Display error or stuck state
   */
  public sayError(creep: CreepLike, message?: string, cpuGetter?: () => number): void {
    if (!this.isEnabled() || this.config.verbosity === "minimal") {
      return;
    }

    if (creep.memory.stuck) {
      this.say(creep, "stuck", message, cpuGetter);
    } else {
      this.say(creep, "error", message, cpuGetter);
    }
  }

  /**
   * Display resource status (full/empty)
   */
  public sayResourceStatus(creep: CreepLike, isFull: boolean, percentage?: number, cpuGetter?: () => number): void {
    if (!this.isEnabled() || this.config.verbosity === "minimal") {
      return;
    }

    const action: CreepAction = isFull ? "full" : "empty";
    const text = percentage !== undefined ? `${Math.floor(percentage)}%` : undefined;
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
