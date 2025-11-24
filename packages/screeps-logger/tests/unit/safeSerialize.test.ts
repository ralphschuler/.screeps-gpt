import { describe, it, expect } from "vitest";
import { safeSerialize } from "../../src/safeSerialize";

describe("safeSerialize", () => {
  describe("Primitives", () => {
    it("should handle null", () => {
      expect(safeSerialize(null)).toBe("null");
    });

    it("should handle undefined", () => {
      expect(safeSerialize(undefined)).toBe("undefined");
    });

    it("should handle strings", () => {
      expect(safeSerialize("test")).toBe("test");
    });

    it("should handle numbers", () => {
      expect(safeSerialize(42)).toBe("42");
    });

    it("should handle booleans", () => {
      expect(safeSerialize(true)).toBe("true");
      expect(safeSerialize(false)).toBe("false");
    });
  });

  describe("Error objects", () => {
    it("should serialize Error objects", () => {
      const error = new Error("Test error");
      const result = safeSerialize(error);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe("Error");
      expect(parsed.message).toBe("Test error");
      expect(parsed.stack).toBeDefined();
    });

    it("should serialize Zod-like errors with issues", () => {
      const zodError = Object.assign(new Error("Validation failed"), {
        issues: [{ code: "invalid_type", message: "Invalid" }]
      });

      const result = safeSerialize(zodError);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.issues).toBeDefined();
      expect(Array.isArray(parsed.issues)).toBe(true);
    });
  });

  describe("Circular references", () => {
    it("should handle circular references", () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;

      const result = safeSerialize(obj);
      expect(result).toContain("[Circular]");
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe("Complex objects", () => {
    it("should serialize nested objects", () => {
      const obj = { level1: { level2: { value: "deep" } } };
      const result = safeSerialize(obj);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.level1.level2.value).toBe("deep");
    });
  });
});
