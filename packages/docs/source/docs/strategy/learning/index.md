# Learning Insights

This directory contains documented patterns, lessons learned, and strategic insights extracted from the bot's development history. These insights help prevent repeating failed approaches and accelerate future development by leveraging proven patterns.

## Purpose

Learning documentation serves to:

- **Capture Institutional Knowledge** - Preserve lessons learned from successes and failures
- **Prevent Repeated Mistakes** - Document failed approaches so future work avoids them
- **Accelerate Development** - Share proven patterns for common problems
- **Guide Strategic Decisions** - Provide evidence-based recommendations for planning

## Key Learning Areas

### Successful Patterns

- [Bootstrap Phase Implementation](bootstrap-implementation.md) - Early-game optimization with harvester-focused spawning
- [Container-Based Harvesting](container-based-harvesting.md) - Role specialization for efficient energy economy
- [Round-Robin Task Scheduling](round-robin-scheduling.md) - Fair CPU allocation preventing creep starvation

### Architecture Patterns

- **Manager-Based Architecture** - Consistent pattern across all managers (ScoutManager, TerminalManager, etc.)
- **Priority-Based Queuing** - Used for spawn queue, task queue, terminal transfers
- **Role Specialization** - Specialized roles more effective than generalist creeps

### Failed Approaches

- **Generalist Harvesters** - Mobile harvesters less efficient than stationary + hauler combination
- **Static Role Minimums** - Fixed role counts don't adapt to room conditions
- **Global Resource Tracking** - High memory cost, slow updates; room-local tracking better
- **Complex Lab Coordination** - Multi-room lab optimization too complex; room-local automation sufficient

## Pattern Categories

### 1. Economic Patterns

Patterns related to resource gathering, storage, and distribution:

- Container-based harvesting (stationary harvester + hauler)
- Link network energy highways
- Terminal resource balancing
- Storage manager resource routing

### 2. Task Management Patterns

Patterns related to task generation, assignment, and execution:

- Round-robin task scheduling for CPU fairness
- Priority-based task queuing
- Task persistence across ticks
- Distance-based task assignment

### 3. Spawning Patterns

Patterns related to creep creation and role management:

- Bootstrap phase harvester-focused spawning
- Dynamic body part generation
- Priority-based spawn queue
- Cold boot recovery logic

### 4. Coordination Patterns

Patterns related to multi-creep and multi-room coordination:

- Squad-based combat coordination
- Traffic management with position reservation
- Inter-shard messaging for resource coordination
- Colony-wide resource pooling

### 5. Defense Patterns

Patterns related to tower automation and threat response:

- Threat prioritization (healers > attackers > others)
- Energy-aware repair (only when energy >50%)
- Multi-tower coordination through shared targeting
- Automatic retreat logic for combat squads

### 6. Infrastructure Patterns

Patterns related to construction and maintenance:

- RCL-appropriate base planning
- Automated road network planning
- Repairer role for infrastructure maintenance
- Extension placement optimization

## Using Learning Documentation

### For Developers

When implementing new features:

1. **Search for related patterns** - Check if similar problems have been solved
2. **Review failed approaches** - Avoid repeating documented mistakes
3. **Apply proven patterns** - Leverage successful implementations
4. **Document new insights** - Add learnings from your implementation

### For Autonomous Agents

When generating improvement recommendations:

1. **Consult learning docs** - Understand historical context
2. **Reference patterns** - Suggest proven approaches
3. **Avoid failed approaches** - Don't recommend documented failures
4. **Update learnings** - Add new insights from implementations

### For Strategic Planning

When making architectural decisions:

1. **Review architectural patterns** - Understand established conventions
2. **Consider past failures** - Factor in documented challenges
3. **Leverage successes** - Build on proven foundations
4. **Document decisions** - Create ADRs for significant choices

## Adding New Learnings

When documenting new learnings:

1. **Create dedicated document** - One file per major pattern or insight
2. **Use template structure** - Context, problem, solution, outcomes, related patterns
3. **Link to evidence** - Reference CHANGELOG entries, issues, PRs
4. **Update this README** - Add to appropriate category
5. **Cross-reference** - Link from phase docs and roadmap

### Template Structure

```markdown
# Pattern Name

**Category**: Economic / Task Management / Spawning / Coordination / Defense / Infrastructure
**Phase**: Which phase this pattern emerged from
**Status**: Proven / Experimental / Deprecated

## Context

What problem was being solved? What was the situation?

## Problem

What specific challenge or issue needed to be addressed?

## Solution

How was the problem solved? What approach was taken?

## Implementation

Key implementation details, code structure, algorithms used.

## Outcomes

Results of implementing this pattern:

- Performance improvements
- CPU savings
- Complexity reduction
- Other benefits

## Trade-offs

What are the downsides or limitations of this approach?

## When to Use

Scenarios where this pattern is appropriate.

## When to Avoid

Scenarios where this pattern is not appropriate.

## Related Patterns

- Links to related learning documents
- Links to phase documentation
- Links to CHANGELOG entries
- Links to relevant issues/PRs

## See Also

- Code references (file paths)
- Test coverage
- Documentation
```

## Pattern Evaluation Criteria

Patterns should be documented when they:

- **Solve real problems** - Address actual issues encountered during development
- **Are proven** - Validated through implementation and testing
- **Are reusable** - Applicable to future similar problems
- **Have evidence** - Backed by data, tests, or observable outcomes
- **Are significant** - Non-trivial solutions worth preserving

## Maintenance

Learning documentation should be updated:

- **After major implementations** - Capture insights while fresh
- **When patterns emerge** - Document recurring solutions
- **When failures occur** - Record what didn't work and why
- **During retrospectives** - Phase completion reviews
- **When asked** - Respond to specific pattern queries

## Related Documentation

- [Strategic Roadmap](../roadmap.md) - Phase progression and priorities
- [Phase Documentation](../phases/) - Detailed phase objectives and status
- [Architectural Decisions](../decisions/) - ADRs for major design choices
- [CHANGELOG.md](../../../CHANGELOG.md) - Implementation history
