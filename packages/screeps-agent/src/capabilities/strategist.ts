/**
 * Strategist Capability
 *
 * Provides strategic planning capabilities for Screeps development,
 * including expansion strategies, behavior strategies, and resource optimization.
 */

import type { MCPClient } from "../mcp/client.js";
import {
  ActionType,
  type TaskResult,
  type AgentAction,
  type StrategyRequest,
  type StrategyResult,
  type StrategyPhase,
  type SuccessMetric,
  type RiskAssessment,
  type ImplementationPlan
} from "../types.js";

/**
 * Strategist capability for autonomous strategic planning
 */
export class StrategistCapability {
  private mcpClient: MCPClient;
  private actions: AgentAction[] = [];

  public constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
    this.actions = [];
  }

  /**
   * Create a strategic plan for the specified domain
   *
   * @param request - Strategy request configuration
   * @returns Task result containing strategic plan
   */
  public async createStrategy(request: StrategyRequest): Promise<TaskResult> {
    this.actions = [];

    try {
      this.logAction(ActionType.StrategicPlanning, "Starting strategic planning", {
        domain: request.domain,
        timeHorizon: request.timeHorizon,
        objectivesCount: request.objectives.length
      });

      // Analyze current bot state for context
      const currentState = await this.analyzeCurrentState(request);

      // Generate strategy phases based on domain
      const phases = this.generatePhases(request, currentState);

      // Define success metrics
      const metrics = this.defineMetrics(request);

      // Assess risks
      const risks = this.assessRisks(request, phases);

      // Create implementation plan
      const implementation = this.createImplementationPlan(request, phases);

      // Calculate confidence
      const confidence = this.calculateConfidence(request, phases, metrics);

      // Generate summary
      const summary = this.generateSummary(request, phases, metrics, risks);

      const result: StrategyResult = {
        domain: request.domain,
        phases,
        metrics,
        risks,
        implementation,
        timestamp: new Date(),
        summary,
        confidence
      };

      this.logAction(ActionType.StrategicPlanning, "Strategic planning completed", {
        phasesCount: phases.length,
        metricsCount: metrics.length,
        risksCount: risks.length,
        confidence
      });

      return {
        success: true,
        message: `Strategic plan created for domain: ${request.domain}`,
        data: result as unknown as Record<string, unknown>,
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Strategic planning failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
  }

  /**
   * Analyze current bot state for strategic context
   */
  private async analyzeCurrentState(request: StrategyRequest): Promise<Record<string, unknown>> {
    const state: Record<string, unknown> = {};

    try {
      this.logAction(ActionType.MCPRead, "Analyzing current bot state", {
        domain: request.domain
      });

      const stats = (await this.mcpClient.getBotState()) as {
        cpu?: { used?: number; limit?: number; bucket?: number };
        gcl?: { level?: number; progress?: number };
        rooms?: number;
        creeps?: number;
      };

      if (stats) {
        state["cpu"] = stats.cpu;
        state["gcl"] = stats.gcl;
        state["roomCount"] = stats.rooms;
        state["creepCount"] = stats.creeps;
      }

      // Get room data for expansion strategies
      if (request.domain === "expansion" || request.domain === "infrastructure") {
        const rooms = await this.mcpClient.getRooms();
        state["rooms"] = rooms;
      }

      // Get creep data for combat and economy strategies
      if (request.domain === "combat" || request.domain === "economy") {
        const creeps = await this.mcpClient.getCreeps();
        state["creeps"] = creeps;
      }

      // Get spawn data for infrastructure strategies
      if (request.domain === "infrastructure" || request.domain === "economy") {
        const spawns = await this.mcpClient.getSpawns();
        state["spawns"] = spawns;
      }
    } catch {
      this.logAction(ActionType.MCPRead, "Bot state partially available", {});
    }

    // Merge with provided current state
    if (request.currentState) {
      Object.assign(state, request.currentState);
    }

    return state;
  }

  /**
   * Generate strategy phases based on domain
   */
  private generatePhases(request: StrategyRequest, currentState: Record<string, unknown>): StrategyPhase[] {
    const phases: StrategyPhase[] = [];

    switch (request.domain) {
      case "expansion":
        phases.push(...this.generateExpansionPhases(request, currentState));
        break;
      case "economy":
        phases.push(...this.generateEconomyPhases(request, currentState));
        break;
      case "defense":
        phases.push(...this.generateDefensePhases(request, currentState));
        break;
      case "combat":
        phases.push(...this.generateCombatPhases(request, currentState));
        break;
      case "infrastructure":
        phases.push(...this.generateInfrastructurePhases(request, currentState));
        break;
      case "optimization":
        phases.push(...this.generateOptimizationPhases(request, currentState));
        break;
    }

    return phases;
  }

  /**
   * Generate expansion strategy phases
   */
  private generateExpansionPhases(request: StrategyRequest, _currentState: Record<string, unknown>): StrategyPhase[] {
    const phases: StrategyPhase[] = [];
    const isLongTerm = request.timeHorizon === "long";

    phases.push({
      name: "Room Evaluation",
      description: "Evaluate adjacent and nearby rooms for expansion potential",
      order: 1,
      duration: isLongTerm ? "1-2 weeks" : "3-5 days",
      actions: [
        {
          name: "Implement room scanner",
          description: "Create scout creeps to explore adjacent rooms",
          type: "implement",
          targets: ["src/runtime/behavior/scout-behavior.ts"],
          priority: "high"
        },
        {
          name: "Room scoring algorithm",
          description: "Score rooms based on sources, controllers, and threats",
          type: "implement",
          targets: ["src/runtime/evaluation/room-scorer.ts"],
          priority: "high"
        }
      ],
      prerequisites: [],
      completionCriteria: ["All adjacent rooms scouted", "Room scores calculated"]
    });

    phases.push({
      name: "Claim Preparation",
      description: "Prepare resources and creeps for claiming target room",
      order: 2,
      duration: isLongTerm ? "1-2 weeks" : "5-7 days",
      actions: [
        {
          name: "Claimer creep design",
          description: "Design optimal claimer body parts",
          type: "implement",
          targets: ["src/runtime/behavior/claimer-behavior.ts"],
          priority: "high"
        },
        {
          name: "Resource staging",
          description: "Stage energy for new room bootstrap",
          type: "configure",
          targets: ["src/runtime/behavior/hauler-behavior.ts"],
          priority: "medium"
        }
      ],
      prerequisites: ["Room Evaluation"],
      completionCriteria: ["Claimer creep ready", "Resources staged"]
    });

    phases.push({
      name: "Room Bootstrap",
      description: "Claim room and establish initial operations",
      order: 3,
      duration: isLongTerm ? "2-3 weeks" : "1-2 weeks",
      actions: [
        {
          name: "Execute claim",
          description: "Send claimer to claim controller",
          type: "implement",
          targets: ["src/runtime/behavior/claimer-behavior.ts"],
          priority: "critical"
        },
        {
          name: "Bootstrap spawn",
          description: "Build first spawn in new room",
          type: "implement",
          targets: ["src/runtime/behavior/builder-behavior.ts"],
          priority: "critical"
        }
      ],
      prerequisites: ["Claim Preparation"],
      completionCriteria: ["Controller claimed", "First spawn operational"]
    });

    return phases;
  }

  /**
   * Generate economy strategy phases
   */
  private generateEconomyPhases(request: StrategyRequest, _currentState: Record<string, unknown>): StrategyPhase[] {
    const phases: StrategyPhase[] = [];
    const isShortTerm = request.timeHorizon === "short";

    phases.push({
      name: "Harvesting Optimization",
      description: "Optimize energy harvesting efficiency",
      order: 1,
      duration: isShortTerm ? "2-3 days" : "1 week",
      actions: [
        {
          name: "Source assignment",
          description: "Assign harvesters to sources efficiently",
          type: "implement",
          targets: ["src/runtime/behavior/harvester-behavior.ts"],
          priority: "high"
        },
        {
          name: "Container placement",
          description: "Optimize container positions near sources",
          type: "configure",
          targets: ["src/runtime/behavior/builder-behavior.ts"],
          priority: "medium"
        }
      ],
      prerequisites: [],
      completionCriteria: ["All sources have assigned harvesters", "Containers placed"]
    });

    phases.push({
      name: "Logistics Network",
      description: "Establish efficient energy transport",
      order: 2,
      duration: isShortTerm ? "3-5 days" : "1-2 weeks",
      actions: [
        {
          name: "Hauler routing",
          description: "Optimize hauler paths and task assignment",
          type: "implement",
          targets: ["src/runtime/behavior/hauler-behavior.ts"],
          priority: "high"
        },
        {
          name: "Link network",
          description: "Configure link-based energy transfer",
          type: "configure",
          targets: ["src/runtime/behavior/link-manager.ts"],
          priority: "medium"
        }
      ],
      prerequisites: ["Harvesting Optimization"],
      completionCriteria: ["Haulers operational", "Link network active"]
    });

    phases.push({
      name: "Controller Upgrading",
      description: "Maximize controller upgrade efficiency",
      order: 3,
      duration: isShortTerm ? "ongoing" : "2-3 weeks",
      actions: [
        {
          name: "Upgrader optimization",
          description: "Optimize upgrader creep bodies and positioning",
          type: "implement",
          targets: ["src/runtime/behavior/upgrader-behavior.ts"],
          priority: "high"
        },
        {
          name: "Energy prioritization",
          description: "Balance energy between upgrading and other tasks",
          type: "configure",
          targets: ["src/runtime/behavior/spawn-manager.ts"],
          priority: "medium"
        }
      ],
      prerequisites: ["Logistics Network"],
      completionCriteria: ["Upgraders at optimal efficiency", "Controller progressing"]
    });

    return phases;
  }

  /**
   * Generate defense strategy phases
   */
  private generateDefensePhases(request: StrategyRequest, _currentState: Record<string, unknown>): StrategyPhase[] {
    const phases: StrategyPhase[] = [];

    phases.push({
      name: "Perimeter Defense",
      description: "Establish room perimeter defenses",
      order: 1,
      duration: request.timeHorizon === "short" ? "3-5 days" : "1-2 weeks",
      actions: [
        {
          name: "Wall construction",
          description: "Build walls at room entrances",
          type: "implement",
          targets: ["src/runtime/behavior/builder-behavior.ts"],
          priority: "high"
        },
        {
          name: "Rampart placement",
          description: "Place ramparts around critical structures",
          type: "configure",
          targets: ["src/runtime/construction/planning.ts"],
          priority: "high"
        }
      ],
      prerequisites: [],
      completionCriteria: ["Walls at entrances", "Critical structures protected"]
    });

    phases.push({
      name: "Active Defense",
      description: "Implement active defense mechanisms",
      order: 2,
      duration: request.timeHorizon === "short" ? "5-7 days" : "2-3 weeks",
      actions: [
        {
          name: "Tower targeting",
          description: "Implement intelligent tower targeting",
          type: "implement",
          targets: ["src/runtime/behavior/tower-manager.ts"],
          priority: "critical"
        },
        {
          name: "Defender spawning",
          description: "Spawn defender creeps when threats detected",
          type: "implement",
          targets: ["src/runtime/behavior/defender-behavior.ts"],
          priority: "high"
        }
      ],
      prerequisites: ["Perimeter Defense"],
      completionCriteria: ["Towers targeting hostile creeps", "Defenders spawn on threat"]
    });

    phases.push({
      name: "Safe Mode Management",
      description: "Implement safe mode activation logic",
      order: 3,
      duration: request.timeHorizon === "short" ? "2-3 days" : "1 week",
      actions: [
        {
          name: "Threat assessment",
          description: "Detect overwhelming threats",
          type: "implement",
          targets: ["src/runtime/evaluation/threat-evaluator.ts"],
          priority: "critical"
        },
        {
          name: "Safe mode trigger",
          description: "Activate safe mode when critical thresholds exceeded",
          type: "implement",
          targets: ["src/runtime/behavior/defense-manager.ts"],
          priority: "critical"
        }
      ],
      prerequisites: ["Active Defense"],
      completionCriteria: ["Threat detection active", "Safe mode triggers correctly"]
    });

    return phases;
  }

  /**
   * Generate combat strategy phases
   */
  private generateCombatPhases(_request: StrategyRequest, _currentState: Record<string, unknown>): StrategyPhase[] {
    const phases: StrategyPhase[] = [];

    phases.push({
      name: "Combat Creep Design",
      description: "Design effective combat creep bodies",
      order: 1,
      duration: "3-5 days",
      actions: [
        {
          name: "Attacker design",
          description: "Design attacker creep with optimal parts",
          type: "implement",
          targets: ["src/runtime/behavior/attacker-behavior.ts"],
          priority: "high"
        },
        {
          name: "Healer design",
          description: "Design healer creep for squad support",
          type: "implement",
          targets: ["src/runtime/behavior/healer-behavior.ts"],
          priority: "high"
        }
      ],
      prerequisites: [],
      completionCriteria: ["Combat creep designs defined"]
    });

    phases.push({
      name: "Squad Coordination",
      description: "Implement coordinated squad movements",
      order: 2,
      duration: "1-2 weeks",
      actions: [
        {
          name: "Squad formation",
          description: "Implement squad movement patterns",
          type: "implement",
          targets: ["src/runtime/behavior/squad-manager.ts"],
          priority: "high"
        },
        {
          name: "Target prioritization",
          description: "Prioritize targets based on threat level",
          type: "implement",
          targets: ["src/runtime/evaluation/target-evaluator.ts"],
          priority: "medium"
        }
      ],
      prerequisites: ["Combat Creep Design"],
      completionCriteria: ["Squads move in formation", "Targets prioritized correctly"]
    });

    return phases;
  }

  /**
   * Generate infrastructure strategy phases
   */
  private generateInfrastructurePhases(
    request: StrategyRequest,
    _currentState: Record<string, unknown>
  ): StrategyPhase[] {
    const phases: StrategyPhase[] = [];

    phases.push({
      name: "Road Network",
      description: "Build efficient road network",
      order: 1,
      duration: request.timeHorizon === "short" ? "3-5 days" : "1-2 weeks",
      actions: [
        {
          name: "Path analysis",
          description: "Analyze frequently used paths",
          type: "implement",
          targets: ["src/runtime/construction/road-planner.ts"],
          priority: "medium"
        },
        {
          name: "Road construction",
          description: "Build roads on high-traffic paths",
          type: "implement",
          targets: ["src/runtime/behavior/builder-behavior.ts"],
          priority: "medium"
        }
      ],
      prerequisites: [],
      completionCriteria: ["High-traffic paths identified", "Roads constructed"]
    });

    phases.push({
      name: "Structure Optimization",
      description: "Optimize structure placement",
      order: 2,
      duration: request.timeHorizon === "short" ? "5-7 days" : "2-3 weeks",
      actions: [
        {
          name: "Extension placement",
          description: "Place extensions for spawn efficiency",
          type: "configure",
          targets: ["src/runtime/construction/planning.ts"],
          priority: "high"
        },
        {
          name: "Tower positioning",
          description: "Position towers for optimal coverage",
          type: "configure",
          targets: ["src/runtime/construction/planning.ts"],
          priority: "high"
        }
      ],
      prerequisites: ["Road Network"],
      completionCriteria: ["Extensions placed optimally", "Towers cover critical areas"]
    });

    return phases;
  }

  /**
   * Generate optimization strategy phases
   */
  private generateOptimizationPhases(
    _request: StrategyRequest,
    _currentState: Record<string, unknown>
  ): StrategyPhase[] {
    const phases: StrategyPhase[] = [];

    phases.push({
      name: "CPU Profiling",
      description: "Profile and identify CPU bottlenecks",
      order: 1,
      duration: "3-5 days",
      actions: [
        {
          name: "Enable profiler",
          description: "Activate CPU profiler for analysis",
          type: "configure",
          targets: ["src/runtime/metrics/profiler.ts"],
          priority: "high"
        },
        {
          name: "Collect metrics",
          description: "Gather CPU usage data over multiple ticks",
          type: "monitor",
          targets: ["reports/profiler/"],
          priority: "high"
        }
      ],
      prerequisites: [],
      completionCriteria: ["Profiler data collected", "Bottlenecks identified"]
    });

    phases.push({
      name: "Memory Optimization",
      description: "Optimize memory usage and structure",
      order: 2,
      duration: "1 week",
      actions: [
        {
          name: "Memory audit",
          description: "Audit current memory structure",
          type: "monitor",
          targets: ["src/runtime/memory/"],
          priority: "medium"
        },
        {
          name: "Cleanup routines",
          description: "Implement memory cleanup for dead creeps",
          type: "implement",
          targets: ["src/runtime/memory/cleanup.ts"],
          priority: "medium"
        }
      ],
      prerequisites: [],
      completionCriteria: ["Memory structure documented", "Cleanup active"]
    });

    phases.push({
      name: "Algorithm Optimization",
      description: "Optimize critical algorithms",
      order: 3,
      duration: "2-3 weeks",
      actions: [
        {
          name: "Pathfinding caching",
          description: "Cache expensive pathfinding results",
          type: "implement",
          targets: ["src/runtime/behavior/movement.ts"],
          priority: "high"
        },
        {
          name: "Batch operations",
          description: "Batch similar operations to reduce overhead",
          type: "implement",
          targets: ["src/runtime/behavior/"],
          priority: "medium"
        }
      ],
      prerequisites: ["CPU Profiling"],
      completionCriteria: ["Critical paths optimized", "CPU usage reduced"]
    });

    return phases;
  }

  /**
   * Define success metrics for strategy
   */
  private defineMetrics(request: StrategyRequest): SuccessMetric[] {
    const metrics: SuccessMetric[] = [];

    for (const objective of request.objectives) {
      metrics.push({
        name: objective.name,
        currentValue: "TBD",
        targetValue: objective.target,
        unit: typeof objective.target === "number" ? "units" : "status",
        measurementMethod: `Monitor ${objective.metric} via PTR telemetry`
      });
    }

    // Add domain-specific default metrics
    switch (request.domain) {
      case "expansion":
        metrics.push({
          name: "Room Count",
          currentValue: 1,
          targetValue: 2,
          unit: "rooms",
          measurementMethod: "Count controlled rooms in Game.rooms"
        });
        break;
      case "economy":
        metrics.push({
          name: "Energy Income",
          currentValue: 0,
          targetValue: 3000,
          unit: "energy/tick",
          measurementMethod: "Calculate from harvester activity"
        });
        break;
      case "defense":
        metrics.push({
          name: "Defense Coverage",
          currentValue: 0,
          targetValue: 100,
          unit: "percent",
          measurementMethod: "Calculate protected vs exposed structures"
        });
        break;
      case "optimization":
        metrics.push({
          name: "CPU Usage",
          currentValue: 100,
          targetValue: 80,
          unit: "percent of limit",
          measurementMethod: "Monitor Game.cpu.getUsed()"
        });
        break;
    }

    return metrics;
  }

  /**
   * Assess risks for strategy
   */
  private assessRisks(request: StrategyRequest, phases: StrategyPhase[]): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    // Domain-specific risks
    switch (request.domain) {
      case "expansion":
        risks.push({
          name: "Hostile room",
          description: "Target room may contain hostile players",
          probability: 30,
          impact: 70,
          mitigation: "Scout thoroughly before committing resources"
        });
        risks.push({
          name: "Resource strain",
          description: "Expansion may strain existing economy",
          probability: 50,
          impact: 40,
          mitigation: "Ensure stable economy before expansion"
        });
        break;
      case "economy":
        risks.push({
          name: "Energy deficit",
          description: "Changes may temporarily reduce income",
          probability: 40,
          impact: 30,
          mitigation: "Implement changes incrementally"
        });
        break;
      case "defense":
        risks.push({
          name: "Resource diversion",
          description: "Defense may divert resources from growth",
          probability: 60,
          impact: 30,
          mitigation: "Balance defense investment with economy"
        });
        break;
      case "combat":
        risks.push({
          name: "Retaliation",
          description: "Combat may trigger enemy retaliation",
          probability: 70,
          impact: 60,
          mitigation: "Ensure defense is ready before attacking"
        });
        break;
      case "optimization":
        risks.push({
          name: "Regression",
          description: "Optimizations may introduce bugs",
          probability: 40,
          impact: 50,
          mitigation: "Thorough testing before deployment"
        });
        break;
    }

    // General risks based on phase count
    if (phases.length > 3) {
      risks.push({
        name: "Complexity",
        description: "Multi-phase strategy increases failure points",
        probability: 30,
        impact: 40,
        mitigation: "Monitor each phase before proceeding"
      });
    }

    return risks;
  }

  /**
   * Create implementation plan
   */
  private createImplementationPlan(request: StrategyRequest, phases: StrategyPhase[]): ImplementationPlan {
    const filesToModify: string[] = [];
    const filesToCreate: string[] = [];
    const testsToAdd: string[] = [];
    const documentationUpdates: string[] = [];

    for (const phase of phases) {
      for (const action of phase.actions) {
        if (action.type === "implement") {
          filesToModify.push(...action.targets);
          testsToAdd.push(...action.targets.map(t => t.replace("src/", "tests/unit/").replace(".ts", ".test.ts")));
        } else if (action.type === "configure") {
          filesToModify.push(...action.targets);
        }
      }
    }

    documentationUpdates.push(`docs/strategy/${request.domain}-strategy.md`);
    documentationUpdates.push("CHANGELOG.md");

    // Estimate effort based on phases and actions
    const totalActions = phases.reduce((sum, p) => sum + p.actions.length, 0);
    let estimatedEffort: string;
    if (totalActions <= 3) {
      estimatedEffort = "1-2 days";
    } else if (totalActions <= 6) {
      estimatedEffort = "3-5 days";
    } else if (totalActions <= 10) {
      estimatedEffort = "1-2 weeks";
    } else {
      estimatedEffort = "2-4 weeks";
    }

    return {
      summary: `Implement ${request.domain} strategy across ${phases.length} phases with ${totalActions} actions`,
      filesToModify: [...new Set(filesToModify)],
      filesToCreate: [...new Set(filesToCreate)],
      testsToAdd: [...new Set(testsToAdd)],
      documentationUpdates,
      estimatedEffort
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(request: StrategyRequest, phases: StrategyPhase[], metrics: SuccessMetric[]): number {
    let confidence = 70; // Base confidence

    // Adjust based on objectives clarity
    if (request.objectives.length > 0) {
      confidence += 10;
    }

    // Adjust based on phase structure
    if (phases.every(p => p.prerequisites.length <= p.order - 1)) {
      confidence += 5; // Well-structured dependencies
    }

    // Adjust based on metrics
    if (metrics.length >= request.objectives.length) {
      confidence += 5; // All objectives have metrics
    }

    // Adjust based on constraints
    if (request.constraints.maxCPU || request.constraints.maxMemory) {
      confidence += 5; // Clear constraints defined
    }

    // Cap at 95
    return Math.min(confidence, 95);
  }

  /**
   * Generate executive summary
   */
  private generateSummary(
    request: StrategyRequest,
    phases: StrategyPhase[],
    metrics: SuccessMetric[],
    risks: RiskAssessment[]
  ): string {
    const totalActions = phases.reduce((sum, p) => sum + p.actions.length, 0);
    const criticalRisks = risks.filter(r => r.impact >= 60).length;

    return (
      `${request.domain.charAt(0).toUpperCase() + request.domain.slice(1)} strategy ` +
      `with ${request.timeHorizon}-term horizon. ${phases.length} phases, ${totalActions} actions, ` +
      `${metrics.length} success metrics. ${criticalRisks > 0 ? `${criticalRisks} critical risks identified.` : "No critical risks."}`
    );
  }

  /**
   * Log an action
   */
  private logAction(type: ActionType, description: string, details?: Record<string, unknown>): void {
    const action: AgentAction = {
      type,
      timestamp: new Date(),
      description
    };
    if (details !== undefined) {
      action.details = details;
    }
    this.actions.push(action);
  }

  /**
   * Get all actions taken
   */
  public getActions(): AgentAction[] {
    return [...this.actions];
  }

  /**
   * Clear action log
   */
  public clearActions(): void {
    this.actions = [];
  }
}
