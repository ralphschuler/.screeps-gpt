# Architectural Decision Records (ADRs)

This directory contains Architectural Decision Records documenting significant design choices made during the bot's development. ADRs capture the context, options considered, decision made, and consequences to provide rationale for future reference.

## Purpose

Architectural Decision Records serve to:

- **Document Rationale** - Explain why specific design choices were made
- **Preserve Context** - Capture the situation and constraints at decision time
- **Guide Future Work** - Help future developers understand the reasoning
- **Facilitate Review** - Enable evaluation of decisions over time
- **Support Learning** - Build institutional knowledge about what works and what doesn't

## What Warrants an ADR?

Create an ADR for decisions that:

- **Are Significant** - Impact architecture, system behavior, or future development
- **Are Hard to Reverse** - Changing the decision later would be costly or disruptive
- **Have Trade-offs** - Multiple viable options with different pros/cons
- **Set Precedent** - Establish patterns that will be followed elsewhere
- **Affect Multiple Systems** - Cross-cutting concerns spanning multiple components

## ADR Template

When creating a new ADR, use this template:

```markdown
# ADR-NNN: [Short Title]

**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-XXX
**Date**: YYYY-MM-DD
**Deciders**: [List of people/agents involved in decision]
**Context**: [Which phase(s) this affects]

## Context and Problem Statement

[Describe the problem or opportunity that motivated this decision.
What is the issue we're trying to address? What constraints exist?]

## Decision Drivers

- [Driver 1: e.g., CPU budget constraints]
- [Driver 2: e.g., Memory limitations]
- [Driver 3: e.g., Simplicity and maintainability]
- [Driver 4: e.g., Alignment with Screeps best practices]

## Considered Options

### Option 1: [Name of Option]

**Description**: [How this option works]

**Pros**:

- [Advantage 1]
- [Advantage 2]

**Cons**:

- [Disadvantage 1]
- [Disadvantage 2]

**Complexity**: Low | Medium | High

### Option 2: [Name of Option]

[Same structure as Option 1]

### Option 3: [Name of Option]

[Same structure as Option 1]

## Decision Outcome

**Chosen option**: "[Option name]"

**Rationale**: [Explain why this option was chosen. What made it better than the alternatives?]

## Consequences

### Positive

- [Positive consequence 1]
- [Positive consequence 2]

### Negative

- [Negative consequence 1]
- [Negative consequence 2]

### Neutral

- [Neutral consequence 1]
- [Neutral consequence 2]

## Implementation Notes

[Practical considerations for implementing this decision:

- Which files/modules affected?
- Migration path from previous approach (if applicable)
- Testing requirements
- Documentation updates needed]

## Validation Criteria

How will we know if this decision was correct?

- [Criterion 1: e.g., CPU usage below threshold]
- [Criterion 2: e.g., Energy efficiency improvement]
- [Criterion 3: e.g., Code complexity reduction]

## Links

- [Link to related ADRs]
- [Link to implementation PRs]
- [Link to design documents]
- [Link to discussion issues]
- [Link to CHANGELOG entries]

## Notes

[Any additional context, future considerations, or open questions]
```

## ADR Lifecycle

### 1. Proposed

Decision is under consideration. ADR documents the options and trade-offs. Discussion and refinement ongoing.

### 2. Accepted

Decision has been made and ADR is finalized. Implementation should follow the documented approach.

### 3. Deprecated

Decision is no longer recommended. Document why it was deprecated and what replaces it.

### 4. Superseded

Decision replaced by a newer ADR. Link to the superseding ADR.

## Naming Convention

ADRs should be named: `adr-NNN-short-title.md`

Where:

- `NNN` is a sequential number (001, 002, etc.)
- `short-title` is a kebab-case brief description

Examples:

- `adr-001-manager-based-architecture.md`
- `adr-002-container-based-harvesting.md`
- `adr-003-round-robin-task-scheduling.md`

## Index of Decisions

As ADRs are created, maintain this index for quick reference:

### Active Decisions

_(No ADRs created yet - this section will be populated as architectural decisions are documented)_

### Deprecated Decisions

_(None yet)_

## Creating a New ADR

1. **Identify the Decision** - Recognize that a significant architectural choice is being made
2. **Copy the Template** - Create new file using template above
3. **Fill in Context** - Document the problem, constraints, and drivers
4. **List Options** - Enumerate all viable alternatives with pros/cons
5. **Make Decision** - Choose the best option and document rationale
6. **Document Consequences** - Describe positive, negative, and neutral outcomes
7. **Add to Index** - Update this README with link to new ADR
8. **Mark as Proposed** - Initially set status to "Proposed" for review
9. **Review and Accept** - Get feedback, refine, then mark "Accepted"
10. **Implement** - Follow the documented approach in implementation

## Retroactive ADRs

For important decisions made before this ADR system existed, consider creating retroactive ADRs:

- Document decisions from learning insights that had significant impact
- Use CHANGELOG and issue history to reconstruct context
- Mark with original decision date (not ADR creation date)
- Valuable for patterns like manager-based architecture, priority queuing, etc.

## Using ADRs

### For Developers

- **Before Starting** - Check if decision already documented
- **During Design** - Create ADR for significant choices
- **During Implementation** - Reference ADRs for guidance
- **During Review** - Verify alignment with ADRs

### For Autonomous Agents

- **Before Proposing** - Consult ADRs to understand established patterns
- **When Recommending** - Reference ADRs to support proposals
- **When Implementing** - Follow ADR guidelines
- **When Reviewing** - Check for ADR compliance

### For Strategic Planning

- **Decision Consistency** - Ensure new decisions align with existing ADRs
- **Pattern Identification** - Extract patterns from multiple ADRs
- **Trade-off Analysis** - Use ADR consequences for strategic planning
- **Architectural Evolution** - Track how decisions evolve over time

## Related Documentation

- [Learning Insights](../learning/) - Documented patterns and lessons learned
- [Phase Documentation](../phases/) - Implementation status by phase
- [Strategic Roadmap](../roadmap.md) - Overall progression and priorities
- [AGENTS.md](../../../AGENTS.md) - Agent guidelines and operational rules

## Further Reading

- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) - Michael Nygard
- [ADR GitHub Organization](https://adr.github.io/) - ADR tools and resources
- [When Should I Write an ADR](https://engineering.atspotify.com/2020/04/when-should-i-write-an-architecture-decision-record/) - Spotify Engineering
