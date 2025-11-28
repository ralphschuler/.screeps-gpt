---
title: "Release 0.180.0: Deployment History Tracking for Reliable Rollbacks"
date: 2025-11-28T14:51:59.336Z
categories:
  - Release Notes
tags:
  - release
  - deployment
  - automation
  - rollback
  - reliability
---

We're excited to announce Screeps GPT version 0.180.0, a release focused on dramatically improving deployment reliability and rollback safety. This update introduces a comprehensive deployment history tracking system that eliminates the guesswork from rollback operations and prevents cascading deployment failures.

## Key Features

**Deployment History Tracking**: Version 0.180.0 introduces a persistent deployment history system that records every validated deployment with comprehensive metrics, enabling intelligent rollback decisions based on actual deployment health rather than just git tags.

## Technical Details

### The Problem: Unreliable Rollback Operations

Before this release, the rollback mechanism relied solely on git tags to determine the previous version. This approach had a critical flaw: it couldn't distinguish between a deployment that was successfully tagged but failed health checks, and one that was genuinely stable. When a deployment failed validation, attempting to roll back to the "previous" version often meant rolling back to another failed deployment, creating a dangerous rollback loop.

**Why This Matters**: In an autonomous bot environment where deployments happen automatically, a broken rollback mechanism can compound failures rather than recover from them. Without knowing which versions actually passed validation, the system had no reliable way to find a safe fallback point.

### The Solution: Validated Deployment History

The new system introduces three key components that work together to provide reliable rollback capabilities:

#### 1. Deployment History Registry

Located at `reports/deployments/deployment-history.json`, this persistent file maintains a rolling window of the last 5 validated deployments. Each entry captures:

- **Version identifier**: Semantic version tag
- **Timestamp**: When the deployment was validated
- **Validation metrics**: CPU usage, energy levels, creep counts
- **Success status**: Whether health checks passed

This registry is committed to the repository alongside deployment artifacts, creating an auditable trail of deployment health over time.

#### 2. Intelligent Version Selection

The rollback process has been enhanced with a new decision tree implemented in `packages/utilities/scripts/manage-deployment-history.ts`:

1. **Primary path**: Query the deployment history for the most recent validated version
2. **Fallback path**: If history is empty (fresh deployment pipeline), fall back to git tag traversal
3. **Safety check**: Prevent rolling back to the current version (would create a no-op rollback)

This approach maintains backward compatibility while providing significantly improved rollback intelligence when history is available.

#### 3. Type-Safe History Management

A new type system defined in `packages/utilities/scripts/types/deployment-history.ts` ensures all deployment history operations are strongly typed:

```typescript
interface DeploymentRecord {
  version: string;
  timestamp: string;
  validationMetrics: ValidationMetrics;
  success: boolean;
}
```

This type safety prevents data corruption and makes the history format self-documenting for monitoring agents.

### Implementation Highlights

**Automated Recording**: The deployment workflow (`.github/workflows/deploy.yml`) automatically records successful deployments after health checks pass. Failed deployments are never recorded, preventing rollback loops.

**Bounded History**: The system maintains only the last 5 validated deployments, balancing auditability with storage efficiency. This window provides enough rollback options for most failure scenarios without unbounded growth.

**Testing Coverage**: The feature includes comprehensive validation:
- **Unit tests**: `tests/unit/manage-deployment-history.test.ts` validates history operations, version selection logic, and edge cases
- **Regression tests**: `tests/regression/deployment-history-tracking.test.ts` ensures rollback loop prevention and validates the complete workflow integration

**Documentation Updates**: The deployment rollback documentation (`packages/docs/source/docs/operations/deployment-rollback.md`) has been updated to explain the new rollback process, including when history is used versus git tag fallback.

## Design Rationale

### Why Not Just Fix Health Checks?

The temptation might be to simply improve health check accuracy so that only good deployments get tagged. However, this misses a fundamental insight: **deployments can degrade over time**. A version that passes initial health checks might encounter issues hours later due to game state changes, resource exhaustion, or emergent behavior bugs.

By maintaining a history of validated deployments with their metrics, we create a richer context for rollback decisions. Future enhancements could leverage this data to:
- Identify versions with optimal performance characteristics
- Detect deployment regressions by comparing metrics over time
- Implement time-weighted rollback selection (prefer recently validated versions)

### Why 5 Deployments?

The 5-deployment window was chosen based on typical deployment frequency and failure patterns:
- **Too few** (1-2): Doesn't provide enough rollback options if multiple deployments fail in sequence
- **Too many** (10+): Increases storage overhead and rollback search time without meaningful benefit
- **Just right** (5): Provides 2-3 weeks of rollback history at typical deployment cadence while keeping the history file small (<5KB)

### Why Commit History to Repository?

Storing deployment history in the repository rather than an external database provides several advantages:
- **Auditability**: History changes are tracked through git, creating a complete audit trail
- **Portability**: Deployment history travels with the codebase, no external dependencies
- **Simplicity**: No database setup, connection management, or additional infrastructure
- **Reliability**: History survives CI/CD system failures or resets

The tradeoff is that the repository grows slightly with each deployment, but at ~1KB per entry, the 5-deployment limit keeps this negligible.

## Bug Fixes

This release resolves **issue #1496** (rollback lacks version history tracking), which documented multiple instances of rollback loops where the system would roll back to another failed version, creating a cycle of deployments that never recovered without manual intervention.

## Impact

### Deployment Safety

The deployment pipeline is now significantly more resilient to failures:
- **No more rollback loops**: The system will never roll back to a version that didn't pass validation
- **Faster recovery**: Rollbacks go directly to the last known-good version without trial and error
- **Better diagnostics**: Deployment metrics in the history help identify what changed between successful deployments

### Operational Confidence

For an autonomous bot project where deployments happen automatically, this improvement is critical:
- **Reduced downtime**: Failed deployments recover faster with confident rollback targets
- **Less manual intervention**: The system can self-heal from deployment failures without human oversight
- **Better monitoring**: The deployment history provides a baseline for detecting deployment regressions

### Development Velocity

By removing the fear of deployment loops, this change enables more aggressive automation:
- Developers can deploy more frequently knowing rollbacks are reliable
- The CI/CD pipeline can be more aggressive with automatic deployments
- Failed deployments become learning opportunities rather than operational crises

## What's Next

The deployment history system lays the groundwork for several exciting enhancements:

**Metrics-Based Rollback Selection**: Future versions could analyze validation metrics to choose the best rollback target, not just the most recent. For example, preferring versions with better CPU efficiency or energy stability.

**Automated Deployment Quality Scoring**: By tracking metrics over time, we could build a deployment quality score that helps predict whether a new deployment is likely to succeed or degrade.

**Canary Deployment Support**: The history tracking provides the foundation for gradual rollout strategies where new versions are validated at scale before full deployment.

**Deployment Performance Trends**: Analyzing the metrics in deployment history could reveal performance regressions or improvements over time, feeding into strategic planning.

## Conclusion

Release 0.180.0 represents a significant maturity milestone for the Screeps GPT deployment pipeline. By introducing intelligent deployment history tracking, we've transformed rollbacks from a risky last resort into a reliable recovery mechanism. This change embodies the project's philosophy of building autonomous, self-healing systems that can operate confidently without constant human oversight.

The implementation demonstrates thoughtful engineering: backward compatible, well-tested, properly typed, and thoroughly documented. It solves a real operational problem while setting the stage for future enhancements. Most importantly, it makes the bot more resilient and the development experience more pleasant.

For autonomous AI development, reliability is paramount. With deployment history tracking, Screeps GPT takes another step toward truly hands-off operation.
