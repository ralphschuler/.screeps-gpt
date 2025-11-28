# Phase 4: Empire Coordination

**Status**: In Progress (50% Complete)
**RCL Target**: Multi-room with 2-5 owned rooms
**Timeline**: Started 2024-11-07, Target Completion: 2025-03-01

## Overview

Phase 4 enables empire-level coordination across multiple owned rooms. This includes combat operations, traffic management, automated expansion, and inter-room logistics. The bot transitions from single-room optimization to empire-wide strategic planning and resource allocation.

## Objectives

### Primary Objectives

1. **Combat System** - Squad-based combat operations and threat response
2. **Traffic Management** - Collision avoidance and movement coordination
3. **Empire Coordination** - Multi-room resource balancing and strategic planning
4. **Room Claiming** - Automated expansion and colonization
5. **Multi-Room Logistics** - Coordinated resource shipping and balancing
6. **Power Management** - Power creep operations and power bank harvesting
7. **Market Automation** - Automated trading and resource acquisition

### Success Criteria

| Criterion                 | Target                               | Status                 |
| ------------------------- | ------------------------------------ | ---------------------- |
| Owned rooms               | 2-5 rooms                            | ⏳ Framework ready     |
| Combat win rate           | >80% defensive battles               | ⏳ Not yet validated   |
| Inter-room energy balance | ±10k across all rooms                | ⏳ Not yet validated   |
| Expansion rate            | 1 room per week (when GCL available) | ⏳ Not yet validated   |
| Traffic collision rate    | <5% creep collisions                 | ⏳ Not yet measured    |
| Market profit margin      | >10% on trades                       | ⏳ Not yet implemented |

## Implementation Status

### Completed Features (50%)

#### Combat System (100%)

Implemented 2024-11-07

- ✅ CombatManager for squad-based operations
- ✅ Squad formation with offense/defense/raid roles
- ✅ Threat assessment and engagement logic
- ✅ Squad movement coordination
- ✅ Retreat logic for damaged squads

**Key Capabilities**:

- Squad composition (attackers, healers, ranged attackers)
- Formation maintenance during movement
- Target prioritization (healers > damage dealers > others)
- Automatic retreat when squad health drops below threshold
- Integration with spawn system for combat creep spawning

**Lessons Learned**:

- Squad coordination dramatically more effective than individual combat creeps
- Healers essential for sustained combat operations
- Simple formation (maintain distance to leader) works well
- Retreat logic prevents unnecessary creep losses

#### Traffic Management (100%)

Implemented 2024-11-07

- ✅ TrafficManager for collision avoidance
- ✅ Priority-based movement system
- ✅ Position reservation to prevent conflicts
- ✅ Stuck detection and resolution
- ✅ Road priority (prefer roads when multiple paths equivalent)

**Key Capabilities**:

- Creep movement priority assignment
- Position reservation system (prevents multiple creeps targeting same spot)
- Stuck creep detection (not moved for N ticks)
- Automatic unstuck logic (random adjacent move)
- Road-aware pathfinding

**Lessons Learned**:

- Position reservation dramatically reduces collisions
- Priority system (haulers > builders > upgraders) improves traffic flow
- Simple stuck detection (tick counter) effective
- Road preference reduces congestion on main routes

### In Progress Features (50%)

#### Empire Coordination (25%)

**Priority**: High
**Status**: Framework exists, logic incomplete

Current implementation:

- ✅ Multi-room tracking
- ✅ Basic resource transfer between rooms
- 🔄 Strategic resource allocation
- ⏳ Empire-wide priority system
- ⏳ Coordinated expansion planning

Needed improvements:

- Empire-level resource pooling (treat all rooms as single economy)
- Strategic priority assignment (which rooms get resources first)
- Coordinated defense (send combat squads to threatened rooms)
- Load balancing (distribute CPU/creeps across rooms efficiently)

#### Room Claiming & Expansion (0%)

**Priority**: High
**Status**: Not yet started

Planned features:

- Expansion candidate evaluation (distance, source count, hostile presence)
- Claim creep spawning and routing
- Bootstrap support for newly claimed rooms
- GCL level tracking and expansion gating

Design considerations:

- When to expand (GCL available, economy stable, defense adequate)
- Which rooms to target (proximity, resources, strategic value)
- How to bootstrap new rooms (send resources from parent room)
- How to handle expansion failures (hostile presence, low resources)

#### Multi-Room Logistics (25%)

**Priority**: High
**Status**: Terminal manager provides foundation, needs enhancement

Current implementation:

- ✅ Terminal-based energy transfers
- ✅ Resource shipping between rooms
- 🔄 Strategic resource routing
- ⏳ Market integration
- ⏳ Automated resource balancing

Needed improvements:

- Automatic mineral/commodity routing to rooms that need them
- Market buy orders for scarce resources
- Market sell orders for excess resources
- Credit management and reserve thresholds

### Pending Features (0%)

#### Power Management (0%)

**Priority**: Medium
**Status**: Not yet started

Planned features:

- Power creep spawning and deployment
- Power bank harvesting
- Power processing and usage
- Power creep skill selection

Design considerations:

- When to create power creeps (power available, economy stable)
- Which skills to prioritize (operator vs commander)
- Power bank scouting and attack coordination
- Power usage strategy (boost vs upgrade)

#### Market Automation (0%)

**Priority**: Medium
**Status**: Not yet started

Planned features:

- Automated buy orders for needed resources
- Automated sell orders for excess resources
- Market price analysis and trend detection
- Credit reserve management

Design considerations:

- Price thresholds for buy/sell orders
- Order expiration and renewal
- Market manipulation detection
- Credit allocation across rooms

#### Intel System (0%)

**Priority**: Medium
**Status**: Not yet started

Planned features:

- Hostile player tracking
- Room ownership history
- Threat level assessment
- Strategic planning data

Design considerations:

- What data to track (ownership, hostile activity, source availability)
- How to store intel (Memory, segments, database)
- How to share intel across rooms/shards
- How to use intel in decision-making

## Blockers

### Critical Blockers

None currently. Phase 4 can continue development independently.

### Non-Critical Issues

1. **Empire Coordination Design**
   - No clear architecture for empire-level decision making
   - Workaround: Room-local decisions, manual coordination

2. **Expansion Logic**
   - Unclear when/where to expand
   - Workaround: Manual room claiming

3. **Market Integration**
   - Market automation not designed yet
   - Workaround: Manual trading via console

## Lessons Learned

### Successful Patterns

1. **Squad-Based Combat**
   - Squad coordination far more effective than individual creeps
   - Simple formations (follow leader) work well
   - Healer:attacker ratio of 1:2 provides good balance

2. **Priority-Based Traffic**
   - Traffic priority system reduces congestion dramatically
   - Position reservation prevents most collisions
   - Simple stuck detection effective

3. **Manager Architecture Scales**
   - Manager pattern from Phase 3 works well for combat and traffic
   - Consistent interface makes testing and debugging easier
   - Clear separation of concerns

### Challenges

1. **Empire-Wide Coordination Complexity**
   - Multi-room decision making significantly more complex than single-room
   - Trade-offs between rooms (which room gets resources) require strategic thinking
   - No clear framework for empire-level priorities yet

2. **Expansion Timing**
   - Difficult to determine optimal expansion timing
   - Too early: strain economy, fail to support new room
   - Too late: waste GCL potential, miss territorial opportunities

3. **Market Dynamics**
   - Market prices highly volatile
   - Difficult to automate trading without price prediction
   - Risk of bad trades without careful logic

## Dependencies

### Prerequisites from Phase 3

- ✅ Terminal management
- ✅ Lab automation (for boosting combat creeps)
- ✅ Remote harvesting (for expansion support)
- ✅ Tower automation (for defense)

### Required for Phase 5

Phase 5 (Multi-Room & Global Management) depends on Phase 4:

- **Colony Management**: Requires expansion logic and multi-room coordination
- **Inter-Shard Communication**: Requires empire coordination framework
- **Global Analytics**: Requires intel system and tracking

## Testing

### Test Coverage

- **Unit Tests**: CombatManager and TrafficManager have basic tests
- **Integration Tests**: Limited testing for multi-room scenarios
- **E2E Tests**: Manual validation in PTR environment

### Test Gaps

- ⚠️ No automated tests for combat scenarios
- ⚠️ No tests for expansion logic (not yet implemented)
- ⚠️ Limited testing for multi-room logistics
- ⚠️ No tests for market automation (not yet implemented)

## Metrics & Monitoring

### Key Performance Indicators

| KPI                       | Target | Current Status         |
| ------------------------- | ------ | ---------------------- |
| Rooms owned               | 2-5    | ⏳ Pending expansion   |
| Combat win rate           | >80%   | ⏳ Not yet measured    |
| Inter-room energy balance | ±10k   | ⏳ Not yet measured    |
| Traffic collision rate    | <5%    | ⏳ Not yet measured    |
| Market profit margin      | >10%   | ⏳ Not yet implemented |

### Current Monitoring

- Manual observation of combat operations
- Memory inspection for traffic manager state
- Console logging for squad status
- Visual inspection of creep movement

## Next Steps

1. **Complete Empire Coordination** - Implement empire-level resource allocation
2. **Implement Expansion Logic** - Automate room claiming and colonization
3. **Enhance Multi-Room Logistics** - Smart resource routing and market integration
4. **Add Power Management** - Power creep operations and power bank harvesting
5. **Begin Market Automation** - Automated trading for resource acquisition
6. **Phase 4 Validation** - Measure KPIs, validate success criteria
7. **Begin Phase 5 Planning** - Colony manager and analytics design

## Related Documentation

- [Strategic Roadmap](../roadmap.md) - Overall phase progression
- [Phase 3: Advanced Economy](phase-3-advanced-economy.md) - Previous phase
- [Phase 5: Multi-Room & Global Management](phase-5-multi-room-global.md) - Next phase
- [TASKS.md](../../../TASKS.md) - Detailed task breakdown for Phase 4
