# Project Constitution

This document defines the foundational principles and development guidelines for the Screeps GPT project.

## Core Principles

### 1. Code Quality

- **Strict TypeScript**: Maintain strict mode enabled, avoid `any` unless absolutely necessary
- **Test-Driven Development**: Write or update tests before fixing bugs
- **Minimal Changes**: Make the smallest possible modifications to achieve goals
- **Type Safety**: Use shared contracts through `src/shared/` rather than duplicating types

### 2. Testing Standards

- **Unit Tests**: All new functionality must have corresponding unit tests in `tests/unit/`
- **Integration Tests**: Complex features require end-to-end tests in `tests/e2e/`
- **Regression Tests**: All bugs must have regression tests before fixes
- **Coverage**: Aim for meaningful coverage, not just percentage targets

### 3. User Experience Consistency

- **Deterministic Runtime**: Keep runtime code deterministic; guard `Math.random()` behind utilities
- **Error Handling**: Provide clear error messages and graceful degradation
- **Documentation**: Update docs when behavior changes
- **Automation**: Leverage existing automation infrastructure

### 4. Performance Requirements

- **CPU Efficiency**: Monitor CPU usage through `src/runtime/metrics/`
- **Memory Management**: Use memory helpers from `src/runtime/memory/`
- **Build Performance**: Maintain fast build times (< 10 seconds)
- **Test Performance**: Keep unit tests fast (< 1 second total)

### 5. Development Workflow

- **Quality Gates**: Always run lint, format, and relevant test suites before committing
- **Documentation First**: Update docs early when planning new features
- **Incremental Changes**: Use frequent commits with clear messages
- **Security First**: Validate changes don't introduce vulnerabilities

## Technical Governance

### Architecture Decisions

- **Node.js 16**: Runtime targets Node 16.x with npm 8.0+
- **TypeScript**: Strict mode with ESLint v9+ and TypeScript ESLint v8+
- **Build Tool**: esbuild for fast bundling
- **Test Framework**: Vitest for all test types

### Dependency Management

- **Minimal Dependencies**: Only add libraries when absolutely necessary
- **Security Scanning**: Use `gh-advisory-database` tool before adding dependencies
- **Version Pinning**: Pin dependency versions for reproducibility

### Automation Governance

- **Least Privilege**: All workflows follow least-privilege permission guidelines
- **Copilot Integration**: Leverage existing `copilot-exec` composite action
- **MCP Servers**: Use Model Context Protocol for extended capabilities
- **Caching**: Implement multi-layer caching for performance

## Implementation Guidelines

### When Adding Features

1. Start with specification using `/speckit.specify`
2. Create technical plan with `/speckit.plan`
3. Generate task breakdown with `/speckit.tasks`
4. Implement with `/speckit.implement`
5. Run full quality gate checks
6. Update changelog and documentation

### When Fixing Bugs

1. Capture failure with regression test
2. Document root cause in `docs/operations/`
3. Apply minimal fix
4. Verify with all relevant test suites
5. Update changelog

### When Refactoring

1. Ensure test coverage exists
2. Make incremental changes
3. Validate behavior unchanged
4. Run full test suite
5. Document architectural changes

## Spec-Driven Development Integration

This project uses GitHub's spec-kit for specification-driven development:

- **Specifications**: Stored in `.specify/specs/{feature-number}-{feature-name}/`
- **Plans**: Technical implementation details in `plan.md`
- **Tasks**: Actionable task lists in `tasks.md`
- **Constitution**: This file guides all development decisions

### Workflow Integration

- Spec-kit commands integrate with GitHub Copilot CLI
- Specifications feed into automated issue resolution
- Plans align with existing quality gates
- Tasks leverage `copilot-exec` composite action

## Review Checklist

Before finalizing any specification, plan, or implementation:

- [ ] Adheres to strict TypeScript conventions
- [ ] Includes appropriate test coverage
- [ ] Updates relevant documentation
- [ ] Maintains existing automation compatibility
- [ ] Follows security best practices
- [ ] Uses existing internal utilities and libraries
- [ ] Passes all quality gates (lint, format, tests)
- [ ] Includes clear error handling
- [ ] Documents any architectural decisions
- [ ] Updates changelog in `[Unreleased]` section
