# Resource Allocation

This document describes the Screeps account configuration and resource allocation for the .screeps-gpt bot.

## Account Configuration

**Account Type:** Lifetime Subscription

**Upgrade Date:** November 2025

The account was upgraded from the free tier to a lifetime subscription, providing significantly increased CPU resources for more sophisticated AI development.

## Resource Limits

### CPU Allocation

| Resource      | Previous (Free Tier) | Current (Lifetime) | Change      |
| ------------- | -------------------- | ------------------ | ----------- |
| **CPU Limit** | 20                   | 50                 | +30 (+150%) |
| **Memory**    | 2048 KB              | 2048 KB            | Unchanged   |

### CPU Budget Details

- **Total CPU Limit:** 50 per tick
- **Bucket Maximum:** 10,000 (standard)
- **Bucket Refill Rate:** Unused CPU per tick

## System Thresholds

The bot uses the following CPU thresholds to prevent script execution timeouts:

### Performance Tracker

- **High CPU Warning:** 75% of limit (37.5 CPU)
- **Critical CPU Alert:** 90% of limit (45 CPU)
- **Bucket Warning:** Below 500

### System Evaluator

- **CPU Usage Warning:** 85% of limit (42.5 CPU)
- **CPU Critical Level:** 95% of limit (47.5 CPU)
- **Low Bucket Threshold:** 500

### Behavior Controller

- **CPU Safety Margin:** 85% of limit (42.5 CPU)
  - Behavior execution stops when CPU usage exceeds this threshold
- **Max CPU per Creep:** 1.5 CPU per creep

### Kernel

- **Emergency Threshold:** 90% of limit (45 CPU)
  - Last line of defense to prevent timeout

## Impact of Resource Upgrade

### Performance Benefits

1. **Reduced CPU Pressure**
   - 2.5x more CPU budget reduces previous CPU constraint concerns
   - Reduces risk of CPU timeout incidents
   - Allows for more sophisticated AI logic and decision-making

2. **Advanced Features**
   - Can enable profiler continuously without performance degradation
   - Multi-room expansion more viable with increased CPU budget
   - Advanced features like task management system can run efficiently
   - More expensive operations (pathfinding, planning) are feasible

3. **Operational Improvements**
   - Lower timeout risk improves bot stability
   - More headroom for emergency CPU bursts
   - Reduced need for aggressive CPU optimization
   - Better performance during peak operations

### Strategic Opportunities

With the increased CPU allocation, the bot can now:

- Run profiler permanently for continuous performance analysis
- Implement more sophisticated creep behaviors
- Enable advanced planning systems (task management, multi-room coordination)
- Explore CPU-intensive features previously considered too expensive
- Focus optimization efforts on strategic improvements rather than survival

## Monitoring and Alerting

### CPU Monitoring Systems

The bot includes comprehensive CPU monitoring:

1. **Performance Tracker** - Real-time CPU usage tracking per tick
2. **System Evaluator** - Health assessment and improvement recommendations
3. **PTR Stats Monitoring** - Historical performance tracking
4. **Autonomous Monitoring** - Strategic analysis combining bot and repository health

### Alert Thresholds

Alerts are triggered based on the new CPU limits:

- **Warning Alerts:** CPU usage > 85% (42.5 CPU)
- **Critical Alerts:** CPU usage > 95% (47.5 CPU)
- **Bucket Alerts:** CPU bucket < 500

## Related Documentation

- [CPU Timeout Diagnostic Runbook](cpu-timeout-diagnosis.md) - Diagnosis and resolution procedures
- [CPU Optimization Strategies](../runtime/operations/cpu-optimization-strategies.md) - Optimization techniques
- [Performance Optimization](performance-optimization.md) - Performance tuning guide
- [PTR Monitoring](stats-monitoring.md) - Performance tracking on test realm
- [Monitoring Alert Playbook](monitoring-alerts-playbook.md) - Alert response procedures

## Historical Context

### Previous Configuration (Free Tier)

Before the upgrade, the bot operated under significant CPU constraints:

- **CPU Limit:** 20 per tick
- **Tight Thresholds:** 80-90% safety margins were necessary
- **Limited Features:** Profiler and advanced systems disabled to conserve CPU
- **Frequent Timeouts:** CPU optimization was critical for survival

### Current Configuration (Lifetime Subscription)

With the upgrade, constraints are reduced:

- **CPU Limit:** 50 per tick (2.5x increase)
- **Adjusted Thresholds:** 85% safety margins provide more headroom
- **Enabled Features:** Can run profiler and advanced systems with better margins
- **Improved Stability:** Timeout risk reduced

## Conclusion

The lifetime subscription upgrade represents a strategic infrastructure enhancement that reduces previous operational constraints. The focus shifts from aggressive CPU optimization for survival to enabling more sophisticated AI features with better safety margins.

The increased CPU budget enables:

- More strategic development opportunities
- Advanced AI behaviors with better margins
- Continuous performance profiling with headroom
- Better multi-room coordination potential
- Reduced risk of CPU timeout incidents
