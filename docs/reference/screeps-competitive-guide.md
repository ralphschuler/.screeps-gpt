# Comprehensive Guide to Developing a Competitive Screeps Bot

> **Reference Material**: This guide provides strategic context for implementing advanced Screeps bot features and validating architectural decisions. It covers game mechanics, optimization strategies, and competitive play patterns.

Screeps is a massively‐multiplayer online real‑time strategy game where code controls every unit and structure. Building a competitive AI means more than simply spawning creeps – it requires careful planning, resource management, and strategies that scale from the moment you spawn your first creep to operating across multiple rooms and even multiple shards. This guide covers every aspect of bot development: creep management, multi‑room expansion, inter‑shard play, market interactions, and advanced optimization techniques.

## 1. Understanding the Screeps Environment

### 1.1 The Tick and CPU

Screeps runs in discrete time steps called **ticks**. Each tick, your bot code executes, and you are charged CPU time. Your CPU limit is determined by your Global Control Level (GCL) and whether you have a subscription; unused CPU accumulates in a bucket up to 10,000, allowing bursts up to 500 CPU for intensive tasks ([docs.screeps.com](https://docs.screeps.com/cpu-limit.html)).

**Key Considerations:**
- Managing CPU usage is critical because expensive operations (pathfinding, empire planning) can starve your bots of execution time
- Track CPU usage per module and operation to identify bottlenecks
- Use the CPU bucket strategically for intensive operations like pathfinding or market analysis
- Consider disabling profiler in production builds to reduce CPU overhead

### 1.2 Control Levels and Structure Limits

Your **Global Control Level (GCL)** controls the total number of rooms you may claim and influences the CPU limit. Each room has its own **Room Controller Level (RCL)**, which governs what structures you can build.

**RCL Progression:**
- **RCL 1-2**: Basic infrastructure (spawns, extensions, containers)
- **RCL 3**: Towers and 10 extensions unlock defense capabilities
- **RCL 4**: Storage enables advanced resource management
- **RCL 5**: Links provide efficient energy transport
- **RCL 6**: Extractors, labs, and terminals unlock mineral processing and trade
- **RCL 7**: Additional structures and factory for commodity production
- **RCL 8**: Maximum structure counts and power spawn capabilities

Understanding these limits guides your expansion strategy – don't plan for a lab when you're still upgrading to RCL 6.

### 1.3 Resources and Economy

**Energy** is the primary resource, harvested from sources and used for spawning, building, and upgrading. **Minerals** become available at RCL 6 with extractors and are essential for:
- **Boosting creeps** with enhanced capabilities
- **Market trading** for economic growth
- **Commodity production** at higher RCLs

The **terminal** (RCL 6+) enables inter-room resource transfers and market trading, forming the backbone of a multi-room economy.

### 1.4 Memory and Persistence

The `Memory` object persists between ticks but counts against your memory limit (2 MB for subscribed players). Efficient memory management is crucial:
- **Avoid storing redundant data** - calculate or cache strategically
- **Clean up dead creeps** and expired data regularly
- **Use memory segments** for large datasets that don't need tick-by-tick access
- **Consider using room properties** for frequently accessed data

## 2. Creep Design & Management

### 2.1 Body Composition

Creep body parts determine capabilities and costs:
- **MOVE**: Enables movement (reduces fatigue)
- **WORK**: Harvesting, building, repairing, upgrading
- **CARRY**: Transporting resources
- **ATTACK/RANGED_ATTACK**: Combat capabilities
- **HEAL**: Repairing other creeps
- **CLAIM**: Claiming and reserving controllers
- **TOUGH**: Additional hit points (place at front of body)

**Design Principles:**
- Balance **MOVE** parts based on terrain (swamp = 5x fatigue)
- For haulers: High CARRY:MOVE ratio (2:1 or 3:1 on roads)
- For workers: Balance WORK and CARRY based on task
- For harvesters: Maximize WORK parts (5 WORK = 1 source fully harvested)
- Consider boosting for expensive operations (remote mining, combat)

### 2.2 Action Pipelines

Creeps can only perform **one primary action per tick**:
- Harvest, build, repair, upgrade, attack, heal, etc.
- Movement and `say()` don't count as primary actions
- Plan creep behavior to maximize actions per tick
- Use `creep.say()` for visual debugging without performance impact

**Efficiency Tips:**
- Position workers next to multiple targets to minimize movement
- Use containers and links to stage resources near work sites
- Implement task queues to optimize creep utilization
- Consider multi-role creeps for flexibility in low-creep scenarios

### 2.3 Role-Based vs. Task-Based Systems

**Role-Based Architecture:**
- Creeps are assigned permanent roles (harvester, upgrader, builder)
- Simple to implement and understand
- Can lead to inefficiency when role demands fluctuate

**Task-Based Architecture:**
- Creeps dynamically select tasks from a priority queue
- More efficient resource utilization (58.8% lower CPU in benchmarks)
- Higher complexity but scales better to large empires
- **Recommended for competitive bots** (default since v0.32.0)

### 2.4 Spawn Queue Management

Efficient spawn management ensures continuous creep production:
- **Priority-based queuing**: Emergency repairs > defense > economy > expansion
- **Body optimization**: Scale creep sizes to room energy capacity
- **Failure handling**: Retry failed spawns or adjust body composition
- **CPU budgeting**: Spawn planning shouldn't consume excessive CPU

## 3. Harvesting & Resource Management

### 3.1 Local Harvesting

**Optimal Local Harvesting:**
- **2 sources per room** provide 3,000 energy per tick (with regeneration)
- **5 WORK parts** fully harvest 1 source (10 energy/tick)
- **Container mining**: Place container next to source for harvester to stand on
- **Link mining**: Transfer energy directly to storage via links (RCL 5+)

**Hauler Optimization:**
- Calculate exact hauler count based on distance and source output
- Use road networks to increase hauler efficiency
- Consider link-based transfer for high-traffic routes

### 3.2 Remote Harvesting

Expanding beyond your owned rooms increases income:
- **Reserved rooms**: Use claim creeps to reserve controllers (prevent decay)
- **Remote miners**: Dedicated harvesters in remote rooms
- **Defender support**: Protect remote operations from hostiles
- **Cost-benefit analysis**: Remote mining is profitable 3-5 rooms away

**Remote Mining Strategy:**
- Choose rooms with low hostile activity
- Establish container infrastructure at remote sources
- Use haulers to transport energy back to owned rooms
- Monitor profitability vs. expansion alternatives

### 3.3 Mineral Processing

At RCL 6, extractors enable mineral harvesting:
- **Mineral deposits** regenerate slowly (every ~50,000 ticks)
- **Labs** produce compounds from base minerals
- **Boosts** provide significant creep enhancements (2x-4x effectiveness)
- **Market value**: Rare minerals and compounds are valuable trade goods

### 3.4 Logistics Infrastructure

**Container Network:**
- Cheap temporary storage (RCL 2+)
- Place near sources, controllers, and construction sites
- Requires periodic repair (500 hits per tick decay)

**Links (RCL 5+):**
- Instant energy transfer across rooms
- High initial cost but zero CPU and creep overhead
- Typical setup: Source links → Storage link → Controller link

**Storage & Terminal (RCL 4+/6+):**
- Central resource repositories
- Terminal enables market trading and inter-room transfers
- Optimize storage placement for minimal creep travel distance

## 4. Base Planning & Layout

### 4.1 Automated Layout Generation

Manual base planning is time-consuming; competitive bots use algorithms:
- **Distance-based placement**: Minimize hauler paths to sources/controller
- **Rampart coverage**: Protect all structures with ramparts
- **Road networks**: Connect sources, controller, and mineral to storage
- **Defense positioning**: Place towers to cover multiple approaches

**Layout Considerations:**
- Plan for all RCL 8 structures from the start
- Leave expansion space for labs and factory
- Consider terrain obstacles (walls, swamps)
- Balance compactness vs. defense in depth

### 4.2 Road Networks

Well-planned roads dramatically improve efficiency:
- **Priority routes**: Sources → Storage → Controller
- **Cost analysis**: Road maintenance vs. creep move cost savings
- **Decay management**: Roads decay slowly (require periodic repair)
- **Remote roads**: Consider roads to remote mining locations

### 4.3 Defense Structures

**Towers (RCL 3+):**
- Autonomous defense and repair capabilities
- Place to maximize coverage of room
- Energy costs: 10 energy per attack/heal at full power
- Range affects effectiveness (damage/heal falloff)

**Ramparts:**
- Protect structures from enemy attacks
- Expensive to maintain at low RCL
- Critical for defending storage and spawn
- Can host defender creeps for combat bonuses

**Walls:**
- Funnel attackers into kill zones
- Combine with ramparts for layered defense
- Balance hits vs. repair costs

### 4.4 Labs and Factory Systems

**Labs (RCL 6+):**
- Produce compounds for boosting and market trading
- Complex reaction chains (base → intermediate → advanced)
- Requires sophisticated resource management
- High value: Boosts are game-changing for combat and efficiency

**Factory (RCL 7+):**
- Produces commodities for market trading
- Requires specific resources and power
- Can be highly profitable with proper management
- Integrates with inter-shard trading strategies

## 5. Pathfinding & CPU Optimization

### 5.1 Path Reuse and Caching

Pathfinding is CPU-intensive:
- **Cache paths** in memory or room properties
- **Reuse paths** until target changes or path becomes invalid
- **Serialize paths**: Store as string representation for minimal memory
- **TTL (Time To Live)**: Expire cached paths periodically

**Implementation:**
```javascript
// Cache path in creep memory
if (!creep.memory.path || creep.memory.pathTarget !== targetId) {
  creep.memory.path = creep.pos.findPathTo(target);
  creep.memory.pathTarget = targetId;
}
creep.moveByPath(creep.memory.path);
```

### 5.2 Cost Matrices

Cost matrices optimize pathfinding:
- **Avoid hostile creeps**: Increase cost of tiles with enemies
- **Prefer roads**: Reduce cost of road tiles
- **Avoid construction sites**: Increase cost to prevent blocking
- **Static obstacles**: Mark walls and structures as impassable

**Performance:**
- Cost matrices are expensive to generate
- Cache room cost matrices and update only when structures change
- Use `PathFinder.search()` with custom cost matrices for complex scenarios

### 5.3 Advanced Pathfinding Strategies

**screeps-cartographer Integration:**
- Provides optimized pathfinding algorithms
- Supports multi-room pathfinding
- Reduces CPU usage significantly
- See issue #555 for integration details

**Movement Patterns:**
- **Swamp avoidance**: Swamps cost 5x fatigue vs. plains (1x) or roads (0.5x)
- **Traffic management**: Coordinate creep movement to prevent congestion
- **Emergency paths**: Use `PathFinder.search()` for urgent rerouting

## 6. Multi-Room Empire Management

### 6.1 Expansion Strategy

**When to Expand:**
- Current rooms are RCL 6+ and energy-positive
- GCL allows additional claimed rooms
- CPU budget supports more room processing
- Suitable target rooms are available (sources, controller position, defensibility)

**Room Selection Criteria:**
- **Source count**: Prefer 2-source rooms
- **Distance to existing rooms**: Closer is cheaper to support
- **Hostile activity**: Avoid heavily contested areas
- **Mineral type**: Diversify mineral portfolio
- **Defensibility**: Natural choke points are valuable

### 6.2 Remote Room Management

**Reserved vs. Claimed:**
- **Reserving**: Cheaper CPU/creep overhead, no structure building
- **Claiming**: Full control, can build defenses and storage
- **Hybrid approach**: Reserve initially, claim if profitable

**Support Infrastructure:**
- **Remote defender patrols**: Protect remote operations
- **Emergency reserves**: Store energy for crisis response
- **Communication**: Share threat intel between rooms

### 6.3 Inter-Room Logistics

**Resource Balancing:**
- **Terminal network**: Transfer resources between rooms
- **Market integration**: Buy scarce resources, sell surpluses
- **Emergency support**: Send energy to rooms under siege
- **Mineral sharing**: Distribute minerals for lab operations

**Terminal Operations:**
- Transfer costs: 0.1 energy per unit per room distance
- Market fees: 5% for direct player trades, 0% for NPC orders
- Automate buy/sell orders based on stockpile levels

## 7. Defense & Combat

### 7.1 Tower Defense

Towers provide autonomous defense:
- **Targeting priorities**: Heal defenders > Attack closest enemy > Attack most dangerous
- **Energy management**: Reserve energy for attacks during siege
- **Range optimization**: Position towers to minimize range penalty
- **Repair duties**: Use excess energy for structure/rampart repair

### 7.2 Creep-Based Defense

**Defender Creeps:**
- Spawn on-demand when hostiles detected
- Balance ATTACK/RANGED_ATTACK/HEAL based on threat
- Use ramparts for combat bonuses and protection
- Coordinate with towers for combined fire

**Advanced Tactics:**
- **Kiting**: Ranged attackers retreat while firing
- **Healing trains**: Multiple healers support front-line attackers
- **Boosted combat**: Use boosts for significant combat advantages

### 7.3 Power Creeps and Advanced Combat

**Power Creeps (GPL 1+):**
- Permanent units that level up over time
- Provide significant bonuses (increased source output, faster construction, etc.)
- Can generate power resources for advanced operations
- Strategic value in both economy and combat

**Offensive Operations:**
- **Raiding**: Target enemy storage for resources
- **Room claiming**: Capture abandoned or weakly defended rooms
- **Harassment**: Disrupt enemy economy and expansion
- Balance offensive investment vs. defensive needs

## 8. Market & Trade

### 8.1 Market Basics

The market enables resource trading between players:
- **Order types**: Buy orders (request resources) and sell orders (offer resources)
- **Order fees**: 5% fee on fulfilled orders (to NPC market)
- **Terminal required**: RCL 6+ to access market
- **Transfer costs**: Energy cost based on distance

### 8.2 Automated Trading

Competitive bots automate market operations:
- **Price monitoring**: Track market prices for all resources
- **Dynamic orders**: Adjust buy/sell prices based on demand
- **Arbitrage**: Buy low in one market, sell high in another
- **Surplus selling**: Automatically sell excess resources
- **Shortage buying**: Purchase critical resources when low

**Trading Strategy:**
- Set buy orders below market price
- Set sell orders above market price
- Cancel unprofitable orders
- Balance immediate needs vs. long-term profit

### 8.3 Commodity Production

Commodities (RCL 7+ with factory) are high-value trade goods:
- **Base commodities**: Produced from common resources
- **Advanced commodities**: Require multiple production steps
- **Market value**: Generally more profitable than raw resources
- **Power integration**: Some commodities require power

## 9. Labs & Boosting

### 9.1 Reaction Chains

Lab reactions produce compounds for boosting:
- **Base minerals**: 7 types (H, O, U, L, K, Z, X)
- **Tier 1 compounds**: Combine two base minerals (e.g., UH, ZK, GH2O)
- **Tier 2 compounds**: Combine T1 compounds with base minerals
- **Tier 3 compounds**: Combine T2 compounds for maximum boost

**Reaction Planning:**
- Plan complete reaction chains from base minerals to target compound
- Optimize lab placement for minimal hauler distance
- Automate resource delivery to labs
- Balance production vs. storage capacity

### 9.2 Boost Logistics

Boosting creeps provides significant advantages:
- **Work boost**: 2x-4x construction/repair/upgrade/harvest rate
- **Move boost**: Reduced fatigue, faster movement
- **Carry boost**: Increased capacity
- **Attack/Ranged/Heal boost**: Enhanced combat effectiveness
- **Tough boost**: Increased damage resistance

**Boost Management:**
- Pre-produce common boosts (work, move, carry)
- Boost high-value creeps (remote miners, combat units)
- Calculate boost ROI (cost vs. benefit)
- Implement boost request system for dynamic boosting

### 9.3 Power Creep Integration

Power creeps enhance lab operations:
- **Operator skills**: Increase lab efficiency and output
- **Economy bonuses**: Reduce energy costs for operations
- **Strategic value**: Long-term investment in bot capabilities

## 10. Inter-Shard Operations

### 10.1 Portal Mechanics

Portals enable inter-shard travel:
- **Portal locations**: Appear randomly in rooms
- **Destination**: Portals lead to specific shards
- **Creep transfer**: Creeps can travel through portals
- **Power creeps**: Can move between shards independently

**Portal Strategy:**
- Scout portal locations and destinations
- Use portals for shard colonization
- Transfer resources via creep carriers
- Monitor portal stability and timing

### 10.2 Cross-Shard Memory

`InterShardMemory` enables communication between shards:
- **Limited size**: 100 KB per shard
- **Use cases**: Coordinate multi-shard strategies, share intel, synchronize operations
- **Format**: JSON strings for structured data
- **Update frequency**: Balance communication needs vs. CPU cost

### 10.3 Multi-Shard Colonization

Operating across shards requires coordination:
- **Shard selection**: Choose shards based on competition level and resources
- **Initial colonization**: Send bootstrap creeps through portals
- **Resource sharing**: Transfer critical resources between shards
- **Threat response**: Coordinate defense across shards
- **Economic integration**: Balance resource production across shards

**Multi-Shard Benefits:**
- Reduced competition (spread across multiple shards)
- Resource diversification
- Risk distribution (shard-specific threats)
- Increased GCL potential (claim rooms on multiple shards)

## 11. Advanced Optimization Techniques

### 11.1 Caching Patterns

Effective caching reduces CPU usage:
- **Room-level caching**: Store frequently accessed room data
- **Global caching**: Cache empire-wide data (market prices, threat intel)
- **Lazy evaluation**: Calculate only when data is accessed
- **Incremental updates**: Update cache partially instead of full recalculation
- **TTL management**: Expire stale cache entries automatically

**Cache Invalidation:**
- Clear cache when underlying data changes
- Use timestamps to track cache age
- Balance staleness vs. CPU cost of updates

### 11.2 Modular Architecture

Well-structured code improves maintainability and CPU efficiency:
- **Separation of concerns**: Divide code into focused modules
- **Dependency injection**: Pass dependencies explicitly for testability
- **Event-driven design**: React to game events rather than polling
- **State machines**: Manage complex behaviors with finite state machines (see XState evaluation #540)

**Benefits:**
- Easier debugging and profiling
- Cleaner code boundaries
- Better testability
- Simplified feature addition

### 11.3 Metrics & Debugging

Comprehensive monitoring enables optimization:
- **CPU profiling**: Track CPU usage per module and function
- **Memory profiling**: Monitor memory usage and growth
- **Performance metrics**: Measure creep efficiency, resource flow, defense effectiveness
- **Visual debugging**: Use `RoomVisual` for in-game visualization (see `creep.say()` #516)

**Monitoring Tools:**
- **screeps-profiler**: CPU profiling for identifying bottlenecks
- **screeps-stats**: Collect and visualize performance metrics
- **Custom dashboards**: Build external dashboards for long-term trends

**Debugging Strategies:**
- Use `console.log()` sparingly (impacts performance)
- Implement log levels (error, warn, info, debug)
- Use `creep.say()` for visual debugging (emoji-based communication)
- Store debug logs in memory segments for post-analysis

## 12. Competitive Bot Development Roadmap

### Phase 1: First Room (RCL 1-3)

**Objectives:**
- Establish basic economy (harvesters, upgraders, builders)
- Build spawn, extensions, and containers
- Implement simple spawn queue
- Basic tower defense

**Success Criteria:**
- Consistent energy income
- Room reaches RCL 3-4
- No creep starvation
- Basic defense against low-level threats

### Phase 2: Single Room Optimization (RCL 4-6)

**Objectives:**
- Optimize harvesting with containers/links
- Implement storage-based economy
- Add mineral harvesting and basic lab operations
- Establish terminal and begin market trading
- Improve spawn queue with priority system

**Success Criteria:**
- Room reaches RCL 6-7
- Storage maintains 100k+ energy buffer
- Basic lab reactions operational
- Market buy/sell orders active

### Phase 3: Multi-Room Empire (RCL 6-8, GCL 2-5)

**Objectives:**
- Implement remote mining operations
- Add 2-3 additional claimed/reserved rooms
- Establish inter-room logistics (terminal network)
- Automated market trading system
- Advanced defense (boosted defenders, coordinated tower+creep defense)

**Success Criteria:**
- 3+ rooms claimed with RCL 6+
- Remote mining operational and profitable
- Market operations generate net positive resources
- Defense repels typical threats without intervention

### Phase 4: Advanced Automation (GCL 5-10)

**Objectives:**
- Full boost production chain
- Automated layout generation for new rooms
- Power creep integration
- Factory commodity production
- Offensive capabilities (raiding, room claiming)

**Success Criteria:**
- 5+ claimed rooms with optimized layouts
- Boost production meets demand
- Power creeps leveled and operational
- Profitable commodity production
- Successful offensive operations

### Phase 5: Multi-Shard Operations (GCL 10+)

**Objectives:**
- Colonize additional shards via portals
- Cross-shard resource sharing
- Inter-shard communication and coordination
- Shard-specific strategies based on competition level
- Advanced market arbitrage across shards

**Success Criteria:**
- Operational presence on 2+ shards
- Cross-shard logistics functional
- Multi-shard strategy coordination
- Competitive ranking on multiple shards

## Conclusion

Building a competitive Screeps bot is a journey from basic automation to sophisticated multi-shard empire management. This guide provides a roadmap for that journey, covering:

- **Fundamentals**: CPU management, room progression, resource economy
- **Core Systems**: Creep design, task management, harvesting optimization
- **Infrastructure**: Base planning, pathfinding, logistics networks
- **Expansion**: Multi-room empires, remote operations, inter-shard colonization
- **Advanced Features**: Market automation, boosting, power creeps, combat
- **Optimization**: Caching, profiling, architecture patterns

Success in Screeps requires balancing immediate needs (surviving, upgrading) with long-term strategy (expansion, optimization, automation). Use this guide as a reference when implementing features, evaluating architectural decisions, and planning your bot's evolution.

## Related Documentation

- [Development Roadmap](../strategy/roadmap.md) - Detailed implementation phases aligned with this guide
- [Task System Architecture](../runtime/task-system.md) - Priority-based task management (recommended)
- [CPU Optimization Strategies](../runtime/operations/cpu-optimization-strategies.md) - CPU budgeting and profiling
- [Creep Roles](../runtime/strategy/creep-roles.md) - Current bot behavior documentation
- [Architecture Alignment](../strategy/architecture.md) - Roadmap integration with codebase

## External Resources

- [Screeps Official Documentation](https://docs.screeps.com/) - Game mechanics and API reference
- [Screeps Quorum](https://github.com/ScreepsQuorum/screeps-quorum) - Open-source competitive bot for architectural inspiration
- [screeps-cartographer](https://www.npmjs.com/package/screeps-cartographer) - Optimized pathfinding library
- [screeps-profiler](https://www.npmjs.com/package/screeps-profiler) - CPU profiling tool

---

**Note**: This guide represents best practices and competitive strategies for Screeps bot development. Actual implementation should be adapted to your bot's current capabilities, available CPU/memory, and strategic priorities.
