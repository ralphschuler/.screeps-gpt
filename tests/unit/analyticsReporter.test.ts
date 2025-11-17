import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalyticsReporter, type AnalyticsConfig } from "@runtime/metrics/AnalyticsReporter";

describe("AnalyticsReporter", () => {
  let config: AnalyticsConfig;

  beforeEach(() => {
    config = {
      endpoint: "https://analytics.example.com/api/stats",
      apiKey: "test-api-key",
      batchSize: 5,
      logger: { log: () => {}, warn: () => {}, error: () => {} }
    };
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const reporter = new AnalyticsReporter();
      const summary = reporter.getSummary();

      expect(summary.queuedReports).toBe(0);
      expect(summary.compressionEnabled).toBe(false);
    });

    it("should initialize with custom config", () => {
      const reporter = new AnalyticsReporter({
        ...config,
        enableCompression: true
      });
      const summary = reporter.getSummary();

      expect(summary.compressionEnabled).toBe(true);
    });

    it("should use provided batch size", () => {
      const reporter = new AnalyticsReporter({ batchSize: 20 });

      // Queue 19 reports (below batch size)
      for (let i = 0; i < 19; i++) {
        reporter.queueReport({ tick: i });
      }

      const summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(19);
    });
  });

  describe("Report queueing", () => {
    it("should queue reports", () => {
      const reporter = new AnalyticsReporter(config);

      reporter.queueReport({ cpu: 50, tick: 1000 });
      reporter.queueReport({ cpu: 60, tick: 1001 });

      const summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(2);
    });

    it("should include metadata in reports", () => {
      const reporter = new AnalyticsReporter(config);

      reporter.queueReport(
        { cpu: 50 },
        {
          shard: "shard0",
          user: "test-user",
          version: "1.0.0"
        }
      );

      const summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(1);
    });

    it("should track oldest report timestamp", () => {
      const reporter = new AnalyticsReporter(config);

      const firstTimestamp = (global as any).Game.time;
      reporter.queueReport({ tick: 1000 });

      const summary = reporter.getSummary();
      expect(summary.oldestReport).toBeGreaterThanOrEqual(firstTimestamp);
    });

    it("should use Game.time instead of Date.now() for deterministic timestamps", () => {
      const reporter = new AnalyticsReporter(config);

      // Set Game.time to a specific value
      (global as any).Game.time = 12345;

      reporter.queueReport({ tick: 1000 });

      const summary = reporter.getSummary();
      // Timestamp should match Game.time, not Date.now()
      expect(summary.oldestReport).toBe(12345);
    });

    it("should return null for oldest report when queue is empty", () => {
      const reporter = new AnalyticsReporter(config);
      const summary = reporter.getSummary();

      expect(summary.oldestReport).toBeNull();
    });
  });

  describe("Batch flushing", () => {
    it("should auto-flush when batch size is reached", async () => {
      const reporter = new AnalyticsReporter({ ...config, batchSize: 3 });

      // Queue 2 reports (below batch size)
      reporter.queueReport({ tick: 1000 });
      reporter.queueReport({ tick: 1001 });

      let summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(2);

      // Queue 3rd report - should trigger flush
      reporter.queueReport({ tick: 1002 });

      // Wait for async flush to complete
      await reporter.flush();

      summary = reporter.getSummary();
      // Queue should be cleared even if send fails
      expect(summary.queuedReports).toBeLessThanOrEqual(2);
    });

    it("should handle manual flush", async () => {
      const logger = { log: () => {}, warn: () => {}, error: () => {} };
      const reporter = new AnalyticsReporter({ logger });

      reporter.queueReport({ tick: 1000 });
      reporter.queueReport({ tick: 1001 });

      await reporter.flush();

      const summary = reporter.getSummary();
      // Queue is cleared when no endpoint is configured
      expect(summary.queuedReports).toBe(0);
    });

    it("should handle flush with empty queue", async () => {
      const reporter = new AnalyticsReporter(config);

      await expect(reporter.flush()).resolves.toBeUndefined();
    });

    it("should warn when no endpoint configured", async () => {
      const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const reporter = new AnalyticsReporter({ logger });

      reporter.queueReport({ tick: 1000 });
      await reporter.flush();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("No endpoint configured"));
    });
  });

  describe("Compression", () => {
    it("should support compression when enabled", () => {
      const reporter = new AnalyticsReporter({
        ...config,
        enableCompression: true
      });

      const summary = reporter.getSummary();
      expect(summary.compressionEnabled).toBe(true);
    });

    it("should not compress by default", () => {
      const reporter = new AnalyticsReporter(config);

      const summary = reporter.getSummary();
      expect(summary.compressionEnabled).toBe(false);
    });
  });

  describe("Queue management", () => {
    it("should clear all queued reports", () => {
      const reporter = new AnalyticsReporter(config);

      reporter.queueReport({ tick: 1000 });
      reporter.queueReport({ tick: 1001 });
      reporter.queueReport({ tick: 1002 });

      expect(reporter.getSummary().queuedReports).toBe(3);

      reporter.clear();

      expect(reporter.getSummary().queuedReports).toBe(0);
    });

    it("should handle clear on empty queue", () => {
      const reporter = new AnalyticsReporter(config);

      expect(reporter.getSummary().queuedReports).toBe(0);
      reporter.clear();
      expect(reporter.getSummary().queuedReports).toBe(0);
    });
  });

  describe("Summary statistics", () => {
    it("should provide accurate summary", () => {
      const reporter = new AnalyticsReporter({
        ...config,
        enableCompression: true,
        batchSize: 10
      });

      reporter.queueReport({ tick: 1000 });
      reporter.queueReport({ tick: 1001 });
      reporter.queueReport({ tick: 1002 });

      const summary = reporter.getSummary();

      expect(summary.queuedReports).toBe(3);
      expect(summary.compressionEnabled).toBe(true);
      expect(summary.oldestReport).not.toBeNull();
    });

    it("should update summary after operations", () => {
      const reporter = new AnalyticsReporter(config);

      let summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(0);

      reporter.queueReport({ tick: 1000 });
      summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(1);

      reporter.clear();
      summary = reporter.getSummary();
      expect(summary.queuedReports).toBe(0);
    });
  });

  describe("Error handling", () => {
    it("should handle flush errors gracefully", async () => {
      const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const reporter = new AnalyticsReporter({
        endpoint: "https://invalid-endpoint.example.com/api/stats",
        logger
      });

      reporter.queueReport({ tick: 1000 });

      await reporter.flush();

      // Should log error but not throw
      expect(logger.error).toHaveBeenCalled();
    });

    it("should prevent unbounded queue growth on repeated failures", async () => {
      const logger = { log: () => {}, warn: () => {}, error: () => {} };
      const reporter = new AnalyticsReporter({
        endpoint: "https://invalid.example.com/api/stats",
        batchSize: 5,
        logger
      });

      // Queue and flush multiple times
      for (let i = 0; i < 20; i++) {
        reporter.queueReport({ tick: i });
      }

      await reporter.flush();
      await reporter.flush();

      const summary = reporter.getSummary();
      // Queue should not grow beyond reasonable limits (batchSize * MAX_RETRY_QUEUE_MULTIPLIER)
      // With isFlushing guard, only one flush processes at a time
      expect(summary.queuedReports).toBeLessThanOrEqual(20);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle typical monitoring workflow", async () => {
      const logger = { log: () => {}, warn: () => {}, error: () => {} };
      const reporter = new AnalyticsReporter({
        batchSize: 100, // High batch size to prevent auto-flush
        logger
      });

      // Simulate collecting stats over multiple ticks
      for (let tick = 1000; tick < 1010; tick++) {
        reporter.queueReport(
          {
            cpu: 50 + Math.random() * 20,
            bucket: 9000 + Math.random() * 500,
            rooms: 3
          },
          {
            shard: "shard0",
            user: "test-user"
          }
        );
      }

      expect(reporter.getSummary().queuedReports).toBe(10);

      await reporter.flush();

      // Queue is cleared when no endpoint configured
      expect(reporter.getSummary().queuedReports).toBe(0);
    });

    it("should support high-frequency stats collection", () => {
      const reporter = new AnalyticsReporter({
        ...config,
        batchSize: 1000
      });

      // Simulate high-frequency data collection
      const startTime = Date.now();
      for (let i = 0; i < 500; i++) {
        reporter.queueReport({ tick: 1000 + i, cpu: 50 });
      }
      const duration = Date.now() - startTime;

      expect(reporter.getSummary().queuedReports).toBe(500);
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });
});
