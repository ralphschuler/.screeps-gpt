import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import type { RuntimeProtocols } from "@runtime/protocols";
import { FlagCommandInterpreter } from "@runtime/commands/FlagCommandInterpreter";

/**
 * Flag command interpretation process that parses user-placed flags into bot commands.
 * Responsibilities:
 * - Parse all game flags each tick
 * - Interpret flag colors as commands
 * - Validate command feasibility
 * - Store commands in Memory for other systems
 * - Remove flags for completed/cancelled commands
 *
 * Priority: 15 (early) - Commands should be interpreted before behavior execution
 */
@registerProcess({ name: "FlagCommandProcess", priority: 15, singleton: true })
export class FlagCommandProcess {
  private readonly interpreter: FlagCommandInterpreter;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor() {
    this.logger = console;
    this.interpreter = new FlagCommandInterpreter(this.logger);
  }

  public run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // Skip if emergency reset or respawn occurred
    // Protocol methods are dynamically registered, causing type inference issues in strict mode
    // This pattern matches other processes (BehaviorProcess, HealthProcess, etc.)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    if (ctx.protocol.isEmergencyReset() || ctx.protocol.needsRespawn()) {
      return;
    }

    // Parse all flags into commands
    const commands = this.interpreter.parseFlags(gameContext);

    // Initialize flag commands memory if not present
    memory.flagCommands ??= {};

    // Track existing command names for cleanup
    const currentCommandNames = new Set<string>(commands.map(cmd => cmd.name));

    // Remove commands for flags that no longer exist
    const flagCommands = memory.flagCommands as Record<string, { acknowledged?: boolean }>;
    for (const flagName in flagCommands) {
      if (!currentCommandNames.has(flagName)) {
        this.interpreter.removeCommand(flagName, memory);
      }
    }

    // Store new commands in memory
    for (const command of commands) {
      // Only store if not already acknowledged
      const existingCommand = flagCommands[command.name];
      if (!existingCommand?.acknowledged) {
        this.interpreter.storeCommand(command, memory, gameContext);
      }
    }
  }
}
