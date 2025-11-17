---
title: Analytics Documentation
date: 2025-11-17T12:00:00.000Z
layout: page
---

# Analytics Documentation

Comprehensive analytics and performance metrics for the Screeps AI bot.

## Overview

The analytics system provides detailed insights into bot performance, resource utilization, and strategic effectiveness. The analytics data is visualized through interactive charts and reports on the documentation site.

## Available Analytics

### Performance Metrics

- [**Bot Analytics Dashboard**](../analytics.html) - 30-day performance charts and metrics visualization including:
  - Room progression and GCL growth
  - Energy production and consumption
  - CPU utilization trends
  - Creep population statistics
  - Resource stockpile levels
  - Construction progress

### Data Collection

The analytics system collects snapshots of game state at regular intervals from the Public Test Realm (PTR) deployment. These snapshots capture:

- Room control levels (RCL)
- Global control level (GCL)
- Energy harvested vs. consumed
- CPU usage patterns
- Creep counts by role
- Resource stockpiles
- Build queue status

### Visualization

Analytics data is transformed into interactive charts using Chart.js, providing:

- Time-series graphs for trend analysis
- Multi-metric comparisons
- Historical performance tracking
- Progress indicators for strategic goals

## Related Documentation

- [Operations Monitoring](../operations/stats-monitoring.html) - PTR monitoring pipeline and telemetry
- [Performance Monitoring](../runtime/operations/performance-monitoring.html) - CPU tracking and optimization
- [Improvement Metrics](../runtime/development/improvement-metrics.html) - Strategy effectiveness measurement

## Quick Links

- [Analytics Dashboard](../analytics.html)
- [Main Documentation Index](../index.html)
- [PTR Console](https://screeps.com/ptr)
