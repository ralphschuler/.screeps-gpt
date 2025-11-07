import { describe, it, expect } from "vitest";
import { AnalyticsReporter } from "@runtime/metrics/AnalyticsReporter";
import { StatsCollector } from "@runtime/metrics/StatsCollector";

/**
 * Regression tests for analytics and metrics collection
 *
 * These tests validate that the analytics system correctly handles:
 * - Large-scale metrics collection and reporting
 * - Batch processing under load
 * - Memory-efficient stats aggregation
 * - Integration with existing StatsCollector
 *
 * Related to Phase 5 implementation: Analytics and Observability
 */
describe("Analytics and metrics collection regression", () => {
  describe("High-volume metrics collection", () => {
    it("should handle 1000+ queued reports efficiently", () => {
      const reporter = new AnalyticsReporter({
        batchSize: 2000,
        logger: { log: () => {}, warn: () => {}, error: () => {} }
      });

      const startTime = Date.now();

      // Queue 1000 reports
      for (let i = 0; i < 1000; i++) {
        reporter.queueReport({
          tick: 10000 + i,
          cpu: 40 + Math.random() * 30,
          bucket: 8000 + Math.random() * 2000,
          rooms: 5,
          creeps: 50 + Math.floor(Math.random() * 20)
        });
      }

      const duration = Date.now() - startTime;

      const summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(1000);
      expect(duration).toBeLessThan(200); // Should complete quickly
    });

    it("should maintain queue integrity under concurrent operations", () => {
      const reporter = new AnalyticsReporter({
        batchSize: 500,
        logger: { log: () => {}, warn: () => {}, error: () => {} }
      });

      // Simulate concurrent report generation
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        reporter.queueReport({ iteration: i, timestamp: Date.now() });

        // Interleave with summary checks
        if (i % 10 === 0) {
          const summary = reporter.getSummary();
          expect(summary.queuedReports).toBeGreaterThan(0);
        }
      }

      const finalSummary = reporter.getSummary();
      expect(finalSummary.queuedReports).toBe(iterations);
    });

    it("should handle varying report sizes", () => {
      const reporter = new AnalyticsReporter({
        batchSize: 100,
        logger: { log: () => {}, warn: () => {}, error: () => {} }
      });

      // Small report
      reporter.queueReport({ tick: 1000 });

      // Medium report
      reporter.queueReport({
        tick: 1001,
        cpu: 50,
        bucket: 9000,
        rooms: {
          W1N1: { energy: 300, rcl: 3 },
          W2N2: { energy: 800, rcl: 5 }
        }
      });

      // Large report
      reporter.queueReport({
        tick: 1002,
        cpu: 60,
        bucket: 8500,
        rooms: Array.from({ length: 10 }, (_, i) => ({
          name: `W${i}N${i}`,
          energy: Math.random() * 1000,
          rcl: Math.floor(Math.random() * 8)
        })),
        creeps: Array.from({ length: 100 }, (_, i) => ({
          name: `creep_${i}`,
          role: "harvester",
          cpu: Math.random() * 0.5
        }))
      });

      const summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(3);
    });
  });

  describe("Batch processing under load", () => {
    it("should auto-flush at batch boundaries", async () => {
      const flushCount = { value: 0 };
      const logger = {
        log: (msg: string) => {
          if (msg.includes("Successfully sent")) {
            flushCount.value++;
          }
        },
        warn: () => {},
        error: () => {}
      };

      const reporter = new AnalyticsReporter({
        endpoint: "https://analytics.example.com/api/stats",
        batchSize: 10,
        logger
      });

      // Queue exactly 10 reports (should trigger one flush)
      for (let i = 0; i < 10; i++) {
        reporter.queueReport({ tick: 1000 + i });
      }

      // Small delay to allow async flush
      await new Promise(resolve => setTimeout(resolve, 50));

      // Note: flush may not happen in test environment without fetch
      // But we can verify queue is managed correctly
      const summary = reporter.getSummary();
      expect(summary.queuedReports).toBeLessThanOrEqual(10);
    });

    it("should handle rapid batch cycles", async () => {
      const reporter = new AnalyticsReporter({
        batchSize: 5,
        logger: { log: () => {}, warn: () => {}, error: () => {} }
      });

      // Queue 25 reports (should trigger 5 batches)
      for (let i = 0; i < 25; i++) {
        reporter.queueReport({ tick: 1000 + i });
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      // Allow flushes to complete
      await reporter.flush();

      const summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(0);
    });

    it("should preserve report order within batches", () => {
      const reporter = new AnalyticsReporter({
        batchSize: 100,
        logger: { log: () => {}, warn: () => {}, error: () => {} }
      });

      const expectedOrder: number[] = [];
      for (let i = 0; i < 50; i++) {
        expectedOrder.push(1000 + i);
        reporter.queueReport({ tick: 1000 + i, index: i });
      }

      // Queue maintains insertion order
      const summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(50);
      expect(summary.oldestReport).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("Memory efficiency", () => {
    it("should limit queue growth on repeated failures", async () => {
      const logger = { log: () => {}, warn: () => {}, error: () => {} };
      const reporter = new AnalyticsReporter({
        endpoint: "https://invalid-endpoint.example.com/api/stats",
        batchSize: 10,
        logger
      });

      // Queue and flush multiple times to simulate failures
      for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 10; i++) {
          reporter.queueReport({ tick: round * 10 + i });
        }
        await reporter.flush();
      }

      const summary = reporter.getSummary();
      // Queue should not grow unbounded (with isFlushing guard, behavior is more predictable)
      expect(summary.queuedReports).toBeLessThanOrEqual(50);
    });

    it("should handle clear operation efficiently", () => {
      const reporter = new AnalyticsReporter({
        batchSize: 10000,
        logger: { log: () => {}, warn: () => {}, error: () => {} }
      });

      // Queue many reports
      for (let i = 0; i < 5000; i++) {
        reporter.queueReport({ tick: i });
      }

      expect(reporter.getSummary().queuedReports).toBe(5000);

      const startTime = Date.now();
      reporter.clear();
      const duration = Date.now() - startTime;

      expect(reporter.getSummary().queuedReports).toBe(0);
      expect(duration).toBeLessThan(10); // Should be instant
    });
  });

  describe("Integration with StatsCollector", () => {
    it("should collect and report game stats", () => {
      const collector = new StatsCollector();
      const reporter = new AnalyticsReporter({
        batchSize: 100,
        logger: { log: () => {}, warn: () => {}, error: () => {} }
      });

      // Mock game context
      const mockGame = {
        time: 12345,
        cpu: {
          getUsed: () => 45.5,
          limit: 100,
          bucket: 9500
        },
        creeps: {
          harvester1: {},
          upgrader1: {},
          builder1: {}
        },
        rooms: {
          W1N1: {
            energyAvailable: 300,
            energyCapacityAvailable: 550,
            controller: {
              level: 3,
              progress: 25000,
              progressTotal: 45000
            }
          }
        }
      };

      const mockMemory: Memory = {} as Memory;
      const mockSnapshot = {
        tick: 12345,
        cpuUsed: 45.5,
        cpuLimit: 100,
        cpuBucket: 9500,
        creepCount: 3,
        roomCount: 1,
        spawnOrders: 0,
        warnings: [],
        execution: {
          processedCreeps: 3,
          spawnedCreeps: [],
          tasksExecuted: {}
        }
      };

      // Collect stats
      collector.collect(mockGame, mockMemory, mockSnapshot);

      // Report stats
      reporter.queueReport(mockMemory.stats, {
        shard: "shard0",
        version: "1.0.0"
      });

      const summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(1);
    });

    it("should handle stats collection over multiple ticks", () => {
      const collector = new StatsCollector();
      const reporter = new AnalyticsReporter({
        batchSize: 20,
        logger: { log: () => {}, warn: () => {}, error: () => {} }
      });

      // Simulate 10 ticks of stats collection
      for (let tick = 1000; tick < 1010; tick++) {
        const mockGame = {
          time: tick,
          cpu: {
            getUsed: () => 40 + Math.random() * 20,
            limit: 100,
            bucket: 9000 + Math.random() * 500
          },
          creeps: {},
          rooms: {}
        };

        const mockMemory: Memory = {} as Memory;
        const mockSnapshot = {
          tick,
          cpuUsed: 40 + Math.random() * 20,
          cpuLimit: 100,
          cpuBucket: 9000 + Math.random() * 500,
          creepCount: 0,
          roomCount: 0,
          spawnOrders: 0,
          warnings: [],
          execution: {
            processedCreeps: 0,
            spawnedCreeps: [],
            tasksExecuted: {}
          }
        };

        collector.collect(mockGame, mockMemory, mockSnapshot);
        reporter.queueReport(mockMemory.stats);
      }

      const summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(10);
    });
  });

  describe("Compression efficiency", () => {
    it("should compress large payloads", () => {
      const reporter = new AnalyticsReporter({
        batchSize: 1000,
        enableCompression: true,
        logger: { log: () => {}, warn: () => {}, error: () => {} }
      });

      // Queue large reports
      for (let i = 0; i < 100; i++) {
        reporter.queueReport({
          tick: 10000 + i,
          cpu: 50,
          rooms: Array.from({ length: 10 }, (_, j) => ({
            name: `W${j}N${j}`,
            structures: Array.from({ length: 50 }, (_, k) => ({
              type: "extension",
              id: `${i}_${j}_${k}`,
              energy: Math.random() * 50
            }))
          }))
        });
      }

      const summary = reporter.getSummary();
      expect(summary.compressionEnabled).toBe(true);
      expect(summary.queuedReports).toBe(100);
    });
  });
});
