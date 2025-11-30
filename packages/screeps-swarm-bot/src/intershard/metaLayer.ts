import type { SwarmShardMeta } from "../types.js";
import type { InterShardSnapshot } from "./schema.js";

export function writeShardSnapshot(meta: SwarmShardMeta): void {
  const snapshot: InterShardSnapshot = {
    shards: meta.shards,
    strategicTargets: meta.globalTargets,
  };
  InterShardMemory.set(JSON.stringify(snapshot));
}

export function readShardSnapshot(): SwarmShardMeta | undefined {
  const raw = InterShardMemory.get();
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as InterShardSnapshot;
  return { shards: parsed.shards, globalTargets: parsed.strategicTargets };
}
