import { profile } from "@profiler";

/**
 * Body composition configuration for a specific role
 */
export interface BodyPattern {
  /** Base parts that are always included (minimum viable body) */
  base: BodyPartConstant[];
  /** Pattern to repeat when scaling up with available energy */
  pattern: BodyPartConstant[];
  /** Maximum number of times to repeat the pattern (default: calculated from MAX_CREEP_SIZE) */
  maxRepeats?: number;
}

/**
 * Manages dynamic creep body composition based on available room energy capacity.
 * Scales body parts to utilize full extension energy while respecting role requirements.
 *
 * Body composition strategy:
 * - Each role has a base (minimum viable) body
 * - Additional parts are added by repeating a pattern until energy capacity is reached
 * - Respects the 50 body part limit per creep
 *
 * @example
 * ```ts
 * const composer = new BodyComposer();
 * const body = composer.generateBody("harvester", 550);
 * // Returns scaled harvester body for RCL 2 (550 energy capacity)
 * ```
 */
@profile
export class BodyComposer {
  private readonly patterns: Record<string, BodyPattern>;

  public constructor() {
    this.patterns = {
      // Harvester: Balanced work/carry/move for gathering and delivery
      // Base: 1 WORK, 1 CARRY, 1 MOVE (200 energy)
      // Pattern: 1 WORK, 1 CARRY, 1 MOVE (scales proportionally)
      harvester: {
        base: [WORK, CARRY, MOVE],
        pattern: [WORK, CARRY, MOVE]
      },

      // Upgrader: Work-heavy for efficient controller upgrading
      // Base: 1 WORK, 1 CARRY, 1 MOVE (200 energy)
      // Pattern: 1 WORK, 1 CARRY, 1 MOVE (balanced for movement and upgrading)
      upgrader: {
        base: [WORK, CARRY, MOVE],
        pattern: [WORK, CARRY, MOVE]
      },

      // Builder: Balanced work/carry/move with extra mobility
      // Base: 1 WORK, 1 CARRY, 2 MOVE (250 energy)
      // Pattern: 1 WORK, 1 CARRY, 1 MOVE (cost-effective scaling)
      builder: {
        base: [WORK, CARRY, MOVE, MOVE],
        pattern: [WORK, CARRY, MOVE]
      },

      // Remote Miner: Work-heavy for efficient remote mining
      // Base: 2 WORK, 1 CARRY, 2 MOVE (350 energy)
      // Pattern: 1 WORK, 1 MOVE (prioritize work and movement)
      remoteMiner: {
        base: [WORK, WORK, CARRY, MOVE, MOVE],
        pattern: [WORK, MOVE]
      },

      // Stationary Harvester: Maximum work parts for container harvesting
      // Base: 5 WORK, 1 MOVE (550 energy)
      // Pattern: 1 WORK (maximize harvesting efficiency)
      stationaryHarvester: {
        base: [WORK, WORK, WORK, WORK, WORK, MOVE],
        pattern: [WORK]
      },

      // Hauler: Carry-heavy for efficient energy transport
      // Base: 4 CARRY, 4 MOVE (400 energy)
      // Pattern: 2 CARRY, 1 MOVE (prioritize carry capacity)
      hauler: {
        base: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
        pattern: [CARRY, CARRY, MOVE]
      },

      // Repairer: Work-heavy with carry for repairs and construction
      // Base: 2 WORK, 1 CARRY, 2 MOVE (350 energy)
      // Pattern: 1 WORK, 1 CARRY, 1 MOVE (balanced scaling)
      repairer: {
        base: [WORK, WORK, CARRY, MOVE, MOVE],
        pattern: [WORK, CARRY, MOVE]
      },

      // Attacker: Melee combat specialist with high damage output
      // Base: 2 TOUGH, 4 ATTACK, 4 MOVE (560 energy)
      // Pattern: 1 ATTACK, 1 MOVE (prioritize damage and mobility)
      attacker: {
        base: [TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE],
        pattern: [ATTACK, MOVE]
      },

      // Healer: Support specialist for sustained healing
      // Base: 1 TOUGH, 3 HEAL, 4 MOVE (650 energy)
      // Pattern: 1 HEAL, 1 MOVE (prioritize healing and mobility)
      healer: {
        base: [TOUGH, HEAL, HEAL, HEAL, MOVE, MOVE, MOVE, MOVE],
        pattern: [HEAL, MOVE]
      },

      // Dismantler: Structure removal specialist
      // Base: 1 TOUGH, 4 WORK, 4 MOVE (550 energy)
      // Pattern: 1 WORK, 1 MOVE (prioritize structure damage and mobility)
      dismantler: {
        base: [TOUGH, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE],
        pattern: [WORK, MOVE]
      }
    };
  }

  /**
   * Generate a body composition for a role using available energy capacity.
   *
   * @param role - The creep role (harvester, upgrader, builder, etc.)
   * @param energyCapacity - Room's total energy capacity (room.energyCapacityAvailable)
   * @returns Optimized body part array, or empty array if insufficient energy
   */
  public generateBody(role: string, energyCapacity: number): BodyPartConstant[] {
    const pattern = this.patterns[role];
    if (!pattern) {
      // Unknown role - return minimal emergency body if possible
      return this.generateEmergencyBody(energyCapacity);
    }

    // Try normal body generation first
    const normalBody = this.scaleBody(pattern, energyCapacity);
    if (normalBody.length > 0) {
      return normalBody;
    }

    // Fallback to emergency body for critical roles in low-energy situations
    if (role === "harvester" || role === "upgrader" || role === "builder") {
      return this.generateEmergencyBody(energyCapacity);
    }

    return [];
  }

  /**
   * Generate an emergency minimal body when energy is critically low.
   * Used during bootstrap or total creep loss scenarios.
   *
   * @param energyAvailable - Energy currently available for spawning
   * @returns Minimal viable body, or empty array if insufficient energy
   */
  public generateEmergencyBody(energyAvailable: number): BodyPartConstant[] {
    // Minimal harvester: [WORK, CARRY, MOVE] = 200 energy
    if (energyAvailable >= 200) {
      return [WORK, CARRY, MOVE];
    }

    // Ultra-minimal worker: [WORK, MOVE] = 150 energy
    // Can harvest but needs to drop resources on ground
    if (energyAvailable >= 150) {
      return [WORK, MOVE];
    }

    // Cannot spawn anything useful
    return [];
  }

  /**
   * Scale a body pattern to fit within energy capacity.
   * Repeats the pattern until energy capacity is reached or max body size is hit.
   *
   * @param pattern - Body pattern configuration with base and repeating parts
   * @param energyCapacity - Available energy capacity
   * @returns Scaled body part array
   */
  private scaleBody(pattern: BodyPattern, energyCapacity: number): BodyPartConstant[] {
    const { base, pattern: repeatPattern, maxRepeats = 50 } = pattern;

    // Calculate base cost
    const baseCost = this.calculateBodyCost(base);
    if (energyCapacity < baseCost) {
      // Not enough energy for minimum body
      return [];
    }

    // Start with base parts
    const body: BodyPartConstant[] = [...base];
    let totalCost = baseCost;

    // Calculate pattern cost
    const patternCost = this.calculateBodyCost(repeatPattern);
    if (patternCost === 0) {
      return body;
    }

    // Add pattern repeats until we hit energy capacity or body size limit (50 parts max)
    let repeats = 0;
    const MAX_BODY_SIZE = 50;
    while (
      totalCost + patternCost <= energyCapacity &&
      body.length + repeatPattern.length <= MAX_BODY_SIZE &&
      repeats < maxRepeats
    ) {
      body.push(...repeatPattern);
      totalCost += patternCost;
      repeats++;
    }

    return body;
  }

  /**
   * Calculate the total energy cost of a body composition.
   *
   * @param body - Array of body parts
   * @returns Total energy cost
   */
  public calculateBodyCost(body: BodyPartConstant[]): number {
    return body.reduce((total, part) => total + (BODYPART_COST[part] ?? 0), 0);
  }

  /**
   * Get the body pattern configuration for a specific role.
   * Useful for testing and validation.
   *
   * @param role - The creep role
   * @returns Body pattern configuration, or undefined if role not found
   */
  public getPattern(role: string): BodyPattern | undefined {
    return this.patterns[role];
  }

  /**
   * Get all available role names that have body patterns defined.
   *
   * @returns Array of role names
   */
  public getAvailableRoles(): string[] {
    return Object.keys(this.patterns);
  }
}
