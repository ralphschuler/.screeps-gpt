# Task Breakdown: [Feature Name]

**Feature ID**: [XXX-feature-slug]  
**Specification**: [Link to spec.md]  
**Plan**: [Link to plan.md]  
**Status**: Not Started | In Progress | Complete  
**Created**: [Date]  
**Last Updated**: [Date]

## Task Organization

Tasks are organized by user story and implementation phase. Dependencies are clearly marked, and parallel execution opportunities are indicated with `[P]`.

## Execution Guidelines

- **Sequential Tasks**: Complete in order within each phase
- **Parallel Tasks** `[P]`: Can be executed simultaneously
- **Validation Checkpoints**: Test functionality at each checkpoint before proceeding
- **TDD Approach**: Write tests before implementation where specified

---

## Phase 1: Foundation

### User Story: [Story Title]

#### Checkpoint: Foundation Setup

**Goal**: Establish basic structure and dependencies

**Tasks**:

1. [ ] **Create type definitions** `[P]`
   - File: `src/shared/[feature]-types.ts`
   - Action: Define core interfaces and types
   - Tests: N/A (types only)

2. [ ] **Set up directory structure** `[P]`
   - Files: Create `src/runtime/[feature]/` directory
   - Action: Initialize module with index.ts
   - Tests: N/A (structure only)

3. [ ] **Add shared contracts**
   - File: `src/shared/index.ts`
   - Action: Export new feature types
   - Dependencies: Task 1
   - Tests: N/A (exports only)

**Validation**:

- [ ] Project builds without errors
- [ ] Types are accessible from other modules
- [ ] No TypeScript strict mode violations

---

## Phase 2: Core Implementation

### User Story: [Story Title]

#### Checkpoint: Core Functionality

**Goal**: Implement primary feature logic

**Tasks**:

1. [ ] **Write unit tests for core logic** (TDD)
   - File: `tests/unit/[feature].test.ts`
   - Action: Define test cases for core functionality
   - Tests: N/A (this creates tests)

2. [ ] **Implement core module**
   - File: `src/runtime/[feature]/core.ts`
   - Action: Build main feature logic
   - Dependencies: Task 1, Phase 1 complete
   - Tests: Must pass `npm run test:unit`

3. [ ] **Add error handling** `[P]`
   - File: `src/runtime/[feature]/errors.ts`
   - Action: Create custom error types and handlers
   - Tests: Unit tests in task 1

4. [ ] **Integrate with metrics** `[P]`
   - File: `src/runtime/[feature]/core.ts`
   - Action: Add CPU tracking using `src/runtime/metrics/`
   - Tests: Unit tests verify metrics are called

**Validation**:

- [ ] All unit tests pass
- [ ] Error cases are handled gracefully
- [ ] CPU metrics are tracked correctly
- [ ] Code passes lint and format checks

---

## Phase 3: Integration

### User Story: [Story Title]

#### Checkpoint: System Integration

**Goal**: Connect feature to existing runtime

**Tasks**:

1. [ ] **Write integration tests** (TDD)
   - File: `tests/e2e/[feature].e2e.test.ts`
   - Action: Define integration test scenarios
   - Tests: N/A (this creates tests)

2. [ ] **Update bootstrap kernel**
   - File: `src/runtime/bootstrap/kernel.ts`
   - Action: Wire feature into main loop
   - Dependencies: Task 1, Phase 2 complete
   - Tests: Must pass `npm run test:e2e`

3. [ ] **Add memory persistence** `[P]`
   - File: `src/runtime/[feature]/memory.ts`
   - Action: Use memory helpers from `src/runtime/memory/`
   - Tests: Integration tests verify persistence

4. [ ] **Update evaluation system** `[P]`
   - File: `src/runtime/evaluation/index.ts`
   - Action: Add feature metrics to health reports
   - Tests: Integration tests verify evaluation

**Validation**:

- [ ] Feature works in simulated environment
- [ ] Memory state persists across ticks
- [ ] Evaluation system includes feature metrics
- [ ] All integration tests pass

---

## Phase 4: Quality & Documentation

### User Story: [Story Title]

#### Checkpoint: Production Readiness

**Goal**: Ensure quality and maintainability

**Tasks**:

1. [ ] **Add regression tests**
   - File: `tests/regression/[feature].regression.test.ts`
   - Action: Create tests for known edge cases
   - Tests: Must pass `npm run test:regression`

2. [ ] **Run dependency security scan**
   - Action: Use `gh-advisory-database` tool for any new dependencies
   - Tests: No vulnerabilities found

3. [ ] **Update documentation** `[P]`
   - Files:
     - `README.md` - [Section to update]
     - `DOCS.md` - [Section to update]
     - `docs/[relevant-doc].md`
   - Action: Document new feature usage and APIs
   - Tests: Documentation build succeeds

4. [ ] **Add inline documentation** `[P]`
   - Files: All feature source files
   - Action: Add TSDoc comments for exported functions
   - Tests: TSDoc linter passes

5. [ ] **Update changelog**
   - File: `CHANGELOG.md`
   - Action: Add feature to [Unreleased] section
   - Tests: N/A

6. [ ] **Update version index**
   - Action: Run `npm run versions:update`
   - Tests: Version files are updated

**Validation**:

- [ ] All test suites pass (unit, e2e, regression)
- [ ] No security vulnerabilities detected
- [ ] Documentation is complete and builds successfully
- [ ] Code is fully commented
- [ ] Changelog and versions are updated
- [ ] Lint and format checks pass

---

## Phase 5: Final Verification

### User Story: [Story Title]

#### Checkpoint: Pre-merge Validation

**Goal**: Final checks before merge

**Tasks**:

1. [ ] **Run full quality gate**
   - Action: Execute all quality checks locally
   - Tests:
     - `npm run lint`
     - `npm run format:check`
     - `npm run build`
     - `npm run test:unit`
     - `npm run test:e2e`
     - `npm run test:regression`
     - `npm run test:coverage`

2. [ ] **Manual validation**
   - Action: Test feature manually in development environment
   - Tests: Feature works as specified

3. [ ] **Review security**
   - Action: Review code for security issues
   - Tests: CodeQL scan passes (run automatically in PR)

4. [ ] **Update PR description**
   - Action: Document changes, testing, and validation
   - Tests: N/A

**Validation**:

- [ ] All automated checks pass
- [ ] Manual testing confirms expected behavior
- [ ] Security review complete
- [ ] PR description is comprehensive

---

## Completion Criteria

This feature is complete when:

- [ ] All phases are completed
- [ ] All tasks are checked off
- [ ] All validation checkpoints pass
- [ ] Feature meets all acceptance criteria from specification
- [ ] Code review is approved
- [ ] Quality gate checks pass in CI
- [ ] Documentation is updated
- [ ] No security vulnerabilities exist

## Notes

Add any implementation notes, discoveries, or decisions made during execution:

- [Note 1]
- [Note 2]
- [Note 3]

## Revision History

| Date   | Version | Author | Changes                |
| ------ | ------- | ------ | ---------------------- |
| [Date] | 1.0     | [Name] | Initial task breakdown |
