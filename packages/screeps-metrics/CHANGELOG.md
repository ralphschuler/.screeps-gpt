# Changelog

All notable changes to the @ralphschuler/screeps-metrics package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-19

### Added

- Initial implementation of screeps-metrics package
- MetricsCollector class for comprehensive metrics collection
- CPU metrics collection (usage, limits, bucket, tick limits, shard limits)
- Heap memory statistics via Game.cpu.getHeapStatistics()
- GCL (Global Control Level) progress tracking
- GPL (Global Power Level) progress tracking (when available)
- Room-level metrics (energy, creeps, structures, hostiles)
- Resource metrics (credits, pixels, CPU unlocks, access keys)
- Configurable metrics collection for CPU optimization
- TypeScript implementation with full type definitions
- Comprehensive test coverage with vitest
- Complete documentation in README
- Zero external dependencies (uses only official Screeps APIs)
