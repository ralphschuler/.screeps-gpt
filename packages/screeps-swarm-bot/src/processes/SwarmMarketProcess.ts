import { process } from "@ralphschuler/screeps-kernel";
import type { SwarmProcessContext } from "../types.js";
import { runMarketCycle } from "../logic/market.js";

/**
 * Market scanner and trade executor; low-frequency to stay within CPU and
 * transaction budgets while keeping resource buffers aligned to strategy.
 */
@process({ name: "SwarmMarketProcess", priority: 40, singleton: true })
export class SwarmMarketProcess {
  public run(ctx: SwarmProcessContext): void {
    runMarketCycle(ctx);
  }
}
