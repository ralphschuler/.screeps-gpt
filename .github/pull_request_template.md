## Description

Provide a clear and concise description of your changes.

**Related Issues:** Closes #[issue_number]

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Automation/workflow improvement
- [ ] Performance optimization
- [ ] Refactoring (no functional changes)
- [ ] Dependency update

## Changes Made

Describe the specific changes made in this PR:

-
-
-

## Testing Performed

### Test Coverage

- [ ] Unit tests added/updated (`npm run test:unit`)
- [ ] End-to-end tests added/updated (`npm run test:e2e`)
- [ ] Regression tests added/updated (`npm run test:regression`)
- [ ] Manual testing performed
- [ ] No tests required (documentation only)

### Test Results

Provide evidence of testing:

```
# Paste test output here
```

### Regression Test Requirements

- [ ] This is a bug fix and includes a regression test (required per AGENTS.md)
- [ ] This change doesn't fix a bug (regression test not required)
- [ ] Existing regression tests cover this change

## Code Quality Checklist

### AGENTS.md Compliance

- [ ] Code follows repository coding standards
- [ ] Changes are minimal and surgical (smallest possible changes)
- [ ] No unrelated changes or fixes included
- [ ] TypeScript strict mode compliance maintained

### Quality Gates

- [ ] Code formatted with Prettier (`npm run format:write`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] All relevant test suites pass

### Runtime Considerations (if applicable)

- [ ] Changes are deterministic (no unguarded `Math.random()`)
- [ ] Memory usage considerations addressed
- [ ] CPU performance impact evaluated
- [ ] Screeps API compatibility maintained

## Documentation Updates

- [ ] README.md updated (if user-facing changes)
- [ ] DOCS.md updated (if developer workflow changes)
- [ ] docs/ directory updated (if detailed documentation needed)
- [ ] TSDoc/code comments added for complex logic
- [ ] CHANGELOG.md updated in `[Unreleased]` section
- [ ] No documentation updates required

## Breaking Changes

- [ ] No breaking changes
- [ ] Breaking changes documented below
- [ ] Obsolete/deprecated code removed (if applicable)

If breaking changes exist, describe:

- What breaks:
- Migration path (if transitioning existing deployments):

**Note**: This repository does not maintain backwards compatibility. Obsolete code should be removed immediately rather than deprecated.

## Deployment Considerations

- [ ] Changes are safe to deploy immediately
- [ ] Requires deployment coordination
- [ ] New environment variables/secrets needed
- [ ] Database/memory structure changes
- [ ] No deployment considerations

## Additional Notes

### Performance Impact

- [ ] No performance impact expected
- [ ] Performance impact measured and acceptable
- [ ] Performance optimization (include benchmarks)

### Security Considerations

- [ ] No security implications
- [ ] Security review completed
- [ ] New secrets/credentials properly handled

### Automation Impact

- [ ] No impact on existing workflows
- [ ] Workflow changes tested with `npm run test:actions`
- [ ] New automation added/modified

## Reviewer Guidance

**Focus Areas:**

- **Known Limitations:**

- **Questions for Reviewers:**

-

## Pre-Merge Checklist

Before marking this PR as ready for review:

- [ ] All tests pass locally
- [ ] Code has been formatted and linted
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Breaking changes are documented
- [ ] Related issues are linked
- [ ] PR title follows conventional commit format
- [ ] Labels are applied appropriately

---

**Labels:** Add appropriate labels from the standardized system:

- **State:** `state/in-progress`, `state/blocked`, `state/done`
- **Type:** `type/bug`, `type/feature`, `type/enhancement`, `type/chore`
- **Priority:** `priority/critical`, `priority/high`, `priority/medium`, `priority/low`
- **Domain:** `runtime`, `automation`, `documentation`, `monitoring`, `dependencies`
- **Process:** `needs/regression-test`, `Todo`, `copilot`
- **Workflow:** `good-first-issue`, `help-wanted`

See [Label System Guide](../docs/automation/label-system.md) for details.
