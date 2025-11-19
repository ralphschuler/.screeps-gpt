# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-19

### Added

- Initial release of `@ralphschuler/screeps-profiler` package
- CPU profiling with decorator support (`@profile`)
- CLI interface for profiler control (start, stop, status, output, clear)
- Tick-based caching for performance optimization (60-80% overhead reduction)
- Build-time enable/disable support via `__PROFILER_ENABLED__` constant
- Memory-efficient profiling data storage
- Formatted console output with detailed statistics
- TypeScript type definitions
- Comprehensive documentation and examples
- Support for both method and class decorators
- Auto-initialization of Memory.profiler structure
- Helper functions for string padding in output formatting

### Performance

- Optimized profiler state checking with per-tick caching
- Reduced Memory access from 1000+ to 1-2 per tick
- ~2-5% overhead when profiler is running
- 0% overhead when disabled at build time

### Documentation

- Complete README with usage examples
- API documentation in code comments
- Build configuration examples for esbuild and webpack
- Best practices guide
- Console command reference
