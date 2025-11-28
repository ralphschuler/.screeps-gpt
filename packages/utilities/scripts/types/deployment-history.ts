/**
 * Type definitions for deployment history tracking
 *
 * This module defines types for tracking validated deployment versions,
 * enabling reliable rollback to known-good versions rather than relying
 * on git tag ordering which may not reflect deployment validation status.
 */

/**
 * Validation metrics captured during deployment health check
 */
export interface DeploymentValidationMetrics {
  /** CPU usage at validation time */
  cpuUsed: number;
  /** CPU bucket level at validation time */
  cpuBucket: number;
  /** Number of creeps at validation time */
  creepCount: number;
  /** Number of controlled rooms at validation time */
  roomCount: number;
  /** Number of spawns at validation time */
  spawnCount: number;
}

/**
 * A single validated deployment entry
 */
export interface ValidatedDeployment {
  /** Semantic version tag (e.g., "v0.175.4") */
  version: string;
  /** ISO 8601 timestamp when deployment was validated */
  validatedAt: string;
  /** Git commit SHA for this deployment */
  commitSha: string;
  /** Validation metrics at time of health check */
  validation: DeploymentValidationMetrics;
  /** URL to the GitHub Actions workflow run */
  workflowRunUrl: string;
}

/**
 * Deployment history file structure
 *
 * Tracks the last N validated deployments for reliable rollback.
 * Only deployments that pass health checks are recorded here.
 */
export interface DeploymentHistory {
  /** Most recent validated version (for quick access) */
  lastValidated: string | null;
  /** Commit SHA of the last validated deployment */
  lastValidatedCommit: string | null;
  /** ISO 8601 timestamp of the last update */
  lastUpdated: string;
  /** History of validated deployments (most recent first, limited to MAX_HISTORY_SIZE) */
  history: ValidatedDeployment[];
}

/**
 * Maximum number of validated deployments to keep in history
 */
export const MAX_HISTORY_SIZE = 5;

/**
 * Default empty deployment history
 */
export function createEmptyHistory(): DeploymentHistory {
  return {
    lastValidated: null,
    lastValidatedCommit: null,
    lastUpdated: new Date().toISOString(),
    history: []
  };
}
