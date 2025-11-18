# Performance Baseline Metrics

This document describes the methodology and implementation of performance baseline metrics for autonomous monitoring and anomaly detection.

## Overview

Performance baselines establish reference points for normal operation, enabling the monitoring system to:

- Detect performance anomalies and degradations
- Track optimization improvements objectively
- Generate data-driven recommendations
- Reduce false-positive alerts
- Enable regression detection

## Statistical Methodology

### Data Collection

**Minimum Requirements:**

- At least 24 hours of stable operation data
- Recommended: 48 hours for statistical confidence
- Collected during normal operations (not during bootstrap or respawn)
- Sampling interval: Every 30 minutes (via screeps-monitoring.yml workflow)

**Data Sources:**

- Bot state snapshots from `reports/bot-snapshots/`
- Stats collection from Memory.stats (via StatsCollector)
- PTR telemetry data

### Baseline Calculation

For each performance metric:

1. **Mean (μ)**: Average value across all data points
2. **Standard Deviation (σ)**: Measure of variance from the mean
3. **Percentiles**: 95th percentile for understanding distribution tail
4. **Trend Rate**: Linear regression slope for time-series metrics

### Threshold Determination

**Warning Threshold:** μ ± 2σ (95% confidence interval)

- Indicates significant deviation from normal operation
- Triggers investigation but not critical alert

**Critical Threshold:** μ ± 3σ (99.7% confidence interval)

- Indicates severe deviation requiring immediate attention
- Triggers critical alerts and potential automated remediation

**Directional Thresholds:**

- For metrics where lower is better (e.g., CPU usage): `μ + 2σ` for warning
- For metrics where higher is better (e.g., bucket level): `μ - 2σ` for warning

## Performance Indicators

### CPU Usage

**Metrics:**

- `cpu.used.mean`: Average CPU per tick
- `cpu.used.percentile95`: 95th percentile CPU usage
- `cpu.bucket.mean`: Average bucket level
- `cpu.bucket.trendRate`: Bucket growth/decay rate

**Alert Conditions:**

- Warning: CPU > μ + 2σ sustained for 10+ ticks
- Critical: CPU > μ + 3σ or bucket < critical threshold
- Objective: Maintain CPU efficiency while maximizing throughput

### Energy Economy

**Metrics:**

- `energy.incomePerRoom.mean`: Average energy per room
- `energy.storageTotal.mean`: Total energy storage
- `energy.storageTotal.accumulationRate`: Energy accumulation trend

**Alert Conditions:**

- Warning: Income deviation > 20% from baseline (μ ± 2σ)
- Critical: Income deviation > 30% from baseline (μ ± 3σ)
- Objective: Maintain positive energy balance

### Creep Population

**Metrics:**

- `creeps.total.mean`: Average total creep count
- `creeps.byRole`: Per-role population baselines

**Alert Conditions:**

- Warning: Population deviation > 30% from baseline
- Critical: Critical role missing or severe population collapse
- Objective: Maintain optimal creep distribution

### Room Control

**Metrics:**

- `rooms.controlledCount.mean`: Average number of controlled rooms
- `rooms.rclProgressRate.mean`: RCL upgrade rate

**Alert Conditions:**

- Warning: RCL progress stalled > 50 ticks
- Critical: Room control lost or upgrade rate near zero
- Objective: Steady expansion and RCL progression

### Spawn Efficiency

**Metrics:**

- `spawns.uptimePercentage.mean`: Spawn utilization rate

**Alert Conditions:**

- Warning: Uptime < μ - 2σ (underutilization) or > μ + 2σ (overutilization)
- Critical: Spawn uptime extremes indicating spawn starvation or inefficiency
- Objective: Balanced spawn utilization

## Implementation

### Establishing Baselines

#### Automatic Establishment (Recommended)

The monitoring workflow (`screeps-monitoring.yml`) automatically checks baseline readiness and establishes baselines when sufficient data exists:

1. **Every 30 minutes**: Monitoring workflow collects bot snapshots
2. **Readiness Check**: After each snapshot, checks if 48+ valid data points exist
3. **Auto-Establish**: When ready, automatically runs baseline establishment
4. **Auto-Commit**: Commits `baselines.json` to repository

**Status Check:**

```bash
npx tsx packages/utilities/scripts/check-baseline-readiness.ts
```

**Requirements for Automatic Establishment:**

- Minimum 48 snapshots (24 hours at 30min intervals)
- Snapshots must contain valid performance data (CPU, rooms, or creeps)
- Collection period must span at least 24 hours
- Recommended: 96+ snapshots (48 hours) for highest confidence

#### Manual Establishment

**Script:** `packages/utilities/scripts/establish-baselines.ts`

```bash
npx tsx packages/utilities/scripts/establish-baselines.ts
```

**Prerequisites:**

- Stats collection must be operational
- Minimum 24 hours of bot snapshot data in `reports/bot-snapshots/`
- Normal operation state (not during respawn or major disruption)

**Output:** `reports/monitoring/baselines.json`

### Baseline Structure

```json
{
  "version": "1.0.0",
  "generatedAt": "2025-11-15T00:00:00.000Z",
  "dataPointCount": 48,
  "collectionPeriod": {
    "startDate": "2025-11-13T00:00:00.000Z",
    "endDate": "2025-11-15T00:00:00.000Z",
    "durationHours": 48.0
  },
  "cpu": {
    "used": {
      "mean": 15.2,
      "stdDev": 2.1,
      "percentile95": 18.5,
      "warningThreshold": 19.4,
      "criticalThreshold": 21.5
    },
    "bucket": {
      "mean": 8500,
      "stdDev": 500,
      "trendRate": 2.5,
      "warningThreshold": 7500,
      "criticalThreshold": 7000
    }
  },
  "metadata": {
    "methodology": "Mean and standard deviation calculated from historical snapshots. Warning threshold: μ ± 2σ (95% CI). Critical threshold: μ ± 3σ (99.7% CI).",
    "confidenceLevel": "high",
    "recalibrationRecommended": "Weekly or after significant code changes"
  }
}
```

### Using Baselines in Monitoring

#### Autonomous Strategic Monitoring

The Copilot monitoring agent (`.github/copilot/prompts/screeps-monitor`) uses baselines for intelligent anomaly detection:

**Data-Driven Detection (when baselines available):**

- **Critical Alerts**: Metrics exceed μ ± 3σ thresholds
  - CPU usage > `baselines.cpu.used.criticalThreshold`
  - CPU bucket < `baselines.cpu.bucket.criticalThreshold`
  - Creep population < `baselines.creeps.total.criticalThreshold`

- **Warning Alerts**: Metrics exceed μ ± 2σ thresholds
  - CPU usage > `baselines.cpu.used.warningThreshold` (sustained)
  - Energy income < `baselines.energy.incomePerRoom.warningThreshold`
  - Creep population < `baselines.creeps.total.warningThreshold`
  - RCL progress < `baselines.rooms.rclProgressRate.warningThreshold`

**Fallback Detection (when baselines unavailable):**

- Uses generic heuristic thresholds
- CPU >95%, Energy <20%, etc.
- Issues note that thresholds are estimates until baselines established

**Workflow Integration:**

1. Monitoring agent checks `reports/monitoring/baselines.json`
2. Reads `metadata.confidenceLevel` to determine readiness
3. If `"high"` or `"low"`: Uses baseline-driven thresholds
4. If `"none"`: Falls back to heuristic thresholds
5. Issues include baseline status and recommend establishment

**Example Detection in Issue:**

```markdown
**Alert**: CPU usage critical

Current: 25.3 CPU/tick
Baseline: μ=15.2, σ=2.1
Warning threshold: 19.4 (μ+2σ)
Critical threshold: 21.5 (μ+3σ)

Status: **EXCEEDS CRITICAL THRESHOLD by 18%**
```

## Baseline Recalibration

### When to Recalibrate

**Scheduled:**

- Weekly automatic recalibration recommended
- After accumulating 7+ days of new data

**Event-Triggered:**

- After significant code changes (new features, optimizations)
- After respawn or major disruption
- When confidence level is "low" (< 48 data points)
- After room expansion or major strategic shift

### Recalibration Process

1. Verify stable operation state
2. Ensure sufficient new data collected (24-48 hours)
3. Run baseline establishment script
4. Review new baselines for sanity
5. Commit updated `reports/monitoring/baselines.json`
6. Monitor for alert threshold accuracy

### Rolling Window Approach

For continuous recalibration, use a rolling window approach:

- Keep last 30 days of snapshots
- Recalculate baselines weekly
- Compare old vs new baselines for significant shifts
- Maintain baseline history for trend analysis

## Validation

### Baseline Quality Checks

**Statistical Validity:**

- ✓ Sufficient data points (48+ recommended)
- ✓ Low standard deviation (< 50% of mean for most metrics)
- ✓ Normal distribution (check for outliers)

**Operational Validity:**

- ✓ Baselines reflect current code performance
- ✓ No major disruptions during collection period
- ✓ Thresholds don't generate false positives

### Testing Anomaly Detection

1. Establish baselines from known-good data
2. Inject known deviations (manual tests)
3. Verify detection at warning and critical thresholds
4. Adjust σ multipliers if needed (default: 2σ and 3σ)

## Troubleshooting

### Insufficient Data

**Problem:** Less than 24 hours of snapshots available

**Solution:**

- Wait for more data collection
- Script will warn about low confidence
- Baselines can still be generated but marked as "low confidence"

### Missing Stats Data

**Problem:** Snapshots contain only timestamps (issue #684)

**Solution:**

- Fix stats collection (see issue #684)
- Ensure StatsCollector is operational
- Verify Memory.stats is populated in runtime

### High Variance

**Problem:** Standard deviation is very high (> 50% of mean)

**Solution:**

- Indicates unstable operation or diverse workload
- May need separate baselines for different operational modes
- Consider filtering outliers or using median instead of mean

### False Positives

**Problem:** Alerts trigger during normal operation

**Solution:**

- Increase threshold multiplier (e.g., 3σ for warning, 4σ for critical)
- Recalibrate after collecting more representative data
- Add hysteresis (require sustained deviation, not single tick)

## References

- **Related Issues:**
  - #684 - Memory.stats collection restoration (prerequisite)
  - #711 - Systematic stats collection regression
  - #724 - Monitoring resilience improvements
  - #738 - Comprehensive resilience layer for stats

- **Related Scripts:**
  - `collect-bot-snapshot.ts` - Snapshot collection
  - `generate-analytics.ts` - Analytics data generation
  - `check-bot-health.ts` - Health monitoring

- **Monitoring Workflow:**
  - `.github/workflows/screeps-monitoring.yml` - Autonomous monitoring

## Changelog

- **2025-11-15**: Initial baseline methodology documentation
