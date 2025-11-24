/**
 * Spawn Recovery Attempt Tracker
 *
 * Implements circuit breaker logic to prevent infinite spawn placement loops.
 * Tracks all spawn recovery attempts and enforces max 3 attempts per 24-hour period.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

interface SpawnRecoveryAttempt {
  timestamp: string;
  tick: number;
  status: "lost" | "empty" | "normal";
  action: "respawned" | "spawn_placed" | "failed" | "none";
  roomName?: string;
  shardName?: string;
  error?: string;
  source: "aliveness_check" | "spawn_monitor" | "manual";
}

interface SpawnRecoveryState {
  attempts: SpawnRecoveryAttempt[];
  lastSuccessfulRecovery?: string;
  circuitBreakerActive: boolean;
  circuitBreakerUntil?: string;
}

const REPORTS_DIR = resolve("reports", "spawn-recovery");
const STATE_FILE = resolve(REPORTS_DIR, "recovery-state.json");
const MAX_ATTEMPTS_PER_WINDOW = 3;
const WINDOW_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const CIRCUIT_BREAKER_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Ensure reports directory exists
 */
async function ensureReportsDir(): Promise<void> {
  if (!existsSync(REPORTS_DIR)) {
    await mkdir(REPORTS_DIR, { recursive: true });
  }
}

/**
 * Load current recovery state from disk
 */
async function loadState(): Promise<SpawnRecoveryState> {
  try {
    if (existsSync(STATE_FILE)) {
      const data = await readFile(STATE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load recovery state:", error);
  }

  // Return default state
  return {
    attempts: [],
    circuitBreakerActive: false
  };
}

/**
 * Save recovery state to disk
 */
async function saveState(state: SpawnRecoveryState): Promise<void> {
  await ensureReportsDir();
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Get attempts within the current window (last 24 hours)
 */
function getRecentAttempts(state: SpawnRecoveryState): SpawnRecoveryAttempt[] {
  const now = Date.now();
  const windowStart = now - WINDOW_DURATION_MS;

  return state.attempts.filter(attempt => {
    const attemptTime = new Date(attempt.timestamp).getTime();
    return attemptTime >= windowStart;
  });
}

/**
 * Check if circuit breaker should be active
 */
function shouldActivateCircuitBreaker(state: SpawnRecoveryState): boolean {
  // Check if already active and still within duration
  if (state.circuitBreakerActive && state.circuitBreakerUntil) {
    const now = Date.now();
    const breakerEnd = new Date(state.circuitBreakerUntil).getTime();
    if (now < breakerEnd) {
      return true;
    }
    // Circuit breaker expired, deactivate
    state.circuitBreakerActive = false;
    state.circuitBreakerUntil = undefined;
  }

  // Check recent attempts
  const recentAttempts = getRecentAttempts(state);
  const failedAttempts = recentAttempts.filter(attempt => attempt.action === "failed" || attempt.action === "none");

  // Activate if we've had MAX_ATTEMPTS failures in the window
  if (failedAttempts.length >= MAX_ATTEMPTS_PER_WINDOW) {
    state.circuitBreakerActive = true;
    state.circuitBreakerUntil = new Date(Date.now() + CIRCUIT_BREAKER_DURATION_MS).toISOString();
    return true;
  }

  return false;
}

/**
 * Record a spawn recovery attempt
 */
export async function recordAttempt(attempt: Omit<SpawnRecoveryAttempt, "timestamp">): Promise<void> {
  const state = await loadState();

  const fullAttempt: SpawnRecoveryAttempt = {
    ...attempt,
    timestamp: new Date().toISOString()
  };

  state.attempts.push(fullAttempt);

  // Update last successful recovery if this was successful
  if (attempt.action === "respawned" || attempt.action === "spawn_placed") {
    state.lastSuccessfulRecovery = fullAttempt.timestamp;
    // Reset circuit breaker on success
    state.circuitBreakerActive = false;
    state.circuitBreakerUntil = undefined;
  }

  // Check if we should activate circuit breaker
  shouldActivateCircuitBreaker(state);

  await saveState(state);

  // Log individual attempt to separate file for audit trail
  const attemptFile = resolve(REPORTS_DIR, `attempt-${fullAttempt.timestamp.replace(/:/g, "-")}.json`);
  await writeFile(attemptFile, JSON.stringify(fullAttempt, null, 2));
}

/**
 * Check if spawn recovery should be allowed (circuit breaker check)
 */
export async function canAttemptRecovery(): Promise<{
  allowed: boolean;
  reason?: string;
  attemptsInWindow: number;
  circuitBreakerUntil?: string;
}> {
  const state = await loadState();

  // Check circuit breaker
  if (shouldActivateCircuitBreaker(state)) {
    return {
      allowed: false,
      reason: "Circuit breaker active - too many failed attempts",
      attemptsInWindow: getRecentAttempts(state).length,
      circuitBreakerUntil: state.circuitBreakerUntil
    };
  }

  // Check attempt count in current window (only count attempts, not successes)
  const recentAttempts = getRecentAttempts(state);
  const recentFailedAttempts = recentAttempts.filter(
    attempt => attempt.action === "failed" || attempt.action === "none"
  );

  if (recentFailedAttempts.length >= MAX_ATTEMPTS_PER_WINDOW) {
    // Activate circuit breaker
    state.circuitBreakerActive = true;
    state.circuitBreakerUntil = new Date(Date.now() + CIRCUIT_BREAKER_DURATION_MS).toISOString();
    await saveState(state);

    return {
      allowed: false,
      reason: `Maximum ${MAX_ATTEMPTS_PER_WINDOW} attempts per 24 hours exceeded`,
      attemptsInWindow: recentFailedAttempts.length,
      circuitBreakerUntil: state.circuitBreakerUntil
    };
  }

  return {
    allowed: true,
    attemptsInWindow: recentAttempts.length
  };
}

/**
 * Get recovery statistics for monitoring
 */
export async function getRecoveryStats(): Promise<{
  totalAttempts: number;
  recentAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  lastSuccessfulRecovery?: string;
  circuitBreakerActive: boolean;
  circuitBreakerUntil?: string;
}> {
  const state = await loadState();
  const recentAttempts = getRecentAttempts(state);

  return {
    totalAttempts: state.attempts.length,
    recentAttempts: recentAttempts.length,
    successfulAttempts: state.attempts.filter(a => a.action === "respawned" || a.action === "spawn_placed").length,
    failedAttempts: state.attempts.filter(a => a.action === "failed").length,
    lastSuccessfulRecovery: state.lastSuccessfulRecovery,
    circuitBreakerActive: shouldActivateCircuitBreaker(state),
    circuitBreakerUntil: state.circuitBreakerUntil
  };
}

/**
 * Reset circuit breaker (for manual intervention)
 * Also clears recent attempts to prevent immediate reactivation
 */
export async function resetCircuitBreaker(): Promise<void> {
  const state = await loadState();
  state.circuitBreakerActive = false;
  state.circuitBreakerUntil = undefined;

  // Clear recent attempts to prevent immediate reactivation
  // Keep older attempts for audit trail
  const now = Date.now();
  const windowStart = now - WINDOW_DURATION_MS;
  state.attempts = state.attempts.filter(attempt => {
    const attemptTime = new Date(attempt.timestamp).getTime();
    return attemptTime < windowStart;
  });

  await saveState(state);
}

/**
 * Clean up old attempts (older than 30 days)
 */
export async function cleanupOldAttempts(): Promise<number> {
  const state = await loadState();
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const originalCount = state.attempts.length;
  state.attempts = state.attempts.filter(attempt => {
    const attemptTime = new Date(attempt.timestamp).getTime();
    return attemptTime >= thirtyDaysAgo;
  });

  await saveState(state);
  return originalCount - state.attempts.length;
}
