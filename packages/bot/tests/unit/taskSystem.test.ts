import { describe, it, expect, beforeEach } from "vitest";
import {
  TaskRequest,
  TaskPriority,
  HarvestAction,
  BuildAction,
  MinionCanWork,
  MinionHasFreeCapacity,
  MinionHasEnergy
} from "@runtime/tasks";

// Mock Game object
global.Game = {
  time: 1000
} as unknown as Game;

describe("TaskRequest", () => {
  let mockCreep: Creep;

  beforeEach(() => {
    mockCreep = {
      id: "creep1" as Id<Creep>,
      name: "TestCreep",
      body: [
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ],
      store: {
        getUsedCapacity: (resource?: ResourceConstant) => (resource === RESOURCE_ENERGY ? 50 : 0),
        getFreeCapacity: () => 0
      },
      pos: {
        getRangeTo: () => 5
      }
    } as unknown as Creep;
  });

  it("should create a task request with correct properties", () => {
    const action = new HarvestAction("source1" as Id<Source>);
    const task = new TaskRequest("task1", action, TaskPriority.HIGH);

    expect(task.id).toBe("task1");
    expect(task.task).toBe(action);
    expect(task.status).toBe("PENDING");
    expect(task.priority).toBe(TaskPriority.HIGH);
    expect(task.assignedCreep).toBeUndefined();
  });

  it("should assign task to creep when prerequisites are met", () => {
    const action = new HarvestAction("source1" as Id<Source>);
    const task = new TaskRequest("task1", action, TaskPriority.HIGH);

    // Creep has WORK and free capacity (though getFreeCapacity returns 0, we need to fix the mock)
    mockCreep.store.getFreeCapacity = () => 50;

    const success = task.assign(mockCreep);
    expect(success).toBe(true);
    expect(task.status).toBe("INPROCESS");
    expect(task.assignedCreep).toBe(mockCreep.id);
  });

  it("should not assign task when prerequisites are not met", () => {
    const action = new BuildAction("site1" as Id<ConstructionSite>);
    const task = new TaskRequest("task1", action, TaskPriority.HIGH);

    // Creep has no energy
    mockCreep.store.getUsedCapacity = () => 0;

    const success = task.assign(mockCreep);
    expect(success).toBe(false);
    expect(task.status).toBe("PENDING");
    expect(task.assignedCreep).toBeUndefined();
  });

  it("should check if task can be assigned to creep", () => {
    const action = new HarvestAction("source1" as Id<Source>);
    const task = new TaskRequest("task1", action, TaskPriority.HIGH);

    mockCreep.store.getFreeCapacity = () => 50;

    expect(task.canAssign(mockCreep)).toBe(true);
  });

  it("should detect expired tasks", () => {
    (global.Game as { time: number }).time = 100;

    const action = new HarvestAction("source1" as Id<Source>);
    const task = new TaskRequest("task1", action, TaskPriority.HIGH, 50); // Deadline in the past

    expect(task.isExpired()).toBe(true);
  });

  it("should not expire tasks without deadline", () => {
    (global.Game as { time: number }).time = 100;

    const action = new HarvestAction("source1" as Id<Source>);
    const task = new TaskRequest("task1", action, TaskPriority.HIGH);

    expect(task.isExpired()).toBe(false);
  });
});

describe("Task Prerequisites", () => {
  let mockCreep: Creep;

  beforeEach(() => {
    mockCreep = {
      body: [
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ],
      store: {
        getUsedCapacity: (resource?: ResourceConstant) => (resource === RESOURCE_ENERGY ? 50 : 0),
        getFreeCapacity: () => 50
      }
    } as unknown as Creep;
  });

  it("should validate MinionCanWork prerequisite", () => {
    const prereq = new MinionCanWork();
    expect(prereq.meets(mockCreep)).toBe(true);

    const creepWithoutWork = {
      ...mockCreep,
      body: [{ type: MOVE, hits: 100 }]
    } as unknown as Creep;
    expect(prereq.meets(creepWithoutWork)).toBe(false);
  });

  it("should validate MinionHasEnergy prerequisite", () => {
    const prereq = new MinionHasEnergy(30);
    expect(prereq.meets(mockCreep)).toBe(true);

    const prereqHigh = new MinionHasEnergy(100);
    expect(prereqHigh.meets(mockCreep)).toBe(false);
  });
});

describe("Task Actions", () => {
  it("should create HarvestAction with correct prerequisites", () => {
    const action = new HarvestAction("source1" as Id<Source>);
    expect(action.prereqs).toHaveLength(2);
    expect(action.prereqs[0]).toBeInstanceOf(MinionHasFreeCapacity);
  });

  it("should create BuildAction with correct prerequisites", () => {
    const action = new BuildAction("site1" as Id<ConstructionSite>);
    expect(action.prereqs).toHaveLength(2);
    expect(action.prereqs[0]).toBeInstanceOf(MinionHasEnergy);
  });
});
