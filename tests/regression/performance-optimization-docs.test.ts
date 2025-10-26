import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Regression test for performance optimization documentation
 *
 * This test validates that the performance optimization guide exists and contains
 * comprehensive documentation on CPU and memory optimization strategies.
 *
 * Related issue: Performance optimization guide creation
 */
describe("Performance optimization documentation", () => {
  const docsPath = join(process.cwd(), "docs/operations/performance-optimization.md");

  it("should have performance optimization guide in docs/operations", () => {
    expect(existsSync(docsPath)).toBe(true);
  });

  describe("Guide content validation", () => {
    let content: string;

    it("should load the documentation file", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content.length).toBeGreaterThan(1000);
    });

    it("should contain CPU optimization strategies section", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toMatch(/##\s+CPU Optimization/i);
      expect(content).toContain("CPU Budget Management");
      expect(content).toContain("BehaviorController Safety Margin");
      expect(content).toContain("PerformanceTracker Thresholds");
      expect(content).toContain("Kernel Emergency Threshold");
    });

    it("should document CPU optimization thresholds", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toContain("0.8"); // 80% safety margin
      expect(content).toContain("0.7"); // 70% warning threshold
      expect(content).toContain("0.9"); // 90% critical threshold
      expect(content).toContain("1.5"); // Per-creep CPU threshold
    });

    it("should contain memory management best practices section", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toMatch(/##\s+Memory Management/i);
      expect(content).toContain("Memory Best Practices");
      expect(content).toContain("Clean Up Dead Creep Memory");
      expect(content).toContain("Store References, Not Objects");
      expect(content).toContain("Use Efficient Data Structures");
    });

    it("should contain pathfinding optimization section", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toMatch(/##\s+Pathfinding Optimization/i);
      expect(content).toContain("Movement Optimization Strategies");
      expect(content).toContain("reusePath");
      expect(content).toContain("Cached Pathfinding");
    });

    it("should document optimal reusePath values", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toContain("reusePath: 30"); // Standard movement
      expect(content).toContain("reusePath: 40"); // Remote mining
      expect(content).toContain("reusePath: 50"); // Long distance
    });

    it("should contain profiling and monitoring section", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toMatch(/##\s+Profiling and Monitoring/i);
      expect(content).toContain("PerformanceTracker");
      expect(content).toContain("StatsCollector");
      expect(content).toContain("SystemEvaluator");
    });

    it("should reference existing performance utilities", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toContain("src/runtime/metrics/PerformanceTracker.ts");
      expect(content).toContain("src/runtime/metrics/StatsCollector.ts");
      expect(content).toContain("src/runtime/behavior/BehaviorController.ts");
      expect(content).toContain("src/runtime/evaluation/SystemEvaluator.ts");
      expect(content).toContain("src/runtime/memory/MemoryManager.ts");
    });

    it("should contain performance patterns section", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toMatch(/##\s+Performance Patterns/i);
      expect(content).toContain("Early Exit Pattern");
      expect(content).toContain("Batching Pattern");
      expect(content).toContain("Incremental Processing Pattern");
    });

    it("should contain anti-patterns section", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toMatch(/##\s+Anti-Patterns to Avoid/i);
      expect(content).toContain("Per-Tick Room Scans");
      expect(content).toContain("Unnecessary Object Creation");
      expect(content).toContain("Ignoring CPU Budget");
    });

    it("should reference official Screeps documentation", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toContain("https://docs.screeps.com/game-loop.html");
      expect(content).toContain("https://docs.screeps.com/cpu-limit.html");
    });

    it("should reference related issues and monitoring infrastructure", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toContain("#117"); // PTR CPU monitoring alerts
      expect(content).toContain("#299"); // Proactive CPU monitoring system
      expect(content).toContain("#287"); // CPU timeout regression
      expect(content).toContain("#137"); // Screeps-profiler integration
    });

    it("should reference existing regression tests", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toContain("cpu-timeout-prevention.test.ts");
      expect(content).toContain("cpu-optimization-90-percent.test.ts");
    });

    it("should link to related documentation", () => {
      content = readFileSync(docsPath, "utf-8");
      expect(content).toContain("stats-monitoring.md");
      expect(content).toContain("stats-collection.md");
    });

    it("should contain code examples", () => {
      content = readFileSync(docsPath, "utf-8");
      // Should have TypeScript code blocks
      expect(content).toMatch(/```typescript/);
      // Should have JavaScript code blocks for console examples
      expect(content).toMatch(/```(javascript|typescript)/);
      // Should contain example code
      expect(content).toContain("Game.cpu.getUsed()");
      expect(content).toContain("creep.moveTo");
    });
  });
});
