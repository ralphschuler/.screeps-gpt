import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  generateTimestampedFilename,
  saveReport,
  listReports,
  loadLatestReport,
  loadReport,
  applyRetentionPolicy,
  getReportsInRange
} from "../../packages/utilities/scripts/lib/report-storage";

const TEST_REPORTS_DIR = resolve("test-reports-temp");

describe("report-storage", () => {
  beforeEach(() => {
    // Create a temporary test reports directory
    if (existsSync(TEST_REPORTS_DIR)) {
      rmSync(TEST_REPORTS_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_REPORTS_DIR, { recursive: true });
    // Temporarily override reports directory
    process.chdir(TEST_REPORTS_DIR);
  });

  afterEach(() => {
    // Clean up test directory
    process.chdir(resolve(TEST_REPORTS_DIR, ".."));
    if (existsSync(TEST_REPORTS_DIR)) {
      rmSync(TEST_REPORTS_DIR, { recursive: true, force: true });
    }
  });

  describe("generateTimestampedFilename", () => {
    it("should generate filename with timestamp", () => {
      const filename = generateTimestampedFilename("test-report");
      expect(filename).toMatch(/^test-report-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);
    });

    it("should support custom extension", () => {
      const filename = generateTimestampedFilename("test-report", "txt");
      expect(filename).toMatch(/^test-report-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.txt$/);
    });
  });

  describe("saveReport", () => {
    it("should save a report with timestamp", async () => {
      const data = { test: "data", value: 123 };
      const filePath = await saveReport("test-type", data);

      expect(existsSync(filePath)).toBe(true);
      expect(filePath).toContain("test-type");
    });

    it("should create directory if it doesn't exist", async () => {
      const data = { test: "data" };
      await saveReport("new-type", data);

      expect(existsSync(resolve("reports", "new-type"))).toBe(true);
    });

    it("should save with custom filename", async () => {
      const data = { test: "data" };
      const filePath = await saveReport("test-type", data, "custom-name.json");

      expect(filePath).toContain("custom-name.json");
    });
  });

  describe("listReports", () => {
    it("should return empty array for non-existent directory", async () => {
      const reports = await listReports("non-existent");
      expect(reports).toEqual([]);
    });

    it("should list reports sorted by timestamp descending", async () => {
      // Create multiple reports with delays
      await saveReport("test-type", { value: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));
      await saveReport("test-type", { value: 2 });
      await new Promise(resolve => setTimeout(resolve, 10));
      await saveReport("test-type", { value: 3 });

      const reports = await listReports("test-type");

      expect(reports).toHaveLength(3);
      // Newest should be first
      expect(reports[0].timestamp > reports[1].timestamp).toBe(true);
      expect(reports[1].timestamp > reports[2].timestamp).toBe(true);
    });
  });

  describe("loadLatestReport", () => {
    it("should return null for non-existent reports", async () => {
      const report = await loadLatestReport("non-existent");
      expect(report).toBeNull();
    });

    it("should load the most recent report", async () => {
      await saveReport("test-type", { value: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));
      await saveReport("test-type", { value: 2 });

      const report = await loadLatestReport<{ value: number }>("test-type");

      expect(report).not.toBeNull();
      expect(report?.value).toBe(2);
    });
  });

  describe("loadReport", () => {
    it("should return null for non-existent report", async () => {
      const report = await loadReport("test-type", "non-existent.json");
      expect(report).toBeNull();
    });

    it("should load a specific report by filename", async () => {
      const data = { test: "specific" };
      await saveReport("test-type", data, "specific.json");

      const loaded = await loadReport<typeof data>("test-type", "specific.json");

      expect(loaded).toEqual(data);
    });
  });

  describe("applyRetentionPolicy", () => {
    it("should not delete reports when count is below minimum", async () => {
      await saveReport("test-type", { value: 1 });
      await saveReport("test-type", { value: 2 });

      const deletedCount = await applyRetentionPolicy("test-type", {
        maxAgeDays: 0,
        minReportsToKeep: 5
      });

      expect(deletedCount).toBe(0);
    });

    it("should delete old reports beyond minimum", async () => {
      // Create 5 reports
      for (let i = 0; i < 5; i++) {
        await saveReport("test-type", { value: i });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const deletedCount = await applyRetentionPolicy("test-type", {
        maxAgeDays: 0, // All reports are "old"
        minReportsToKeep: 2
      });

      expect(deletedCount).toBe(3);

      const remaining = await listReports("test-type");
      expect(remaining).toHaveLength(2);
    });
  });

  describe("getReportsInRange", () => {
    it("should return reports within date range", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await saveReport("test-type", { value: 1 });

      const reports = await getReportsInRange("test-type", yesterday, tomorrow);

      expect(reports.length).toBeGreaterThan(0);
    });

    it("should exclude reports outside date range", async () => {
      await saveReport("test-type", { value: 1 });

      const past = new Date("2020-01-01");
      const pastEnd = new Date("2020-12-31");

      const reports = await getReportsInRange("test-type", past, pastEnd);

      expect(reports).toHaveLength(0);
    });
  });
});
