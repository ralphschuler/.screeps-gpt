import { describe, it, expect, vi } from "vitest";
import { PixelGenerator } from "../../src/runtime/metrics/PixelGenerator";

describe("PixelGenerator", () => {
  describe("Pixel Generation", () => {
    it("should generate pixel when bucket is full", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const generator = new PixelGenerator({}, mockLogger);
      const mockGeneratePixel = vi.fn().mockReturnValue(0); // OK = 0

      const result = generator.tryGeneratePixel(10000, mockGeneratePixel);

      expect(result).toBe(true);
      expect(mockGeneratePixel).toHaveBeenCalledOnce();
      expect(mockLogger.log).toHaveBeenCalledWith("Generated pixel (bucket: 10000)");
    });

    it("should not generate pixel when bucket is below threshold", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const generator = new PixelGenerator({}, mockLogger);
      const mockGeneratePixel = vi.fn().mockReturnValue(0);

      const result = generator.tryGeneratePixel(9999, mockGeneratePixel);

      expect(result).toBe(false);
      expect(mockGeneratePixel).not.toHaveBeenCalled();
      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it("should handle generation failure", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const generator = new PixelGenerator({}, mockLogger);
      const mockGeneratePixel = vi.fn().mockReturnValue(-1); // Error code

      const result = generator.tryGeneratePixel(10000, mockGeneratePixel);

      expect(result).toBe(false);
      expect(mockGeneratePixel).toHaveBeenCalledOnce();
      expect(mockLogger.warn).toHaveBeenCalledWith("Failed to generate pixel: -1");
    });

    it("should use custom bucket threshold", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const generator = new PixelGenerator({ minBucketLevel: 8000 }, mockLogger);
      const mockGeneratePixel = vi.fn().mockReturnValue(0);

      const result = generator.tryGeneratePixel(8000, mockGeneratePixel);

      expect(result).toBe(true);
      expect(mockGeneratePixel).toHaveBeenCalledOnce();
    });

    it("should not generate pixel below custom threshold", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const generator = new PixelGenerator({ minBucketLevel: 8000 }, mockLogger);
      const mockGeneratePixel = vi.fn().mockReturnValue(0);

      const result = generator.tryGeneratePixel(7999, mockGeneratePixel);

      expect(result).toBe(false);
      expect(mockGeneratePixel).not.toHaveBeenCalled();
    });
  });

  describe("Deterministic Output", () => {
    it("should return consistent results for same inputs", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const generator = new PixelGenerator({}, mockLogger);
      const mockGeneratePixel = vi.fn().mockReturnValue(0);

      const result1 = generator.tryGeneratePixel(10000, mockGeneratePixel);
      const result2 = generator.tryGeneratePixel(10000, mockGeneratePixel);

      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    });
  });
});
