/**
 * Strategic spawn thresholds and ratios.
 * These values were extracted from legacy behavior controller during state machine migration.
 *
 * @see Issue #1267 - State machine migration
 * @see Issue #1105 - Energy threshold adjustment for spawn idle bug
 */
export const SPAWN_THRESHOLDS = {
  /**
   * CPU bucket threshold below which spawning is suppressed (85%).
   * Conservative to prevent bucket drain during spawn waves.
   */
  CPU_SAFETY_MARGIN: 0.85,

  /**
   * Minimum energy reserve before allowing spawning (20% of capacity).
   * Maintains emergency buffer for repairs and urgent construction.
   * Used in conjunction with MIN_ENERGY_RESERVE.
   */
  ENERGY_RESERVE_RATIO: 0.2,

  /**
   * Absolute minimum energy reserve in energy units (50 energy).
   * Ensures a minimum buffer even in low-capacity rooms.
   */
  MIN_ENERGY_RESERVE: 50,

  /**
   * Storage high threshold (50% full) - spawn freely.
   * Indicates sufficient energy surplus for aggressive spawning.
   */
  STORAGE_HIGH_THRESHOLD: 0.5,

  /**
   * Storage medium threshold (30% full) - spawn cautiously.
   * Balances spawn responsiveness with energy accumulation.
   */
  STORAGE_MEDIUM_THRESHOLD: 0.3,

  /**
   * Energy availability high threshold (90%) - spawn freely.
   * Indicates extensions are nearly full, enabling maximum spawning.
   */
  ENERGY_HIGH_THRESHOLD: 0.9,

  /**
   * Energy availability medium threshold (75%) - spawn cautiously.
   * Prevents spawn starvation while maintaining energy reserves.
   */
  ENERGY_MEDIUM_THRESHOLD: 0.75,

  /**
   * Energy threshold for early game spawning (80%) for RCL ≤ 3.
   * Adjusted from higher value to prevent spawn idle at healthy energy levels.
   * @see Issue #1105 - Spawn utilization optimization
   */
  ENERGY_EARLY_GAME_THRESHOLD: 0.8
} as const;

/**
 * Type representing the spawn threshold constants.
 * Useful for type-safe access to threshold values.
 */
export type SpawnThresholds = typeof SPAWN_THRESHOLDS;

/**
 * Rationale for threshold values:
 *
 * **CPU_SAFETY_MARGIN (0.85)**: Conservative to prevent bucket drain during spawn waves.
 * Spawning operations are CPU-intensive, so this margin ensures the CPU bucket doesn't
 * become critically low during multiple consecutive spawns.
 *
 * **ENERGY_RESERVE_RATIO (0.2) & MIN_ENERGY_RESERVE (50)**: Maintains emergency buffer
 * for repairs and urgent construction. The 20% ratio scales with room capacity, while
 * the minimum ensures low-capacity rooms always retain a basic buffer.
 *
 * **Storage thresholds (0.5, 0.3)**: Balance between spawn responsiveness and energy
 * accumulation. Higher storage ratios indicate surplus energy, enabling more aggressive
 * spawning without risking energy starvation.
 *
 * **Energy thresholds (0.9, 0.75, 0.8)**: Prevent spawn starvation while allowing
 * aggressive early-game spawning. The 0.8 threshold for RCL ≤ 3 was specifically
 * adjusted in Issue #1105 to prevent spawn idle when energy levels are healthy.
 */
