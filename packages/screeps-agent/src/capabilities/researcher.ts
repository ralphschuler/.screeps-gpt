/**
 * Researcher Capability
 *
 * Provides autonomous research capabilities for investigating topics,
 * analyzing patterns, and delivering structured insights for Screeps development.
 */

import type { MCPClient } from "../mcp/client.js";
import {
  ActionType,
  type TaskResult,
  type AgentAction,
  type ResearchRequest,
  type ResearchResult,
  type ResearchFinding,
  type ResearchRecommendation,
  type ResearchSource
} from "../types.js";

/**
 * Researcher capability for autonomous topic research and analysis
 */
export class ResearcherCapability {
  private mcpClient: MCPClient;
  private actions: AgentAction[] = [];

  public constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * Conduct research on a specified topic
   *
   * @param request - Research request configuration
   * @returns Task result containing research findings
   */
  public async conductResearch(request: ResearchRequest): Promise<TaskResult> {
    this.actions = [];

    try {
      this.logAction(ActionType.ResearchAnalysis, "Starting research", {
        topic: request.topic,
        scope: request.scope,
        depth: request.depth
      });

      // Gather data based on scope
      const sources: ResearchSource[] = [];
      const findings: ResearchFinding[] = [];

      if (request.scope === "internal" || request.scope === "comprehensive") {
        // Research internal codebase and documentation
        const internalFindings = await this.researchInternal(request);
        findings.push(...internalFindings.findings);
        sources.push(...internalFindings.sources);
      }

      if (request.scope === "external" || request.scope === "comprehensive") {
        // Research external resources (Screeps docs, API, community)
        const externalFindings = await this.researchExternal(request);
        findings.push(...externalFindings.findings);
        sources.push(...externalFindings.sources);
      }

      // Analyze bot state for context
      const botState = await this.analyzeBotState();
      if (botState.findings.length > 0) {
        findings.push(...botState.findings);
        sources.push(...botState.sources);
      }

      // Generate recommendations based on findings
      const recommendations = this.generateRecommendations(findings, request);

      // Calculate confidence score
      const confidence = this.calculateConfidence(findings, sources);

      // Generate summary
      const summary = this.generateSummary(request, findings, recommendations);

      const result: ResearchResult = {
        topic: request.topic,
        findings,
        recommendations,
        sources,
        confidence,
        timestamp: new Date(),
        summary
      };

      this.logAction(ActionType.ResearchAnalysis, "Research completed", {
        findingsCount: findings.length,
        recommendationsCount: recommendations.length,
        confidence
      });

      return {
        success: true,
        message: `Research completed for topic: ${request.topic}`,
        data: result as unknown as Record<string, unknown>,
        actions: this.actions
      };
    } catch (error) {
      return {
        success: false,
        message: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        actions: this.actions
      };
    }
  }

  /**
   * Research internal codebase and documentation
   */
  private async researchInternal(
    request: ResearchRequest
  ): Promise<{ findings: ResearchFinding[]; sources: ResearchSource[] }> {
    const findings: ResearchFinding[] = [];
    const sources: ResearchSource[] = [];

    this.logAction(ActionType.MCPRead, "Analyzing internal codebase", {
      topic: request.topic
    });

    // Analyze runtime code patterns
    const codePatterns = this.analyzeCodePatterns(request);
    if (codePatterns.length > 0) {
      findings.push({
        title: "Code Pattern Analysis",
        description: `Found ${codePatterns.length} relevant code patterns in the runtime`,
        relevance: 85,
        evidence: codePatterns,
        category: "code"
      });
      sources.push({
        title: "Runtime Codebase",
        location: "src/runtime/",
        type: "code",
        reliability: 95
      });
    }

    // Analyze existing documentation
    const docAnalysis = this.analyzeDocumentation(request);
    if (docAnalysis.length > 0) {
      findings.push({
        title: "Documentation Analysis",
        description: `Found ${docAnalysis.length} relevant documentation sections`,
        relevance: 80,
        evidence: docAnalysis,
        category: "documentation"
      });
      sources.push({
        title: "Repository Documentation",
        location: "docs/",
        type: "documentation",
        reliability: 90
      });
    }

    // Analyze existing issues for context
    const issueContext = await this.analyzeIssueContext(request);
    if (issueContext.length > 0) {
      findings.push({
        title: "Issue History Analysis",
        description: `Found ${issueContext.length} related issues in the repository`,
        relevance: 75,
        evidence: issueContext,
        category: "issues"
      });
      sources.push({
        title: "GitHub Issues",
        location: "github.com/issues",
        type: "issue",
        reliability: 85
      });
    }

    return { findings, sources };
  }

  /**
   * Research external resources
   */
  private async researchExternal(
    request: ResearchRequest
  ): Promise<{ findings: ResearchFinding[]; sources: ResearchSource[] }> {
    const findings: ResearchFinding[] = [];
    const sources: ResearchSource[] = [];

    this.logAction(ActionType.ResearchAnalysis, "Analyzing external resources", {
      topic: request.topic
    });

    // Screeps API documentation patterns
    const apiPatterns = this.analyzeScreepsAPI(request);
    if (apiPatterns.length > 0) {
      findings.push({
        title: "Screeps API Analysis",
        description: `Identified ${apiPatterns.length} relevant API patterns`,
        relevance: 90,
        evidence: apiPatterns,
        category: "api"
      });
      sources.push({
        title: "Screeps API Documentation",
        location: "https://docs.screeps.com/api/",
        type: "external",
        reliability: 95
      });
    }

    // Game mechanics analysis
    const mechanicsAnalysis = this.analyzeGameMechanics(request);
    if (mechanicsAnalysis.length > 0) {
      findings.push({
        title: "Game Mechanics Analysis",
        description: `Analyzed ${mechanicsAnalysis.length} relevant game mechanics`,
        relevance: 85,
        evidence: mechanicsAnalysis,
        category: "mechanics"
      });
      sources.push({
        title: "Screeps Game Documentation",
        location: "https://docs.screeps.com/",
        type: "external",
        reliability: 95
      });
    }

    return { findings, sources };
  }

  /**
   * Analyze current bot state for research context
   */
  private async analyzeBotState(): Promise<{ findings: ResearchFinding[]; sources: ResearchSource[] }> {
    const findings: ResearchFinding[] = [];
    const sources: ResearchSource[] = [];

    try {
      const stats = (await this.mcpClient.getBotState()) as {
        cpu?: { used?: number; limit?: number };
        gcl?: { level?: number };
        rooms?: number;
        creeps?: number;
      } | null;

      if (stats) {
        // Extract only non-sensitive summary metrics for evidence
        const safeMetrics: string[] = ["Bot state retrieved successfully"];
        if (stats.cpu?.used !== undefined) {
          safeMetrics.push(`CPU: ${stats.cpu.used.toFixed(1)}%`);
        }
        if (stats.gcl?.level !== undefined) {
          safeMetrics.push(`GCL: ${stats.gcl.level}`);
        }
        if (stats.rooms !== undefined) {
          safeMetrics.push(`Rooms: ${stats.rooms}`);
        }
        if (stats.creeps !== undefined) {
          safeMetrics.push(`Creeps: ${stats.creeps}`);
        }

        findings.push({
          title: "Bot State Analysis",
          description: "Current bot operational state analyzed for research context",
          relevance: 70,
          evidence: safeMetrics,
          category: "runtime"
        });
        sources.push({
          title: "Screeps Bot Runtime",
          location: "screeps://stats",
          type: "api",
          reliability: 100
        });
      }
    } catch {
      // Bot state not available, continue without it
      this.logAction(ActionType.MCPRead, "Bot state not available for research context", {});
    }

    return { findings, sources };
  }

  /**
   * Analyze code patterns relevant to the research topic
   */
  private analyzeCodePatterns(request: ResearchRequest): string[] {
    const patterns: string[] = [];
    const topic = request.topic.toLowerCase();

    // Map common research topics to code patterns
    if (topic.includes("creep") || topic.includes("behavior")) {
      patterns.push("Creep behavior patterns in src/runtime/behavior/");
      patterns.push("Role assignment logic in spawn manager");
    }

    if (topic.includes("spawn") || topic.includes("queue")) {
      patterns.push("Spawn queue management in spawn-manager");
      patterns.push("Creep priority calculations");
    }

    if (topic.includes("memory") || topic.includes("cache")) {
      patterns.push("Memory management patterns in src/runtime/memory/");
      patterns.push("Caching strategies for expensive calculations");
    }

    if (topic.includes("performance") || topic.includes("cpu")) {
      patterns.push("CPU profiling integration in src/runtime/metrics/");
      patterns.push("Performance optimization patterns");
    }

    if (topic.includes("expansion") || topic.includes("room")) {
      patterns.push("Room evaluation algorithms");
      patterns.push("Multi-room management patterns");
    }

    if (patterns.length === 0) {
      patterns.push(`General patterns related to: ${request.topic}`);
    }

    return patterns;
  }

  /**
   * Analyze existing documentation
   */
  private analyzeDocumentation(request: ResearchRequest): string[] {
    const docs: string[] = [];
    const topic = request.topic.toLowerCase();

    // Map research topics to documentation sections
    if (topic.includes("automation")) {
      docs.push("packages/docs/source/docs/automation/ - Workflow specifications");
      docs.push("AGENTS.md - Agent guidelines and knowledge base");
    }

    if (topic.includes("strategy") || topic.includes("roadmap")) {
      docs.push("docs/strategy/roadmap.md - Development roadmap");
      docs.push("docs/strategy/phases/ - Phase-specific documentation");
    }

    if (topic.includes("monitoring") || topic.includes("telemetry")) {
      docs.push("docs/automation/monitoring-telemetry.md - Telemetry system");
      docs.push("packages/docs/source/docs/operations/ - Operations documentation");
    }

    if (docs.length === 0) {
      docs.push("README.md - Repository overview");
      docs.push("DOCS.md - Developer guide");
    }

    return docs;
  }

  /**
   * Analyze issue context for research
   */
  private async analyzeIssueContext(request: ResearchRequest): Promise<string[]> {
    const context: string[] = [];
    const keywords = request.keywords || [request.topic];

    for (const keyword of keywords) {
      context.push(`Issues related to: ${keyword}`);
    }

    return context;
  }

  /**
   * Analyze Screeps API for relevant patterns
   */
  private analyzeScreepsAPI(request: ResearchRequest): string[] {
    const patterns: string[] = [];
    const topic = request.topic.toLowerCase();

    // Map topics to API patterns
    if (topic.includes("creep")) {
      patterns.push("Creep class methods: move, harvest, build, repair, etc.");
      patterns.push("Creep.store for resource management");
    }

    if (topic.includes("room")) {
      patterns.push("Room class for spatial management");
      patterns.push("RoomPosition for coordinate calculations");
    }

    if (topic.includes("spawn")) {
      patterns.push("StructureSpawn.spawnCreep() for creep creation");
      patterns.push("StructureSpawn.spawning for spawn status");
    }

    if (topic.includes("memory")) {
      patterns.push("Memory global object for persistence");
      patterns.push("RawMemory for advanced memory management");
    }

    if (topic.includes("path") || topic.includes("move")) {
      patterns.push("PathFinder for efficient pathfinding");
      patterns.push("Room.findPath for simple path calculation");
    }

    return patterns;
  }

  /**
   * Analyze game mechanics relevant to research
   */
  private analyzeGameMechanics(request: ResearchRequest): string[] {
    const mechanics: string[] = [];
    const topic = request.topic.toLowerCase();

    if (topic.includes("energy") || topic.includes("harvest")) {
      mechanics.push("Energy source mechanics: 3000 energy, 300 ticks regeneration");
      mechanics.push("Harvesting: 2 energy per WORK part per tick");
    }

    if (topic.includes("controller") || topic.includes("rcl")) {
      mechanics.push("Controller level progression requirements");
      mechanics.push("Downgrade mechanics: 20000 ticks for level 1-4");
    }

    if (topic.includes("cpu") || topic.includes("bucket")) {
      mechanics.push("CPU bucket: 10000 max, unused CPU accumulates");
      mechanics.push("GCL determines CPU limit increase");
    }

    if (topic.includes("combat") || topic.includes("attack")) {
      mechanics.push("Attack mechanics: 30 damage per ATTACK part");
      mechanics.push("Tower range mechanics: optimal at range 5");
    }

    return mechanics;
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(findings: ResearchFinding[], request: ResearchRequest): ResearchRecommendation[] {
    const recommendations: ResearchRecommendation[] = [];

    // Generate recommendations based on findings and output format
    if (request.outputFormat === "actionable_items") {
      // Generate specific action items
      for (const finding of findings.filter(f => f.relevance >= 70)) {
        recommendations.push({
          title: `Action: ${finding.title}`,
          description: `Based on ${finding.category} analysis: ${finding.description}`,
          priority: finding.relevance >= 85 ? "high" : "medium",
          effort: "medium",
          impact: `Addresses findings in ${finding.category} category`
        });
      }
    } else {
      // Generate general recommendations
      if (findings.length > 0) {
        recommendations.push({
          title: "Continue Investigation",
          description: `Further research recommended based on ${findings.length} findings`,
          priority: "medium",
          effort: "small",
          impact: "Better understanding of topic"
        });
      }

      const highRelevanceCount = findings.filter(f => f.relevance >= 80).length;
      if (highRelevanceCount > 0) {
        recommendations.push({
          title: "Prioritize High-Relevance Findings",
          description: `${highRelevanceCount} high-relevance findings warrant immediate attention`,
          priority: "high",
          effort: "medium",
          impact: "Direct improvement to bot performance"
        });
      }
    }

    return recommendations;
  }

  /**
   * Calculate confidence score for research
   */
  private calculateConfidence(findings: ResearchFinding[], sources: ResearchSource[]): number {
    if (findings.length === 0) return 0;

    // Weight factors
    const findingWeight = 0.4;
    const sourceWeight = 0.3;
    const reliabilityWeight = 0.3;

    // Calculate finding score
    const avgRelevance = findings.reduce((sum, f) => sum + f.relevance, 0) / findings.length;
    const findingScore = Math.min(avgRelevance, 100);

    // Calculate source diversity score
    const sourceTypes = new Set(sources.map(s => s.type));
    const sourceScore = Math.min(sourceTypes.size * 25, 100);

    // Calculate reliability score
    const avgReliability =
      sources.length > 0 ? sources.reduce((sum, s) => sum + s.reliability, 0) / sources.length : 50;

    return Math.round(findingScore * findingWeight + sourceScore * sourceWeight + avgReliability * reliabilityWeight);
  }

  /**
   * Generate executive summary
   */
  private generateSummary(
    request: ResearchRequest,
    findings: ResearchFinding[],
    recommendations: ResearchRecommendation[]
  ): string {
    const highRelevance = findings.filter(f => f.relevance >= 80).length;
    const categories = [...new Set(findings.map(f => f.category))];

    return (
      `Research on "${request.topic}" completed with ${request.depth} depth. ` +
      `Found ${findings.length} findings across ${categories.length} categories ` +
      `(${highRelevance} high-relevance). Generated ${recommendations.length} recommendations. ` +
      `Scope: ${request.scope}.`
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
