export interface InterShardSnapshot {
  shards: Record<
    string,
    {
      role: "core" | "frontier" | "resource" | "backup";
      economyIndex: number;
      warIndex: number;
      cpuBucket: number;
      lastUpdated: number;
      portals?: Array<{ room: string; target: string; danger: number }>;
    }
  >;
  strategicTargets: {
    powerLevelTarget?: number;
    dominantWarShard?: string;
  };
}
