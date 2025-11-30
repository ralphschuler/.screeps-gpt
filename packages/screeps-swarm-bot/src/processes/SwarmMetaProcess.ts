import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import { SHARD_META_INTERVAL } from "../constants.js";
import { SwarmMemoryManager } from "../memory/SwarmMemoryManager.js";
import type { SwarmProcessContext, SwarmShardMeta } from "../types.js";

@process({ name: "SwarmMetaProcess", priority: 110, singleton: true })
export class SwarmMetaProcess {
  private readonly memoryManager = new SwarmMemoryManager(new Logger({ minLevel: "info" }));
  private readonly logger = new Logger({ minLevel: "info" }).child({ system: "swarm-meta" });

  public run(ctx: SwarmProcessContext): void {
    if (ctx.game.time % SHARD_META_INTERVAL !== 0) return;
    const swarm = this.memoryManager.getOrInit(ctx.memory);
    const meta = this.readMeta();

    const shardName = (ctx.game as { shard?: { name?: string } }).shard?.name ?? "shard0";
    const economyIndex = this.computeEconomyIndex(ctx);
    const warIndex = this.computeWarIndex(swarm);

    meta.shards[shardName] = {
      role: meta.shards[shardName]?.role ?? "core",
      economyIndex,
      warIndex,
      cpuBucket: ctx.game.cpu.bucket,
      lastUpdated: ctx.game.time
    };

    this.writeMeta(meta);
    this.logger.debug?.("Updated inter-shard meta", { shardName, economyIndex, warIndex });
  }

  private computeEconomyIndex(ctx: SwarmProcessContext): number {
    const storages = Object.values(ctx.game.rooms)
      .map(room => room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0);
    if (storages.length === 0) return 0;
    return Math.round(storages.reduce((sum, value) => sum + value, 0) / storages.length);
  }

  private computeWarIndex(swarm: ReturnType<SwarmMemoryManager["getOrInit"]>): number {
    const weights = Object.values(swarm.rooms).map(room => room.pheromones.war);
    if (weights.length === 0) return 0;
    return Math.max(...weights);
  }

  private readMeta(): SwarmShardMeta {
    const raw = InterShardMemory.getLocal();
    if (!raw) {
      return { shards: {}, globalTargets: {} };
    }
    try {
      return JSON.parse(raw) as SwarmShardMeta;
    } catch {
      return { shards: {}, globalTargets: {} };
    }
  }

  private writeMeta(meta: SwarmShardMeta): void {
    InterShardMemory.setLocal(JSON.stringify(meta));
  }
}
