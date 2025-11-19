# Changelog

All notable changes to the @ralphschuler/screeps-perf package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-19

### Added

- Initial implementation of screeps-perf package
- Array function optimizations (filter, forEach, map) using for-loops
- Automatic creep memory cleanup for dead creeps
- Path finding cache to reduce expensive pathfinding calls
- TypeScript implementation with full type definitions
- Comprehensive test coverage with vitest
- Complete documentation in README
- Configurable options to enable/disable specific optimizations
- Access to original implementations when needed

### Credits

- Based on the original [screeps-perf](https://www.npmjs.com/package/screeps-perf) by Gary Borton
- Rewritten in TypeScript with enhanced type safety and modern module structure
