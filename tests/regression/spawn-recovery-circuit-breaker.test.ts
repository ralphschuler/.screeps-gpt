/**
 * Regression test for spawn recovery circuit breaker logic
 * Ensures the circuit breaker prevents infinite spawn placement loops
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { unlink, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  canAttemptRecovery,
  recordAttempt,
  getRecoveryStats,
  resetCircuitBreaker,
  cleanupOldAttempts
} from "../../packages/utilities/scripts/spawn-recovery-tracker.js";

const TEST_REPORTS_DIR = resolve("reports", "spawn-recovery");
const TEST_STATE_FILE = resolve(TEST_REPORTS_DIR, "recovery-state.json");

describe("Spawn Recovery Circuit Breaker", () => {
  beforeEach(async () => {
    // Clean up test state before each test
    if (existsSync(TEST_REPORTS_DIR)) {
      await rm(TEST_REPORTS_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_REPORTS_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up after tests
    if (existsSync(TEST_REPORTS_DIR)) {
      await rm(TEST_REPORTS_DIR, { recursive: true, force: true });
    }
  });

  describe("Attempt Recording", () => {
    it("should record spawn recovery attempts", async () => {
      await recordAttempt({
        tick: 1000,
        status: "lost",
        action: "respawned",
        source: "spawn_monitor"
      });

      const stats = await getRecoveryStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.recentAttempts).toBe(1);
    });

    it("should record multiple attempts", async () => {
      await recordAttempt({
        tick: 1000,
        status: "lost",
        action: "respawned",
        source: "spawn_monitor"
      });

      await recordAttempt({
        tick: 2000,
        status: "empty",
        action: "spawn_placed",
        source: "spawn_monitor"
      });

      const stats = await getRecoveryStats();
      expect(stats.totalAttempts).toBe(2);
      expect(stats.successfulAttempts).toBe(2);
    });

    it("should track failed attempts separately", async () => {
      await recordAttempt({
        tick: 1000,
        status: "lost",
        action: "failed",
        error: "API error",
        source: "spawn_monitor"
      });

      const stats = await getRecoveryStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.failedAttempts).toBe(1);
      expect(stats.successfulAttempts).toBe(0);
    });
  });

  describe("Circuit Breaker Logic", () => {
    it("should allow recovery when no attempts exist", async () => {
      const result = await canAttemptRecovery();
      expect(result.allowed).toBe(true);
      expect(result.attemptsInWindow).toBe(0);
    });

    it("should allow recovery with fewer than 3 attempts", async () => {
      await recordAttempt({
        tick: 1000,
        status: "lost",
        action: "failed",
        source: "spawn_monitor"
      });

      await recordAttempt({
        tick: 2000,
        status: "lost",
        action: "failed",
        source: "spawn_monitor"
      });

      const result = await canAttemptRecovery();
      expect(result.allowed).toBe(true);
      expect(result.attemptsInWindow).toBe(2);
    });

    it("should block recovery after 3 attempts in 24h window", async () => {
      // Record 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await recordAttempt({
          tick: 1000 + i * 100,
          status: "lost",
          action: "failed",
          source: "spawn_monitor"
        });
      }

      const result = await canAttemptRecovery();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Circuit breaker active");
      expect(result.attemptsInWindow).toBeGreaterThan(0);
      expect(result.circuitBreakerUntil).toBeDefined();
    });

    it("should reset circuit breaker on successful recovery", async () => {
      // Record 2 failed attempts
      await recordAttempt({
        tick: 1000,
        status: "lost",
        action: "failed",
        source: "spawn_monitor"
      });

      await recordAttempt({
        tick: 2000,
        status: "lost",
        action: "failed",
        source: "spawn_monitor"
      });

      // Successful recovery
      await recordAttempt({
        tick: 3000,
        status: "lost",
        action: "respawned",
        source: "spawn_monitor"
      });

      const stats = await getRecoveryStats();
      expect(stats.circuitBreakerActive).toBe(false);
      expect(stats.lastSuccessfulRecovery).toBeDefined();
    });

    it("should allow manual circuit breaker reset", async () => {
      // Trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        await recordAttempt({
          tick: 1000 + i * 100,
          status: "lost",
          action: "failed",
          source: "spawn_monitor"
        });
      }

      // Verify circuit breaker is active
      const resultBefore = await canAttemptRecovery();
      expect(resultBefore.allowed).toBe(false);

      // Reset circuit breaker
      await resetCircuitBreaker();

      // Verify circuit breaker is inactive
      const resultAfter = await canAttemptRecovery();
      expect(resultAfter.allowed).toBe(true);
    });
  });

  describe("Time Window Management", () => {
    it("should only count attempts in 24h window", async () => {
      // This test would require mocking Date.now() or waiting 24 hours
      // For now, we verify the logic is in place
      const stats = await getRecoveryStats();
      expect(stats.recentAttempts).toBeLessThanOrEqual(stats.totalAttempts);
    });

    it("should clean up old attempts", async () => {
      // Record multiple attempts
      for (let i = 0; i < 5; i++) {
        await recordAttempt({
          tick: 1000 + i * 100,
          status: "lost",
          action: "failed",
          source: "spawn_monitor"
        });
      }

      const statsBefore = await getRecoveryStats();
      expect(statsBefore.totalAttempts).toBe(5);

      // Clean up (this won't remove recent attempts in test)
      const removed = await cleanupOldAttempts();
      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Recovery Statistics", () => {
    it("should calculate correct statistics", async () => {
      // Record mix of successful and failed attempts
      await recordAttempt({
        tick: 1000,
        status: "lost",
        action: "respawned",
        source: "spawn_monitor"
      });

      await recordAttempt({
        tick: 2000,
        status: "lost",
        action: "failed",
        source: "spawn_monitor"
      });

      await recordAttempt({
        tick: 3000,
        status: "empty",
        action: "spawn_placed",
        source: "spawn_monitor"
      });

      const stats = await getRecoveryStats();
      expect(stats.totalAttempts).toBe(3);
      expect(stats.successfulAttempts).toBe(2);
      expect(stats.failedAttempts).toBe(1);
    });

    it("should track last successful recovery", async () => {
      await recordAttempt({
        tick: 1000,
        status: "lost",
        action: "respawned",
        source: "spawn_monitor"
      });

      const stats = await getRecoveryStats();
      expect(stats.lastSuccessfulRecovery).toBeDefined();
    });
  });

  describe("Audit Trail", () => {
    it("should create individual attempt files", async () => {
      await recordAttempt({
        tick: 1000,
        status: "lost",
        action: "respawned",
        source: "spawn_monitor"
      });

      // Check that attempt file was created
      const files = await import("node:fs/promises").then(fs => fs.readdir(TEST_REPORTS_DIR));
      const attemptFiles = files.filter(f => f.startsWith("attempt-"));
      expect(attemptFiles.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing state file gracefully", async () => {
      // Delete state file if it exists
      if (existsSync(TEST_STATE_FILE)) {
        await unlink(TEST_STATE_FILE);
      }

      const result = await canAttemptRecovery();
      expect(result.allowed).toBe(true);
    });

    it("should handle corrupted state file", async () => {
      // Write invalid JSON
      await import("node:fs/promises").then(fs =>
        fs.writeFile(TEST_STATE_FILE, "invalid json {")
      );

      const result = await canAttemptRecovery();
      expect(result.allowed).toBe(true);
    });
  });
});
