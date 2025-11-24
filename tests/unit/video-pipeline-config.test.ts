import { describe, it, expect } from "vitest";
import { parseTimeWindow } from "../../packages/utilities/scripts/lib/video-config";
import { DEFAULT_VIDEO_CONFIG } from "../../packages/utilities/scripts/types/video-pipeline";

describe("Video Pipeline Configuration", () => {
  describe("parseTimeWindow", () => {
    it("should parse numeric tick values", () => {
      const result = parseTimeWindow(1000);
      expect(result).toBe(1000);
    });

    it("should parse hour-based time windows", () => {
      const result = parseTimeWindow("24h");
      // 24 hours * 60 minutes * 60 seconds * 1000 ms / 3000 ms per tick
      const expected = Math.floor((24 * 60 * 60 * 1000) / 3000);
      expect(result).toBe(expected);
    });

    it("should parse day-based time windows", () => {
      const result = parseTimeWindow("7d");
      // 7 days * 24 hours * 60 minutes * 60 seconds * 1000 ms / 3000 ms per tick
      const expected = Math.floor((7 * 24 * 60 * 60 * 1000) / 3000);
      expect(result).toBe(expected);
    });

    it("should parse week-based time windows", () => {
      const result = parseTimeWindow("2w");
      // 2 weeks * 7 days * 24 hours * 60 minutes * 60 seconds * 1000 ms / 3000 ms per tick
      const expected = Math.floor((2 * 7 * 24 * 60 * 60 * 1000) / 3000);
      expect(result).toBe(expected);
    });

    it("should handle 'now' keyword", () => {
      const result = parseTimeWindow("now");
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(Date.now() + 1000);
    });

    it("should throw error for invalid format", () => {
      expect(() => parseTimeWindow("invalid")).toThrow("Invalid time window format");
    });

    it("should throw error for unknown time unit", () => {
      expect(() => parseTimeWindow("10x")).toThrow("Invalid time window format");
    });
  });

  describe("DEFAULT_VIDEO_CONFIG", () => {
    it("should have valid default configuration", () => {
      expect(DEFAULT_VIDEO_CONFIG).toBeDefined();
      expect(DEFAULT_VIDEO_CONFIG.rooms).toEqual([]);
      expect(DEFAULT_VIDEO_CONFIG.shard).toBe("shard3");
    });

    it("should have valid rendering settings", () => {
      expect(DEFAULT_VIDEO_CONFIG.rendering.width).toBe(1920);
      expect(DEFAULT_VIDEO_CONFIG.rendering.height).toBe(1080);
      expect(DEFAULT_VIDEO_CONFIG.rendering.fps).toBe(30);
      expect(DEFAULT_VIDEO_CONFIG.rendering.codec).toBe("libx264");
      expect(DEFAULT_VIDEO_CONFIG.rendering.ticksPerFrame).toBe(10);
    });

    it("should have valid overlay settings", () => {
      expect(DEFAULT_VIDEO_CONFIG.overlays.showTimestamp).toBe(true);
      expect(DEFAULT_VIDEO_CONFIG.overlays.showTick).toBe(true);
      expect(DEFAULT_VIDEO_CONFIG.overlays.showVersion).toBe(true);
      expect(DEFAULT_VIDEO_CONFIG.overlays.showRoomName).toBe(true);
    });

    it("should have valid storage settings", () => {
      expect(DEFAULT_VIDEO_CONFIG.storage.replayRetentionDays).toBe(30);
      expect(DEFAULT_VIDEO_CONFIG.storage.keepVideos).toBe(true);
    });

    it("should have valid YouTube settings", () => {
      expect(DEFAULT_VIDEO_CONFIG.youtube).toBeDefined();
      expect(DEFAULT_VIDEO_CONFIG.youtube?.enabled).toBe(false);
      expect(DEFAULT_VIDEO_CONFIG.youtube?.visibility).toBe("unlisted");
      expect(DEFAULT_VIDEO_CONFIG.youtube?.tags).toContain("screeps");
    });

    it("should have template placeholders in title", () => {
      const template = DEFAULT_VIDEO_CONFIG.youtube?.titleTemplate || "";
      expect(template).toContain("{room}");
      expect(template).toContain("{startTick}");
      expect(template).toContain("{endTick}");
    });

    it("should have template placeholders in description", () => {
      const template = DEFAULT_VIDEO_CONFIG.youtube?.descriptionTemplate || "";
      expect(template).toContain("{room}");
      expect(template).toContain("{shard}");
      expect(template).toContain("{version}");
    });
  });
});
