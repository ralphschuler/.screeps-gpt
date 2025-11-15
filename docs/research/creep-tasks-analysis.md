# creep-tasks Library Analysis

**Research Date:** November 2025  
**Purpose:** Evaluate creep-tasks task management patterns for integration into .screeps-gpt  
**Repository:** https://github.com/bencbartlett/creep-tasks  
**Version Analyzed:** v1.3.0  
**License:** Unlicense (public domain)

## Executive Summary

The creep-tasks library by Ben Bartlett provides a lightweight, persistent task management system for Screeps creeps. Originally extracted from the Overmind codebase, it encapsulates the "do action X to thing Y until condition Z is met" pattern through a single `creep.task` property. This analysis evaluates whether its architecture and patterns could enhance .screeps-gpt's existing task system.

### Key Findings

- **Persistent Task Objects:** Tasks are stored in creep memory and persist across ticks, eliminating redundant decision-tree logic
- **Prototype-Based API:** Uses Creep.prototype extensions to provide `creep.task`, `creep.isIdle`, and `creep.run()` properties
- **Task Chaining:** Parent-child task relationships enable complex multi-step operations through `task.fork()` and `Tasks.chain()`
- **Target Caching:** Global target registry tracks which creeps are targeting each object for load balancing
- **Validation Model:** Dual validation with `isValidTask()` and `isValidTarget()` checked each tick
- **Memory Efficiency:** Lightweight serialization through `protoTask` format stores only essential data

### Integration Recommendation: **PARTIAL ADOPTION**

**Rationale:**

- Current .screeps-gpt task system already implements core concepts (TaskRequest, TaskAction, TaskPrerequisite)
- Task chaining and parent-child relationships would add valuable composition capabilities
- Prototype-based API conflicts with TypeScript-first, explicit architecture philosophy
- Target caching mechanism provides useful load balancing that current system lacks
- Integration complexity is moderate; patterns can be adapted without full library adoption

**Recommended Approach:**  
Adopt specific patterns (task chaining, target tracking) while maintaining current architecture rather than full library integration.

## Core Architecture

### 1. Task Abstraction Pattern

**Architecture Overview:**

creep-tasks implements a single abstract `Task` class that all task types extend. Each task encapsulates:

1. **Target Reference:** Stored as `{ref: string, _pos: protoPos}` to handle vision loss
2. **Validation Logic:** `isValidTask()` checks creep state, `isValidTarget()` checks target state
3. **Movement Logic:** `moveToTarget()` handles pathfinding with configurable range
4. **Work Logic:** `work()` performs the actual creep action (harvest, build, transfer, etc.)
5. **Parent Reference:** Optional parent task to return to upon completion

**Code Example:**

```typescript
export abstract class Task {
  name: string;
  _target: { ref: string; _pos: protoPos };
  _parent: protoTask | null;
  settings: TaskSettings; // targetRange, workOffRoad, oneShot
  options: TaskOptions; // blind, nextPos, moveOptions

  abstract isValidTask(): boolean;
  abstract isValidTarget(): boolean;
  abstract work(): number;

  run(): number | undefined {
    if (this.creep.pos.inRangeTo(this.targetPos, this.settings.targetRange)) {
      let result = this.work();
      if (this.settings.oneShot && result == OK) {
        this.finish();
      }
      return result;
    } else {
      this.moveToTarget();
    }
  }
}
```

**Concrete Implementation - TaskHarvest:**

```typescript
export class TaskHarvest extends Task {
  static taskName = "harvest";
  target: Source | Mineral;

  constructor(target: Source | Mineral, options = {} as TaskOptions) {
    super(TaskHarvest.taskName, target, options);
  }

  isValidTask() {
    return _.sum(this.creep.carry) < this.creep.carryCapacity;
  }

  isValidTarget() {
    return isSource(this.target) ? this.target.energy > 0 : this.target.mineralAmount > 0;
  }

  work() {
    return this.creep.harvest(this.target);
  }
}
```

**Current .screeps-gpt Architecture:**

```typescript
// TaskAction.ts - Base action class
export abstract class TaskAction {
  public abstract prereqs: TaskPrerequisite[];
  public abstract action(creep: Creep): boolean;

  protected moveToTarget(creep: Creep, target: RoomPosition | { pos: RoomPosition }, range = 1): void {
    // Movement logic with pathfinding manager support
  }
}

// HarvestAction.ts - Concrete action
export class HarvestAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private sourceId: Id<Source>;

  constructor(sourceId: Id<Source>) {
    this.prereqs = [new MinionHasFreeCapacity(), new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public action(creep: Creep): boolean {
    const source = Game.getObjectById(this.sourceId);
    if (!source) return true;

    const result = creep.harvest(source);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, source, 1);
      return false;
    }
    return result === OK ? creep.store.getFreeCapacity() === 0 : true;
  }
}
```

**Integration Potential:** ⭐⭐⭐ (Medium)

**Comparison:**

| Feature            | creep-tasks                        | .screeps-gpt                  |
| ------------------ | ---------------------------------- | ----------------------------- |
| **Validation**     | Dual validation (task + target)    | Prerequisite-based validation |
| **Execution**      | Integrated move + work in run()    | Separate movement in action() |
| **Completion**     | Returns boolean from work()        | Returns boolean from action() |
| **Target Storage** | Reference string + cached position | Object ID only                |
| **Memory**         | Stored in creep.memory.task        | Stored in creep.memory.taskId |

**Compatibility Assessment:**

- **Aligned:** Both use abstract base classes with concrete implementations
- **Divergent:** creep-tasks combines movement and execution; .screeps-gpt separates them
- **Gap:** Current system lacks dual validation pattern (task vs. target)

**Recommendations:**

1. **Adopt dual validation:** Add `isValidTarget()` concept to TaskAction
2. **Keep separation:** Maintain explicit separation between movement and action for clarity
3. **Target caching:** Store target position alongside ID to handle vision loss
4. **Completion signals:** Use boolean returns to indicate task completion status

### 2. Task Chaining & Composition

**Pattern Description:**

creep-tasks supports two composition mechanisms:

1. **Parent-Child Relationships:** Each task can have a parent task to return to upon completion
2. **Task Chaining:** `Tasks.chain()` transforms a list of tasks into a linked structure
3. **Forking:** `task.fork(newTask)` creates a subtask with current task as parent

**Code Example:**

```typescript
// Parent-child relationship
class Task {
  _parent: protoTask | null;

  get parent(): Task | null {
    return this._parent ? initializeTask(this._parent) : null;
  }

  set parent(parentTask: Task | null) {
    this._parent = parentTask ? parentTask.proto : null;
  }

  fork(newTask: Task): Task {
    newTask.parent = this;
    if (this.creep) {
      this.creep.task = newTask;
    }
    return newTask;
  }

  finish(): void {
    this.moveToNextPos();
    if (this.creep) {
      this.creep.task = this.parent; // Switch to parent task
    }
  }
}

// Task chaining utility
class Tasks {
  static chain(tasks: ITask[], setNextPos = true): ITask | null {
    if (tasks.length == 0) return null;

    // Optionally link positions for smooth transitions
    if (setNextPos) {
      for (let i = 0; i < tasks.length - 1; i++) {
        tasks[i].options.nextPos = tasks[i + 1].targetPos;
      }
    }

    // Build chain from end to start
    let task = _.last(tasks);
    tasks = _.dropRight(tasks);
    for (let i = tasks.length - 1; i >= 0; i--) {
      task = task.fork(tasks[i]);
    }
    return task;
  }
}
```

**Usage Example:**

```typescript
// Create a complex multi-step task
let harvestTask = Tasks.harvest(source);
let transferTask = Tasks.transfer(spawn);
let upgradeTask = Tasks.upgrade(controller);

// Chain them together
creep.task = Tasks.chain([harvestTask, transferTask, upgradeTask]);

// Or fork tasks dynamically
let mainTask = Tasks.upgrade(controller);
let subtask = Tasks.harvest(source);
creep.task = mainTask.fork(subtask); // Harvest first, then upgrade
```

**Current .screeps-gpt Architecture:**

```typescript
// TaskRequest.ts - Task with prerequisites
export class TaskRequest {
  public id: string;
  public task: TaskAction;
  public status: TaskStatus;
  public priority: number;
  public assignedCreep?: Id<Creep>;

  // Subtask generation from prerequisites
  public getPrerequisiteSubtasks(creep: Creep): TaskAction[] {
    const subtasks: TaskAction[] = [];
    for (const prereq of this.task.prereqs) {
      if (!prereq.meets(creep)) {
        const prereqTasks = prereq.toMeet(creep);
        subtasks.push(...prereqTasks);
      }
    }
    return subtasks;
  }
}

// TaskPrerequisite.ts - Prerequisites can generate subtasks
export abstract class TaskPrerequisite {
  public abstract meets(creep: Creep): boolean;
  public abstract toMeet(creep: Creep): TaskAction[];
}
```

**Integration Potential:** ⭐⭐⭐⭐⭐ (Very High)

**Compatibility Assessment:**

- **Gap:** Current system has prerequisite subtask generation but no parent-child chaining
- **Opportunity:** Task chaining would enable complex multi-step behaviors without role logic
- **Aligned:** `getPrerequisiteSubtasks()` shows foundation for subtask relationships

**Recommendations:**

1. **Add parent field to TaskRequest:** Store parent task reference for completion chaining
2. **Implement TaskChain utility:** Create `TaskChain.chain(tasks: TaskRequest[])` helper
3. **Automatic prerequisite chaining:** Convert prerequisite subtasks into chained tasks
4. **Completion callback:** Add `onComplete` handler to transition to parent task
5. **Example use case:** Harvest → Transfer → Upgrade chain for upgrader role

**Proposed Implementation:**

```typescript
// Enhanced TaskRequest with chaining
export class TaskRequest {
  public parent?: TaskRequest; // Add parent reference
  public nextPos?: RoomPosition; // For smooth transitions

  public chain(nextTask: TaskRequest): TaskRequest {
    nextTask.parent = this;
    return nextTask;
  }

  public execute(creep: Creep): boolean {
    const complete = this.task.action(creep);
    if (complete) {
      this.status = "COMPLETE";
      // Transition to parent task if exists
      if (this.parent) {
        creep.memory.taskId = this.parent.id;
        return false; // Continue with parent
      }
    }
    return complete;
  }
}

// Chaining utility
export class TaskChain {
  static chain(tasks: TaskRequest[]): TaskRequest | null {
    if (tasks.length === 0) return null;

    // Link tasks from end to start
    for (let i = tasks.length - 1; i > 0; i--) {
      tasks[i - 1].chain(tasks[i]);
      tasks[i - 1].nextPos = tasks[i].task.getTargetPos();
    }

    return tasks[0];
  }
}
```

### 3. Prototype-Based API

**Pattern Description:**

creep-tasks extends Creep.prototype to add task-related properties and methods:

```typescript
// Creep.prototype extensions
Object.defineProperty(Creep.prototype, "task", {
  get() {
    if (!this._task) {
      let protoTask = this.memory.task;
      this._task = protoTask ? initializeTask(protoTask) : null;
    }
    return this._task;
  },
  set(task: ITask | null) {
    // Update target cache
    TargetCache.assert();
    // Unregister old target
    let oldProtoTask = this.memory.task;
    if (oldProtoTask) {
      let oldRef = oldProtoTask._target.ref;
      if (Game.TargetCache.targets[oldRef]) {
        _.remove(Game.TargetCache.targets[oldRef], name => name == this.name);
      }
    }
    // Set new task
    this.memory.task = task ? task.proto : null;
    if (task) {
      // Register new target
      if (task.target) {
        if (!Game.TargetCache.targets[task.target.ref]) {
          Game.TargetCache.targets[task.target.ref] = [];
        }
        Game.TargetCache.targets[task.target.ref].push(this.name);
      }
      task.creep = this;
    }
    this._task = null;
  }
});

Creep.prototype.run = function (): void {
  if (this.task) {
    return this.task.run();
  }
};

Object.defineProperties(Creep.prototype, {
  hasValidTask: {
    get() {
      return this.task && this.task.isValid();
    }
  },
  isIdle: {
    get() {
      return !this.hasValidTask;
    }
  }
});
```

**Usage Example:**

```typescript
// Simple, clean API
for (let creep of harvesters) {
  if (creep.isIdle) {
    RoleHarvester.newTask(creep);
  }
  creep.run();
}
```

**Current .screeps-gpt Architecture:**

```typescript
// TaskManager.ts - Explicit task management
export class TaskManager {
  private tasks: Map<string, TaskRequest> = new Map();

  public assignTasks(creeps: Creep[]): void {
    const idleCreeps = creeps.filter(c => !c.memory.taskId || !this.tasks.get(c.memory.taskId));
    for (const creep of idleCreeps) {
      const task = this.findBestTask(creep);
      if (task?.assign(creep)) {
        creep.memory.taskId = task.id;
      }
    }
  }

  public executeTasks(creeps: Creep[], cpuLimit: number): Record<string, number> {
    for (const creep of creeps) {
      const taskId = creep.memory.taskId;
      if (!taskId) continue;

      const task = this.tasks.get(taskId);
      if (!task) {
        delete creep.memory.taskId;
        continue;
      }

      const complete = task.execute(creep);
      if (complete) {
        delete creep.memory.taskId;
        this.tasks.delete(taskId);
      }
    }
  }
}
```

**Integration Potential:** ⭐⭐ (Low)

**Compatibility Assessment:**

- **Conflict:** Prototype extensions conflict with TypeScript-first, explicit architecture
- **Maintainability:** Prototype pollution can make debugging harder
- **Type Safety:** Requires declaration merging and careful TypeScript configuration
- **Architecture:** Current system favors explicit TaskManager over implicit prototype methods

**Recommendations:**

1. **Do NOT adopt prototype extensions:** Maintain explicit TaskManager architecture
2. **Keep type safety:** Current approach has better TypeScript integration
3. **Consider helper methods:** Add `TaskManager.isIdle(creep)` for similar ergonomics
4. **Maintain separation:** Keep task management logic in TaskManager, not Creep

### 4. Target Caching System

**Pattern Description:**

creep-tasks implements a global target cache that tracks which creeps are targeting each object. This enables:

1. **Load balancing:** Avoid multiple creeps targeting the same resource
2. **Efficient queries:** `source.targetedBy` returns all creeps targeting that source
3. **Automatic cleanup:** Cache updates when tasks are reassigned

**Code Example:**

```typescript
// TargetCache.ts
export class TargetCache {
  targets: { [ref: string]: string[] }; // targetId -> creepNames[]
  tick: number;

  private cacheTargets() {
    this.targets = {};
    for (let creepName in Game.creeps) {
      let creep = Game.creeps[creepName];
      let task = creep.memory.task;

      // Walk the task chain
      while (task) {
        if (!this.targets[task._target.ref]) {
          this.targets[task._target.ref] = [];
        }
        this.targets[task._target.ref].push(creep.name);
        task = task._parent;
      }
    }
  }

  static assert() {
    if (!(Game.TargetCache && Game.TargetCache.tick == Game.time)) {
      Game.TargetCache = new TargetCache();
      Game.TargetCache.build();
    }
  }
}

// RoomObject.prototype extension
Object.defineProperty(RoomObject.prototype, "targetedBy", {
  get: function () {
    TargetCache.assert();
    return _.map(Game.TargetCache.targets[this.ref], name => Game.creeps[name]);
  }
});
```

**Usage Example:**

```typescript
// Load balancing example
static newTask(creep: Creep): void {
  if (creep.carry.energy < creep.carryCapacity) {
    let sources = creep.room.find(FIND_SOURCES);

    // Prefer unattended sources
    let unattendedSource = _.filter(sources,
      source => source.targetedBy.length == 0)[0];

    if (unattendedSource) {
      creep.task = Tasks.harvest(unattendedSource);
    } else {
      // Fall back to least-targeted source
      let leastTargeted = _.sortBy(sources,
        s => s.targetedBy.length)[0];
      creep.task = Tasks.harvest(leastTargeted);
    }
  }
}
```

**Current .screeps-gpt Architecture:**

```typescript
// TaskManager.ts - Closest creep assignment without load tracking
private findBestTask(creep: Creep): TaskRequest | null {
  const availableTasks = Array.from(this.tasks.values())
    .filter(t => t.status === "PENDING")
    .sort((a, b) => b.priority - a.priority);

  for (const task of availableTasks) {
    if (task.canAssign(creep)) {
      return task;
    }
  }
  return null;
}
```

**Integration Potential:** ⭐⭐⭐⭐⭐ (Very High)

**Compatibility Assessment:**

- **Gap:** Current system lacks target tracking for load balancing
- **High Value:** Target caching would prevent resource contention
- **Implementable:** Can add without major architectural changes
- **Performance:** One-time cache build per tick is CPU-efficient

**Recommendations:**

1. **Implement TargetTracker class:** Create explicit tracking system (not prototype-based)
2. **Track task assignments:** Update tracker when tasks are assigned/completed
3. **Load balancing in task generation:** Prefer unassigned targets when creating harvest/build tasks
4. **Helper methods:** Add `TaskManager.getTargetLoad(targetId)` for queries
5. **Memory efficiency:** Store only in heap (Game object), not Memory

**Proposed Implementation:**

```typescript
// TargetTracker.ts
export class TargetTracker {
  private targets: Map<string, Set<string>> = new Map(); // targetId -> creepNames
  private lastUpdate: number = 0;

  public update(creeps: Creep[], tasks: Map<string, TaskRequest>): void {
    if (this.lastUpdate === Game.time) return;

    this.targets.clear();
    for (const creep of creeps) {
      const taskId = creep.memory.taskId;
      if (!taskId) continue;

      const task = tasks.get(taskId);
      if (!task) continue;

      const targetId = task.task.getTargetId?.();
      if (!targetId) continue;

      if (!this.targets.has(targetId)) {
        this.targets.set(targetId, new Set());
      }
      this.targets.get(targetId)!.add(creep.name);
    }

    this.lastUpdate = Game.time;
  }

  public getTargetLoad(targetId: string): number {
    return this.targets.get(targetId)?.size ?? 0;
  }

  public getTargetedCreeps(targetId: string): Creep[] {
    const names = this.targets.get(targetId);
    if (!names) return [];
    return Array.from(names)
      .map(name => Game.creeps[name])
      .filter(Boolean);
  }
}

// TaskManager integration
export class TaskManager {
  private targetTracker = new TargetTracker();

  public generateHarvestTasks(room: Room): void {
    const sources = room.find(FIND_SOURCES_ACTIVE);

    for (const source of sources) {
      // Check load on this source
      const currentLoad = this.targetTracker.getTargetLoad(source.id);

      // Only create task if not overcrowded (max 2 creeps per source)
      if (currentLoad < 2) {
        const existingTask = Array.from(this.tasks.values()).find(
          t => t.status !== "COMPLETE" && t.task instanceof HarvestAction && t.task.getTargetId() === source.id
        );

        if (!existingTask) {
          const task = new HarvestAction(source.id);
          const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.NORMAL);
          this.tasks.set(request.id, request);
        }
      }
    }
  }

  public executeTasks(creeps: Creep[], cpuLimit: number): Record<string, number> {
    // Update tracker before execution
    this.targetTracker.update(creeps, this.tasks);

    // ... existing execution logic
  }
}
```

### 5. Memory Serialization

**Pattern Description:**

creep-tasks uses a lightweight `protoTask` format for memory serialization:

```typescript
interface protoTask {
  name: string; // Task type name
  _creep: { name: string }; // Creep reference
  _target: {
    ref: string; // Target ID or name
    _pos: protoPos; // Cached position
  };
  _parent: protoTask | null; // Parent task (recursive)
  options: TaskOptions; // Configuration
  data: TaskData; // Task-specific data
  tick: number; // Creation time
}

interface protoPos {
  x: number;
  y: number;
  roomName: string;
}
```

**Serialization/Deserialization:**

```typescript
class Task {
  // Serialize to memory-safe format
  get proto(): protoTask {
    return {
      name: this.name,
      _creep: this._creep,
      _target: this._target,
      _parent: this._parent,
      options: this.options,
      data: this.data,
      tick: this.tick
    };
  }

  // Restore from memory
  set proto(protoTask: protoTask) {
    this._creep = protoTask._creep;
    this._target = protoTask._target;
    this._parent = protoTask._parent;
    this.options = protoTask.options;
    this.data = protoTask.data;
    this.tick = protoTask.tick;
  }
}

// Initialization from memory
function initializeTask(protoTask: protoTask): Task {
  let taskName = protoTask.name;
  let target = deref(protoTask._target.ref);
  let task: Task;

  // Create task instance based on name
  switch (taskName) {
    case TaskHarvest.taskName:
      task = new TaskHarvest(target as Source);
      break;
    // ... other task types
  }

  // Restore state from proto
  task.proto = protoTask;
  return task;
}
```

**Current .screeps-gpt Architecture:**

```typescript
// TaskRequest stored in manager, only ID in creep memory
interface CreepMemory {
  taskId?: string; // Only store task ID
  role?: string;
  version?: number;
}

export class TaskManager {
  private tasks: Map<string, TaskRequest> = new Map(); // In-heap storage

  public executeTasks(creeps: Creep[]): Record<string, number> {
    for (const creep of creeps) {
      const taskId = creep.memory.taskId;
      if (!taskId) continue;

      const task = this.tasks.get(taskId); // Look up from heap
      if (!task) {
        delete creep.memory.taskId; // Clean up invalid reference
        continue;
      }
      // ... execute task
    }
  }
}
```

**Integration Potential:** ⭐⭐ (Low)

**Comparison:**

| Aspect               | creep-tasks             | .screeps-gpt             |
| -------------------- | ----------------------- | ------------------------ |
| **Storage Location** | Creep.memory.task       | TaskManager.tasks (heap) |
| **Memory Size**      | ~100-200 bytes per task | ~10 bytes (just ID)      |
| **Persistence**      | Survives code reload    | Lost on code reload      |
| **Flexibility**      | Task travels with creep | Task managed centrally   |
| **Lookup Cost**      | Deserialize from memory | Map lookup (O(1))        |

**Compatibility Assessment:**

- **Trade-offs:** creep-tasks prioritizes persistence; .screeps-gpt prioritizes memory efficiency
- **Current approach:** Heap storage is valid for stateless task system
- **Consideration:** Persistent tasks would help with code reload scenarios

**Recommendations:**

1. **Keep current approach for task generation:** Central TaskManager with heap storage
2. **Consider hybrid model:** Store task state in creep memory only for long-running tasks
3. **Add task serialization:** Implement `toProto()` / `fromProto()` for persistence support
4. **Use case:** Enable task persistence for multi-tick operations (remote mining, hauling)

**Optional Enhancement:**

```typescript
// Add serialization support to TaskAction
export abstract class TaskAction {
  public abstract toProto(): TaskProto;
  public abstract fromProto(proto: TaskProto): void;
}

// Example: HarvestAction with serialization
export class HarvestAction extends TaskAction {
  private sourceId: Id<Source>;

  public toProto(): TaskProto {
    return {
      type: "harvest",
      targetId: this.sourceId,
      targetPos: Game.getObjectById(this.sourceId)?.pos
    };
  }

  public static fromProto(proto: TaskProto): HarvestAction {
    return new HarvestAction(proto.targetId as Id<Source>);
  }
}

// TaskManager: Persist long-running tasks
export class TaskManager {
  public executeTasks(creeps: Creep[]): void {
    for (const creep of creeps) {
      let task: TaskRequest | undefined;

      // Try heap first
      if (creep.memory.taskId) {
        task = this.tasks.get(creep.memory.taskId);
      }

      // Fall back to memory if heap lookup fails (code reload scenario)
      if (!task && creep.memory.persistedTask) {
        const action = TaskAction.fromProto(creep.memory.persistedTask);
        task = new TaskRequest(this.getNextTaskId(), action, TaskPriority.NORMAL);
        this.tasks.set(task.id, task);
        creep.memory.taskId = task.id;
        delete creep.memory.persistedTask;
      }

      // ... execute task
    }
  }
}
```

### 6. Task Settings & Options

**Pattern Description:**

creep-tasks separates task configuration into two layers:

1. **TaskSettings:** Default behavior for task type (applies to all instances)
2. **TaskOptions:** Per-instance customization (applies to specific task)

```typescript
interface TaskSettings {
  targetRange: number; // Range at which work() can be performed
  workOffRoad: boolean; // Should creep move off road to work?
  oneShot: boolean; // Complete task after single successful work() call?
}

interface TaskOptions {
  blind?: boolean; // Allow targeting objects in unobserved rooms?
  nextPos?: protoPos; // Position to move to after task completion
  moveOptions?: MoveToOpts; // Custom pathfinding options
}

class Task {
  settings: TaskSettings = {
    targetRange: 1,
    workOffRoad: false,
    oneShot: false
  };
  options: TaskOptions;

  constructor(taskName: string, target: targetType, options = {} as TaskOptions) {
    this.options = _.defaults(options, {
      blind: false,
      moveOptions: {}
    });
  }
}
```

**Usage Examples:**

```typescript
// Default behavior
creep.task = Tasks.harvest(source);

// Custom options
creep.task = Tasks.harvest(source, {
  blind: true, // Allow harvesting in unobserved room
  nextPos: controller.pos, // Move to controller after harvest
  moveOptions: {
    reusePath: 10,
    ignoreCreeps: true
  }
});

// Task-specific settings (in TaskUpgrade constructor)
class TaskUpgrade extends Task {
  constructor(target: StructureController, options = {} as TaskOptions) {
    super(TaskUpgrade.taskName, target, options);
    this.settings.targetRange = 3; // Can upgrade from range 3
    this.settings.workOffRoad = true; // Move off roads when upgrading
  }
}

// OneShot tasks (TaskTransfer)
class TaskTransfer extends Task {
  constructor(
    target: transferTargetType,
    resourceType: ResourceConstant,
    amount?: number,
    options = {} as TaskOptions
  ) {
    super(TaskTransfer.taskName, target, options);
    this.settings.oneShot = true; // Complete after single transfer
    this.data.resourceType = resourceType;
    this.data.amount = amount;
  }
}
```

**Current .screeps-gpt Architecture:**

```typescript
// TaskAction - No explicit settings/options pattern
export abstract class TaskAction {
  protected pathfindingManager?: PathfindingManager;

  public setPathfindingManager(manager: PathfindingManager): void {
    this.pathfindingManager = manager;
  }

  protected moveToTarget(creep: Creep, target: RoomPosition | { pos: RoomPosition }, range = 1): void {
    const targetPos = target instanceof RoomPosition ? target : target.pos;
    if (creep.pos.getRangeTo(targetPos) > range) {
      if (this.pathfindingManager) {
        this.pathfindingManager.moveTo(creep, targetPos, { range, reusePath: 5 });
      } else {
        creep.moveTo(targetPos, { range, reusePath: 5 });
      }
    }
  }
}

// Example: UpgradeAction - Hardcoded range
export class UpgradeAction extends TaskAction {
  public action(creep: Creep): boolean {
    const controller = Game.getObjectById(this.controllerId);
    if (!controller) return true;

    const result = creep.upgradeController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, controller, 3); // Hardcoded range
      return false;
    }
    // ... rest of logic
  }
}
```

**Integration Potential:** ⭐⭐⭐⭐ (High)

**Compatibility Assessment:**

- **Gap:** Current system lacks explicit configuration patterns
- **Inconsistency:** Ranges and options are hardcoded in action implementations
- **Opportunity:** Settings/options pattern would improve maintainability and flexibility

**Recommendations:**

1. **Add TaskSettings interface:** Define default behavior for each action type
2. **Add TaskOptions parameter:** Support per-instance customization
3. **Standardize ranges:** Move hardcoded values (range 1, 3) to settings
4. **Support blind mode:** Enable targeting objects in unobserved rooms
5. **NextPos support:** For task chaining integration

**Proposed Implementation:**

```typescript
// TaskSettings.ts
export interface TaskSettings {
  targetRange: number; // Range at which action can be performed
  workOffRoad?: boolean; // Move off roads while working
  oneShot?: boolean; // Complete after single successful action
}

export interface TaskOptions {
  blind?: boolean; // Allow targeting unobserved objects
  nextPos?: RoomPosition; // Position to move to after completion
  moveOptions?: MoveToOpts; // Custom pathfinding options
}

// Enhanced TaskAction
export abstract class TaskAction {
  public abstract prereqs: TaskPrerequisite[];
  protected settings: TaskSettings;
  protected options: TaskOptions;
  protected pathfindingManager?: PathfindingManager;

  constructor(settings: Partial<TaskSettings> = {}, options: TaskOptions = {}) {
    this.settings = {
      targetRange: 1,
      workOffRoad: false,
      oneShot: false,
      ...settings
    };
    this.options = {
      blind: false,
      moveOptions: {},
      ...options
    };
  }

  public abstract action(creep: Creep): boolean;

  protected moveToTarget(creep: Creep, target: RoomPosition | { pos: RoomPosition }): void {
    const targetPos = target instanceof RoomPosition ? target : target.pos;
    const range = this.settings.targetRange;

    if (creep.pos.getRangeTo(targetPos) > range) {
      if (this.pathfindingManager) {
        this.pathfindingManager.moveTo(creep, targetPos, {
          range,
          ...this.options.moveOptions
        });
      } else {
        creep.moveTo(targetPos, { range, ...this.options.moveOptions });
      }
    }
  }
}

// Example: UpgradeAction with settings
export class UpgradeAction extends TaskAction {
  private controllerId: Id<StructureController>;

  constructor(controllerId: Id<StructureController>, options: TaskOptions = {}) {
    super(
      {
        targetRange: 3, // Upgrade range is 3
        workOffRoad: true // Prefer working off roads
      },
      options
    );

    this.controllerId = controllerId;
    this.prereqs = [new MinionHasEnergy(), new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public action(creep: Creep): boolean {
    const controller = Game.getObjectById(this.controllerId);
    if (!controller) return true;

    const result = creep.upgradeController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, controller); // Uses settings.targetRange
      return false;
    }

    if (result === OK) {
      return creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0;
    }

    return true;
  }
}

// Example: TransferAction with oneShot
export class TransferAction extends TaskAction {
  private targetId: Id<AnyStoreStructure>;
  private resourceType: ResourceConstant;

  constructor(
    targetId: Id<AnyStoreStructure>,
    resourceType: ResourceConstant = RESOURCE_ENERGY,
    options: TaskOptions = {}
  ) {
    super(
      {
        targetRange: 1,
        oneShot: true // Complete after single transfer
      },
      options
    );

    this.targetId = targetId;
    this.resourceType = resourceType;
    this.prereqs = [new MinionHasBodyParts({ [CARRY]: 1 })];

    if (resourceType === RESOURCE_ENERGY) {
      this.prereqs.push(new MinionHasEnergy());
    }
  }

  public action(creep: Creep): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target || target.store.getFreeCapacity(this.resourceType) === 0) {
      return true;
    }

    const result = creep.transfer(target, this.resourceType);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, target);
      return false;
    }

    // If oneShot, complete immediately on success
    if (this.settings.oneShot && result === OK) {
      return true;
    }

    // Otherwise, continue until empty
    return result === OK ? creep.store.getUsedCapacity(this.resourceType) === 0 : true;
  }
}
```

## Comparison with Current System

### Architecture Comparison

| Feature             | creep-tasks                                                | .screeps-gpt                                 |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| **Task Storage**    | Creep memory (`creep.memory.task`)                         | TaskManager heap (`tasks: Map<>`)            |
| **Assignment**      | Direct property set (`creep.task = Tasks.harvest(source)`) | Manager-based (`taskManager.assignTasks()`)  |
| **Execution**       | Prototype method (`creep.run()`)                           | Manager-based (`taskManager.executeTasks()`) |
| **Validation**      | Dual (task + target)                                       | Prerequisite-based                           |
| **Chaining**        | Built-in parent/child                                      | Prerequisites can generate subtasks          |
| **Target Tracking** | Global cache (`source.targetedBy`)                         | None                                         |
| **API Style**       | Prototype-based, implicit                                  | Class-based, explicit                        |
| **Memory Overhead** | ~150 bytes per task                                        | ~10 bytes per creep                          |
| **Persistence**     | Survives code reload                                       | Lost on reload                               |

### Pattern Adoption Priority

Based on analysis, recommended adoption priority:

1. **⭐⭐⭐⭐⭐ High Priority: Target Tracking System**
   - **Value:** Prevents resource contention, enables load balancing
   - **Complexity:** Low - can be implemented without disrupting current architecture
   - **Impact:** Immediate improvement to task distribution efficiency

2. **⭐⭐⭐⭐⭐ High Priority: Task Chaining**
   - **Value:** Enables complex multi-step behaviors without role-specific logic
   - **Complexity:** Medium - requires adding parent field and completion handlers
   - **Impact:** Simplifies role implementations, reduces decision tree complexity

3. **⭐⭐⭐⭐ Medium Priority: Settings & Options Pattern**
   - **Value:** Standardizes configuration, improves maintainability
   - **Complexity:** Low - refactoring existing actions
   - **Impact:** Better code organization, easier customization

4. **⭐⭐⭐ Low Priority: Dual Validation (Task + Target)**
   - **Value:** Separates concerns (can creep do this? is target still valid?)
   - **Complexity:** Low - split current validation logic
   - **Impact:** Clearer validation logic, better error handling

5. **⭐⭐ Very Low Priority: Memory Serialization**
   - **Value:** Task persistence across code reloads
   - **Complexity:** Medium - requires serialization/deserialization
   - **Impact:** Helpful for long-running tasks, not critical for current use cases

6. **⭐ Not Recommended: Prototype-Based API**
   - **Reason:** Conflicts with TypeScript-first, explicit architecture
   - **Alternative:** Keep explicit TaskManager for better type safety and debugging

### Integration Challenges

1. **Architectural Consistency:**
   - Current system uses explicit manager pattern
   - creep-tasks uses implicit prototype-based pattern
   - **Solution:** Adapt patterns to fit explicit architecture

2. **Prerequisite System:**
   - Current system has rich prerequisite validation
   - creep-tasks has simpler isValidTask/isValidTarget
   - **Solution:** Keep prerequisites, add isValidTarget() for target checks

3. **Task Generation:**
   - Current system generates tasks proactively in TaskManager
   - creep-tasks assigns tasks reactively in role logic
   - **Solution:** Keep proactive generation, use chaining for multi-step tasks

4. **Memory Management:**
   - Current system minimizes memory usage
   - creep-tasks stores full task state in memory
   - **Solution:** Hybrid approach - heap for active tasks, memory for persistence

## Integration Roadmap

### Phase 1: Target Tracking (Sprint 1)

**Goal:** Implement target tracking system for load balancing

**Tasks:**

1. Create `TargetTracker` class
2. Update `TaskManager` to track target assignments
3. Modify `generateHarvestTasks()` to check target load
4. Add helper methods: `getTargetLoad()`, `getTargetedCreeps()`
5. Add unit tests for target tracking

**Estimated Effort:** 2-3 days  
**Risk:** Low  
**Dependencies:** None

### Phase 2: Task Chaining (Sprint 1-2)

**Goal:** Enable parent-child task relationships

**Tasks:**

1. Add `parent` field to `TaskRequest`
2. Implement `chain()` method on `TaskRequest`
3. Create `TaskChain` utility class with `chain()` helper
4. Update `execute()` to handle parent transitions
5. Add `nextPos` support for smooth transitions
6. Convert prerequisite subtasks to chained tasks
7. Add integration tests for task chains

**Estimated Effort:** 3-4 days  
**Risk:** Medium  
**Dependencies:** None

### Phase 3: Settings & Options (Sprint 2)

**Goal:** Standardize task configuration

**Tasks:**

1. Define `TaskSettings` and `TaskOptions` interfaces
2. Refactor `TaskAction` to use settings/options
3. Update all concrete task actions
4. Add `oneShot` support for immediate completion
5. Add `blind` mode for unobserved targets
6. Update unit tests for all actions

**Estimated Effort:** 2-3 days  
**Risk:** Low  
**Dependencies:** None (can be done in parallel with Phase 2)

### Phase 4: Dual Validation (Sprint 3)

**Goal:** Separate task and target validation

**Tasks:**

1. Add `isValidTarget()` method to `TaskAction`
2. Split current validation logic
3. Update all concrete task actions
4. Enhance `TaskRequest.canAssign()` to check both
5. Update unit tests

**Estimated Effort:** 1-2 days  
**Risk:** Low  
**Dependencies:** Phase 3 (easier with settings in place)

### Phase 5: Optional Persistence (Sprint 4+)

**Goal:** Support task persistence across code reloads

**Tasks:**

1. Add `toProto()` / `fromProto()` methods to `TaskAction`
2. Implement serialization for all task actions
3. Add fallback in `executeTasks()` to restore from memory
4. Add configuration flag to enable/disable persistence
5. Update documentation and examples

**Estimated Effort:** 3-4 days  
**Risk:** Medium  
**Dependencies:** Phase 2 (chaining affects serialization)

## Code Examples

### Example 1: Target Tracking Integration

```typescript
// Using target tracker in task generation
export class TaskManager {
  private targetTracker = new TargetTracker();

  public generateHarvestTasks(room: Room): void {
    const sources = room.find(FIND_SOURCES_ACTIVE);

    for (const source of sources) {
      const currentLoad = this.targetTracker.getTargetLoad(source.id);

      // Prefer unassigned sources, but allow up to 2 creeps per source
      if (currentLoad < 2) {
        const hasExistingTask = Array.from(this.tasks.values()).some(
          t => t.status !== "COMPLETE" && t.task instanceof HarvestAction && t.task.getTargetId() === source.id
        );

        if (!hasExistingTask) {
          const task = new HarvestAction(source.id);
          const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.NORMAL);
          this.tasks.set(request.id, request);
        }
      }
    }
  }

  public executeTasks(creeps: Creep[], cpuLimit: number): Record<string, number> {
    // Update tracker at start of execution
    this.targetTracker.update(creeps, this.tasks);

    // ... existing execution logic
  }
}
```

### Example 2: Task Chaining for Complex Behaviors

```typescript
// Before: Role-based logic with state machine
class RoleHarvester {
  run(creep: Creep) {
    if (creep.memory.state === "harvest" && creep.store.getFreeCapacity() === 0) {
      creep.memory.state = "deliver";
    } else if (creep.memory.state === "deliver" && creep.store.getUsedCapacity() === 0) {
      creep.memory.state = "harvest";
    }

    if (creep.memory.state === "harvest") {
      // ... harvest logic
    } else if (creep.memory.state === "deliver") {
      // ... deliver logic
    }
  }
}

// After: Task chaining
class TaskManager {
  public assignHarvesterTask(creep: Creep, source: Source, spawn: StructureSpawn): void {
    // Create task chain: harvest -> transfer -> repeat
    const harvestTask = new TaskRequest(this.getNextTaskId(), new HarvestAction(source.id), TaskPriority.NORMAL);

    const transferTask = new TaskRequest(
      this.getNextTaskId(),
      new TransferAction(spawn.id, RESOURCE_ENERGY, undefined, { nextPos: source.pos }),
      TaskPriority.NORMAL
    );

    // Chain: harvest -> transfer
    const chainedTask = harvestTask.chain(transferTask);

    // Assign chained task
    if (chainedTask.assign(creep)) {
      creep.memory.taskId = chainedTask.id;
      this.tasks.set(chainedTask.id, chainedTask);
    }
  }
}
```

### Example 3: Settings & Options Pattern

```typescript
// Flexible task configuration
export class TaskManager {
  public assignRemoteMiningTask(creep: Creep, source: Source, storage: StructureStorage): void {
    const harvestTask = new TaskRequest(
      this.getNextTaskId(),
      new HarvestAction(source.id, {
        blind: true, // Allow harvesting even if room not visible
        moveOptions: {
          reusePath: 15, // Longer path reuse for remote mining
          ignoreRoads: false
        }
      }),
      TaskPriority.HIGH
    );

    const transferTask = new TaskRequest(
      this.getNextTaskId(),
      new TransferAction(storage.id, RESOURCE_ENERGY, undefined, {
        moveOptions: {
          reusePath: 20 // Even longer for return trip
        },
        nextPos: source.pos // Return to source after delivery
      }),
      TaskPriority.HIGH
    );

    const chainedTask = TaskChain.chain([harvestTask, transferTask]);

    if (chainedTask && chainedTask.assign(creep)) {
      creep.memory.taskId = chainedTask.id;
      this.tasks.set(chainedTask.id, chainedTask);
    }
  }
}
```

## Performance Considerations

### Memory Overhead

**creep-tasks:**

- Stores full task state in creep memory
- ~150-200 bytes per task
- Includes target position, options, parent chain
- **Total for 50 creeps:** ~7.5-10 KB

**.screeps-gpt Current:**

- Stores only task ID in creep memory
- ~10 bytes per creep
- Task objects stored in heap
- **Total for 50 creeps:** ~500 bytes

**Recommended Approach:**

- Keep heap storage for primary tasks
- Optional: Persist only long-running remote tasks in memory
- Use target position caching for vision loss scenarios

### CPU Overhead

**creep-tasks:**

- Task deserialization each tick: ~0.01 CPU per creep
- Target cache build: ~0.1 CPU per tick (all creeps)
- Validation checks: ~0.02 CPU per task
- **Total for 50 creeps:** ~0.6-0.8 CPU per tick

**.screeps-gpt Current:**

- Map lookup: ~0.001 CPU per creep
- Task execution: ~0.02 CPU per task
- **Total for 50 creeps:** ~0.05-0.1 CPU per tick

**Target Tracker Addition:**

- Cache build: ~0.05 CPU per tick
- Lookups: ~0.001 CPU per query
- **Impact:** +5-10% CPU overhead, acceptable for load balancing benefits

**Task Chaining Addition:**

- Parent transition: ~0.001 CPU per completion
- Chain initialization: ~0.01 CPU per chain
- **Impact:** Negligible (+1-2% CPU)

## Related Issues & References

### Related .screeps-gpt Issues

- **#478** - Task management system evaluation (current task system)
- **#567** - Task prerequisite enhancements (validation patterns)
- **#617** - Overmind architecture research (parent bot using creep-tasks)
- **#624** - overmind-rl research (reinforcement learning integration)
- **#626** - screeps-packrat research (memory compression)

### Cross-Reference with Overmind Analysis

From `overmind-analysis.md`:

> **Task Assignment & Persistence Pattern:**
> Tasks are transferable, persistent objects assigned to creeps. Decouples task assignment from execution. Validity checking (isValidTask, isValidTarget) each tick. Parent task chaining for complex multi-step operations. Tasks persist between ticks, reducing recalculation overhead.

**Alignment:** creep-tasks implements the task system described in Overmind analysis. The patterns are proven in production Overmind bot.

**Integration Value:** Adopting creep-tasks patterns brings .screeps-gpt closer to Overmind's proven architecture while maintaining our distinct design philosophy.

### External Resources

- **GitHub Repository:** https://github.com/bencbartlett/creep-tasks
- **Wiki/Documentation:** https://github.com/bencbartlett/creep-tasks/wiki
- **Overmind Usage Examples:** https://github.com/bencbartlett/Overmind/tree/master/src/overlords/core
- **NPM Package:** https://www.npmjs.com/package/creep-tasks

## Decision & Recommendation

### Decision: **ADOPT KEY PATTERNS** (Partial Integration)

After comprehensive analysis, we recommend **selective pattern adoption** rather than full library integration.

### Rationale

**Adopt:**

1. **Target tracking** - High value for load balancing, low implementation cost
2. **Task chaining** - Simplifies complex behaviors, proven pattern from Overmind
3. **Settings/options** - Improves configuration consistency and flexibility
4. **Dual validation** - Clearer separation of concerns

**Do Not Adopt:**

1. **Prototype-based API** - Conflicts with TypeScript-first architecture
2. **Full memory serialization** - Current heap storage more memory-efficient
3. **Complete library dependency** - Unnecessary overhead, prefer adapted patterns

### Implementation Strategy

1. **Sprint 1:** Implement target tracking system (TargetTracker class)
2. **Sprint 1-2:** Add task chaining support (parent field, TaskChain utility)
3. **Sprint 2:** Refactor to settings/options pattern
4. **Sprint 3:** Add dual validation (isValidTarget method)
5. **Sprint 4+:** Optional task persistence for remote mining

### Success Metrics

- **Target Distribution:** Sources should have <= 2 creeps per source
- **Task Complexity:** Role logic should decrease by 30-40% with chaining
- **CPU Overhead:** Target tracking should add < 10% CPU overhead
- **Code Maintainability:** Task configuration should be centralized in settings

### Next Steps

1. Create implementation issues for each phase
2. Link to related issues (#478, #567, #617)
3. Update TASKS.md with new roadmap items
4. Begin Phase 1 implementation (target tracking)

## Conclusion

The creep-tasks library provides valuable, proven patterns from the Overmind ecosystem. While full library adoption is not recommended due to architectural differences, selective pattern integration will significantly enhance .screeps-gpt's task management capabilities. The proposed roadmap balances value delivery with implementation complexity, prioritizing high-impact patterns (target tracking, task chaining) while deferring or rejecting patterns that conflict with our architecture (prototype API, full memory serialization).

This research completes the evaluation requested in issue #XXX and provides a clear path forward for task system enhancement.
