/* eslint-disable @typescript-eslint/no-unsafe-call */
import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { RuntimeProtocols } from "@runtime/protocols";
import type { GameContext } from "@runtime/types/GameContext";
import { RoomVisualManager } from "@runtime/visuals/RoomVisualManager";

/**
 * Room visualization process that renders visual overlays for operational visibility.
 * Responsibilities:
 * - Rendering room visuals
 * - Displaying creep states and tasks
 * - Showing resource flows and priorities
 *
 * Priority: 20 (low) - Non-critical, run late to preserve CPU for gameplay
 */
@registerProcess({ name: "VisualsProcess", priority: 20, singleton: true })
export class VisualsProcess {
  private readonly visualManager: RoomVisualManager;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor() {
    this.logger = console;
    this.visualManager = new RoomVisualManager({
      enabled:
        __ROOM_VISUALS_ENABLED__ === "true" ||
        (typeof Memory !== "undefined" && Memory.experimentalFeatures?.roomVisuals === true) ||
        (typeof Memory !== "undefined" && Memory.experimentalFeatures?.roomVisuals !== false)
    });
    this.cpuEmergencyThreshold = 0.9;
  }

  public run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    const gameContext = ctx.game as GameContext;

    // Skip if emergency reset or respawn occurred
    if (ctx.protocol.isEmergencyReset() || ctx.protocol.needsRespawn()) {
      return;
    }

    // CPU guard before rendering visuals
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[VisualsProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `skipping visual rendering`
      );
      return;
    }

    // Render room visuals for operational visibility
    this.visualManager.render(gameContext);
  }
}
