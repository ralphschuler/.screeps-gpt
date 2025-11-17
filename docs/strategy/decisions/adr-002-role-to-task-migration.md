# ADR-002: Role-Based to Task-Based Architecture Migration

**Status**: Accepted (In Progress)  
**Date**: 2024-11-06 (Initial), 2025-11-17 (Updated)  
**Deciders**: Autonomous development system, @ralphschuler  
**Context**: Phase 2-4 Core Framework and Empire Coordination

## Context and Problem Statement

The bot currently uses a role-based architecture where creeps are assigned fixed roles (harvester, upgrader, builder) for their entire lifetime. As the bot scales to multi-room operations and complex behaviors, this approach becomes inefficient. How should we transition to a more flexible task-based system while maintaining stability?

## Decision Drivers

- **Flexibility** - Creeps should be able to multi-task based on priorities
- **Efficiency** - Better creep utilization reduces CPU and spawn costs
- **Scalability** - Support multi-room coordination and complex behaviors
- **Stability** - Migration must not disrupt existing functionality
- **CPU Performance** - Task evaluation must not be more expensive than role system
- **Maintainability** - Clear mental model for debugging and testing
- **Autonomous Development** - Support incremental, AI-driven changes

## Considered Options

### Option 1: Immediate Full Migration

**Description**: Replace entire role-based system with task-based system in single update.

**Pros**:

- Clean break, no hybrid complexity
- Forces resolution of all edge cases
- Simpler codebase (single system)
- Clear completion point

**Cons**:

- High risk of introducing bugs
- Difficult to test comprehensively
- No rollback path if issues found
- Disrupts all existing behaviors simultaneously
- Not suitable for autonomous development (too risky)

**Complexity**: Very High

### Option 2: Hybrid Co-Existence (Incremental Migration)

**Description**: Implement task system alongside role system. Gradually migrate behaviors from roles to tasks. Both systems coexist during transition.

**Pros**:

- Low risk - role system remains fallback
- Incremental migration allows thorough testing
- Easy rollback if issues found
- Can validate task system with non-critical behaviors first
- Supports autonomous development (small changes)
- Stakeholders can observe progress

**Cons**:

- More complex codebase during transition
- Need to maintain both systems temporarily
- Potential confusion about which system handles what
- Requires discipline to avoid coupling

**Complexity**: Medium (managed over time)

### Option 3: Fork for Task System

**Description**: Create separate branch with task system. Develop in parallel, merge when complete.

**Pros**:

- Clean separation during development
- Main branch remains stable
- Can experiment freely

**Cons**:

- Difficult to keep branches in sync
- Large merge conflicts at end
- No validation in production until complete
- Blocks other development
- Not suitable for autonomous development (merge conflicts)

**Complexity**: High

## Decision Outcome

**Chosen option**: "Hybrid Co-Existence (Incremental Migration)"

**Rationale**:

- Minimizes risk through incremental changes
- Allows thorough validation at each step
- Supports rollback if needed
- Aligns with autonomous development approach
- Stakeholders can track progress
- Proven approach from Overmind migration patterns
- Balance of safety and progress

## Consequences

### Positive

- **Low Risk**: Role system remains stable during migration
- **Testable**: Each migration step independently validated
- **Reversible**: Easy to rollback if issues found
- **Observable**: Progress visible through testing and monitoring
- **Flexible**: Can adjust migration plan based on learnings
- **Production Safe**: Critical behaviors remain on proven system

### Negative

- **Temporary Complexity**: Two systems coexist during transition
- **Longer Timeline**: Migration takes 12-16 weeks vs. single update
- **Maintenance Burden**: Must maintain both systems temporarily
- **Discipline Required**: Need clear rules on system boundaries

### Neutral

- **Code Size**: Temporarily larger, but manageable
- **Documentation**: Need to document both systems during transition
- **Testing**: More test scenarios, but better coverage

## Implementation Notes

### Migration Phases

**Phase 1: Foundation (Weeks 1-2)** ✅ Completed

- Task interface and contracts defined
- TaskManager implemented
- Task queue with priority system
- Basic task generation (harvest, upgrade, build)
- Unit tests for task system
- Documentation

**Phase 2: Parallel Validation (Weeks 3-6)** 🔄 In Progress (60% complete)

- Task system runs alongside roles
- Non-critical roles migrated first (builders, repairers)
- Comprehensive testing in PTR
- Performance comparison (role vs. task CPU usage)
- Monitoring and metrics collection
- Related: #723 (Phase 2 task framework)

**Phase 3: Critical Role Migration (Weeks 7-10)** ⏳ Pending

- Migrate harvesters to task-based
- Migrate upgraders to task-based
- Role system becomes backup
- Extensive regression testing
- Performance validation

**Phase 4: Advanced Features (Weeks 11-14)** ⏳ Pending

- Multi-task creeps (harvest + upgrade)
- Dynamic priority adjustment
- Task coordination across rooms
- Combat task integration

**Phase 5: Role System Deprecation (Weeks 15-16)** ⏳ Pending

- Remove role system code
- Cleanup role-specific memory
- Update documentation
- Final validation

### Coexistence Rules

**During Migration**:

1. **BehaviorController** orchestrates both systems
2. **Roles take precedence** for critical behaviors (harvesting, upgrading)
3. **Tasks handle** supplementary behaviors (building, repairing, hauling)
4. **Clear ownership**: Each behavior either role OR task, not both
5. **Feature flags**: Task system can be disabled via configuration

### Task System Design

**Task Interface** (`src/shared/contracts.ts`):

```typescript
interface Task {
  id: string;
  type: TaskType;
  priority: number;
  target: Id<any>;
  assignedTo: string | null;
  createdAt: number;
  isValid(): boolean;
  isValidTarget(): boolean;
}
```

**Task Assignment Algorithm**:

1. Sort tasks by priority (high to low)
2. Find idle creeps with capability match
3. Assign closest capable creep to task
4. Cache assignments in creep memory
5. Validate task/target each tick

**Task Types**:

- Harvest (source energy)
- Upgrade (controller)
- Build (construction sites)
- Repair (damaged structures)
- Haul (transfer resources)
- Combat (attack/defend)
- Remote (off-room tasks)

### Performance Considerations

**CPU Budget**:

- Task generation: <0.5 CPU/room/tick
- Task assignment: <1.0 CPU/room/tick
- Task validation: <0.2 CPU/creep/tick
- Total overhead: <2 CPU/room/tick target

**Optimization Strategies**:

- Cache task list (regenerate every N ticks)
- Batch assign tasks (not per-creep)
- Lazy evaluation of task validity
- Reuse tasks between ticks (task persistence)

### Testing Strategy

**Unit Tests**:

- Task creation and validation
- Assignment algorithm
- Priority queue operations
- Task lifecycle management

**Integration Tests**:

- Full tick with task system
- Hybrid role + task execution
- Multi-room task coordination

**Regression Tests**:

- Creep behavior consistency
- Resource efficiency metrics
- CPU usage comparison
- Edge cases (empty room, under attack)

**E2E Validation**:

- PTR deployment with task system enabled
- Monitor for 1000+ ticks
- Compare metrics to baseline
- Validate no regressions

## Validation Criteria

**Phase 2 Success Criteria** (Current):

- [ ] Task system operational in PTR
- [ ] Non-critical roles migrated to tasks (builders, repairers)
- [ ] CPU usage within 10% of role-based system
- [ ] Energy efficiency unchanged or improved
- [ ] Zero production incidents from task system
- [ ] Comprehensive test coverage (>90%)

**Phase 3 Success Criteria**:

- [ ] All roles migrated to tasks
- [ ] Role system used as fallback only
- [ ] CPU usage <15 CPU/tick at RCL 6
- [ ] Creep utilization improved (>80% active)
- [ ] Multi-room coordination functional

**Phase 5 Success Criteria**:

- [ ] Role system code removed
- [ ] Task system handles all behaviors
- [ ] Documentation updated
- [ ] Performance validated in production
- [ ] Zero rollback incidents

## Links

- [Task System Implementation](../../packages/bot/src/runtime/tasks/)
- [BehaviorController](../../packages/bot/src/runtime/behavior/BehaviorController.ts)
- [Issue #723](https://github.com/ralphschuler/.screeps-gpt/issues/723) - Phase 2 Task Framework
- [Issue #653](https://github.com/ralphschuler/.screeps-gpt/issues/653) - Capability-based Assignment
- [Issue #715](https://github.com/ralphschuler/.screeps-gpt/issues/715) - Phase 1 Completion
- [Overmind Analysis](../research/overmind-analysis.md) - Task patterns
- [Phase 2 Documentation](../strategy/phases/phase-2.md)

## Notes

### Current Status (2025-11-17)

**Completed**:

- ✅ Task interface defined
- ✅ TaskManager implementation
- ✅ Basic task generation
- ✅ Priority queue system
- ✅ Unit tests for task system
- ✅ Documentation framework

**In Progress**:

- 🔄 Phase 2 task framework (#723) - 60% complete
- 🔄 Capability-based assignment (#653)
- 🔄 Testing in PTR environment

**Pending**:

- ⏳ Critical role migration (harvesters, upgraders)
- ⏳ Multi-task creeps
- ⏳ Multi-room task coordination
- ⏳ Role system deprecation

### Lessons Learned

**From Phase 1-2**:

- Incremental approach validated - no major incidents
- Task system adds <1 CPU/tick overhead (acceptable)
- Hybrid coexistence works well (no confusion)
- Good test coverage essential for confidence

**Challenges Encountered**:

- Task assignment algorithm complexity
- Balancing priority vs. distance vs. capability
- Task persistence and validation
- Memory overhead from task storage

**Recommendations**:

- Continue incremental migration
- Add task reuse pool (Overmind pattern)
- Implement task chaining (parent-child tasks)
- Monitor CPU usage closely during migration

### Future Enhancements

**After Migration Complete**:

- Dynamic priority adjustment based on room state
- Task templates for common patterns
- Task delegation across rooms
- Advanced coordination (squad tasks, logistics chains)
- Machine learning for task priority tuning

### Rollback Plan

**If Migration Issues**:

1. Disable task system via feature flag
2. Fall back to role system
3. Investigate root cause
4. Fix and re-enable incrementally
5. Document lessons learned

**Rollback Triggers**:

- CPU usage >30% higher than baseline
- Energy efficiency drops >20%
- Production incidents from task system
- Unresolvable bugs in task assignment
