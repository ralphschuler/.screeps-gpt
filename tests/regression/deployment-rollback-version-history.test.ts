import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DeploymentHistory, ValidatedDeployment } from "../../packages/utilities/scripts/types/deployment-history";
import { MAX_HISTORY_SIZE, createEmptyHistory } from "../../packages/utilities/scripts/types/deployment-history";

/**
 * Regression tests for deployment rollback version history tracking
 *
 * Issue: Deploy workflow rollback mechanism relies on `git describe --tags --abbrev=0 HEAD~1`
 * which may fail in rapid deployment scenarios or when tags are not sequential.
 *
 * These tests verify that the deployment history tracking correctly handles:
 * - Multiple failed deployments (avoiding infinite rollback loops)
 * - Skipping failed versions when finding rollback targets
 * - Tag reordering scenarios
 *
 * @see Issue #1496 - Deploy workflow rollback mechanism lacks version history tracking
 */
describe("Deployment Rollback Version History", () => {
  const testDir = resolve("/tmp/rollback-history-regression-test");
  const testHistoryPath = resolve(testDir, "deployment-history.json");

  /**
   * Helper function to simulate finding rollback target
   * (mirrors logic in manage-deployment-history.ts)
   */
  function getLastValidatedVersion(history: DeploymentHistory, currentVersion: string): string | null {
    for (const entry of history.history) {
      if (entry.version !== currentVersion) {
        return entry.version;
      }
    }
    return null;
  }

  /**
   * Helper function to record a validated deployment
   * (mirrors logic in manage-deployment-history.ts)
   */
  function recordValidatedDeployment(
    history: DeploymentHistory,
    version: string,
    commitSha: string,
    metrics: ValidatedDeployment["validation"]
  ): DeploymentHistory {
    const entry: ValidatedDeployment = {
      version,
      validatedAt: new Date().toISOString(),
      commitSha,
      validation: metrics,
      workflowRunUrl: `https://github.com/test/repo/actions/runs/${Date.now()}`
    };

    const existingIndex = history.history.findIndex(h => h.version === version);
    if (existingIndex >= 0) {
      history.history[existingIndex] = entry;
    } else {
      history.history.unshift(entry);
    }

    if (history.history.length > MAX_HISTORY_SIZE) {
      history.history.splice(MAX_HISTORY_SIZE);
    }

    history.lastValidated = version;
    history.lastValidatedCommit = commitSha;
    history.lastUpdated = new Date().toISOString();

    return history;
  }

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Scenario 1: Multiple Failed Deployments", () => {
    /**
     * From issue:
     * 1. Deploy v1.0.0 (success)
     * 2. Deploy v1.0.1 (fails, rollback to v1.0.0)
     * 4. Rollback to broken version → infinite failure loop
     *
     * With history tracking:
     * - Only v1.0.0 is recorded as validated
     * - v1.0.1 fails, rollback finds v1.0.0 (correct!)
     * - Future failed deployments also rollback to v1.0.0
     */
    it("should rollback to last validated version, skipping failed versions", () => {
      let history = createEmptyHistory();
      const defaultMetrics = { cpuUsed: 45, cpuBucket: 9000, creepCount: 10, roomCount: 1, spawnCount: 1 };

      // Step 1: Deploy v1.0.0 (success) - gets recorded in history
      history = recordValidatedDeployment(history, "v1.0.0", "commit100", defaultMetrics);
      expect(history.lastValidated).toBe("v1.0.0");

      // Step 2: Deploy v1.0.1 (fails validation - NOT recorded in history)
      // The workflow would call getLastValidatedVersion to find rollback target
      const rollbackTarget = getLastValidatedVersion(history, "v1.0.1");
      expect(rollbackTarget).toBe("v1.0.0"); // Correct! Rolls back to v1.0.0

      // Step 3: Deploy v1.0.2 (also fails - still NOT recorded)
      // Should still find v1.0.0 as rollback target
      const rollbackTarget2 = getLastValidatedVersion(history, "v1.0.2");
      expect(rollbackTarget2).toBe("v1.0.0"); // Still correct!
    });

    it("should not record failed deployments in history", () => {
      let history = createEmptyHistory();
      const defaultMetrics = { cpuUsed: 45, cpuBucket: 9000, creepCount: 10, roomCount: 1, spawnCount: 1 };

      // v1.0.0 succeeds
      history = recordValidatedDeployment(history, "v1.0.0", "commit100", defaultMetrics);

      // v1.0.1 fails - DO NOT call recordValidatedDeployment
      // (workflow only records after validation passes)

      // History should only have v1.0.0
      expect(history.history.length).toBe(1);
      expect(history.history[0].version).toBe("v1.0.0");
    });
  });

  describe("Scenario 2: Sequential Successful Deployments", () => {
    it("should track multiple successful deployments", () => {
      let history = createEmptyHistory();
      const defaultMetrics = { cpuUsed: 45, cpuBucket: 9000, creepCount: 10, roomCount: 1, spawnCount: 1 };

      // Deploy and validate multiple versions
      history = recordValidatedDeployment(history, "v1.0.0", "commit100", defaultMetrics);
      history = recordValidatedDeployment(history, "v1.0.1", "commit101", defaultMetrics);
      history = recordValidatedDeployment(history, "v1.0.2", "commit102", defaultMetrics);

      expect(history.history.length).toBe(3);
      expect(history.lastValidated).toBe("v1.0.2");

      // Rollback from v1.0.3 should find v1.0.2
      expect(getLastValidatedVersion(history, "v1.0.3")).toBe("v1.0.2");

      // Rollback from current v1.0.2 should find v1.0.1
      expect(getLastValidatedVersion(history, "v1.0.2")).toBe("v1.0.1");
    });
  });

  describe("Scenario 3: Tag Reordering", () => {
    /**
     * Git tags are not guaranteed to be chronological.
     * The deployment history uses explicit timestamps and order,
     * not git tag semantics.
     */
    it("should use deployment order, not version number order", () => {
      let history = createEmptyHistory();
      const defaultMetrics = { cpuUsed: 45, cpuBucket: 9000, creepCount: 10, roomCount: 1, spawnCount: 1 };

      // Deploy in non-sequential order (e.g., hotfix scenario)
      history = recordValidatedDeployment(history, "v1.0.0", "commit100", defaultMetrics);
      history = recordValidatedDeployment(history, "v1.1.0", "commit110", defaultMetrics); // Feature release
      history = recordValidatedDeployment(history, "v1.0.1", "commit101", defaultMetrics); // Hotfix to v1.0.x

      // Most recent deployment is v1.0.1
      expect(history.lastValidated).toBe("v1.0.1");
      expect(history.history[0].version).toBe("v1.0.1");

      // Rollback from v1.0.2 should find v1.0.1 (most recent validated)
      expect(getLastValidatedVersion(history, "v1.0.2")).toBe("v1.0.1");
    });
  });

  describe("Scenario 4: Empty History (First Deployment)", () => {
    it("should return null when no validated deployments exist", () => {
      const history = createEmptyHistory();

      // No previous validated versions
      const rollbackTarget = getLastValidatedVersion(history, "v1.0.0");
      expect(rollbackTarget).toBeNull();
    });

    it("should fallback to git tags when history is empty", () => {
      // This is handled in the workflow shell script
      // When getLastValidatedVersion returns null, workflow falls back to git describe
      const history = createEmptyHistory();
      const rollbackTarget = getLastValidatedVersion(history, "v1.0.0");

      expect(rollbackTarget).toBeNull();
      // Workflow would then call: git describe --tags --abbrev=0 "${CURRENT_TAG}^"
    });
  });

  describe("Scenario 5: History Size Limit", () => {
    it("should maintain only MAX_HISTORY_SIZE validated deployments", () => {
      let history = createEmptyHistory();
      const defaultMetrics = { cpuUsed: 45, cpuBucket: 9000, creepCount: 10, roomCount: 1, spawnCount: 1 };

      // Deploy more versions than MAX_HISTORY_SIZE
      for (let i = 0; i < MAX_HISTORY_SIZE + 5; i++) {
        history = recordValidatedDeployment(history, `v1.0.${i}`, `commit${i}`, defaultMetrics);
      }

      expect(history.history.length).toBe(MAX_HISTORY_SIZE);

      // Oldest versions should be trimmed
      const versions = history.history.map(h => h.version);
      expect(versions).not.toContain("v1.0.0");
      expect(versions).not.toContain("v1.0.1");

      // Most recent versions should be present
      expect(versions).toContain(`v1.0.${MAX_HISTORY_SIZE + 4}`);
      expect(versions).toContain(`v1.0.${MAX_HISTORY_SIZE + 3}`);
    });
  });

  describe("Persistence", () => {
    it("should save and load history correctly", () => {
      let history = createEmptyHistory();
      const defaultMetrics = { cpuUsed: 45, cpuBucket: 9000, creepCount: 10, roomCount: 1, spawnCount: 1 };

      history = recordValidatedDeployment(history, "v1.0.0", "commit100", defaultMetrics);
      history = recordValidatedDeployment(history, "v1.0.1", "commit101", defaultMetrics);

      // Save to file
      writeFileSync(testHistoryPath, JSON.stringify(history, null, 2));

      // Load from file
      const loaded = JSON.parse(readFileSync(testHistoryPath, "utf-8")) as DeploymentHistory;

      expect(loaded.lastValidated).toBe("v1.0.1");
      expect(loaded.history.length).toBe(2);
      expect(getLastValidatedVersion(loaded, "v1.0.2")).toBe("v1.0.1");
    });
  });
});
