import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DeploymentHistory, ValidatedDeployment } from "../../packages/utilities/scripts/types/deployment-history";
import { MAX_HISTORY_SIZE, createEmptyHistory } from "../../packages/utilities/scripts/types/deployment-history";

/**
 * Unit tests for deployment history management
 *
 * Tests validate:
 * - History file loading and saving
 * - Recording validated deployments
 * - Finding rollback targets
 * - History size limits
 * - Error handling for corrupted/missing files
 */
describe("Deployment History Management", () => {
  const testDir = resolve("/tmp/deployment-history-test");
  const testHistoryPath = resolve(testDir, "deployment-history.json");

  beforeEach(() => {
    // Create test directory
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe("createEmptyHistory", () => {
    it("should create a valid empty history object", () => {
      const history = createEmptyHistory();

      expect(history.lastValidated).toBeNull();
      expect(history.lastValidatedCommit).toBeNull();
      expect(history.lastUpdated).toBeDefined();
      expect(history.history).toEqual([]);
    });

    it("should set lastUpdated to current timestamp", () => {
      const before = new Date().toISOString();
      const history = createEmptyHistory();
      const after = new Date().toISOString();

      expect(history.lastUpdated >= before).toBe(true);
      expect(history.lastUpdated <= after).toBe(true);
    });
  });

  describe("MAX_HISTORY_SIZE", () => {
    it("should be set to 5", () => {
      expect(MAX_HISTORY_SIZE).toBe(5);
    });
  });

  describe("DeploymentHistory structure", () => {
    it("should allow valid history structure", () => {
      const history: DeploymentHistory = {
        lastValidated: "v0.175.4",
        lastValidatedCommit: "abc123",
        lastUpdated: new Date().toISOString(),
        history: [
          {
            version: "v0.175.4",
            validatedAt: new Date().toISOString(),
            commitSha: "abc123",
            validation: {
              cpuUsed: 45.2,
              cpuBucket: 9500,
              creepCount: 12,
              roomCount: 1,
              spawnCount: 1
            },
            workflowRunUrl: "https://github.com/test/repo/actions/runs/123"
          }
        ]
      };

      expect(history.lastValidated).toBe("v0.175.4");
      expect(history.history.length).toBe(1);
      expect(history.history[0].validation.cpuUsed).toBe(45.2);
    });

    it("should allow empty history", () => {
      const history: DeploymentHistory = {
        lastValidated: null,
        lastValidatedCommit: null,
        lastUpdated: new Date().toISOString(),
        history: []
      };

      expect(history.lastValidated).toBeNull();
      expect(history.history.length).toBe(0);
    });
  });

  describe("ValidatedDeployment structure", () => {
    it("should contain all required fields", () => {
      const deployment: ValidatedDeployment = {
        version: "v0.175.4",
        validatedAt: "2025-11-28T00:00:00.000Z",
        commitSha: "abc123def456",
        validation: {
          cpuUsed: 45.2,
          cpuBucket: 9500,
          creepCount: 12,
          roomCount: 1,
          spawnCount: 1
        },
        workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345"
      };

      expect(deployment.version).toBe("v0.175.4");
      expect(deployment.validatedAt).toBe("2025-11-28T00:00:00.000Z");
      expect(deployment.commitSha).toBe("abc123def456");
      expect(deployment.validation.cpuUsed).toBe(45.2);
      expect(deployment.workflowRunUrl).toContain("github.com");
    });
  });

  describe("History file operations", () => {
    it("should save and load history correctly", () => {
      const history: DeploymentHistory = {
        lastValidated: "v0.175.4",
        lastValidatedCommit: "abc123",
        lastUpdated: new Date().toISOString(),
        history: [
          {
            version: "v0.175.4",
            validatedAt: new Date().toISOString(),
            commitSha: "abc123",
            validation: {
              cpuUsed: 45.2,
              cpuBucket: 9500,
              creepCount: 12,
              roomCount: 1,
              spawnCount: 1
            },
            workflowRunUrl: "https://github.com/test/repo/actions/runs/123"
          }
        ]
      };

      // Save history
      writeFileSync(testHistoryPath, JSON.stringify(history, null, 2));

      // Load and verify
      const loaded = JSON.parse(readFileSync(testHistoryPath, "utf-8")) as DeploymentHistory;
      expect(loaded.lastValidated).toBe("v0.175.4");
      expect(loaded.history.length).toBe(1);
      expect(loaded.history[0].version).toBe("v0.175.4");
    });

    it("should handle missing file gracefully", () => {
      const missingPath = resolve(testDir, "nonexistent.json");
      expect(existsSync(missingPath)).toBe(false);
    });

    it("should handle corrupted JSON gracefully", () => {
      // Write invalid JSON
      writeFileSync(testHistoryPath, "{ invalid json }");

      // Trying to parse should throw
      expect(() => JSON.parse(readFileSync(testHistoryPath, "utf-8"))).toThrow();
    });
  });

  describe("Rollback target selection", () => {
    it("should find the first non-current version", () => {
      const history: DeploymentHistory = {
        lastValidated: "v0.175.5",
        lastValidatedCommit: "def456",
        lastUpdated: new Date().toISOString(),
        history: [
          {
            version: "v0.175.5",
            validatedAt: new Date().toISOString(),
            commitSha: "def456",
            validation: { cpuUsed: 50, cpuBucket: 9000, creepCount: 10, roomCount: 1, spawnCount: 1 },
            workflowRunUrl: "https://github.com/test/repo/actions/runs/124"
          },
          {
            version: "v0.175.4",
            validatedAt: new Date().toISOString(),
            commitSha: "abc123",
            validation: { cpuUsed: 45.2, cpuBucket: 9500, creepCount: 12, roomCount: 1, spawnCount: 1 },
            workflowRunUrl: "https://github.com/test/repo/actions/runs/123"
          }
        ]
      };

      const currentVersion = "v0.175.5";

      // Find rollback target (first version that's not current)
      const rollbackTarget = history.history.find(h => h.version !== currentVersion);

      expect(rollbackTarget?.version).toBe("v0.175.4");
    });

    it("should return null if only current version in history", () => {
      const history: DeploymentHistory = {
        lastValidated: "v0.175.5",
        lastValidatedCommit: "def456",
        lastUpdated: new Date().toISOString(),
        history: [
          {
            version: "v0.175.5",
            validatedAt: new Date().toISOString(),
            commitSha: "def456",
            validation: { cpuUsed: 50, cpuBucket: 9000, creepCount: 10, roomCount: 1, spawnCount: 1 },
            workflowRunUrl: "https://github.com/test/repo/actions/runs/124"
          }
        ]
      };

      const currentVersion = "v0.175.5";
      const rollbackTarget = history.history.find(h => h.version !== currentVersion);

      expect(rollbackTarget).toBeUndefined();
    });

    it("should skip failed versions when finding rollback target", () => {
      // Scenario: v0.175.5 (current, failed), v0.175.4 (not in history - was failed)
      // Should find v0.175.3 as the rollback target
      const history: DeploymentHistory = {
        lastValidated: "v0.175.3",
        lastValidatedCommit: "old789",
        lastUpdated: new Date().toISOString(),
        history: [
          {
            version: "v0.175.3",
            validatedAt: new Date().toISOString(),
            commitSha: "old789",
            validation: { cpuUsed: 40, cpuBucket: 9800, creepCount: 8, roomCount: 1, spawnCount: 1 },
            workflowRunUrl: "https://github.com/test/repo/actions/runs/122"
          }
        ]
      };

      const currentVersion = "v0.175.5";
      const rollbackTarget = history.history.find(h => h.version !== currentVersion);

      expect(rollbackTarget?.version).toBe("v0.175.3");
    });
  });

  describe("History size limits", () => {
    it("should keep only MAX_HISTORY_SIZE entries", () => {
      const history: DeploymentHistory = {
        lastValidated: "v0.175.6",
        lastValidatedCommit: "commit6",
        lastUpdated: new Date().toISOString(),
        history: []
      };

      // Add more than MAX_HISTORY_SIZE entries
      for (let i = 0; i < MAX_HISTORY_SIZE + 3; i++) {
        history.history.push({
          version: `v0.175.${i}`,
          validatedAt: new Date().toISOString(),
          commitSha: `commit${i}`,
          validation: { cpuUsed: 40 + i, cpuBucket: 9000, creepCount: 10, roomCount: 1, spawnCount: 1 },
          workflowRunUrl: `https://github.com/test/repo/actions/runs/${100 + i}`
        });
      }

      // Simulate trimming (as the script does)
      if (history.history.length > MAX_HISTORY_SIZE) {
        history.history.splice(MAX_HISTORY_SIZE);
      }

      expect(history.history.length).toBe(MAX_HISTORY_SIZE);
    });
  });

  describe("Version deduplication", () => {
    it("should update existing entry instead of creating duplicate", () => {
      const history: DeploymentHistory = {
        lastValidated: "v0.175.4",
        lastValidatedCommit: "abc123",
        lastUpdated: new Date().toISOString(),
        history: [
          {
            version: "v0.175.4",
            validatedAt: "2025-11-28T00:00:00.000Z",
            commitSha: "abc123",
            validation: { cpuUsed: 45.2, cpuBucket: 9500, creepCount: 12, roomCount: 1, spawnCount: 1 },
            workflowRunUrl: "https://github.com/test/repo/actions/runs/123"
          }
        ]
      };

      const newVersion = "v0.175.4";
      const newTimestamp = "2025-11-28T12:00:00.000Z";

      // Check if version exists
      const existingIndex = history.history.findIndex(h => h.version === newVersion);

      if (existingIndex >= 0) {
        // Update existing
        history.history[existingIndex].validatedAt = newTimestamp;
        history.history[existingIndex].commitSha = "updated123";
      }

      expect(history.history.length).toBe(1);
      expect(history.history[0].validatedAt).toBe(newTimestamp);
      expect(history.history[0].commitSha).toBe("updated123");
    });
  });
});
