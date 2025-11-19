import { describe, it, expect } from "vitest";
import { createProcessContext, NoOpLogger, NoOpMetricsCollector } from "../src/ProcessContext";
import type { GameContext } from "../src/types";

describe("ProcessContext", () => {
  const mockGame: GameContext = {
    time: 100,
    cpu: {
      getUsed: () => 5,
      limit: 100,
      bucket: 1000
    },
    creeps: {},
    spawns: {},
    rooms: {}
  };

  const mockMemory = { test: "data" };

  it("should create a process context with defaults", () => {
    const ctx = createProcessContext(mockGame, mockMemory);

    expect(ctx.game).toBe(mockGame);
    expect(ctx.memory).toBe(mockMemory);
    expect(ctx.logger).toBeInstanceOf(NoOpLogger);
    expect(ctx.metrics).toBeInstanceOf(NoOpMetricsCollector);
  });

  it("should create a process context with custom logger", () => {
    const customLogger = {
      log: () => {},
      warn: () => {},
      error: () => {}
    };

    const ctx = createProcessContext(mockGame, mockMemory, customLogger);

    expect(ctx.logger).toBe(customLogger);
  });

  it("should create a process context with custom metrics", () => {
    const customMetrics = {
      record: () => {},
      begin: () => {},
      end: () => {}
    };

    const ctx = createProcessContext(mockGame, mockMemory, undefined, customMetrics);

    expect(ctx.metrics).toBe(customMetrics);
  });

  it("should support type-safe memory access", () => {
    interface CustomMemory {
      myData: string;
      myNumber: number;
    }

    const typedMemory: CustomMemory = {
      myData: "test",
      myNumber: 42
    };

    const ctx = createProcessContext<CustomMemory>(mockGame, typedMemory);

    // TypeScript should allow these accesses
    expect(ctx.memory.myData).toBe("test");
    expect(ctx.memory.myNumber).toBe(42);
  });
});

describe("NoOpLogger", () => {
  it("should not throw when calling log methods", () => {
    const logger = new NoOpLogger();

    expect(() => logger.log?.("test")).not.toThrow();
    expect(() => logger.warn?.("test")).not.toThrow();
    expect(() => logger.error?.("test")).not.toThrow();
  });
});

describe("NoOpMetricsCollector", () => {
  it("should not throw when calling metric methods", () => {
    const metrics = new NoOpMetricsCollector();

    expect(() => metrics.record("test", 42)).not.toThrow();
    expect(() => metrics.begin("test")).not.toThrow();
    expect(() => metrics.end("test")).not.toThrow();
  });
});
