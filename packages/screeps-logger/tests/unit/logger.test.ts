import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger } from "../../src/Logger";

describe("Logger", () => {
  let mockConsole: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockConsole = { log: vi.fn() };
  });

  describe("Log Levels", () => {
    it("should log info messages by default", () => {
      const logger = new Logger({}, mockConsole);
      logger.info("Test message");

      expect(mockConsole.log).toHaveBeenCalledOnce();
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining("[INFO] Test message"));
    });

    it("should log warn messages", () => {
      const logger = new Logger({}, mockConsole);
      logger.warn("Warning message");

      expect(mockConsole.log).toHaveBeenCalledOnce();
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining("[WARN] Warning message"));
    });

    it("should log error messages", () => {
      const logger = new Logger({}, mockConsole);
      logger.error("Error message");

      expect(mockConsole.log).toHaveBeenCalledOnce();
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining("[ERROR] Error message"));
    });

    it("should filter debug messages when minLevel is info", () => {
      const logger = new Logger({ minLevel: "info" }, mockConsole);
      logger.debug("Debug message");

      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it("should log debug messages when minLevel is debug", () => {
      const logger = new Logger({ minLevel: "debug" }, mockConsole);
      logger.debug("Debug message");

      expect(mockConsole.log).toHaveBeenCalledOnce();
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining("[DEBUG] Debug message"));
    });

    it("should filter info and warn when minLevel is error", () => {
      const logger = new Logger({ minLevel: "error" }, mockConsole);
      logger.info("Info message");
      logger.warn("Warn message");

      expect(mockConsole.log).not.toHaveBeenCalled();
    });
  });

  describe("Timestamps", () => {
    it("should include timestamps by default", () => {
      const logger = new Logger({}, mockConsole);
      logger.info("Test");

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringMatching(/^\[\d+\]/));
    });

    it("should exclude timestamps when configured", () => {
      const logger = new Logger({ includeTimestamp: false }, mockConsole);
      logger.info("Test");

      expect(mockConsole.log).toHaveBeenCalledWith(expect.not.stringMatching(/^\[\d+\]/));
    });
  });

  describe("Log Level Prefix", () => {
    it("should include level prefix by default", () => {
      const logger = new Logger({}, mockConsole);
      logger.info("Test");

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining("[INFO]"));
    });

    it("should exclude level prefix when configured", () => {
      const logger = new Logger({ includeLevel: false }, mockConsole);
      logger.info("Test");

      expect(mockConsole.log).toHaveBeenCalledWith(expect.not.stringContaining("[INFO]"));
    });
  });

  describe("Context", () => {
    it("should include context in log output", () => {
      const logger = new Logger({}, mockConsole);
      logger.info("Test", { key: "value" });

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('{"key":"value"}'));
    });

    it("should handle empty context", () => {
      const logger = new Logger({}, mockConsole);
      logger.info("Test", {});

      expect(mockConsole.log).toHaveBeenCalledWith(expect.not.stringContaining("{}"));
    });

    it("should handle missing context", () => {
      const logger = new Logger({}, mockConsole);
      logger.info("Test");

      expect(mockConsole.log).toHaveBeenCalledWith(expect.not.stringContaining("{"));
    });
  });

  describe("Child Logger", () => {
    it("should create child logger with context", () => {
      const parent = new Logger({}, mockConsole);
      const child = parent.child({ component: "test" });

      child.info("Message");

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('{"component":"test"}'));
    });

    it("should merge parent and child context", () => {
      const parent = new Logger({}, mockConsole);
      const child = parent.child({ component: "test" });

      child.info("Message", { action: "start" });

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('"component":"test"'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('"action":"start"'));
    });
  });

  describe("Deterministic Output", () => {
    it("should format consistently for same inputs", () => {
      const logger = new Logger({}, mockConsole);

      logger.info("Test message", { key: "value" });
      const firstCall = mockConsole.log.mock.calls[0]?.[0] as string;

      mockConsole.log.mockClear();
      logger.info("Test message", { key: "value" });
      const secondCall = mockConsole.log.mock.calls[0]?.[0] as string;

      // Timestamps may differ, but structure should be consistent
      expect(typeof firstCall).toBe("string");
      expect(typeof secondCall).toBe("string");
      expect(firstCall).toContain("[INFO] Test message");
      expect(secondCall).toContain("[INFO] Test message");
    });
  });
});
