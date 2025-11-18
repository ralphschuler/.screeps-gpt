# Screeps Stats Directory

This directory contains stats data collected from the Screeps API or console telemetry.

## Files

- `latest.json` - Most recent stats snapshot (bootstrapped with placeholder)
- `.gitkeep` - Ensures directory is tracked in git

## Usage

The monitoring workflow (`screeps-monitoring.yml`) populates this directory every 30 minutes with fresh data from:
1. Screeps Stats API (primary source)
2. Console telemetry (fallback)

Scripts that depend on this data:
- `collect-bot-snapshot.ts` - Reads stats to create comprehensive snapshots
- `check-ptr-alerts.ts` - Reads stats for trend analysis and alerting
- `establish-baselines.ts` - Consumes historical data for statistical baselines

## Troubleshooting

If this directory or files are missing, see `docs/operations/troubleshooting-telemetry.md` Issue 6.
